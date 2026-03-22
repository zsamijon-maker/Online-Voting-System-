-- Normalize candidate positions to election_positions while preserving legacy data.

ALTER TABLE IF EXISTS candidates
  ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES election_positions(id);

CREATE INDEX IF NOT EXISTS idx_election_positions_election_id
  ON election_positions(election_id);

CREATE INDEX IF NOT EXISTS idx_candidates_election_position_id
  ON candidates(election_id, position_id);

-- Create missing position rows for legacy candidate text positions.
INSERT INTO election_positions (election_id, position_name, max_vote)
SELECT
  c.election_id,
  c.position,
  1
FROM candidates c
LEFT JOIN election_positions ep
  ON ep.election_id = c.election_id
 AND ep.position_name = c.position
WHERE c.position IS NOT NULL
  AND trim(c.position) <> ''
  AND ep.id IS NULL
GROUP BY c.election_id, c.position;

-- Backfill candidates.position_id from existing text position.
UPDATE candidates c
SET position_id = ep.id
FROM election_positions ep
WHERE c.position_id IS NULL
  AND c.election_id = ep.election_id
  AND c.position = ep.position_name;

-- Diagnostics: candidates still not mapped.
SELECT id, election_id, position
FROM candidates
WHERE position_id IS NULL;
