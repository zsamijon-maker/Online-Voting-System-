-- Check if your staff account exists in both auth.users and users table
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/bvjdpbqrudlaugkxpzvs/sql/new

-- STEP 1: Check auth.users (Supabase Auth)
-- Replace 'your-email@example.com' with your actual email
SELECT 
  au.id as auth_user_id,
  au.email,
  au.created_at as auth_created
FROM auth.users au
WHERE au.email = 'your-email@example.com';  -- ⚠️ REPLACE THIS

-- STEP 2: Check users table (your app's user profiles)
SELECT 
  u.id as user_id,
  u.email,
  u.first_name,
  u.last_name,
  u.roles,
  u.created_at
FROM users u
WHERE u.email = 'your-email@example.com';  -- ⚠️ REPLACE THIS

-- STEP 3: Check if UUIDs match between both tables
SELECT 
  au.id as auth_user_id,
  u.id as users_table_id,
  CASE 
    WHEN au.id = u.id THEN '✓ UUIDs MATCH - Account is correct'
    WHEN u.id IS NULL THEN '✗ User missing from users table - Run the INSERT statement'
    ELSE '✗ UUID MISMATCH - Delete and recreate'
  END as status,
  au.email,
  u.roles
FROM auth.users au
LEFT JOIN users u ON au.id = u.id
WHERE au.email = 'your-email@example.com';  -- ⚠️ REPLACE THIS
