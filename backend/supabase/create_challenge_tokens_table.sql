-- ============================================
-- CHALLENGE TOKENS TABLE
-- Stores 2FA challenge tokens for production use
-- ============================================

CREATE TABLE IF NOT EXISTS auth_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  challenge_id TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL,
  payload JSONB,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);

-- Index for looking up challenges by user_id and purpose
CREATE INDEX IF NOT EXISTS auth_challenges_user_purpose_idx
ON auth_challenges (user_id, purpose)
WHERE consumed_at IS NULL;

-- Index for looking up challenges by challenge_id
CREATE INDEX IF NOT EXISTS auth_challenges_challenge_id_idx
ON auth_challenges (challenge_id);

-- Index for cleaning up expired challenges
CREATE INDEX IF NOT EXISTS auth_challenges_expires_at_idx
ON auth_challenges (expires_at);

-- Enable RLS
ALTER TABLE auth_challenges ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
DROP POLICY IF EXISTS "Service role can manage auth_challenges" ON auth_challenges;
CREATE POLICY "Service role can manage auth_challenges"
ON auth_challenges
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Function to cleanup expired challenges
CREATE OR REPLACE FUNCTION cleanup_expired_challenges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM auth_challenges
  WHERE expires_at < NOW()
  OR (consumed_at IS NOT NULL AND consumed_at < NOW() - INTERVAL '1 hour');
END;
$$;

-- Function to atomically increment challenge attempts
CREATE OR REPLACE FUNCTION increment_challenge_attempt(p_challenge_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
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