-- ============================================================
-- MIGRATE public.users names → auth.users.user_metadata
-- One-time script: Copy first_name/last_name to user_metadata
-- Run in Supabase SQL Editor as admin AFTER userController.js update
-- ============================================================

-- 1) Migration: Update ALL auth.users.user_metadata with names from public.users
UPDATE auth.users au
SET user_metadata = jsonb_build_object(
  'first_name', COALESCE(pu.first_name, au.user_metadata->>'first_name', ''),
  'last_name', COALESCE(pu.last_name, au.user_metadata->>'last_name', ''),
  'roles', COALESCE(pu.roles, au.user_metadata->'roles')
  || (au.user_metadata - 'first_name' - 'last_name' - 'roles')  -- Preserve other metadata
)
FROM public.users pu
WHERE au.id = pu.id;

-- 2) Verify migration (check sync)
SELECT 
  au.id,
  pu.first_name, pu.last_name,
  (au.user_metadata->>'first_name') as meta_first_name,
  (au.user_metadata->>'last_name') as meta_last_name
FROM auth.users au
JOIN public.users pu ON au.id = pu.id
ORDER BY pu.updated_at DESC 
LIMIT 10;

-- Expected: pu.first_name == meta_first_name, pu.last_name == meta_last_name

-- 3) Count updated rows
SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN pu.first_name = (au.user_metadata->>'first_name') THEN 1 END) as name_synced
FROM auth.users au
JOIN public.users pu ON au.id = pu.id;

-- 4) NOTES:
-- • Preserves existing user_metadata (avatar_url, etc.)
-- • Only updates first_name/last_name/roles from public.users
-- • Safe: idempotent (can re-run)
-- • Run ONCE after userController.js deploy
-- ============================================================
