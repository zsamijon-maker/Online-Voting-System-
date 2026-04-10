import { createRemoteJWKSet, jwtVerify } from 'jose';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET;
const issuer = supabaseUrl ? `${supabaseUrl}/auth/v1` : null;
const audience = 'authenticated';

let jwks;

function getJwks() {
  if (!issuer) {
    throw new Error('SUPABASE_URL is not configured.');
  }

  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  }

  return jwks;
}

function hasUsableJwtSecret() {
  return (
    typeof supabaseJwtSecret === 'string' &&
    supabaseJwtSecret.trim().length > 0 &&
    supabaseJwtSecret !== 'your-supabase-jwt-secret-here'
  );
}

function getTokenAlg(token) {
  try {
    const [headerB64] = String(token).split('.');
    if (!headerB64) return null;
    const normalized = headerB64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf8');
    const header = JSON.parse(json);
    return typeof header?.alg === 'string' ? header.alg : null;
  } catch {
    return null;
  }
}

export async function verifySupabaseAccessToken(token) {
  if (!token) {
    return { valid: false, status: 401, reason: 'Missing access token.' };
  }

  try {
    const alg = getTokenAlg(token);
    const shouldUseSharedSecret = hasUsableJwtSecret() && (!alg || alg.startsWith('HS'));

    if (shouldUseSharedSecret) {
      const secret = new TextEncoder().encode(supabaseJwtSecret);
      const { payload } = await jwtVerify(token, secret, {
        algorithms: ['HS256'],
        issuer,
        audience,
      });

      return { valid: true, payload };
    }

    const { payload } = await jwtVerify(token, getJwks(), {
      issuer,
      audience,
    });

    return { valid: true, payload };
  } catch (error) {
    const code = error?.code;

    if (code === 'ERR_JWT_EXPIRED') {
      return { valid: false, status: 401, reason: 'Invalid or expired token.' };
    }

    if (
      code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' ||
      code === 'ERR_JWT_CLAIM_VALIDATION_FAILED' ||
      code === 'ERR_JWT_MALFORMED' ||
      code === 'ERR_JOSE_NOT_SUPPORTED'
    ) {
      return { valid: false, status: 401, reason: 'Invalid or expired token.' };
    }

    return {
      valid: false,
      status: 503,
      reason: 'Authentication service temporarily unavailable.',
      error,
      transient: true,
    };
  }
}
