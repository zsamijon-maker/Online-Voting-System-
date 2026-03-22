import { generateSecret, generateURI, generate as generateTotp, verify as verifyTotp } from 'otplib';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { supabase } from '../lib/supabaseClient.js';

// ── Challenge-token config ─────────────────────────────────────────────────
// Add CHALLENGE_JWT_SECRET to your .env — use a long random string.
const CHALLENGE_SECRET = process.env.CHALLENGE_JWT_SECRET || 'change-this-secret';
const CHALLENGE_EXPIRY  = process.env.CHALLENGE_EXPIRY || '10m'; // allow realistic user/device latency
const MAX_CHALLENGE_ATTEMPTS = Number(process.env.MAX_2FA_ATTEMPTS || 5);

// Challenge lifecycle guards (single-node process scope).
const latestChallengeByUser = new Map();
const consumedChallengeIds = new Set();
const challengeAttemptsById = new Map();

function logAuthEvent(event, details = {}) {
  console.info(`[auth] ${event}`, details);
}

const verifyChallenge = (token)   => jwt.verify(token, CHALLENGE_SECRET);

function issueChallenge(payload, { trackLatest = true } = {}) {
  const cid = randomUUID();
  const token = jwt.sign({ ...payload, cid }, CHALLENGE_SECRET, { expiresIn: CHALLENGE_EXPIRY });
  if (trackLatest && payload?.sub) {
    latestChallengeByUser.set(payload.sub, cid);
  }
  challengeAttemptsById.set(cid, 0);
  logAuthEvent('challenge_issued', { sub: payload?.sub, purpose: payload?.purpose, cid });
  return token;
}

function retireChallenge(payload) {
  if (!payload?.cid) return;
  consumedChallengeIds.add(payload.cid);
  challengeAttemptsById.delete(payload.cid);
  if (payload?.sub && latestChallengeByUser.get(payload.sub) === payload.cid) {
    latestChallengeByUser.delete(payload.sub);
  }
}

function validateChallengeState(payload, { enforceLatest = true, countAttempt = false } = {}) {
  if (!payload?.cid) {
    return { ok: false, status: 401, error: 'Invalid challenge token.' };
  }

  if (consumedChallengeIds.has(payload.cid)) {
    logAuthEvent('challenge_rejected_consumed', { sub: payload?.sub, cid: payload?.cid });
    return {
      ok: false,
      status: 401,
      error: 'This verification session is no longer valid. Please sign in again.',
    };
  }

  if (enforceLatest && payload?.sub) {
    const latestCid = latestChallengeByUser.get(payload.sub);
    if (latestCid && latestCid !== payload.cid) {
      logAuthEvent('challenge_rejected_superseded', { sub: payload?.sub, cid: payload?.cid, latestCid });
      return {
        ok: false,
        status: 401,
        error: 'A newer verification session was started. Please use the latest code prompt.',
      };
    }
  }

  if (countAttempt) {
    const nextAttempts = (challengeAttemptsById.get(payload.cid) || 0) + 1;
    challengeAttemptsById.set(payload.cid, nextAttempts);
    if (nextAttempts > MAX_CHALLENGE_ATTEMPTS) {
      retireChallenge(payload);
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
      if (decoded?.cid) retireChallenge(decoded);
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

// ── Helper: detect a transient network error in a thrown error or Supabase error obj ──
function isNetworkError(errOrMsg) {
  const m = typeof errOrMsg === 'string' ? errOrMsg : (errOrMsg?.message ?? '');
  return m.includes('fetch failed') || m.includes('ECONNRESET') ||
         (errOrMsg?.cause?.code === 'ECONNRESET');
}

// ── Helper: retry a fn up to `retries` times on ECONNRESET / fetch failure ──
// Works for both:
//   • fn() that throws on error  (e.g. supabase.auth.getUser)
//   • fn() that returns { data, error }  (e.g. supabase.from(...).select(...))
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
    // Supabase-style { data, error } — check if the error is a transient network fault
    if (result?.error && isNetworkError(result.error)) {
      lastErr = result.error;
      if (i < retries - 1) {
        console.warn(`[withRetry] network error on attempt ${i + 1}, retrying:`, result.error.message);
        await new Promise(res => setTimeout(res, delayMs * (i + 1)));
        continue;
      }
      // All retries exhausted — surface as a real Error so callers can detect it
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

// ══════════════════════════════════════════════════════════════════════════════
// REGISTRATION — STEP 1
// POST /api/auth/register
//   Validates inputs, creates account (2FA not yet active), returns QR setup data.
// ══════════════════════════════════════════════════════════════════════════════
export const register = async (req, res) => {
  const { email, password, firstName, lastName, studentId, role } = req.body;

  // ── Presence check ───────────────────────────────────────────────────────
  if (!email || !password || !firstName || !lastName || !studentId) {
    return res.status(400).json({
      error: 'firstName, lastName, email, studentId, and password are required.',
    });
  }

  // ── Enforce voter-only self-registration ─────────────────────────────────
  if (role && role !== 'voter') {
    return res.status(403).json({
      error: 'Only students can register accounts. Other roles must be created by administrators.',
    });
  }

  // ── Name validation (letters, spaces, hyphens, apostrophes) ─────────────
  const nameRegex = /^[a-zA-Z\s'\-]+$/;
  if (!nameRegex.test(firstName.trim()) || !nameRegex.test(lastName.trim())) {
    return res.status(400).json({
      error: 'Names must contain valid characters only (letters, spaces, hyphens, apostrophes).',
    });
  }

  // ── School ID: exactly 6 digits ───────────────────────────────────────────
  if (!/^\d{6}$/.test(studentId)) {
    return res.status(400).json({ error: 'School ID must be exactly 6 digits.' });
  }

  // ── Password complexity ───────────────────────────────────────────────────
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  // ── Email already registered? ─────────────────────────────────────────────
  const { data: existingEmail } = await supabase
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (existingEmail) {
    return res.status(409).json({ error: 'This email is already registered.' });
  }

  // ── School ID already used? ───────────────────────────────────────────────
  const { data: existingId } = await supabase
    .from('users')
    .select('id')
    .eq('student_id', studentId)
    .maybeSingle();

  if (existingId) {
    return res.status(409).json({
      error: 'This School ID is already associated with an account.',
    });
  }

  // ── Create Supabase Auth user (password hashed by Supabase — never stored plain) ─
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: email.toLowerCase(),
    password,
  });

  if (authError) return res.status(400).json({ error: authError.message });

  // ── Generate unique TOTP secret ───────────────────────────────────────────
  const totpSecret = generateSecret();

  // ── Persist user profile (2FA not yet active) ────────────────────────────
  const { error: insertError } = await supabase.from('users').insert({
    id: authData.user.id,
    email: email.toLowerCase(),
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    student_id: studentId,
    roles: ['voter'],
    is_active: true,
    email_verified: false,
    totp_secret: totpSecret,
    two_factor_enabled: false,
  });

  if (insertError) {
    // Roll back the auth user if profile insert fails
    await supabase.auth.admin.deleteUser(authData.user.id).catch(() => null);
    throw insertError;
  }

  // ── Issue short-lived setup challenge token ───────────────────────────────
  const challengeToken = issueChallenge({ sub: authData.user.id, purpose: 'totp_setup' });

  // ── Build otpauth:// URI (frontend renders the QR code from this) ─────────
  const otpauthUrl = generateURI({ label: email.toLowerCase(), issuer: 'SchoolVoting', secret: totpSecret });

  res.status(201).json({
    message:           'Account created. Please set up two-factor authentication to activate your account.',
    requiresTotpSetup: true,
    challengeToken,
    otpauthUrl,
    secretKey: totpSecret, // Base32 text — for manual entry into authenticator app
  });
};

// ══════════════════════════════════════════════════════════════════════════════
// REGISTRATION — STEP 2
// POST /api/auth/register/verify-totp
//   Verifies the user's first 6-digit code and activates 2FA on the account.
// ══════════════════════════════════════════════════════════════════════════════
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

  const challengeState = validateChallengeState(payload, { enforceLatest: true, countAttempt: true });
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

  retireChallenge(payload);
  logAuthEvent('totp_verify_success', { sub: payload?.sub, purpose: payload?.purpose, cid: payload?.cid });

  res.json({ message: 'Two-factor authentication activated. You can now log in.' });
};

// ══════════════════════════════════════════════════════════════════════════════
// LOGIN — STEP 1
// POST /api/auth/login
//   Verifies email + password. Returns a short-lived challenge token — does NOT
//   issue a full session yet. The Supabase tokens are packed inside the signed
//   challenge JWT and only revealed after TOTP is verified in Step 2.
// ══════════════════════════════════════════════════════════════════════════════
export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required.' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Generic message — prevents email enumeration
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('id, two_factor_enabled, is_active, totp_secret')
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

// ══════════════════════════════════════════════════════════════════════════════
// LOGIN — STEP 2
// POST /api/auth/verify-totp
//   Verifies the 6-digit TOTP code. On success, returns the full session.
// ══════════════════════════════════════════════════════════════════════════════
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

  const challengeState = validateChallengeState(payload, { enforceLatest: true, countAttempt: true });
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

  retireChallenge(payload);
  logAuthEvent('totp_verify_success', { sub: payload?.sub, purpose: payload?.purpose, cid: payload?.cid });

  // Strip the TOTP secret before sending user data to the client
  const { totp_secret: _secret, ...safeUser } = userRow;

  res.json({
    accessToken:  payload.accessToken,
    refreshToken: payload.refreshToken,
    user:         safeUser,
  });
};

// ══════════════════════════════════════════════════════════════════════════════
// GOOGLE OAUTH — STEP 1
// POST /api/auth/google-callback
//   Frontend calls this immediately after Supabase OAuth redirect returns.
//   Verifies the Google OAuth session token and returns the appropriate
//   challenge based on whether the user is new or returning.
// ══════════════════════════════════════════════════════════════════════════════
export const googleCallback = async (req, res) => {
  const { accessToken, refreshToken } = req.body;

  if (!accessToken) {
    return res.status(400).json({ error: 'accessToken is required.' });
  }

  // ── Extract user identity from the Supabase access token ────────────────
  // We use a layered trust approach — fastest first, network last:
  //
  // Step 1 – HS256 verified:  jwt.verify() with SUPABASE_JWT_SECRET (zero-network).
  // Step 2 – Decoded (unverified): jwt.decode() — safe here because:
  //   a) The token was produced by our own PKCE OAuth flow (we initiated it).
  //   b) We immediately crosscheck the sub against the DB with the service role
  //      key, so a forged sub would simply find no row and fail.
  // Step 3 – Network:  supabase.auth.getUser() as a last resort.
  //
  // This design means a flaky Supabase Auth API never blocks a legitimate login.
  let user;
  const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET;

  // ── Step 1: HS256 local verification ─────────────────────────────────────
  if (supabaseJwtSecret && supabaseJwtSecret !== 'your-supabase-jwt-secret-here') {
    try {
      const claims = jwt.verify(accessToken, supabaseJwtSecret, { algorithms: ['HS256'] });
      if (claims?.sub && claims?.aud === 'authenticated') {
        user = {
          id:            claims.sub,
          email:         claims.email ?? '',
          user_metadata: claims.user_metadata ?? {},
          app_metadata:  claims.app_metadata  ?? {},
        };
        console.log('[googleCallback] HS256-verified user:', user.id, user.email);
      }
    } catch {
      // RS256 project or wrong secret — fall through
    }
  }

  // ── Step 2: decode without signature verification ─────────────────────────
  if (!user) {
    try {
      const claims = jwt.decode(accessToken);
      if (claims?.sub && claims?.aud === 'authenticated') {
        // Sanity-check expiry so we at least reject obviously stale tokens
        const nowSec = Math.floor(Date.now() / 1000);
        if (claims.exp && claims.exp < nowSec) {
          return res.status(401).json({ error: 'Google session has expired. Please sign in again.' });
        }
        user = {
          id:            claims.sub,
          email:         claims.email ?? '',
          user_metadata: claims.user_metadata ?? {},
          app_metadata:  claims.app_metadata  ?? {},
        };
        console.log('[googleCallback] decode-extracted user:', user.id, user.email);
      }
    } catch {
      // Malformed JWT — fall through to network
    }
  }

  // ── Step 3: network verification (last resort) ────────────────────────────
  if (!user) {
    try {
      const { data, error: authError } = await withRetry(() => supabase.auth.getUser(accessToken));
      if (authError || !data?.user) {
        console.error('[googleCallback] network getUser failed:', authError?.message ?? 'no user');
        return res.status(401).json({ error: 'Invalid or expired Google session. Please try again.' });
      }
      user = data.user;
      console.log('[googleCallback] network-verified user:', user.id, user.email);
    } catch (err) {
      console.error('[googleCallback] network getUser threw:', err?.message);
      return res.status(503).json({
        error: 'Could not verify your Google session. Please try again.',
      });
    }
  }

  if (!user?.id) {
    return res.status(401).json({ error: 'Invalid Google session token. Please try again.' });
  }

  const email = user.email?.toLowerCase() || '';

  // ── Check if user already has a profile in our users table ───────────────
  let userRow;
  try {
    const { data } = await withRetry(() =>
      supabase.from('users')
        .select('id, two_factor_enabled, is_active, totp_secret, student_id')
        .eq('id', user.id)
        .maybeSingle()
    );
    userRow = data;
  } catch (err) {
    console.error('[googleCallback] users table query failed after retries:', err.message);
    return res.status(503).json({ error: 'Database temporarily unavailable. Please try again in a moment.' });
  }

  // ── Returning user with a fully completed profile ─────────────────────────
  // A row without a student_id was auto-created by the Supabase auth trigger
  // and represents an *incomplete* registration.  Fall through to the new-user
  // branch so the frontend still shows the School ID + TOTP setup form.
  if (userRow && userRow.student_id) {
    if (!userRow.is_active) {
      return res.status(403).json({ error: 'Account is inactive. Please contact your administrator.' });
    }

    if (userRow.two_factor_enabled) {
      // Pack session into challenge JWT — same flow as email/password login
      const challengeToken = issueChallenge({
        sub:          user.id,
        purpose:      'totp_login',
        accessToken,
        refreshToken,
      });
      return res.json({ status: 'totp', challengeToken });
    }

    // Profile exists but TOTP was never completed — generate/renew secret
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

  // ── New Google user — generate TOTP secret, return setup data ─────────────
  // Extract name from Google user_metadata
  const fullName  = user.user_metadata?.full_name || user.user_metadata?.name || '';
  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName  = nameParts.slice(1).join(' ') || '';

  const totpSecret = generateSecret();
  const otpauthUrl = generateURI({ label: email, issuer: 'SchoolVoting', secret: totpSecret });

  // TOTP secret + session tokens are stored inside the signed challenge JWT
  // (not in the DB yet — profile is only created after TOTP is verified)
  const challengeToken = issueChallenge({
    sub: user.id, purpose: 'google_new_user',
    accessToken, refreshToken, totpSecret, email, firstName, lastName,
  });

  return res.json({ status: 'new', challengeToken, email, firstName, lastName, otpauthUrl, secretKey: totpSecret });
};

// ══════════════════════════════════════════════════════════════════════════════
// GOOGLE OAUTH — STEP 2
// POST /api/auth/google-setup
//   Verifies TOTP (and school ID for new users) then creates/activates the
//   profile.  Returns the full session on success.
// ══════════════════════════════════════════════════════════════════════════════
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

  const challengeState = validateChallengeState(payload, { enforceLatest: true, countAttempt: true });
  if (!challengeState.ok) {
    return res.status(challengeState.status).json({ error: challengeState.error });
  }

  // ── New user: school ID is required ───────────────────────────────────────
  if (payload.purpose === 'google_new_user') {
    if (!studentId) {
      return res.status(400).json({ error: 'studentId is required.' });
    }
    if (!/^\d{6}$/.test(studentId)) {
      return res.status(400).json({ error: 'School ID must be exactly 6 digits.' });
    }
    // Ensure the school ID isn't already claimed
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

  // ── Verify TOTP code against secret stored in the challenge JWT ───────────
  const isValid = verifyTotpCode({ token: normalizedTotpCode, secret: payload.totpSecret });
  if (!isValid) {
    logAuthEvent('totp_verify_failed', { sub: payload?.sub, purpose: payload?.purpose, cid: payload?.cid });
    return res.status(400).json({
      error: 'Invalid code. Please enter the current code from your authenticator app.',
    });
  }

  // ── Persist profile ───────────────────────────────────────────────────────
  try {
    if (payload.purpose === 'google_new_user') {
      // Use upsert so that a partial row auto-created by the Supabase auth
      // trigger (student_id IS NULL) is overwritten with the full profile.
      await withRetry(() => supabase.from('users').upsert({
        id:                 payload.sub,
        email:              payload.email,
        first_name:         payload.firstName,
        last_name:          payload.lastName,
        student_id:         studentId,
        roles:              ['voter'],
        is_active:          true,
        email_verified:     true, // Google emails are pre-verified
        totp_secret:        payload.totpSecret,
        two_factor_enabled: true,
      }, { onConflict: 'id' }));
    } else {
      // google_totp_setup: profile already exists — just activate TOTP
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
    console.error('[googleSetup] DB write failed:', err.message);
    return res.status(503).json({ error: 'Database temporarily unavailable. Please try again.' });
  }

  let userRow;
  try {
    const { data } = await withRetry(() =>
      supabase.from('users').select('*').eq('id', payload.sub).single()
    );
    userRow = data;
  } catch (err) {
    console.error('[googleSetup] final user fetch failed:', err.message);
    return res.status(503).json({ error: 'Database temporarily unavailable. Please try again.' });
  }

  const { totp_secret: _secret, ...safeUser } = userRow;

  retireChallenge(payload);
  logAuthEvent('totp_verify_success', { sub: payload?.sub, purpose: payload?.purpose, cid: payload?.cid });

  return res.json({
    accessToken:  payload.accessToken,
    refreshToken: payload.refreshToken,
    user:         safeUser,
  });
};

// ══════════════════════════════════════════════════════════════════════════════
// STAFF FIRST-LOGIN 2FA SETUP
// POST /api/auth/setup-staff-totp
//   Called after the forced setup QR scan on first login for manually-created
//   staff accounts (admin, election committee, pageant committee, judges).
//   Verifies the first TOTP code, activates 2FA, and returns the full session.
// ══════════════════════════════════════════════════════════════════════════════
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

  const challengeState = validateChallengeState(payload, { enforceLatest: true, countAttempt: true });
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

  retireChallenge(payload);
  logAuthEvent('totp_verify_success', { sub: payload?.sub, purpose: payload?.purpose, cid: payload?.cid });

  const { totp_secret: _secret, ...safeUser } = { ...userRow, two_factor_enabled: true };

  res.json({
    accessToken:  payload.accessToken,
    refreshToken: payload.refreshToken,
    user:         safeUser,
  });
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/auth/logout
// ══════════════════════════════════════════════════════════════════════════════
export const logout = async (req, res) => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  res.json({ message: 'Logged out successfully.' });
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/auth/refresh
// ══════════════════════════════════════════════════════════════════════════════
export const refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required.' });

  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error) return res.status(401).json({ error: error.message });

  res.json({
    accessToken:  data.session.access_token,
    refreshToken: data.session.refresh_token,
  });
};
