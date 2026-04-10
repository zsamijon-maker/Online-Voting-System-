-- ============================================
-- SOFT DELETE SUPPORT
-- Add deleted_at columns and update queries for soft delete
-- ============================================

-- Add deleted_at column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add deleted_at column to elections table
ALTER TABLE elections
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add deleted_at column to candidates table
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add deleted_at column to votes table (optional - usually votes are preserved)
ALTER TABLE votes
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add deleted_at column to pageants table
ALTER TABLE pageants
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add deleted_at column to contestants table
ALTER TABLE contestants
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add deleted_at column to criteria table
ALTER TABLE criteria
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add indexes for soft delete queries
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_elections_deleted_at ON elections (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_candidates_deleted_at ON candidates (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pageants_deleted_at ON pageants (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contestants_deleted_at ON contestants (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_criteria_deleted_at ON criteria (deleted_at) WHERE deleted_at IS NULL;

-- Create soft delete functions

-- Users soft delete
CREATE OR REPLACE FUNCTION soft_delete_user(user_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users
  SET deleted_at = NOW()
  WHERE id = user_uuid
  AND deleted_at IS NULL;
END;
$$;

-- Elections soft delete
CREATE OR REPLACE FUNCTION soft_delete_election(election_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE elections
  SET deleted_at = NOW()
  WHERE id = election_uuid
  AND deleted_at IS NULL;
END;
$$;

-- Candidates soft delete
CREATE OR REPLACE FUNCTION soft_delete_candidate(candidate_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE candidates
  SET deleted_at = NOW()
  WHERE id = candidate_uuid
  AND deleted_at IS NULL;
END;
$$;

-- Pageants soft delete
CREATE OR REPLACE FUNCTION soft_delete_pageant(pageant_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE pageants
  SET deleted_at = NOW()
  WHERE id = pageant_uuid
  AND deleted_at IS NULL;
END;
$$;

-- Contestants soft delete
CREATE OR REPLACE FUNCTION soft_delete_contestant(contestant_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE contestants
  SET deleted_at = NOW()
  WHERE id = contestant_uuid
  AND deleted_at IS NULL;
END;
$$;

-- Criteria soft delete
CREATE OR REPLACE FUNCTION soft_delete_criteria(criteria_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE criteria
  SET deleted_at = NOW()
  WHERE id = criteria_uuid
  AND deleted_at IS NULL;
END;
$$;

-- Add trigger function to auto-set deleted_at on hard delete attempts (optional safety net)
CREATE OR REPLACE FUNCTION prevent_hard_delete_users()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE users SET deleted_at = NOW() WHERE id = OLD.id;
    RETURN NULL;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Note: This trigger is disabled by default as it may cause issues with cascade deletes
-- Uncomment if you want to prevent hard deletes entirely
-- DROP TRIGGER IF EXISTS prevent_hard_delete_users_trigger ON users;
-- CREATE TRIGGER prevent_hard_delete_users_trigger
--   BEFORE DELETE ON users
--   FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete_users();