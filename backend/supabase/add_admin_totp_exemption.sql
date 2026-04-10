-- ============================================
-- MIGRATION: Add admin TOTP exemption flag
-- Allows explicitly approved admin accounts to bypass TOTP login
-- Run this in your Supabase SQL Editor
-- ============================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS totp_exempt BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.users.totp_exempt IS
  'When true and user has admin role, backend login may bypass TOTP challenge.';
