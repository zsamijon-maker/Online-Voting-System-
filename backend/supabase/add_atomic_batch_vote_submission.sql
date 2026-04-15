-- Atomic batch vote submission for submit-all voting flow.
-- Run this migration in Supabase SQL editor.

CREATE OR REPLACE FUNCTION public.submit_votes_batch_atomic(
  p_election_id UUID,
  p_voter_id UUID,
  p_candidate_ids UUID[],
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  error_code TEXT,
  error_message TEXT,
  submitted_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requested_count INTEGER;
  v_matched_count INTEGER;
  v_conflict RECORD;
BEGIN
  IF p_candidate_ids IS NULL OR array_length(p_candidate_ids, 1) IS NULL THEN
    RETURN QUERY SELECT FALSE, 'INVALID_SELECTION', 'No candidates selected.', 0;
    RETURN;
  END IF;

  -- Serialize vote submissions for one voter within one election.
  PERFORM pg_advisory_xact_lock(hashtext(p_election_id::text), hashtext(p_voter_id::text));

  IF EXISTS (
    SELECT 1
    FROM unnest(p_candidate_ids) AS requested_id
    GROUP BY requested_id
    HAVING COUNT(*) > 1
  ) THEN
    RETURN QUERY SELECT FALSE, 'DUPLICATE_CANDIDATE', 'Duplicate candidates were submitted in the same request.', 0;
    RETURN;
  END IF;

  SELECT COUNT(*)::INTEGER
    INTO v_requested_count
  FROM unnest(p_candidate_ids) AS requested_id;

  SELECT COUNT(*)::INTEGER
    INTO v_matched_count
  FROM candidates c
  WHERE c.id = ANY(p_candidate_ids)
    AND c.election_id = p_election_id;

  IF v_matched_count <> v_requested_count THEN
    IF EXISTS (
      SELECT 1
      FROM candidates c
      WHERE c.id = ANY(p_candidate_ids)
        AND c.election_id <> p_election_id
    ) THEN
      RETURN QUERY SELECT FALSE, 'CANDIDATE_ELECTION_MISMATCH', 'One or more selected candidates do not belong to this election.', 0;
      RETURN;
    END IF;

    RETURN QUERY SELECT FALSE, 'CANDIDATE_NOT_FOUND', 'One or more selected candidates were not found.', 0;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM votes v
    WHERE v.election_id = p_election_id
      AND v.voter_id = p_voter_id
      AND v.candidate_id = ANY(p_candidate_ids)
  ) THEN
    RETURN QUERY SELECT FALSE, 'DUPLICATE_CANDIDATE', 'You have already voted for one or more selected candidates.', 0;
    RETURN;
  END IF;

  WITH requested_candidates AS (
    SELECT c.id, c.position, c.position_id
    FROM candidates c
    WHERE c.id = ANY(p_candidate_ids)
      AND c.election_id = p_election_id
  ),
  requested_counts AS (
    SELECT
      COALESCE(position_id::TEXT, position) AS position_key,
      MAX(position) AS position_label,
      MAX(position_id) AS position_id,
      COUNT(*)::INTEGER AS requested_count
    FROM requested_candidates
    GROUP BY COALESCE(position_id::TEXT, position)
  ),
  existing_counts AS (
    SELECT
      COALESCE(c.position_id::TEXT, c.position) AS position_key,
      COUNT(*)::INTEGER AS existing_count
    FROM votes v
    JOIN candidates c ON c.id = v.candidate_id
    WHERE v.election_id = p_election_id
      AND v.voter_id = p_voter_id
    GROUP BY COALESCE(c.position_id::TEXT, c.position)
  ),
  limits AS (
    SELECT
      rc.position_key,
      rc.position_label,
      rc.requested_count,
      COALESCE(ec.existing_count, 0) AS existing_count,
      COALESCE(
        ep.max_vote,
        CASE rc.position_label
          WHEN 'SSG President' THEN 1
          WHEN 'SSG Vice President' THEN 1
          WHEN 'SSG Senators' THEN 12
          WHEN 'FSTLP President' THEN 1
          WHEN 'FSTLP Vice President' THEN 1
          WHEN 'FSTLP Secretary' THEN 1
          WHEN 'FSTLP Treasurer' THEN 1
          WHEN 'FSTLP Auditor' THEN 1
          WHEN 'FSTLP PIO' THEN 2
          WHEN 'FSTLP Board Members' THEN 6
          WHEN 'President' THEN 1
          WHEN 'Vice President' THEN 1
          WHEN 'Senators' THEN 12
          WHEN 'Secretary' THEN 1
          WHEN 'Treasurer' THEN 1
          WHEN 'Auditor' THEN 1
          WHEN 'PIO' THEN 2
          WHEN 'Board Members' THEN 6
          ELSE 1
        END
      )::INTEGER AS max_votes
    FROM requested_counts rc
    LEFT JOIN election_positions ep
      ON ep.id = rc.position_id
      AND ep.election_id = p_election_id
    LEFT JOIN existing_counts ec
      ON ec.position_key = rc.position_key
  )
  SELECT *
    INTO v_conflict
  FROM limits
  WHERE (existing_count + requested_count) > max_votes
  ORDER BY position_label
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY
      SELECT
        FALSE,
        'POSITION_LIMIT_REACHED',
        format(
          'Maximum votes reached for %s. Existing: %s, requested: %s, limit: %s.',
          COALESCE(v_conflict.position_label, 'this position'),
          v_conflict.existing_count,
          v_conflict.requested_count,
          v_conflict.max_votes
        ),
        0;
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
  SELECT
    p_election_id,
    p_voter_id,
    c.id,
    c.position,
    md5(
      concat_ws(
        ':',
        p_voter_id::TEXT,
        p_election_id::TEXT,
        c.id::TEXT,
        c.position,
        clock_timestamp()::TEXT,
        uuid_generate_v4()::TEXT,
        random()::TEXT
      )
    ) AS vote_hash,
    p_ip_address,
    p_user_agent
  FROM candidates c
  WHERE c.id = ANY(p_candidate_ids)
    AND c.election_id = p_election_id;

  GET DIAGNOSTICS v_requested_count = ROW_COUNT;
  RETURN QUERY SELECT TRUE, NULL::TEXT, NULL::TEXT, v_requested_count;
EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT FALSE, 'DUPLICATE_CANDIDATE', 'One or more selected candidates already have recorded votes.', 0;
    RETURN;
 END;
 $$;