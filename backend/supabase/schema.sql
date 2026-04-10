-- ============================================
-- SECURE SCHOOL VOTING SYSTEM - SUPABASE SCHEMA
-- Run this in your Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  student_id TEXT UNIQUE,
  roles TEXT[] NOT NULL DEFAULT ARRAY['voter'],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ELECTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS elections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('student_government', 'fstlp_officers', 'class_representative', 'club_officers', 'other')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'upcoming', 'active', 'closed', 'archived')),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  allow_write_ins BOOLEAN NOT NULL DEFAULT FALSE,
  max_votes_per_voter INT NOT NULL DEFAULT 1,
  results_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ELECTION POSITIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS election_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  position_name TEXT NOT NULL,
  max_vote INT NOT NULL CHECK (max_vote >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (election_id, position_name)
);

-- ============================================
-- CANDIDATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  position TEXT NOT NULL,
  display_name TEXT NOT NULL,
  photo_url TEXT,
  bio TEXT,
  platform TEXT,
  is_write_in BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- VOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES users(id),
  candidate_id UUID NOT NULL REFERENCES candidates(id),
  position TEXT NOT NULL,
  vote_hash TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (election_id, voter_id, candidate_id)
);

-- Atomic vote submission RPC to prevent duplicate and position-limit races.
CREATE OR REPLACE FUNCTION public.submit_vote_atomic(
  p_election_id UUID,
  p_voter_id UUID,
  p_candidate_id UUID,
  p_vote_hash TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  error_code TEXT,
  error_message TEXT,
  vote_hash TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidate RECORD;
  v_max_votes INTEGER;
  v_votes_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_election_id::text), hashtext(p_voter_id::text));

  SELECT c.id, c.election_id, c.position, c.position_id
    INTO v_candidate
  FROM candidates c
  WHERE c.id = p_candidate_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'CANDIDATE_NOT_FOUND', 'Candidate not found.', NULL::TEXT;
    RETURN;
  END IF;

  IF v_candidate.election_id <> p_election_id THEN
    RETURN QUERY SELECT FALSE, 'CANDIDATE_ELECTION_MISMATCH', 'Candidate does not belong to this election.', NULL::TEXT;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM votes v
    WHERE v.election_id = p_election_id
      AND v.voter_id = p_voter_id
      AND v.candidate_id = p_candidate_id
  ) THEN
    RETURN QUERY SELECT FALSE, 'DUPLICATE_CANDIDATE', 'You have already voted for this candidate.', NULL::TEXT;
    RETURN;
  END IF;

  IF v_candidate.position_id IS NOT NULL THEN
    SELECT ep.max_vote
      INTO v_max_votes
    FROM election_positions ep
    WHERE ep.id = v_candidate.position_id
      AND ep.election_id = p_election_id;
  END IF;

  IF v_max_votes IS NULL OR v_max_votes < 1 THEN
    v_max_votes := CASE v_candidate.position
      WHEN 'President' THEN 1
      WHEN 'Vice President' THEN 1
      WHEN 'Senators' THEN 12
      WHEN 'Secretary' THEN 1
      WHEN 'Treasurer' THEN 1
      WHEN 'Auditor' THEN 1
      WHEN 'PIO' THEN 2
      WHEN 'Board Members' THEN 6
      ELSE 1
    END;
  END IF;

  SELECT COUNT(*)
    INTO v_votes_count
  FROM votes v
  JOIN candidates c2
    ON c2.id = v.candidate_id
  WHERE v.election_id = p_election_id
    AND v.voter_id = p_voter_id
    AND (
      (v_candidate.position_id IS NOT NULL AND c2.position_id = v_candidate.position_id)
      OR
      (v_candidate.position_id IS NULL AND COALESCE(c2.position, '') = COALESCE(v_candidate.position, ''))
    );

  IF v_votes_count >= v_max_votes THEN
    RETURN QUERY
      SELECT FALSE,
             'POSITION_LIMIT_REACHED',
             format('Maximum votes reached for %s. Limit: %s.', COALESCE(v_candidate.position, 'this position'), v_max_votes),
             NULL::TEXT;
    RETURN;
  END IF;

  INSERT INTO votes (
    election_id,
    voter_id,
    candidate_id,
    position,
    vote_hash,
    ip_address,
    user_agent
  )
  VALUES (
    p_election_id,
    p_voter_id,
    p_candidate_id,
    v_candidate.position,
    p_vote_hash,
    p_ip_address,
    p_user_agent
  );

  RETURN QUERY SELECT TRUE, NULL::TEXT, NULL::TEXT, p_vote_hash;
EXCEPTION
  WHEN unique_violation THEN
    IF EXISTS (
      SELECT 1
      FROM votes v
      WHERE v.election_id = p_election_id
        AND v.voter_id = p_voter_id
        AND v.candidate_id = p_candidate_id
    ) THEN
      RETURN QUERY SELECT FALSE, 'DUPLICATE_CANDIDATE', 'You have already voted for this candidate.', NULL::TEXT;
      RETURN;
    END IF;

    RETURN QUERY SELECT FALSE, 'UNIQUE_VIOLATION', 'A conflicting vote already exists.', NULL::TEXT;
    RETURN;
END;
$$;

-- ============================================
-- PAGEANTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS pageants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'upcoming', 'active', 'completed', 'archived')),
  created_by UUID NOT NULL REFERENCES users(id),
  scoring_method TEXT NOT NULL CHECK (scoring_method IN ('average', 'weighted', 'ranking', 'ranking_by_gender')),
  total_weight NUMERIC NOT NULL DEFAULT 100,
  results_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- CONTESTANTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS contestants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pageant_id UUID NOT NULL REFERENCES pageants(id) ON DELETE CASCADE,
  contestant_number INT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  photo_url TEXT,
  bio TEXT,
  age INT,
  department TEXT,
  gender TEXT CHECK (gender IN ('Male', 'Female')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS contestants_pageant_number_gender_scope_key
ON contestants (pageant_id, contestant_number, COALESCE(gender, '__NO_GENDER__'));

-- ============================================
-- CRITERIA TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS criteria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pageant_id UUID NOT NULL REFERENCES pageants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  weight NUMERIC NOT NULL,
  max_score NUMERIC NOT NULL DEFAULT 100,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- PAGEANT JUDGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS pageant_judges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pageant_id UUID NOT NULL REFERENCES pageants(id) ON DELETE CASCADE,
  judge_id UUID NOT NULL REFERENCES users(id),
  judge_name TEXT NOT NULL,
  assigned_by UUID NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (pageant_id, judge_id)
);

-- ============================================
-- SCORES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pageant_id UUID NOT NULL REFERENCES pageants(id) ON DELETE CASCADE,
  contestant_id UUID NOT NULL REFERENCES contestants(id) ON DELETE CASCADE,
  criteria_id UUID NOT NULL REFERENCES criteria(id) ON DELETE CASCADE,
  judge_id UUID NOT NULL REFERENCES users(id),
  score NUMERIC NOT NULL,
  notes TEXT,
  score_hash TEXT NOT NULL,
  ip_address TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pageant_id, contestant_id, criteria_id, judge_id)
);

-- ============================================
-- AUDIT LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('user', 'election', 'vote', 'pageant', 'score', 'candidate', 'contestant', 'criteria')),
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ROW-LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE election_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pageants ENABLE ROW LEVEL SECURITY;
ALTER TABLE contestants ENABLE ROW LEVEL SECURITY;
ALTER TABLE criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE pageant_judges ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Service role bypass (used by Node.js backend with SUPABASE_SERVICE_ROLE_KEY)
-- All access from the backend uses the service role key, bypassing RLS.
-- No additional policies needed for backend API access.
