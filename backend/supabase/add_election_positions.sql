-- Add per-position voting limits for elections
CREATE TABLE IF NOT EXISTS election_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  position_name TEXT NOT NULL,
  max_vote INT NOT NULL CHECK (max_vote >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT election_positions_election_id_position_name_key UNIQUE (election_id, position_name)
);

-- Required by Supabase Security Advisor for PostgREST-exposed tables.
ALTER TABLE election_positions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_election_positions_election_id
  ON election_positions (election_id);

-- Allow multiple votes per position but prevent duplicate votes for same candidate.
ALTER TABLE votes
  DROP CONSTRAINT IF EXISTS votes_election_id_voter_id_position_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'votes_election_id_voter_id_candidate_id_key'
  ) THEN
    ALTER TABLE votes
      ADD CONSTRAINT votes_election_id_voter_id_candidate_id_key
      UNIQUE (election_id, voter_id, candidate_id);
  END IF;
END $$;
