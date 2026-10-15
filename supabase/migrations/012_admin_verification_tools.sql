-- =====================================================================
-- Migration: 012_admin_verification_tools.sql
-- Description: Add rejection_reason columns to properties and profiles,
--              harden RLS and integrity triggers so only administrators
--              can approve/reject student IDs and property listings.
-- =====================================================================

-- 1. Add rejection_reason columns
ALTER TABLE public.properties 
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS student_id_rejection_reason TEXT;

-- 2. Update enforce_property_integrity() trigger to guard rejection_reason
CREATE OR REPLACE FUNCTION public.enforce_property_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    prop_count INTEGER;
    base_slug  TEXT;
BEGIN
    -- Administrators and internal processes bypass client-facing integrity constraints
    IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
        RETURN NEW;
    END IF;

    -- ── INSERT ────────────────────────────────────────────────────────────
    IF TG_OP = 'INSERT' THEN

        -- 1. owner_id must be the authenticated caller
        IF NEW.owner_id IS NULL OR NEW.owner_id <> auth.uid() THEN
            RAISE EXCEPTION 'Property security: owner_id must equal the authenticated user.'
                USING ERRCODE = '42501';
        END IF;

        -- 2. Limit: max 10 properties per owner
        SELECT COUNT(*) INTO prop_count
        FROM public.properties
        WHERE owner_id = NEW.owner_id;

        IF prop_count >= 10 THEN
            RAISE EXCEPTION 'Property limit reached: you may not own more than 10 properties.'
                USING ERRCODE = '53400';
        END IF;

        -- 3. Force privileged columns to safe defaults
        NEW.is_verified      := FALSE;
        NEW.is_premium       := FALSE;
        NEW.rating           := 0;
        NEW.reviews_count    := 0;
        NEW.rejection_reason := NULL;

        -- 4. Auto-generate slug
        base_slug := trim(both '-' from
            lower(regexp_replace(NEW.title, '[^a-zA-Z0-9]+', '-', 'g'))
        );
        NEW.slug := base_slug || '-' || left(gen_random_uuid()::text, 6);

        RETURN NEW;
    END IF;

    -- ── UPDATE ────────────────────────────────────────────────────────────
    IF TG_OP = 'UPDATE' THEN

        IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
            RAISE EXCEPTION 'Property security: only administrators can modify is_verified.'
                USING ERRCODE = '42501';
        END IF;

        IF NEW.is_premium IS DISTINCT FROM OLD.is_premium THEN
            RAISE EXCEPTION 'Property security: only administrators can modify is_premium.'
                USING ERRCODE = '42501';
        END IF;

        IF NEW.rating IS DISTINCT FROM OLD.rating THEN
            RAISE EXCEPTION 'Property security: only administrators can modify rating.'
                USING ERRCODE = '42501';
        END IF;

        IF NEW.reviews_count IS DISTINCT FROM OLD.reviews_count THEN
            RAISE EXCEPTION 'Property security: only administrators can modify reviews_count.'
                USING ERRCODE = '42501';
        END IF;

        IF NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
            RAISE EXCEPTION 'Property security: only administrators can modify rejection_reason.'
                USING ERRCODE = '42501';
        END IF;

        IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
            RAISE EXCEPTION 'Property security: owner_id is immutable.'
                USING ERRCODE = '42501';
        END IF;

        IF NEW.slug IS DISTINCT FROM OLD.slug THEN
            RAISE EXCEPTION 'Property security: slug is immutable after creation.'
                USING ERRCODE = '42501';
        END IF;

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

-- 3. Update protect_profile_privileged_columns() trigger to guard student_id_rejection_reason
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
        IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
            RAISE EXCEPTION 'Unauthorized column modification: Only administrators can modify is_verified.'
                USING ERRCODE = '42501';
        END IF;

        IF NEW.email IS DISTINCT FROM OLD.email THEN
            RAISE EXCEPTION 'Unauthorized column modification: Only administrators or auth hooks can modify email.'
                USING ERRCODE = '42501';
        END IF;

        -- Non-admins cannot set rejection reasons (they can only clear it when uploading a replacement document)
        IF NEW.student_id_rejection_reason IS NOT NULL AND NEW.student_id_rejection_reason IS DISTINCT FROM OLD.student_id_rejection_reason THEN
            RAISE EXCEPTION 'Unauthorized column modification: Only administrators can assign a rejection reason.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Ensure triggers remain hooked
DROP TRIGGER IF EXISTS trg_property_integrity ON public.properties;
CREATE TRIGGER trg_property_integrity
    BEFORE INSERT OR UPDATE ON public.properties
    FOR EACH ROW EXECUTE FUNCTION public.enforce_property_integrity();

DROP TRIGGER IF EXISTS trg_protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileged_columns
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();
