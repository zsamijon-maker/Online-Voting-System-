// src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseRequestTimeoutMs = Number(process.env.SUPABASE_REQUEST_TIMEOUT_MS || 30000);
const supabaseFetchRetries = Number(process.env.SUPABASE_FETCH_RETRIES || 3);
const supabaseRetryDelayMs = Number(process.env.SUPABASE_RETRY_DELAY_MS || 250);

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableFetchError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();

  return (
    error?.name === 'AbortError' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    message.includes('fetch failed') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('socket hang up')
  );
};

const fetchWithTimeout = async (input, init = {}) => {
  let lastError;

  for (let attempt = 1; attempt <= supabaseFetchRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), supabaseRequestTimeoutMs);

    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } catch (error) {
      lastError = error;
      const shouldRetry = isRetryableFetchError(error) && attempt < supabaseFetchRetries;
      if (!shouldRetry) throw error;
      await sleep(supabaseRetryDelayMs * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
};

// Service-role DB client used for backend data operations.
// Keep this client isolated from interactive auth flows to avoid session/token bleed.
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  global: {
    fetch: fetchWithTimeout,
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
    },
  },
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

// Separate client for Auth API calls (sign-in/get-user/refresh/sign-out).
// Prefer anon key for least privilege, fall back to service role key if needed.
const authClientKey = supabaseAnonKey || supabaseServiceRoleKey;

export const supabaseAuth = createClient(supabaseUrl, authClientKey, {
  global: {
    fetch: fetchWithTimeout,
    headers: {
      apikey: authClientKey,
      Authorization: `Bearer ${authClientKey}`,
    },
  },
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
