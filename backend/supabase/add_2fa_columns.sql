-- ============================================
-- MIGRATION: Add 2FA / TOTP columns to users table
-- Run this in your Supabase SQL Editor
-- ============================================

-- Add TOTP secret key column (stores the base32 secret generated per user)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_secret TEXT;

-- Add flag indicating whether the user has completed 2FA setup
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE;
