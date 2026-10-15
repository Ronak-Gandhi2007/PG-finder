-- =====================================================================
-- Migration: 010_visit_completion_and_review_gate.sql
-- Description: Allow property owners to mark Confirmed visits as Completed
--              on or after the scheduled visit date (Asia/Kolkata), and gate
--              review creation behind completed visits for students.
-- =====================================================================

-- 1. Authoritative booking integrity function (updated owner completion flow)
CREATE OR REPLACE FUNCTION public.enforce_booking_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    actual_owner_id      UUID;
    caller_is_admin       BOOLEAN;
    caller_id             UUID;
    student_full_name     TEXT;
    student_user_email    TEXT;
BEGIN
    caller_id       := auth.uid();
    caller_is_admin := public.is_admin();

    -- ── INSERT path ─────────────────────────────────────────────────────
    IF TG_OP = 'INSERT' THEN

        -- 1. Caller must be the student recorded in the row
        IF caller_id IS NULL OR caller_id <> NEW.student_id THEN
            RAISE EXCEPTION 'Booking security: student_id must equal the authenticated user.'
                USING ERRCODE = '42501';
        END IF;

        -- 2. Resolve the real owner_id from the properties table
        SELECT owner_id INTO actual_owner_id
        FROM public.properties
        WHERE id = NEW.property_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Booking security: referenced property does not exist.'
                USING ERRCODE = 'P0002';
        END IF;

        -- 3. Silently correct or set owner_id from property record
        NEW.owner_id := actual_owner_id;

        -- 4. Student cannot book their own property
        IF NEW.student_id = NEW.owner_id THEN
            RAISE EXCEPTION 'Booking security: you cannot book a visit to your own property.'
                USING ERRCODE = '42501';
        END IF;

        -- 5. New bookings must start in Pending status only (admins exempted)
        IF NEW.status <> 'Pending' THEN
            IF NOT caller_is_admin THEN
                RAISE EXCEPTION 'Booking security: new bookings must have status Pending.'
                    USING ERRCODE = '42501';
            END IF;
        END IF;

        -- 6. visit_date must be today or future
        IF NEW.visit_date < CURRENT_DATE THEN
            RAISE EXCEPTION 'Booking security: visit_date cannot be in the past.'
                USING ERRCODE = '22023';
        END IF;

        -- 7. time_slot must be a recognized value
        IF NEW.time_slot NOT IN (
            'Morning (10 AM - 12 PM)',
            'Afternoon (1 PM - 4 PM)',
            'Evening (5 PM - 7 PM)'
        ) THEN
            RAISE EXCEPTION 'Booking security: unrecognized time_slot value "%" — must be Morning, Afternoon, or Evening.',
                NEW.time_slot
                USING ERRCODE = '22023';
        END IF;

        -- 8. Snapshot student_name and student_email from public.profiles
        SELECT full_name, email INTO student_full_name, student_user_email
        FROM public.profiles
        WHERE id = NEW.student_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Booking security: student profile does not exist.'
                USING ERRCODE = 'P0002';
        END IF;

        NEW.student_name  := COALESCE(student_full_name, '');
        NEW.student_email := student_user_email;

        -- 9. Trim student_phone and validate length if provided
        IF NEW.student_phone IS NOT NULL THEN
            NEW.student_phone := trim(NEW.student_phone);
            IF length(NEW.student_phone) < 7 OR length(NEW.student_phone) > 20 THEN
                RAISE EXCEPTION 'Booking security: student_phone must be between 7 and 20 characters.'
                    USING ERRCODE = '22023';
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    -- ── UPDATE path ─────────────────────────────────────────────────────
    IF TG_OP = 'UPDATE' THEN

        -- Admins may change anything
        IF caller_is_admin THEN
            RETURN NEW;
        END IF;

        -- Immutable columns for non-admins
        IF NEW.student_id   IS DISTINCT FROM OLD.student_id   OR
           NEW.property_id  IS DISTINCT FROM OLD.property_id  OR
           NEW.owner_id     IS DISTINCT FROM OLD.owner_id     OR
           NEW.visit_date   IS DISTINCT FROM OLD.visit_date   OR
           NEW.time_slot    IS DISTINCT FROM OLD.time_slot    OR
           NEW.student_name  IS DISTINCT FROM OLD.student_name  OR
           NEW.student_email IS DISTINCT FROM OLD.student_email OR
           NEW.student_phone IS DISTINCT FROM OLD.student_phone THEN
            RAISE EXCEPTION 'Booking security: booking details (student, property, owner, date, slot, contact info) are immutable after creation.'
                USING ERRCODE = '42501';
        END IF;

        -- ── Owner-permitted transitions ────────────────────────────────
        IF caller_id = OLD.owner_id THEN
            -- Owners may still act on Pending or Rescheduled bookings
            IF OLD.status IN ('Pending', 'Rescheduled') THEN
                IF NEW.status NOT IN ('Confirmed', 'Declined', 'Rescheduled') THEN
                    RAISE EXCEPTION 'Booking security: owner cannot transition booking to status %.',
                        NEW.status USING ERRCODE = '42501';
                END IF;
                RETURN NEW;
            ELSIF OLD.status = 'Confirmed' THEN
                -- Owners may act on Confirmed ONLY to set Completed on/after visit date
                IF NEW.status <> 'Completed' THEN
                    RAISE EXCEPTION 'Booking security: owner can only transition confirmed bookings to Completed (attempted: %).',
                        NEW.status USING ERRCODE = '42501';
                END IF;
                IF OLD.visit_date > (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
                    RAISE EXCEPTION 'Booking security: visit can only be marked completed on or after the scheduled visit date.'
                        USING ERRCODE = '42501';
                END IF;
                RETURN NEW;
            ELSE
                RAISE EXCEPTION 'Booking security: owner can only act on Pending, Rescheduled, or Confirmed bookings (current: %).',
                    OLD.status USING ERRCODE = '42501';
            END IF;
        END IF;

        -- ── Student-permitted transitions ──────────────────────────────
        IF caller_id = OLD.student_id THEN
            -- Students may only cancel their own bookings
            IF NEW.status <> 'Cancelled' THEN
                RAISE EXCEPTION 'Booking security: students may only cancel their own bookings (attempted: %).',
                    NEW.status USING ERRCODE = '42501';
            END IF;
            -- Students can only cancel from Pending or Confirmed
            IF OLD.status NOT IN ('Pending', 'Confirmed') THEN
                RAISE EXCEPTION 'Booking security: cannot cancel a booking with status %.',
                    OLD.status USING ERRCODE = '42501';
            END IF;
            RETURN NEW;
        END IF;

        -- Neither admin, owner, nor student — reject
        RAISE EXCEPTION 'Booking security: you do not have permission to modify this booking.'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_integrity_insert ON public.bookings_visits;
CREATE TRIGGER trg_booking_integrity_insert
    BEFORE INSERT ON public.bookings_visits
    FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_integrity();

DROP TRIGGER IF EXISTS trg_booking_integrity_update ON public.bookings_visits;
CREATE TRIGGER trg_booking_integrity_update
    BEFORE UPDATE ON public.bookings_visits
    FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_integrity();


-- 2. Authoritative review integrity function (gated review creation)
CREATE OR REPLACE FUNCTION public.enforce_review_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    has_completed_visit BOOLEAN;
    caller_is_admin     BOOLEAN;
BEGIN
    caller_is_admin := public.is_admin();

    -- ── INSERT ───────────────────────────────────────────────────────────
    IF TG_OP = 'INSERT' THEN

        -- Caller must be the student recorded in the row
        IF auth.uid() IS NULL OR auth.uid() <> NEW.student_id THEN
            RAISE EXCEPTION 'Review security: student_id must equal the authenticated user.'
                USING ERRCODE = '42501';
        END IF;

        -- A student may not review their own property
        IF EXISTS (
            SELECT 1 FROM public.properties p
            WHERE p.id = NEW.property_id
              AND p.owner_id = NEW.student_id
        ) THEN
            RAISE EXCEPTION 'Review security: you cannot review your own property.'
                USING ERRCODE = '42501';
        END IF;

        -- Require completed visit for non-admin callers; set is_verified_resident
        IF NOT caller_is_admin THEN
            SELECT EXISTS (
                SELECT 1 FROM public.bookings_visits bv
                WHERE bv.property_id = NEW.property_id
                  AND bv.student_id  = NEW.student_id
                  AND bv.status      = 'Completed'
            ) INTO has_completed_visit;

            IF NOT has_completed_visit THEN
                RAISE EXCEPTION 'You can review a PG only after a completed visit.'
                    USING ERRCODE = '42501';
            END IF;

            NEW.is_verified_resident := true;
        ELSE
            SELECT EXISTS (
                SELECT 1 FROM public.bookings_visits bv
                WHERE bv.property_id = NEW.property_id
                  AND bv.student_id  = NEW.student_id
                  AND bv.status      = 'Completed'
            ) INTO has_completed_visit;

            NEW.is_verified_resident := has_completed_visit;
        END IF;

        RETURN NEW;
    END IF;

    -- ── UPDATE ───────────────────────────────────────────────────────────
    IF TG_OP = 'UPDATE' THEN

        -- Admins can update freely
        IF caller_is_admin THEN
            RETURN NEW;
        END IF;

        -- Students can update their own review content (rating, comment)
        IF auth.uid() = OLD.student_id THEN
            -- Re-compute is_verified_resident on edit — do not trust client
            SELECT EXISTS (
                SELECT 1 FROM public.bookings_visits bv
                WHERE bv.property_id = NEW.property_id
                  AND bv.student_id  = NEW.student_id
                  AND bv.status      = 'Completed'
            ) INTO has_completed_visit;

            NEW.is_verified_resident := has_completed_visit;

            -- Students cannot reassign review to a different property or student
            IF NEW.property_id <> OLD.property_id OR NEW.student_id <> OLD.student_id THEN
                RAISE EXCEPTION 'Review security: property_id and student_id are immutable.'
                    USING ERRCODE = '42501';
            END IF;

            RETURN NEW;
        END IF;

        RAISE EXCEPTION 'Review security: you do not have permission to modify this review.'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_review_integrity_insert ON public.reviews;
CREATE TRIGGER trg_review_integrity_insert
    BEFORE INSERT ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION public.enforce_review_integrity();

DROP TRIGGER IF EXISTS trg_review_integrity_update ON public.reviews;
CREATE TRIGGER trg_review_integrity_update
    BEFORE UPDATE ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION public.enforce_review_integrity();
