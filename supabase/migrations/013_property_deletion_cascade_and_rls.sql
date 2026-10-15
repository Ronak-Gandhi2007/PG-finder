-- =====================================================================
-- Migration: 013_property_deletion_cascade_and_rls.sql
-- Description: Enforce ON DELETE CASCADE across all tables referencing
--              properties(id), strengthen properties DELETE RLS policy,
--              enable owner notification dispatch for tour cancellations,
--              and optimize storage deletion policies.
-- =====================================================================

-- 1. Verify and enforce ON DELETE CASCADE on all foreign keys referencing properties
-- Checked tables:
--   - rooms(property_id) -> public.properties(id) ON DELETE CASCADE
--   - property_amenities(property_id) -> public.properties(id) ON DELETE CASCADE
--   - property_images(property_id) -> public.properties(id) ON DELETE CASCADE
--   - bookings_visits(property_id) -> public.properties(id) ON DELETE CASCADE
--   - shortlists(property_id) -> public.properties(id) ON DELETE CASCADE
--   - reviews(property_id) -> public.properties(id) ON DELETE CASCADE
--   - owner_tour_availability(property_id) -> public.properties(id) ON DELETE CASCADE
--   - verification_documents(property_id) -> public.properties(id) ON DELETE CASCADE
-- Note: public.notifications references public.profiles(id) via user_id
--       and does not contain a property_id foreign key column.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT
            tc.table_schema,
            tc.table_name,
            tc.constraint_name,
            kcu.column_name,
            rc.delete_rule
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.referential_constraints rc
            ON tc.constraint_name = rc.constraint_name
        JOIN information_schema.constraint_column_usage ccu
            ON rc.unique_constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'properties'
          AND ccu.table_schema = 'public'
          AND tc.table_schema = 'public'
    LOOP
        IF r.delete_rule <> 'CASCADE' THEN
            RAISE NOTICE 'Updating foreign key % on %.% to ON DELETE CASCADE (current rule: %)',
                r.constraint_name, r.table_schema, r.table_name, r.delete_rule;
            EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', r.table_schema, r.table_name, r.constraint_name);
            EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.properties(id) ON DELETE CASCADE',
                r.table_schema, r.table_name, r.constraint_name, r.column_name);
        ELSE
            RAISE NOTICE 'Foreign key % on %.% already enforces ON DELETE CASCADE',
                r.constraint_name, r.table_schema, r.table_name;
        END IF;
    END LOOP;
END $$;

-- 2. Explicitly re-assert and verify RLS DELETE policy on public.properties
-- Only the property's owner (auth.uid() = owner_id) or an administrator (public.is_admin())
-- can delete the property row. All other roles (students, other owners, anonymous) are rejected.
DROP POLICY IF EXISTS "Owners and Admins can delete their properties" ON public.properties;

CREATE POLICY "Owners and Admins can delete their properties" 
    ON public.properties
    FOR DELETE 
    TO authenticated
    USING (
        auth.uid() = owner_id 
        OR public.is_admin()
    );

-- 3. Notification dispatch RLS policy:
-- Allow property owners to insert notifications for students who have booked a tour on their properties
-- (e.g. notifying student participants when a property listing and their scheduled tour are cancelled).
DROP POLICY IF EXISTS "Property owners can notify students with bookings" ON public.notifications;

CREATE POLICY "Property owners can notify students with bookings"
    ON public.notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.bookings_visits bv
            WHERE bv.student_id = notifications.user_id
              AND bv.owner_id = auth.uid()
        )
    );

-- 4. SECURITY DEFINER function to reliably notify all students with pending/confirmed tours
CREATE OR REPLACE FUNCTION public.notify_tour_students_property_deleted(p_property_id UUID, p_property_title TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_is_owner BOOLEAN := FALSE;
    v_is_admin BOOLEAN := FALSE;
    v_notified_count INTEGER := 0;
    v_booking RECORD;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;

    -- Verify caller owns the property or is an administrator
    SELECT EXISTS (
        SELECT 1 FROM public.properties
        WHERE id = p_property_id AND owner_id = v_caller_id
    ) INTO v_is_owner;

    v_is_admin := public.is_admin();

    IF NOT v_is_owner AND NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: only the property owner or an administrator can dispatch cancellation notifications.'
            USING ERRCODE = '42501';
    END IF;

    -- Notify all students with Pending or Confirmed tours for this property
    FOR v_booking IN
        SELECT DISTINCT student_id, visit_date, time_slot
        FROM public.bookings_visits
        WHERE property_id = p_property_id
          AND status IN ('Pending', 'Confirmed')
    LOOP
        INSERT INTO public.notifications (user_id, title, message, type, link_url)
        VALUES (
            v_booking.student_id,
            'Tour Cancelled: Property Removed',
            'The property "' || COALESCE(p_property_title, 'Property') || '" has been removed by the owner. Your scheduled tour for ' || v_booking.visit_date || ' (' || v_booking.time_slot || ') has been cancelled.',
            'booking_declined',
            '/dashboard/student'
        );
        v_notified_count := v_notified_count + 1;
    END LOOP;

    RETURN v_notified_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_tour_students_property_deleted(UUID, TEXT) TO authenticated;

-- 5. Storage DELETE policy update for property-images
-- Enables owners to clean up storage objects even after the property record has been removed
DROP POLICY IF EXISTS "Property owners and admins can delete property images" ON storage.objects;

CREATE POLICY "Property owners and admins can delete property images"
    ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'property-images'
        AND (
            owner = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.properties p
                WHERE p.id::text = (storage.foldername(name))[1]
                  AND p.owner_id = auth.uid()
            )
            OR public.is_admin()
        )
    );

-- 6. Guard review rating trigger against cascade deletion race
-- When a property is deleted, cascade delete of reviews should not attempt to UPDATE the deleting property.
CREATE OR REPLACE FUNCTION public.update_property_rating_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_property_id UUID;
    avg_rating NUMERIC(2, 1);
    total_reviews INTEGER;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_property_id := OLD.property_id;
    ELSE
        target_property_id := NEW.property_id;
    END IF;

    -- If the property row itself is already deleted or absent, skip aggregate update
    IF NOT EXISTS (SELECT 1 FROM public.properties WHERE id = target_property_id) THEN
        RETURN NULL;
    END IF;

    -- Calculate aggregate stats
    SELECT 
        COALESCE(ROUND(AVG(rating)::numeric, 1), 0.0),
        COUNT(id)
    INTO 
        avg_rating,
        total_reviews
    FROM public.reviews
    WHERE property_id = target_property_id;

    -- Update property record
    UPDATE public.properties
    SET 
        rating = avg_rating,
        reviews_count = total_reviews,
        updated_at = timezone('utc'::text, now())
    WHERE id = target_property_id;

    RETURN NULL;
END;
$$;
