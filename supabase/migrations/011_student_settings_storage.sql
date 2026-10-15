-- =====================================================================
-- Migration: 011_student_settings_storage.sql
-- Description: Provision and ensure RLS policies for student ID documents 
--              (private bucket, owner-only insert/select/update/delete, admin read)
--              and user avatars (public read, owner upload/update/delete).
-- =====================================================================

-- 1. Ensure storage buckets exist with correct public status and size limits
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    (
        'student-id-documents',
        'student-id-documents',
        false, -- Private bucket
        5242880, -- 5 MB
        ARRAY['application/pdf', 'image/jpeg', 'image/png']
    ),
    (
        'user-avatars',
        'user-avatars',
        true, -- Public bucket
        2097152, -- 2 MB
        ARRAY['image/jpeg', 'image/png', 'image/webp']
    )
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Storage RLS Policies: student-id-documents (Private, Owner + Admin Only)
DROP POLICY IF EXISTS "Students and Admins can view student ID documents" ON storage.objects;
CREATE POLICY "Students and Admins can view student ID documents"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'student-id-documents' 
        AND (
            auth.uid()::text = (storage.foldername(name))[1] 
            OR public.is_admin()
        )
    );

DROP POLICY IF EXISTS "Students can upload their student ID document" ON storage.objects;
CREATE POLICY "Students can upload their student ID document"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'student-id-documents' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "Students and Admins can update student ID documents" ON storage.objects;
CREATE POLICY "Students and Admins can update student ID documents"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'student-id-documents' 
        AND (
            auth.uid()::text = (storage.foldername(name))[1] 
            OR public.is_admin()
        )
    );

DROP POLICY IF EXISTS "Students and Admins can delete student ID documents" ON storage.objects;
CREATE POLICY "Students and Admins can delete student ID documents"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'student-id-documents' 
        AND (
            auth.uid()::text = (storage.foldername(name))[1] 
            OR public.is_admin()
        )
    );

-- 3. Storage RLS Policies: user-avatars (Public Read, Owner Upload/Update/Delete)
DROP POLICY IF EXISTS "Public can view user avatars" ON storage.objects;
CREATE POLICY "Public can view user avatars"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'user-avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'user-avatars' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'user-avatars' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'user-avatars' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );
