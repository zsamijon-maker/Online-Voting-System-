-- ============================================
-- PERFORMANCE INDEXES
-- Add indexes for frequently queried columns
-- ============================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_student_id ON users (student_id);
CREATE INDEX IF NOT EXISTS idx_users_roles ON users USING GIN (roles);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at DESC);

-- Elections table indexes
CREATE INDEX IF NOT EXISTS idx_elections_status ON elections (status);
CREATE INDEX IF NOT EXISTS idx_elections_type ON elections (type);
CREATE INDEX IF NOT EXISTS idx_elections_dates ON elections (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_elections_created_by ON elections (created_by);
CREATE INDEX IF NOT EXISTS idx_elections_created_at ON elections (created_at DESC);

-- Candidates table indexes
CREATE INDEX IF NOT EXISTS idx_candidates_election_id ON candidates (election_id);
CREATE INDEX IF NOT EXISTS idx_candidates_user_id ON candidates (user_id);
CREATE INDEX IF NOT EXISTS idx_candidates_position ON candidates (position);
CREATE INDEX IF NOT EXISTS idx_candidates_is_active ON candidates (is_active);

-- Election positions table indexes
CREATE INDEX IF NOT EXISTS idx_election_positions_election_id ON election_positions (election_id);

-- Votes table indexes (critical for performance)
CREATE INDEX IF NOT EXISTS idx_votes_election_id ON votes (election_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter_id ON votes (voter_id);
CREATE INDEX IF NOT EXISTS idx_votes_candidate_id ON votes (candidate_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter_election ON votes (voter_id, election_id);
CREATE INDEX IF NOT EXISTS idx_votes_position ON votes (position);
CREATE INDEX IF NOT EXISTS idx_votes_voted_at ON votes (voted_at DESC);

-- Pageants table indexes
CREATE INDEX IF NOT EXISTS idx_pageants_status ON pageants (status);
CREATE INDEX IF NOT EXISTS idx_pageants_event_date ON pageants (event_date);
CREATE INDEX IF NOT EXISTS idx_pageants_created_by ON pageants (created_by);
CREATE INDEX IF NOT EXISTS idx_pageants_created_at ON pageants (created_at DESC);

-- Contestants table indexes
CREATE INDEX IF NOT EXISTS idx_contestants_pageant_id ON contestants (pageant_id);
CREATE INDEX IF NOT EXISTS idx_contestants_is_active ON contestants (is_active);
CREATE INDEX IF NOT EXISTS idx_contestants_department ON contestants (department);
CREATE INDEX IF NOT EXISTS idx_contestants_gender ON contestants (gender);

-- Criteria table indexes
CREATE INDEX IF NOT EXISTS idx_criteria_pageant_id ON criteria (pageant_id);
CREATE INDEX IF NOT EXISTS idx_criteria_is_active ON criteria (is_active);

-- Pageant judges table indexes
CREATE INDEX IF NOT EXISTS idx_pageant_judges_pageant_id ON pageant_judges (pageant_id);
CREATE INDEX IF NOT EXISTS idx_pageant_judges_judge_id ON pageant_judges (judge_id);

-- Scores table indexes (critical for performance)
CREATE INDEX IF NOT EXISTS idx_scores_contestant_id ON scores (contestant_id);
CREATE INDEX IF NOT EXISTS idx_scores_judge_id ON scores (judge_id);
CREATE INDEX IF NOT EXISTS idx_scores_criteria_id ON scores (criteria_id);
CREATE INDEX IF NOT EXISTS idx_scores_pageant_id ON scores (pageant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scores_unique ON scores (contestant_id, judge_id, criteria_id);

-- Audit logs table indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs (entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs (entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);

-- Auth challenges table indexes (if not already in schema)
-- Note: These are already added in create_challenge_tokens_table.sql
-- but adding here for completeness if running independently
CREATE INDEX IF NOT EXISTS idx_auth_challenges_user_purpose ON auth_challenges (user_id, purpose)
  WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_auth_challenges_expires_at ON auth_challenges (expires_at);