-- ============================================================
-- SUPABASE STORAGE POLICIES
-- Secure School Voting System
-- ============================================================
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/bvjdpbqrudlaugkxpzvs/sql/new
--
-- Bucket layout
-- ─────────────────────────────────────────────────────────────
--  candidate-photos/   → election candidate profile photos
--  contestant-photos/  → pageant contestant profile photos
--  uploads/            → general user-uploaded assets
--
-- Path convention inside every bucket:
--   {auth.uid()}/{filename}
--   e.g.  a1b2c3.../avatar.png
--
-- Key security rules
-- ─────────────────────────────────────────────────────────────
--  SELECT  : a user can read any file whose `owner` matches their
--            uid  OR  whose first path segment matches their uid.
--            Admins / committee / judges can read all files in
--            relevant buckets (they need to see photos on dashboards).
--  INSERT  : authenticated users may only upload into their own
--            uid-prefixed folder.
--  UPDATE  : only the file owner may overwrite / rename their file.
--  DELETE  : only the file owner may delete their file.
--            Admins may delete any file in any bucket.
-- ============================================================


-- ============================================================
-- 1. CREATE BUCKETS (idempotent)
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'candidate-photos',
    'candidate-photos',
    false,                          -- NOT public; access via signed URLs only
    5242880,                        -- 5 MB max per file
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'contestant-photos',
    'contestant-photos',
    false,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'uploads',
    'uploads',
    false,
    10485760,                       -- 10 MB max per file
    NULL                            -- any mime type allowed in the general bucket
  )
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 2.  HELPER: isSafeRedirectUrl
-- We re-use Postgres helper to extract the first path segment
-- (the owner's uid) from the object name.
-- storage.foldername(name) returns TEXT[], index [1] is the
-- first directory segment.
-- ============================================================


-- ============================================================
-- 3.  POLICIES – candidate-photos
-- ============================================================

-- ── SELECT ──────────────────────────────────────────────────
-- Voters, judges, committee members, and admins all need to see
-- candidate photos.  Any authenticated user may read.
DROP POLICY IF EXISTS "candidate-photos: authenticated users can view" ON storage.objects;
CREATE POLICY "candidate-photos: authenticated users can view"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'candidate-photos'
  AND auth.role() = 'authenticated'
);

-- ── INSERT ──────────────────────────────────────────────────
-- A user may only upload into their own uid-prefixed folder.
DROP POLICY IF EXISTS "candidate-photos: owner can upload" ON storage.objects;
CREATE POLICY "candidate-photos: owner can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'candidate-photos'
  AND auth.role() = 'authenticated'
  -- First path segment must equal the uploader's uid.
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ── UPDATE ──────────────────────────────────────────────────
-- Only the file owner may overwrite or rename their file.
DROP POLICY IF EXISTS "candidate-photos: owner can update" ON storage.objects;
CREATE POLICY "candidate-photos: owner can update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'candidate-photos'
  AND auth.role() = 'authenticated'
  AND (
    owner = auth.uid()
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- ── DELETE ──────────────────────────────────────────────────
-- Owner can delete their own file; admins can delete any file.
DROP POLICY IF EXISTS "candidate-photos: owner or admin can delete" ON storage.objects;
CREATE POLICY "candidate-photos: owner or admin can delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'candidate-photos'
  AND auth.role() = 'authenticated'
  AND (
    owner = auth.uid()
    OR (storage.foldername(name))[1] = auth.uid()::text
    -- Admin bypass: check roles array in the users table.
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND 'admin' = ANY(roles)
        AND is_active = true
    )
  )
);


-- ============================================================
-- 4.  POLICIES – contestant-photos
-- ============================================================

-- ── SELECT ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "contestant-photos: authenticated users can view" ON storage.objects;
CREATE POLICY "contestant-photos: authenticated users can view"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'contestant-photos'
  AND auth.role() = 'authenticated'
);

-- ── INSERT ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "contestant-photos: owner can upload" ON storage.objects;
CREATE POLICY "contestant-photos: owner can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'contestant-photos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ── UPDATE ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "contestant-photos: owner can update" ON storage.objects;
CREATE POLICY "contestant-photos: owner can update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'contestant-photos'
  AND auth.role() = 'authenticated'
  AND (
    owner = auth.uid()
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- ── DELETE ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "contestant-photos: owner or admin can delete" ON storage.objects;
CREATE POLICY "contestant-photos: owner or admin can delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'contestant-photos'
  AND auth.role() = 'authenticated'
  AND (
    owner = auth.uid()
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND 'admin' = ANY(roles)
        AND is_active = true
    )
  )
);


-- ============================================================
-- 5.  POLICIES – uploads (general bucket)
-- ============================================================

-- ── SELECT ──────────────────────────────────────────────────
-- In the general uploads bucket a user may only read files they
-- own.  Admins can read everything.
DROP POLICY IF EXISTS "uploads: owner can view own files" ON storage.objects;
CREATE POLICY "uploads: owner can view own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'uploads'
  AND auth.role() = 'authenticated'
  AND (
    owner = auth.uid()
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND 'admin' = ANY(roles)
        AND is_active = true
    )
  )
);

-- ── INSERT ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "uploads: owner can upload" ON storage.objects;
CREATE POLICY "uploads: owner can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'uploads'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ── UPDATE ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "uploads: owner can update" ON storage.objects;
CREATE POLICY "uploads: owner can update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'uploads'
  AND auth.role() = 'authenticated'
  AND (
    owner = auth.uid()
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- ── DELETE ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "uploads: owner or admin can delete" ON storage.objects;
CREATE POLICY "uploads: owner or admin can delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'uploads'
  AND auth.role() = 'authenticated'
  AND (
    owner = auth.uid()
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND 'admin' = ANY(roles)
        AND is_active = true
    )
  )
);


-- ============================================================
-- 6.  VERIFY
-- ============================================================
-- Run the queries below after applying this file to confirm
-- everything is in place.

-- Check buckets:
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id IN ('candidate-photos', 'contestant-photos', 'uploads')
ORDER BY id;

-- Check storage policies:
SELECT
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename  = 'objects'
ORDER BY policyname;
