-- ============================================
-- MIGRATION: Add TOTP rebind required flag to users table
-- Enforces TOTP reset after admin email changes for protected roles
-- Run this in your Supabase SQL Editor
-- ============================================

-- Add flag indicating whether user must re-setup TOTP (e.g. after email change)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_rebind_required BOOLEAN NOT NULL DEFAULT FALSE;

