-- ============================================
-- FIX ALL RLS POLICIES FOR SERVICE ROLE
-- ============================================
-- Run this in Supabase SQL Editor
-- https://supabase.com/dashboard/project/bvjdpbqrudlaugkxpzvs/sql/new

-- This script fixes RLS policies to allow the backend service role
-- to perform all operations on all tables

-- ============================================
-- USERS TABLE
-- ============================================
DROP POLICY IF EXISTS "Service role full access users" ON users;
CREATE POLICY "Service role full access users"
ON users FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- ELECTIONS TABLE
-- ============================================
DROP POLICY IF EXISTS "Service role full access elections" ON elections;
CREATE POLICY "Service role full access elections"
ON elections FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- ELECTION_POSITIONS TABLE
-- ============================================
DROP POLICY IF EXISTS "Service role full access election_positions" ON election_positions;
CREATE POLICY "Service role full access election_positions"
ON election_positions FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- CANDIDATES TABLE
-- ============================================
DROP POLICY IF EXISTS "Service role full access candidates" ON candidates;
CREATE POLICY "Service role full access candidates"
ON candidates FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- VOTES TABLE
-- ============================================
DROP POLICY IF EXISTS "Service role full access votes" ON votes;
CREATE POLICY "Service role full access votes"
ON votes FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- PAGEANTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Service role full access pageants" ON pageants;
CREATE POLICY "Service role full access pageants"
ON pageants FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- CONTESTANTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Service role full access contestants" ON contestants;
CREATE POLICY "Service role full access contestants"
ON contestants FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- CRITERIA TABLE
-- ============================================
DROP POLICY IF EXISTS "Service role full access criteria" ON criteria;
CREATE POLICY "Service role full access criteria"
ON criteria FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- PAGEANT_JUDGES TABLE
-- ============================================
DROP POLICY IF EXISTS "Service role full access pageant_judges" ON pageant_judges;
CREATE POLICY "Service role full access pageant_judges"
ON pageant_judges FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- SCORES TABLE
-- ============================================
DROP POLICY IF EXISTS "Service role full access scores" ON scores;
CREATE POLICY "Service role full access scores"
ON scores FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- AUDIT_LOGS TABLE
-- ============================================
DROP POLICY IF EXISTS "Service role full access audit_logs" ON audit_logs;
CREATE POLICY "Service role full access audit_logs"
ON audit_logs FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- VERIFY SETUP
-- ============================================
-- Run this to verify all policies are created:
SELECT 
    schemaname,
    tablename, 
    policyname,
    permissive,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
AND policyname LIKE '%Service role%'
ORDER BY tablename, policyname;

-- You should see "Service role full access" policy for each table

-- ============================================
-- OPTIONAL: Add user-level policies
-- ============================================
-- Uncomment these if you want authenticated users to also have direct access:

-- DROP POLICY IF EXISTS "Authenticated can read elections" ON elections;
-- CREATE POLICY "Authenticated can read elections"
-- ON elections FOR SELECT
-- USING (auth.role() = 'authenticated');

-- DROP POLICY IF EXISTS "Authenticated can read candidates" ON candidates;
-- CREATE POLICY "Authenticated can read candidates"
-- ON candidates FOR SELECT
-- USING (auth.role() = 'authenticated');

-- ============================================
-- AUTHENTICATED ROLE ACCESS (RLS FALLBACK)
-- ============================================
-- These policies allow direct authenticated access for committee/admin users.
-- Useful when a request is executed with authenticated role instead of service_role.

DROP POLICY IF EXISTS "Authenticated can read election positions" ON election_positions;
CREATE POLICY "Authenticated can read election positions"
ON election_positions FOR SELECT
USING (
    auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Committee or admin can manage candidates" ON candidates;
CREATE POLICY "Committee or admin can manage candidates"
ON candidates FOR ALL
USING (
    auth.role() = 'authenticated'
    AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
            AND u.is_active = true
            AND (
                'admin' = ANY(u.roles)
                OR 'election_committee' = ANY(u.roles)
            )
    )
)
WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
            AND u.is_active = true
            AND (
                'admin' = ANY(u.roles)
                OR 'election_committee' = ANY(u.roles)
            )
    )
);

DROP POLICY IF EXISTS "Committee or admin can manage candidate images" ON storage.objects;
CREATE POLICY "Committee or admin can manage candidate images"
ON storage.objects FOR ALL
USING (
    bucket_id = 'candidate-images'
    AND auth.role() = 'authenticated'
    AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
            AND u.is_active = true
            AND (
                'admin' = ANY(u.roles)
                OR 'election_committee' = ANY(u.roles)
            )
    )
)
WITH CHECK (
    bucket_id = 'candidate-images'
    AND auth.role() = 'authenticated'
    AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
            AND u.is_active = true
            AND (
                'admin' = ANY(u.roles)
                OR 'election_committee' = ANY(u.roles)
            )
    )
);
