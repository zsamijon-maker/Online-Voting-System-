-- ============================================
-- MIGRATION: Enforce BISU email for voter accounts
-- Voter records must use @bisu.edu.ph email addresses
-- ============================================

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_voter_bisu_email_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_voter_bisu_email_check
  CHECK (
    NOT ('voter' = ANY(roles))
    OR lower(email) LIKE '%@bisu.edu.ph'
  );

-- Optional pre-check query before running this migration:
-- SELECT id, email, roles
-- FROM public.users
-- WHERE 'voter' = ANY(roles)
--   AND lower(email) NOT LIKE '%@bisu.edu.ph';
