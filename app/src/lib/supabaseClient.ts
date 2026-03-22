/**
 * Minimal Supabase client for the frontend.
 * Used ONLY for triggering Google OAuth redirects and reading the
 * resulting session after the redirect returns.
 *
 * The full session (access/refresh tokens) is exchanged with the
 * backend (Express API) after TOTP verification — this client is NOT
 * used to authenticate direct Supabase API calls from the browser.
 */
import { createClient } from '@supabase/supabase-js';

// This client is used ONLY for OAuth triggers and the /auth/callback exchange.
// It must NOT be the same client used by the backend (which uses the service role key).

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnon) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    // Persist the OAuth session in localStorage between page navigations
    persistSession: true,
    autoRefreshToken: false, // the backend manages tokens, not the Supabase client
    // Required: automatically exchanges the PKCE `?code=` param in the URL
    // that Supabase appends after the Google OAuth redirect
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});
