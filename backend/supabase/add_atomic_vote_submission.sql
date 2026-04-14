-- Atomic vote submission to prevent duplicate and position-limit race conditions.
-- Run this migration in Supabase SQL editor.

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
  -- Serialize vote submissions for one voter within one election.
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