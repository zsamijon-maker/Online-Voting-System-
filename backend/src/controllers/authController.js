import { generateSecret, generateURI, generate as generateTotp, verify as verifyTotp } from 'otplib';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { supabase, supabaseAuth } from '../lib/supabaseClient.js';
import { logger } from '../lib/logger.js';
import * as challengeStore from '../lib/challengeStore.js';
import { verifySupabaseAccessToken } from '../lib/supabaseJwtVerifier.js';

// SESSION REFRESH ENDPOINT
export const refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'refreshToken is required.' });
  }
  try {
    const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token: refreshToken });
    if (error) {
      return res.status(401).json({ error: error.message || 'Invalid refresh token.' });
    }
    // Optionally, you can issue a new challenge token here if you want to wrap the new tokens in your challenge system
    return res.json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: data.user,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to refresh session.' });
  }
};

// ── Challenge-token config ─────────────────────────────────────────────────
// CHALLENGE_JWT_SECRET must be set in environment variables.
const CHALLENGE_SECRET = process.env.CHALLENGE_JWT_SECRET;
if (!CHALLENGE_SECRET) {
  throw new Error('CHALLENGE_JWT_SECRET environment variable is required. Set a long random string.');
}
const CHALLENGE_EXPIRY = process.env.CHALLENGE_EXPIRY || '10m'; // allow realistic user/device latency
const MAX_CHALLENGE_ATTEMPTS = Number(process.env.MAX_2FA_ATTEMPTS || 5);
const BISU_EMAIL_DOMAIN = 'bisu.edu.ph';

function logAuthEvent(event, details = {}) {
  logger.info(`[auth] ${event}`, details);
}

const verifyChallenge = (token) => jwt.verify(token, CHALLENGE_SECRET);

// Fallback in-memory storage for when database is unavailable
const latestChallengeByUser = new Map();
const consumedChallengeIds = new Set();

function issueChallenge(payload) {
  const cid = randomUUID();
  const token = jwt.sign({ ...payload, cid }, CHALLENGE_SECRET, { expiresIn: CHALLENGE_EXPIRY });

  // Keep an in-memory pointer for fallback validation and "latest challenge" checks.
  if (payload?.sub) {
    latestChallengeByUser.set(payload.sub, cid);
    consumedChallengeIds.delete(cid);

    // Persist challenge in DB. Invalidate previous challenges first to avoid
    // a race where late invalidation consumes the brand new challenge row.
    (async () => {
      try {
        await challengeStore.invalidateUserChallenges(payload.sub, payload.purpose);
        await challengeStore.createChallenge({
          userId: payload.sub,
          purpose: payload.purpose,
          payload: { ...payload, cid },
          challengeId: cid, // Use the same cid as the JWT
        });
      } catch (err) {
        logger.warn('[auth] Challenge DB write failed, continuing with in-memory fallback');
      }
    })();
  }

  logAuthEvent('challenge_issued', { sub: payload?.sub, purpose: payload?.purpose, cid });
  return token;
}

async function retireChallenge(payload) {
  if (!payload?.cid) return;

  try {
    const challenge = await challengeStore.getChallenge(payload.cid);
    if (challenge) {
      await challengeStore.consumeChallenge(payload.cid);
    }
  } catch (err) {
    // Fallback: mark as consumed in memory
    consumedChallengeIds.add(payload.cid);
  }

  try {
    if (payload?.sub) {
      await challengeStore.invalidateUserChallenges(payload.sub, payload.purpose);
    }
  } catch (err) {
    // Fallback: clear in-memory state
    latestChallengeByUser.delete(payload?.sub);
  }

  logAuthEvent('challenge_retired', { sub: payload?.sub, cid: payload?.cid });
}

async function validateChallengeState(payload, { enforceLatest = true, countAttempt = false } = {}) {
  if (!payload?.cid) {
    return { ok: false, status: 401, error: 'Invalid challenge token.' };
  }

  let challenge;
  let dbAvailable = true;

  try {
    challenge = await challengeStore.getChallenge(payload.cid);
  } catch (err) {
    logger.warn('[auth] DB unavailable for validateChallengeState, using fallback');
    dbAvailable = false;
  }

  // Fallback to in-memory if DB fails
  if (!dbAvailable) {
    return {
      ok: false,
      status: 503,
      error: 'Verification service is temporarily unavailable. Please sign in again.',
    };
  }

  if (!challenge) {
    return {
      ok: false,
      status: 401,
      error: 'Invalid challenge token. Please sign in again.',
    };
  }

  if (challenge.expired) {
    return { ok: false, status: 401, error: 'Challenge session expired. Please sign in again.' };
  }

  if (challenge.consumed) {
    logAuthEvent('challenge_rejected_consumed', { sub: payload?.sub, cid: payload?.cid });
    return {
      ok: false,
      status: 401,
      error: 'This verification session is no longer valid. Please sign in again.',
    };
  }

  if (enforceLatest && payload?.sub) {
    let latestChallenge;
    try {
      latestChallenge = await challengeStore.getLatestChallengeByUser(payload.sub, payload.purpose);
    } catch (err) {
      return {
        ok: false,
        status: 503,
        error: 'Verification service is temporarily unavailable. Please sign in again.',
      };
    }
    if (latestChallenge && latestChallenge.challenge_id !== payload.cid) {
      logAuthEvent('challenge_rejected_superseded', { sub: payload?.sub, cid: payload?.cid, latestCid: latestChallenge.challenge_id });
      return {
        ok: false,
        status: 401,
        error: 'A newer verification session was started. Please use the latest code prompt.',
      };
    }
  }

  if (countAttempt) {
    let nextAttempts;
    try {
      nextAttempts = await challengeStore.incrementAttempt(payload.cid);
    } catch (err) {
      await retireChallenge(payload);
      return {
        ok: false,
        status: 503,
        error: 'Verification attempt counter is temporarily unavailable. Please sign in again.',
      };
    }
    if (typeof nextAttempts !== 'number') {
      await retireChallenge(payload);
      return {
        ok: false,
        status: 503,
        error: 'Verification attempt counter is temporarily unavailable. Please sign in again.',
      };
    }

    if (nextAttempts > MAX_CHALLENGE_ATTEMPTS) {
      await retireChallenge(payload);
      logAuthEvent('challenge_locked_too_many_attempts', { sub: payload?.sub, cid: payload?.cid });
      return {
        ok: false,
        status: 429,
        error: 'Too many verification attempts. Please sign in again.',
      };
    }
  }

  return { ok: true };
}

function readChallengeToken(token) {
  try {
    return { payload: verifyChallenge(token), expired: false, invalid: false };
  } catch (error) {
    if (error?.name === 'TokenExpiredError') {
      const decoded = jwt.decode(token);
      if (decoded?.cid) {
        retireChallenge(decoded).catch(err => {
          logger.error('[auth] Failed to retire expired challenge:', err);
        });
      }
      return { payload: null, expired: true, invalid: false };
    }
    return { payload: null, expired: false, invalid: true };
  }
}

function normalizeTotpCode(input) {
  return String(input ?? '').replace(/\s+/g, '').replace(/\D/g, '').slice(0, 6);
}

function isValidTotpFormat(code) {
  return /^\d{6}$/.test(code);
}

function verifyTotpCode({ token, secret }) {
  // Accept the current 30s slice with +/-1 slice tolerance for clock skew/network latency.
  return verifyTotp({ token, secret, window: [1, 1] });
}

function isBisuEmail(email) {
  const value = String(email ?? '').trim().toLowerCase();
  return value.endsWith(`@${BISU_EMAIL_DOMAIN}`);
}

function isVoterOnlyRoles(roles) {
  return Array.isArray(roles) && roles.length > 0 && roles.every((role) => role === 'voter');
}

function splitGoogleName(user) {
  const fullName = String(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '').trim();
  const parts = fullName.split(/\s+/).filter(Boolean);

  // Canonical rule: last word is last name; all preceding words are first name.
  if (parts.length > 1) {
    return {
      firstName: parts.slice(0, -1).join(' '),
      lastName: parts[parts.length - 1],
    };
  }

  const givenName = String(user?.user_metadata?.given_name ?? '').trim();
  const familyName = String(user?.user_metadata?.family_name ?? '').trim();

  if (givenName || familyName) {
    return { firstName: givenName, lastName: familyName };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return { firstName: '', lastName: '' };
}

// ── Helper: detect a transient network error in a thrown error or Supabase error obj ──
function isNetworkError(errOrMsg) {
  const m = typeof errOrMsg === 'string' ? errOrMsg : (errOrMsg?.message ?? '');
  return m.includes('fetch failed') || m.includes('ECONNRESET') ||
         (errOrMsg?.cause?.code === 'ECONNRESET');
}

// ── Helper: retry a fn up to `retries` times on ECONNRESET / fetch failure ──
async function withRetry(fn, retries = 3, delayMs = 500) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    let result;
    try {
      result = await fn();
    } catch (err) {
      lastErr = err;
      if (!isNetworkError(err) || i === retries - 1) throw err;
      await new Promise(res => setTimeout(res, delayMs * (i + 1)));
      continue;
    }
    if (result?.error && isNetworkError(result.error)) {
      lastErr = result.error;
      if (i < retries - 1) {
        logger.warn(`[withRetry] network error on attempt ${i + 1}, retrying:`, result.error.message);
        await new Promise(res => setTimeout(res, delayMs * (i + 1)));
        continue;
      }
      const err = new Error(result.error.message ?? 'fetch failed');
      err.isNetworkError = true;
      throw err;
    }
    return result;
  }
  const err = new Error(lastErr?.message ?? 'fetch failed');
  err.isNetworkError = true;
  throw err;
}

// REGISTRATION — STEP 1
export const register = async (req, res) => {
  return res.status(403).json({
    error: 'Personal accounts are not allowed for voter registration. Use your BISU Google account (@bisu.edu.ph) only.',
  });
};

// REGISTRATION — STEP 2
export const verifyRegistrationTotp = async (req, res) => {
  const { challengeToken, totpCode } = req.body;
  const normalizedTotpCode = normalizeTotpCode(totpCode);

  if (!challengeToken || !totpCode) {
    return res.status(400).json({ error: 'challengeToken and totpCode are required.' });
  }

  if (!isValidTotpFormat(normalizedTotpCode)) {
    return res.status(400).json({ error: 'Verification code must be exactly 6 digits.' });
  }

  const challenge = readChallengeToken(challengeToken);
  if (challenge.expired) {
    return res.status(401).json({
      error: 'Setup session expired. Please register again.',
    });
  }
  if (challenge.invalid || !challenge.payload) {
    return res.status(401).json({ error: 'Invalid challenge token.' });
  }

  const payload = challenge.payload;

  if (payload.purpose !== 'totp_setup') {
    return res.status(401).json({ error: 'Invalid challenge token.' });
  }

  const challengeState = await validateChallengeState(payload, { enforceLatest: true, countAttempt: true });
  if (!challengeState.ok) {
    return res.status(challengeState.status).json({ error: challengeState.error });
  }

  const { data: user, error: userError } = await withRetry(() =>
    supabase
      .from('users')
      .select('id, totp_secret, two_factor_enabled')
      .eq('id', payload.sub)
      .single()
  );

  if (userError || !user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  if (user.two_factor_enabled) {
    return res.status(400).json({ error: '2FA is already activated for this account.' });
  }

  const isValid = verifyTotpCode({ token: normalizedTotpCode, secret: user.totp_secret });

  if (!isValid) {
    logAuthEvent('totp_verify_failed', { sub: payload?.sub, purpose: payload?.purpose, cid: payload?.cid });
    return res.status(400).json({
      error: 'Invalid or expired code. Please try again with the current code from your authenticator app.',
    });
  }

  const { error: updateError } = await withRetry(() =>
    supabase
      .from('users')
      .update({ two_factor_enabled: true })
      .eq('id', user.id)
  );

  if (updateError) throw updateError;

  await retireChallenge(payload);
  logAuthEvent('totp_verify_success', { sub: payload?.sub, purpose: payload?.purpose, cid: payload?.cid });

  res.json({ message: 'Two-factor authentication activated. You can now log in.' });
};

// LOGIN — STEP 1
export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required.' });
  }

  let data;
  let error;

  try {
    ({ data, error } = await withRetry(
      () => supabaseAuth.auth.signInWithPassword({ email, password }),
      3,
      500
    ));
  } catch (err) {
    if (isNetworkError(err) || err?.isNetworkError) {
      return res.status(503).json({
        error: 'Authentication service is temporarily unavailable. Please try again in a moment.',
      });
    }
    throw err;
  }

  if (error) {
    if (isNetworkError(error)) {
      return res.status(503).json({
        error: 'Authentication service is temporarily unavailable. Please try again in a moment.',
      });
    }
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (userError || !userRow) {
    return res.status(404).json({
      error: 'User profile not found. Please contact your administrator.',
    });
  }

  if (!userRow.is_active) {
    return res.status(403).json({ error: 'Account is inactive. Please contact your administrator.' });
  }

  const roles = Array.isArray(userRow.roles) ? userRow.roles : [];
  const isVoterOnly = isVoterOnlyRoles(roles);

  if (isVoterOnly) {
    return res.status(403).json({
      error: 'Personal accounts are not allowed for voter login. Use Google sign-in with your BISU account (@bisu.edu.ph).',
    });
  }

  const isAdmin = roles.includes('admin');
  const isTotpExemptAdmin = isAdmin && userRow.totp_exempt === true;

  // Admin-only bypass: allows specific exempt admin accounts to skip TOTP.
  if (isTotpExemptAdmin) {
    await withRetry(() =>
      supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', userRow.id)
    );

    const { totp_secret: _secret, ...safeUser } = userRow;

    return res.json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: safeUser,
      bypassed2FA: true,
    });
  }

  // TOTP rebind required (e.g. after admin email change)
  if (userRow.totp_rebind_required) {
    const totpSecret = userRow.totp_secret || generateSecret();
    if (!userRow.totp_secret) {
      await supabase.from('users').update({ totp_secret: totpSecret }).eq('id', userRow.id);
    }

    const challengeToken = issueChallenge({
      sub:          data.user.id,
      purpose:      'totp_rebind',
      accessToken:  data.session.access_token,
      refreshToken: data.session.refresh_token,
    });

    const otpauthUrl = generateURI({
      label:  data.user.email,
      issuer: 'SchoolVoting',
      secret: totpSecret,
    });

    return res.json({
      status: 'REQUIRE_TOTP_REBIND',
      challengeToken,
      otpauthUrl,
      secretKey: totpSecret,
    });
  }

  if (!userRow.two_factor_enabled) {
    // Staff accounts are manually created and start with no totp_secret.
    // Force first-time 2FA setup so they can complete login.
    if (!userRow.totp_secret) {
      const totpSecret = generateSecret();
      await supabase.from('users').update({ totp_secret: totpSecret }).eq('id', userRow.id);

      const challengeToken = issueChallenge({
        sub:          data.user.id,
        purpose:      'staff_totp_setup',
        accessToken:  data.session.access_token,
        refreshToken: data.session.refresh_token,
      });

      const otpauthUrl = generateURI({
        label:  data.user.email,
        issuer: 'SchoolVoting',
        secret: totpSecret,
      });

      return res.json({
        requiresTotpSetup: true,
        isFirstSetup:      true,
        challengeToken,
        otpauthUrl,
        secretKey: totpSecret,
      });
    }

    // Student account with a totp_secret but 2FA not yet activated
    return res.status(403).json({
      error: 'Two-factor authentication is not set up. Please complete registration.',
      requiresTotpSetup: true,
    });
  }

  // Pack the Supabase session tokens inside the signed challenge JWT.
  // They are only handed to the client after TOTP is verified in Step 2.
  const challengeToken = issueChallenge({
    sub:          data.user.id,
    purpose:      'totp_login',
    accessToken:  data.session.access_token,
    refreshToken: data.session.refresh_token,
  });

  res.json({ requires2FA: true, challengeToken });
};

// LOGIN — STEP 2
export const verifyLoginTotp = async (req, res) => {
  const { challengeToken, totpCode } = req.body;
  const normalizedTotpCode = normalizeTotpCode(totpCode);

  if (!challengeToken || !totpCode) {
    return res.status(400).json({ error: 'challengeToken and totpCode are required.' });
  }

  if (!isValidTotpFormat(normalizedTotpCode)) {
    return res.status(400).json({ error: 'Verification code must be exactly 6 digits.' });
  }

  const challenge = readChallengeToken(challengeToken);
  if (challenge.expired) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
  if (challenge.invalid || !challenge.payload) {
    return res.status(401).json({ error: 'Invalid challenge token.' });
  }

  const payload = challenge.payload;

  if (payload.purpose !== 'totp_login') {
    return res.status(401).json({ error: 'Invalid challenge token.' });
  }

  const challengeState = await validateChallengeState(payload, { enforceLatest: true, countAttempt: true });
  if (!challengeState.ok) {
    return res.status(challengeState.status).json({ error: challengeState.error });
  }

  const { data: userRow, error: userError } = await withRetry(() =>
    supabase
      .from('users')
      .select('*')
      .eq('id', payload.sub)
      .single()
  );

  if (userError || !userRow) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const isValid = verifyTotpCode({ token: normalizedTotpCode, secret: userRow.totp_secret });

  if (!isValid) {
    logAuthEvent('totp_verify_failed', { sub: payload?.sub, purpose: payload?.purpose, cid: payload?.cid });
    return res.status(400).json({
      error: 'Invalid verification code. Please try again with the current code from your authenticator app.',
    });
  }

  await withRetry(() =>
    supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', userRow.id)
  );

  await retireChallenge(payload);
  logAuthEvent('totp_verify_success', { sub: payload?.sub, purpose: payload?.purpose, cid: payload?.cid });

  // Strip the TOTP secret before sending user data to the client
  const { totp_secret: _secret, ...safeUser } = userRow;

  res.json({
    accessToken:  payload.accessToken,
    refreshToken: payload.refreshToken,
    user:         safeUser,
  });
};

// GOOGLE OAUTH — STEP 1
export const googleCallback = async (req, res) => {
  const { accessToken, refreshToken } = req.body;

  if (!accessToken) {
    return res.status(400).json({ error: 'accessToken is required.' });
  }

  let user;
  const tokenVerification = await verifySupabaseAccessToken(accessToken);

  if (tokenVerification.valid && tokenVerification.payload?.sub) {
    const claims = tokenVerification.payload;
    user = {
      id: claims.sub,
      email: claims.email ?? '',
      user_metadata: claims.user_metadata ?? {},
      app_metadata: claims.app_metadata ?? {},
    };
    logger.info('[googleCallback] verified-token user:', user.id, user.email);
  }

  if (!user) {
    // If local verification is unavailable (e.g., temporary JWKS outage),
    // preserve existing resilience by falling back to Auth API verification.
    if (!tokenVerification.valid && tokenVerification.status && tokenVerification.status !== 503) {
      return res.status(tokenVerification.status).json({
        error: tokenVerification.reason || 'Invalid or expired Google session. Please try again.',
      });
    }

    try {
      const { data, error: authError } = await withRetry(() => supabaseAuth.auth.getUser(accessToken));
      if (authError || !data?.user) {
        logger.error('[googleCallback] network getUser failed:', authError?.message ?? 'no user');
        return res.status(401).json({ error: 'Invalid or expired Google session. Please try again.' });
      }
      user = data.user;
      logger.info('[googleCallback] network-verified user:', user.id, user.email);
    } catch (err) {
      logger.error('[googleCallback] network getUser threw:', err?.message);
      return res.status(503).json({
        error: 'Could not verify your Google session. Please try again.',
      });
    }
  }

  if (!user?.id) {
    return res.status(401).json({ error: 'Invalid Google session token. Please try again.' });
  }

  const email = user.email?.toLowerCase() || '';

  let userRow;
  try {
    const { data } = await withRetry(() =>
      supabase.from('users')
        .select('id, email, first_name, last_name, roles, two_factor_enabled, is_active, totp_secret, student_id')
        .eq('id', user.id)
        .maybeSingle()
    );
    userRow = data;
  } catch (err) {
    logger.error('[googleCallback] users table query failed after retries:', err.message);
    return res.status(503).json({ error: 'Database temporarily unavailable. Please try again in a moment.' });
  }

  if (userRow) {
    const isVoterOnly = isVoterOnlyRoles(userRow.roles);

    if (isVoterOnly && !isBisuEmail(userRow.email || email)) {
      return res.status(403).json({
        error: 'This personal account cannot be used as voter. Voter access requires a BISU Google account (@bisu.edu.ph).',
      });
    }

    if (!isVoterOnly) {
      return res.status(403).json({
        error: 'Google sign-in is only available for voter accounts.',
      });
    }

    if (!userRow.is_active) {
      return res.status(403).json({ error: 'Account is inactive. Please contact your administrator.' });
    }

    // If a voter row exists but profile is incomplete (no student_id), force the
    // same setup path as a brand-new voter so required profile data is collected.
    if (!userRow.student_id) {
      const { firstName, lastName } = splitGoogleName(user);

      const totpSecret = userRow.totp_secret || generateSecret();
      if (!userRow.totp_secret) {
        await supabase.from('users').update({ totp_secret: totpSecret }).eq('id', user.id);
      }

      const otpauthUrl = generateURI({ label: email, issuer: 'SchoolVoting', secret: totpSecret });
      const challengeToken = issueChallenge({
        sub: user.id,
        purpose: 'google_new_user',
        accessToken,
        refreshToken,
        totpSecret,
        email,
        firstName,
        lastName,
      });

      return res.json({
        status: 'new',
        challengeToken,
        email,
        firstName,
        lastName,
        otpauthUrl,
        secretKey: totpSecret,
      });
    }

    if (userRow.two_factor_enabled) {
      const challengeToken = issueChallenge({
        sub:          user.id,
        purpose:      'totp_login',
        accessToken,
        refreshToken,
      });
      return res.json({ status: 'totp', challengeToken });
    }

    const totpSecret = userRow.totp_secret || generateSecret();
    if (!userRow.totp_secret) {
      await supabase.from('users').update({ totp_secret: totpSecret }).eq('id', user.id);
    }
    const otpauthUrl = generateURI({ label: email, issuer: 'SchoolVoting', secret: totpSecret });
    const challengeToken = issueChallenge({
      sub: user.id, purpose: 'google_totp_setup', accessToken, refreshToken, totpSecret,
    });
    return res.json({ status: 'totp_setup', challengeToken, otpauthUrl, secretKey: totpSecret });
  }

  if (!isBisuEmail(email)) {
    return res.status(403).json({
      error: 'This personal Google account cannot register as voter. Use your BISU Google account (@bisu.edu.ph).',
    });
  }

  const { firstName, lastName } = splitGoogleName(user);

  const totpSecret = generateSecret();
  const otpauthUrl = generateURI({ label: email, issuer: 'SchoolVoting', secret: totpSecret });

  const challengeToken = issueChallenge({
    sub: user.id, purpose: 'google_new_user',
    accessToken, refreshToken, totpSecret, email, firstName, lastName,
  });

  return res.json({ status: 'new', challengeToken, email, firstName, lastName, otpauthUrl, secretKey: totpSecret });
};

// GOOGLE OAUTH — STEP 2
export const googleSetup = async (req, res) => {
  const { challengeToken, studentId, totpCode } = req.body;
  const normalizedTotpCode = normalizeTotpCode(totpCode);

  if (!challengeToken || !totpCode) {
    return res.status(400).json({ error: 'challengeToken and totpCode are required.' });
  }

  if (!isValidTotpFormat(normalizedTotpCode)) {
    return res.status(400).json({ error: 'Verification code must be exactly 6 digits.' });
  }

  const challenge = readChallengeToken(challengeToken);
  if (challenge.expired) {
    return res.status(401).json({ error: 'Setup session expired. Please sign in with Google again.' });
  }
  if (challenge.invalid || !challenge.payload) {
    return res.status(401).json({ error: 'Invalid challenge token.' });
  }

  const payload = challenge.payload;

  if (!['google_new_user', 'google_totp_setup'].includes(payload.purpose)) {
    return res.status(401).json({ error: 'Invalid challenge token.' });
  }

  const challengeState = await validateChallengeState(payload, { enforceLatest: true, countAttempt: true });
  if (!challengeState.ok) {
    return res.status(challengeState.status).json({ error: challengeState.error });
  }

  if (payload.purpose === 'google_new_user') {
    if (!isBisuEmail(payload.email)) {
      return res.status(403).json({
        error: 'This personal Google account cannot register as voter. Use your BISU Google account (@bisu.edu.ph).',
      });
    }

    if (!studentId) {
      return res.status(400).json({ error: 'studentId is required.' });
    }
    if (!/^\d{6}$/.test(studentId)) {
      return res.status(400).json({ error: 'School ID must be exactly 6 digits.' });
    }
    let existingId;
    try {
      const { data } = await withRetry(() =>
        supabase.from('users').select('id').eq('student_id', studentId).maybeSingle()
      );
      existingId = data;
    } catch {
      return res.status(503).json({ error: 'Database temporarily unavailable. Please try again.' });
    }
    if (existingId) {
      return res.status(409).json({ error: 'This School ID is already associated with another account.' });
    }
  }

  const isValid = verifyTotpCode({ token: normalizedTotpCode, secret: payload.totpSecret });
  if (!isValid) {
    logAuthEvent('totp_verify_failed', { sub: payload?.sub, purpose: payload?.purpose, cid: payload?.cid });
    return res.status(400).json({
      error: 'Invalid code. Please enter the current code from your authenticator app.',
    });
  }

  try {
    if (payload.purpose === 'google_new_user') {
      await withRetry(() => supabase.from('users').upsert({
        id:                 payload.sub,
        email:              payload.email,
        first_name:         payload.firstName,
        last_name:          payload.lastName,
        student_id:         studentId,
        roles:              ['voter'],
        is_active:          true,
        email_verified:     true,
        totp_secret:        payload.totpSecret,
        two_factor_enabled: true,
      }, { onConflict: 'id' }));
    } else {
      await withRetry(() =>
        supabase.from('users')
          .update({ two_factor_enabled: true, totp_secret: payload.totpSecret })
          .eq('id', payload.sub)
      );
    }

    await withRetry(() =>
      supabase.from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', payload.sub)
    );
  } catch (err) {
    logger.error('[googleSetup] DB write failed:', err.message);
    return res.status(503).json({ error: 'Database temporarily unavailable. Please try again.' });
  }

  let userRow;
  try {
    const { data } = await withRetry(() =>
      supabase.from('users').select('*').eq('id', payload.sub).single()
    );
    userRow = data;
  } catch (err) {
    logger.error('[googleSetup] final user fetch failed:', err.message);
    return res.status(503).json({ error: 'Database temporarily unavailable. Please try again.' });
  }

  const { totp_secret: _secret, ...safeUser } = userRow;

  await retireChallenge(payload);
  logAuthEvent('totp_verify_success', { sub: payload?.sub, purpose: payload?.purpose, cid: payload?.cid });

  return res.json({
    accessToken:  payload.accessToken,
    refreshToken: payload.refreshToken,
    user:         safeUser,
  });
};

// STAFF FIRST-LOGIN 2FA SETUP
export const setupStaffTotp = async (req, res) => {
  const { challengeToken, totpCode } = req.body;
  const normalizedTotpCode = normalizeTotpCode(totpCode);

  if (!challengeToken || !totpCode) {
    return res.status(400).json({ error: 'challengeToken and totpCode are required.' });
  }

  if (!isValidTotpFormat(normalizedTotpCode)) {
    return res.status(400).json({ error: 'Verification code must be exactly 6 digits.' });
  }

  const challenge = readChallengeToken(challengeToken);
  if (challenge.expired) {
    return res.status(401).json({ error: 'Setup session expired. Please log in again.' });
  }
  if (challenge.invalid || !challenge.payload) {
    return res.status(401).json({ error: 'Invalid challenge token.' });
  }

  const payload = challenge.payload;

  if (payload.purpose !== 'staff_totp_setup') {
    return res.status(401).json({ error: 'Invalid challenge token.' });
  }

  const challengeState = await validateChallengeState(payload, { enforceLatest: true, countAttempt: true });
  if (!challengeState.ok) {
    return res.status(challengeState.status).json({ error: challengeState.error });
  }

  const { data: userRow, error: userError } = await withRetry(() =>
    supabase
      .from('users')
      .select('*')
      .eq('id', payload.sub)
      .single()
  );

  if (userError || !userRow) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const isValid = verifyTotpCode({ token: normalizedTotpCode, secret: userRow.totp_secret });

  if (!isValid) {
    logAuthEvent('totp_verify_failed', { sub: payload?.sub, purpose: payload?.purpose, cid: payload?.cid });
    return res.status(400).json({
      error: 'Invalid verification code. Please try again with the current code from your authenticator app.',
    });
  }

  const { error: updateError } = await withRetry(() =>
    supabase
      .from('users')
      .update({ two_factor_enabled: true, last_login: new Date().toISOString() })
      .eq('id', userRow.id)
  );

  if (updateError) throw updateError;

  await retireChallenge(payload);
  logAuthEvent('totp_verify_success', { sub: payload?.sub, purpose: payload?.purpose, cid: payload?.cid });

  const { totp_secret: _secret, ...safeUser } = { ...userRow, two_factor_enabled: true };

  res.json({
    accessToken:  payload.accessToken,
    refreshToken: payload.refreshToken,
    user:         safeUser,
  });
};

// Logout endpoint (missing)
export const logout = async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (accessToken) {
      await supabaseAuth.auth.setAuth(accessToken);
      const { error } = await supabaseAuth.auth.signOut();
      if (error) throw error;
    }
    res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Logout failed.' });
  }
};

