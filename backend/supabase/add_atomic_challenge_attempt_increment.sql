-- Atomic increment for auth challenge attempts.
-- Prevents race conditions from read-then-write updates.

CREATE OR REPLACE FUNCTION public.increment_challenge_attempt(
  p_challenge_id TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts INTEGER;
BEGIN
  UPDATE auth_challenges
  SET attempts = attempts + 1
  WHERE challenge_id = p_challenge_id
    AND consumed_at IS NULL
  RETURNING attempts INTO v_attempts;

  IF v_attempts IS NULL THEN
    RAISE EXCEPTION 'Challenge not found or already consumed.'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN v_attempts;
END;
$$;
