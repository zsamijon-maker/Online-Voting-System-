import { supabase } from './supabaseClient.js';
import { logger } from './logger.js';
import { withRetry } from './networkUtils.js';

const CHALLENGE_EXPIRY_MINUTES = 10;

/**
 * Database-backed challenge token storage.
 * Replaces in-memory Map storage for production deployments.
 */

export async function createChallenge({ userId, purpose, payload = {}, challengeId }) {
  // Use provided challengeId from JWT or generate a new one
  const id = challengeId || crypto.randomUUID();
  const expiresAt = new Date(Date.now() + CHALLENGE_EXPIRY_MINUTES * 60 * 1000).toISOString();

  const { data, error } = await withRetry(() =>
    supabase
      .from('auth_challenges')
      .insert({
        user_id: userId,
        challenge_id: id,
        purpose,
        payload,
        expires_at: expiresAt,
      })
      .select()
      .single()
  );

  if (error) {
    logger.error('[challengeStore] Failed to create challenge:', error);
    throw error;
  }

  logger.info('[challengeStore] Challenge created', { userId, purpose, challengeId: id });
  return { challengeId: id, expiresAt };
}

export async function getChallenge(challengeId) {
  const { data, error } = await withRetry(() =>
    supabase
      .from('auth_challenges')
      .select('*')
      .eq('challenge_id', challengeId)
      .single()
  );

  if (error) {
    if (error.code === 'PGRST116') return null;
    logger.error('[challengeStore] Failed to read challenge:', error);
    throw error;
  }

  if (!data) {
    return null;
  }

  // Check if expired
  if (new Date(data.expires_at) < new Date()) {
    logger.warn('[challengeStore] Challenge expired', { challengeId });
    return { ...data, expired: true };
  }

  // Check if already consumed
  if (data.consumed_at) {
    logger.warn('[challengeStore] Challenge already consumed', { challengeId });
    return { ...data, consumed: true };
  }

  return data;
}

export async function consumeChallenge(challengeId) {
  const { error } = await withRetry(() =>
    supabase
      .from('auth_challenges')
      .update({ consumed_at: new Date().toISOString() })
      .eq('challenge_id', challengeId)
  );

  if (error) {
    logger.error('[challengeStore] Failed to consume challenge:', error);
    throw error;
  }

  logger.info('[challengeStore] Challenge consumed', { challengeId });
}

export async function incrementAttempt(challengeId) {
  const { data, error } = await withRetry(() =>
    supabase.rpc('increment_challenge_attempt', {
      p_challenge_id: challengeId,
    })
  );

  if (error) {
    logger.error('[challengeStore] Failed to increment challenge attempt:', error);
    throw error;
  }

  if (typeof data === 'number') return data;

  if (Array.isArray(data) && data.length > 0) {
    const row = data[0];
    const value = Number(row?.increment_challenge_attempt ?? row?.attempts ?? row);
    if (Number.isFinite(value)) return value;
  }

  throw new Error('increment_challenge_attempt returned no usable value');
}

export async function getLatestChallengeByUser(userId, purpose) {
  const { data, error } = await withRetry(() =>
    supabase
      .from('auth_challenges')
      .select('*')
      .eq('user_id', userId)
      .eq('purpose', purpose)
      .is('consumed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
  );

  if (error) {
    if (error.code === 'PGRST116') return null;
    logger.error('[challengeStore] Failed to read latest challenge by user:', error);
    throw error;
  }

  if (!data) {
    return null;
  }

  // Check if expired
  if (new Date(data.expires_at) < new Date()) {
    return null;
  }

  return data;
}

export async function invalidateUserChallenges(userId, purpose) {
  const { error } = await withRetry(() =>
    supabase
      .from('auth_challenges')
      .update({ consumed_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('purpose', purpose)
      .is('consumed_at', null)
  );

  if (error) {
    logger.error('[challengeStore] Failed to invalidate user challenges:', error);
  }
}

export async function cleanupExpiredChallenges() {
  const { error } = await withRetry(() =>
    supabase
      .from('auth_challenges')
      .delete()
      .lt('expires_at', new Date().toISOString())
  );

  if (error) {
    logger.error('[challengeStore] Failed to cleanup expired challenges:', error);
  }
}