import { supabase, supabaseAuth } from '../lib/supabaseClient.js';
import { withRetry, isTransientNetworkError } from '../lib/networkUtils.js';
import { verifySupabaseAccessToken } from '../lib/supabaseJwtVerifier.js';
import { logger } from '../lib/logger.js';

/**
 * Middleware: Verify Supabase JWT token from Authorization header.
 * Attaches `req.user` with user id and role metadata.
 */
export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify JWT locally first to avoid coupling each protected request to Auth API availability.
    const verification = await verifySupabaseAccessToken(token);
    let userId = verification.payload?.sub;
    let tokenEmail = verification.payload?.email;

    if (!verification.valid) {
      // If local verification is temporarily unavailable (e.g., JWKS endpoint issue),
      // fall back to Supabase Auth API with retries before returning 503.
      if (verification.status === 503 || verification.transient) {
        logger.warn('[authenticate] Local JWT verification unavailable, using Auth API fallback:', verification.error ?? verification.reason);

        const { data, error } = await withRetry(() => supabaseAuth.auth.getUser(token));

        if (error || !data?.user?.id) {
          return res.status(401).json({ error: 'Invalid or expired token.' });
        }

        userId = data.user.id;
        tokenEmail = data.user.email;
      } else {
        return res.status(verification.status ?? 401).json({
          error: verification.reason ?? 'Invalid or expired token.',
        });
      }
    }

    if (!userId) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }

    // Fetch user profile with retries for transient upstream networking issues.
    const { data: userRow, error: userError } = await withRetry(() =>
      supabase
        .from('users')
        .select('id, roles, is_active, email')
        .eq('id', userId)
        .single()
    );

    if (userError || !userRow) {
      return res.status(401).json({ error: 'User not found.' });
    }

    if (!userRow.is_active) {
      return res.status(403).json({ error: 'Account is deactivated.' });
    }

    req.user = {
      id: userRow.id,
      roles: userRow.roles,
      email: userRow.email ?? tokenEmail,
    };

    next();
  } catch (error) {
    if (isTransientNetworkError(error) || error?.isTransientNetworkError) {
      logger.error('[authenticate] Transient upstream auth/network failure:', error);
      return res.status(503).json({
        error: 'Authentication service temporarily unavailable. Please try again.',
      });
    }

    logger.error('[authenticate] Unexpected authentication error:', error);
    return res.status(500).json({
      error: 'An unexpected authentication error occurred.',
    });
  }
};
