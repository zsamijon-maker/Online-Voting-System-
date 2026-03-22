-- ============================================================
-- Sync auth.users -> public.users
-- Creates a trigger that inserts a profile row into public.users
-- whenever a new authentication user is created in auth.users.
-- Also includes a backfill for existing users missing profiles.
-- Run this in your Supabase project's SQL editor.
-- ============================================================

-- 1) Create trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Basic safety: if NEW is null do nothing
  IF NEW IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insert a minimal profile for the new auth user. If a profile
  -- already exists, update the email and updated_at timestamp.
  INSERT INTO public.users (
    id, email, first_name, last_name, roles, is_active, email_verified, last_login, created_at, updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    '',
    '',
    ARRAY['voter'],
    TRUE,
    (CASE WHEN (NEW.confirmed_at IS NOT NULL) THEN TRUE ELSE FALSE END),
    NULL,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- 2) Create trigger on auth.users (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'auth_user_created_to_public_users'
  ) THEN
    CREATE TRIGGER auth_user_created_to_public_users
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_auth_user_created();
  END IF;
END;
$$;

-- 3) Backfill existing auth.users that do not have a public.users row
-- Run this once to populate missing profiles. Skip if you don't need it.

INSERT INTO public.users (id, email, first_name, last_name, roles, is_active, email_verified, last_login, created_at, updated_at)
SELECT
  au.id,
  au.email,
  '',
  '',
  ARRAY['voter'],
  TRUE,
  (CASE WHEN (au.confirmed_at IS NOT NULL) THEN TRUE ELSE FALSE END),
  NULL,
  NOW(),
  NOW()
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL;

-- 4) Optional: verify inserted rows (simple query to run manually)
-- SELECT id, email, created_at FROM public.users ORDER BY created_at DESC LIMIT 20;

-- NOTE:
-- • If your project's auth.users schema differs (column names) adjust the
--   references to NEW.confirmed_at / au.confirmed_at accordingly.
-- • Always run this in Supabase SQL Editor as a logged-in project admin.
-- • If you use Supabase Auth with external providers (Google/Github), the
--   same trigger will create profiles for those users as well.
-- ============================================================
