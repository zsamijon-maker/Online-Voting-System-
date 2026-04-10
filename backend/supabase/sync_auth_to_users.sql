-- ============================================================
-- Sync auth.users ↔ public.users (CREATE + UPDATE bi-directional)
-- 1. INSERT on auth.users → CREATE public.users row
-- 2. UPDATE on auth.users → SYNC first_name/last_name/email to public.users
-- Run this in your Supabase project's SQL editor.
-- ============================================================

-- 1) CREATE/UPDATE trigger function (handles both INSERT + UPDATE)
CREATE OR REPLACE FUNCTION public.handle_auth_user_changed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW IS NULL THEN
    RETURN NEW;
  END IF;

  -- UPSERT public.users row: always sync email + basic fields
  INSERT INTO public.users (
    id, email, first_name, last_name, roles, is_active, email_verified, 
    last_login, created_at, updated_at
  ) VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.first_name, ''),
    COALESCE(NEW.last_name, ''),
    COALESCE((NEW.raw_user_meta_data->>'roles')::TEXT[], ARRAY['voter']),
    TRUE,
    (CASE WHEN (NEW.confirmed_at IS NOT NULL) THEN TRUE ELSE FALSE END),
    NULL,
    COALESCE(NEW.created_at, NOW()),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email_verified = EXCLUDED.email_verified,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- 2) CREATE triggers on auth.users (INSERT + UPDATE, idempotent)
DO $$
BEGIN
  -- INSERT trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'auth_user_created_to_public_users'
  ) THEN
    CREATE TRIGGER auth_user_created_to_public_users
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_auth_user_changed();
  END IF;
  
  -- UPDATE trigger (NEW critical fix)
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'auth_user_updated_to_public_users'
  ) THEN
    CREATE TRIGGER auth_user_updated_to_public_users
    AFTER UPDATE ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_auth_user_changed();
  END IF;
END;
$$;

-- 3) Backfill: Sync EXISTING auth.users → public.users
INSERT INTO public.users (id, email, first_name, last_name, roles, is_active, email_verified, last_login, created_at, updated_at)
SELECT
  au.id, au.email, au.first_name, au.last_name, ARRAY['voter'], TRUE,
  (CASE WHEN (au.confirmed_at IS NOT NULL) THEN TRUE ELSE FALSE END), NULL, NOW(), NOW()
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL;

-- 4) CRITICAL: One-time sync for EXISTING public.users with stale names
UPDATE public.users pu
SET 
  first_name = au.first_name,
  last_name = au.last_name,
  email = au.email,
  updated_at = NOW()
FROM auth.users au
WHERE pu.id = au.id 
  AND (pu.first_name != au.first_name OR pu.last_name != au.last_name OR pu.email != au.email);

-- 5) Verify sync (run manually)
-- SELECT pu.id, pu.email, pu.first_name, pu.last_name, au.first_name, au.last_name 
-- FROM public.users pu JOIN auth.users au ON pu.id = au.id 
-- ORDER BY pu.updated_at DESC LIMIT 10;

-- NOTES:
-- • Bi-directional: Backend edits → auth.users → trigger → public.users
-- • Auth changes → trigger → public.users immediately
-- • Gmail OAuth: user_metadata preserved in auth.users
-- • Run as Supabase admin in SQL editor
-- ============================================================
