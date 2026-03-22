-- Fix RLS policies for backend service role access
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/bvjdpbqrudlaugkxpzvs/sql/new

-- Option 1: Add policy for service role (RECOMMENDED)
-- This allows the backend service role to access all user data

-- Drop existing policies if any
DROP POLICY IF EXISTS "Service role can read all users" ON users;
DROP POLICY IF EXISTS "Service role can update all users" ON users;
DROP POLICY IF EXISTS "Service role can insert all users" ON users;

-- Create comprehensive service role policies
CREATE POLICY "Service role can read all users"
ON users FOR SELECT
USING (true);

CREATE POLICY "Service role can update all users"
ON users FOR UPDATE
USING (true);

CREATE POLICY "Service role can insert all users"
ON users FOR INSERT
WITH CHECK (true);

-- Also add user policies for authenticated users to read their own data
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

CREATE POLICY "Users can read own profile"
ON users FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id);

-- Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'users';
