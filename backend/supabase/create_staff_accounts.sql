-- ============================================
-- MANUAL STAFF ACCOUNT CREATION
-- ============================================
-- Run this in Supabase SQL Editor to create staff accounts
-- Students register through the app; staff accounts are created here

-- Step 1: Create users in Supabase Auth (auth.users)
-- Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/auth/users
-- Click "Add user" → "Create new user"
-- Set email and password for each staff member

-- Step 2: After creating in Auth UI, run these SQL statements
-- to add them to the users table with proper roles

-- ============================================
-- ADMIN ACCOUNT
-- ============================================
-- Replace 'REPLACE_WITH_AUTH_USER_ID' with the actual UUID from auth.users
INSERT INTO users (id, email, first_name, last_name, roles, is_active, email_verified)
VALUES (
  'REPLACE_WITH_AUTH_USER_ID',
  'admin@school.edu',
  'System',
  'Administrator',
  ARRAY['admin'],
  true,
  true
)
ON CONFLICT (id) DO UPDATE SET
  roles = EXCLUDED.roles,
  email = EXCLUDED.email;

-- ============================================
-- ELECTION COMMITTEE ACCOUNT
-- ============================================
INSERT INTO users (id, email, first_name, last_name, roles, is_active, email_verified)
VALUES (
  'REPLACE_WITH_AUTH_USER_ID',
  'election@school.edu',
  'Election',
  'Committee',
  ARRAY['election_committee'],
  true,
  true
)
ON CONFLICT (id) DO UPDATE SET
  roles = EXCLUDED.roles,
  email = EXCLUDED.email;

-- ============================================
-- PAGEANT COMMITTEE ACCOUNT
-- ============================================
INSERT INTO users (id, email, first_name, last_name, roles, is_active, email_verified)
VALUES (
  'REPLACE_WITH_AUTH_USER_ID',
  'pageant@school.edu',
  'Pageant',
  'Committee',
  ARRAY['pageant_committee'],
  true,
  true
)
ON CONFLICT (id) DO UPDATE SET
  roles = EXCLUDED.roles,
  email = EXCLUDED.email;

-- ============================================
-- JUDGE ACCOUNT
-- ============================================
INSERT INTO users (id, email, first_name, last_name, roles, is_active, email_verified)
VALUES (
  'REPLACE_WITH_AUTH_USER_ID',
  'judge1@school.edu',
  'Maria',
  'Santos',
  ARRAY['judge'],
  true,
  true
)
ON CONFLICT (id) DO UPDATE SET
  roles = EXCLUDED.roles,
  email = EXCLUDED.email;


-- ============================================
-- QUICK REFERENCE: Finding Auth User IDs
-- ============================================
-- Run this to see all users from auth.users:
-- SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC;

-- Check what's in your users table:
-- SELECT id, email, first_name, last_name, roles FROM users;
