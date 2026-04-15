/**
 * /auth/callback
 *
 * Handles the browser redirect that Supabase sends after a successful
 * Google OAuth flow.  The page:
 *   1. Reads the OAuth session from Supabase (PKCE exchange happens automatically).
 *   2. Sends the session tokens to the backend for verification.
 *   3. Shows the correct follow-up UI:
 *        - 'new'        → new Google user: collect School ID + TOTP setup
 *        - 'totp_setup' → existing profile but TOTP never activated: TOTP setup only
 *        - 'totp'       → returning user: just enter the 6-digit code
 *
 * ─── UI ONLY changed — all logic, API calls, state, and handlers are untouched ───
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Vote, ShieldCheck, Copy, CheckCheck, Loader2, AlertCircle, ChevronLeft,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabaseClient';
import { getOAuthCallbackUrl, getPostLoginRedirectTarget } from '@/lib/runtimeConfig';
import { api, setToken, camelize } from '@/lib/api';
import type { User } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';

// ─── Types (unchanged) ────────────────────────────────────────────────────────
type Phase = 'processing' | 'new' | 'totp_setup' | 'totp' | 'error';

interface BackendResponse {
  status: 'new' | 'totp_setup' | 'totp';
  challengeToken: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  otpauthUrl?: string;
  secretKey?: string;
}

// ─── Small UI primitives (same pattern as LoginPage) ─────────────────────────
const FieldInput = ({
  id, type = 'text', placeholder, value, onChange, required, autoFocus,
  inputMode, pattern, maxLength, autoComplete, className = '',
}: {
  id: string; type?: string; placeholder?: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean; autoFocus?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  pattern?: string; maxLength?: number; autoComplete?: string; className?: string;
}) => (
  <input
    id={id} type={type} placeholder={placeholder} value={value}
    onChange={onChange} required={required} autoFocus={autoFocus}
    inputMode={inputMode} pattern={pattern} maxLength={maxLength}
    autoComplete={autoComplete}
    className={[
      'w-full rounded-xl border border-gray-200 bg-gray-50/60 px-3.5 py-2.5 text-sm text-gray-900',
      'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/30 focus:border-[#1E3A8A]',
      'transition-all duration-150',
      className,
    ].join(' ')}
  />
);

const PrimaryBtn = ({
  type = 'button', onClick, disabled, loading, children, color = 'blue',
}: {
  type?: 'button' | 'submit'; onClick?: () => void;
  disabled?: boolean; loading?: boolean;
  children: React.ReactNode; color?: 'blue' | 'green';
}) => {
  const base = color === 'green'
    ? 'bg-green-600 hover:bg-green-700 shadow-green-200'
    : 'bg-[#1E3A8A] hover:bg-[#1d3580] shadow-blue-200';
  return (
    <button
      type={type} onClick={onClick} disabled={disabled || loading}
      className={`
        w-full flex items-center justify-center gap-2 px-4 py-2.5
        text-sm font-semibold text-white rounded-xl shadow-sm
        transition-all duration-150 hover:-translate-y-px active:translate-y-0
        disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0
        ${base}
      `}
    >
      {children}
    </button>
  );
};

const OutlineBtn = ({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) => (
  <button
    type="button" onClick={onClick}
    className="
      w-full flex items-center justify-center gap-2 px-4 py-2.5
      text-sm font-medium text-gray-700 rounded-xl border border-gray-200
      bg-white hover:bg-gray-50 transition-all duration-150
    "
  >
    {children}
  </button>
);

const FieldRow = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-gray-700 tracking-wide">{label}</label>
    {children}
    {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
  </div>
);

const TotpSetupBlock = ({
  otpauthUrl, secretKey, copied, onCopy,
}: { otpauthUrl: string; secretKey: string; copied: boolean; onCopy: () => void }) => (
  <div className="space-y-4">
    <div className="flex justify-center">
      <div className="p-3 bg-white border border-gray-100 rounded-2xl shadow-md inline-block">
        <QRCodeSVG value={otpauthUrl} size={168} level="M" />
      </div>
    </div>
    <div>
      <p className="text-[11px] text-center text-gray-400 mb-1.5">
        Can't scan? Enter this key in your authenticator app:
      </p>
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
        <code className="flex-1 text-[11px] font-mono text-gray-700 break-all select-all">{secretKey}</code>
        <button
          type="button" onClick={onCopy}
          className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          title="Copy secret key"
        >
          {copied ? <CheckCheck className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────
export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUserFromCallback } = useAuth();
  const { showError, showSuccess } = useNotification();
  const postLoginRedirectUrl = getPostLoginRedirectTarget();

  const redirectAfterLogin = () => {
    if (postLoginRedirectUrl.startsWith('http://') || postLoginRedirectUrl.startsWith('https://')) {
      window.location.assign(postLoginRedirectUrl);
      return;
    }

    navigate(postLoginRedirectUrl, { replace: true });
  };

  // ── All state unchanged ───────────────────────────────────────────────────
  const [phase, setPhase]               = useState<Phase>('processing');
  const [error, setError]               = useState('');
  const [isLoading, setIsLoading]       = useState(false);
  const [challengeToken, setChallenge]  = useState('');
  const [copiedSecret, setCopied]       = useState(false);

  const [totpCode, setTotpCode]         = useState('');
  const [otpauthUrl, setOtpauthUrl]     = useState('');
  const [secretKey, setSecretKey]       = useState('');
  const [prefillEmail, setPrefillEmail] = useState('');
  const [prefillFirst, setPrefillFirst] = useState('');
  const [prefillLast, setPrefillLast]   = useState('');
  const [studentId, setStudentId]       = useState('');
  const [setupTotpCode, setSetupCode]   = useState('');

  const otpSubmitInFlightRef        = useRef(false);
  const callbackSubmitInFlightRef   = useRef(false);
  const callbackHandledRef          = useRef(false);

  // ── All handlers unchanged ────────────────────────────────────────────────
  const normalizeTotpCode = (input: string) =>
    String(input ?? '').trim().replace(/\s+/g, '').replace(/\D/g, '').slice(0, 6);

  const restartGoogleSignIn = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getOAuthCallbackUrl(),
          queryParams: { access_type: 'offline', prompt: 'select_account' },
        },
      });
    } catch {
      setError('Could not restart Google sign-in. Please return to login and try again.');
      setPhase('error');
    }
  };

  useEffect(() => {
    let done = false;

    const handleSession = async (accessToken: string, refreshToken: string) => {
      if (callbackSubmitInFlightRef.current || callbackHandledRef.current) return;
      callbackSubmitInFlightRef.current = true;
      try {
        const response = await api.post<BackendResponse>('/api/auth/google-callback', {
          accessToken, refreshToken,
        });
        callbackHandledRef.current = true;
        setStudentId('');
        setSetupCode('');
        setTotpCode('');
        setChallenge(response.challengeToken);
        if (response.status === 'new' || response.status === 'totp_setup') {
          setOtpauthUrl(response.otpauthUrl || '');
          setSecretKey(response.secretKey   || '');
          setPrefillEmail(response.email    || '');
          setPrefillFirst(response.firstName || '');
          setPrefillLast(response.lastName  || '');
          setPhase(response.status);
        } else {
          setPhase('totp');
        }
      } catch (err) {
        const msg = (err as Error).message || 'Something went wrong during sign-in.';
        const isDomainRestriction = /bisu\.edu\.ph|personal\s+google\s+account|register\s+as\s+voter/i.test(msg);
        const finalErrorMessage =
          msg === 'Failed to fetch'
            ? 'Cannot reach the server. Please make sure the backend is running on port 5000 and try again.'
            : isDomainRestriction
              ? 'Personal Google accounts cannot register as voter. Please use your BISU account (@bisu.edu.ph).'
              : msg;

        showError(finalErrorMessage);
        setError(
          finalErrorMessage
        );
        setPhase('error');
      } finally {
        callbackSubmitInFlightRef.current = false;
      }
    };

    const consumeExistingSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (done || !session || callbackHandledRef.current) return;
        done = true;
        subscription.unsubscribe();
        await handleSession(session.access_token, session.refresh_token ?? '');
      } catch { /* Keep listener path active as fallback. */ }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (done || !session) return;
      done = true;
      subscription.unsubscribe();
      void handleSession(session.access_token, session.refresh_token ?? '');
    });

    void consumeExistingSession();

    const timeout = setTimeout(() => {
      if (!done) {
        done = true;
        subscription.unsubscribe();
        setError('Sign-in timed out. The Google session may have expired — please try again.');
        setPhase('error');
      }
    }, 30_000);

    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
  }, [showError]);

  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeToken) {
      showError('Your verification session expired. Please sign in with Google again.');
      setPhase('error'); return;
    }
    if (otpSubmitInFlightRef.current) return;
    otpSubmitInFlightRef.current = true;
    setIsLoading(true);
    try {
      const data = await api.post<{ accessToken: string; refreshToken: string; user: unknown }>(
        '/api/auth/verify-totp',
        { challengeToken, totpCode: normalizeTotpCode(totpCode) }
      );
      await supabase.auth.setSession({ access_token: data.accessToken, refresh_token: data.refreshToken }).catch(() => null);
      setToken(data.accessToken, data.refreshToken);
      setUserFromCallback(camelize<User>(data.user));
      showSuccess('Signed in with Google!');
      redirectAfterLogin();
    } catch (err) {
      showError((err as Error).message || 'Invalid code. Please try again.');
      setTotpCode('');
    } finally {
      otpSubmitInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const handleCompleteSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeToken) {
      showError('Your setup session expired. Please sign in with Google again.');
      setPhase('error'); return;
    }
    if (!setupTotpCode || setupTotpCode.length !== 6) return;
    if (otpSubmitInFlightRef.current) return;
    otpSubmitInFlightRef.current = true;
    setIsLoading(true);
    try {
      const data = await api.post<{ accessToken: string; refreshToken: string; user: unknown }>(
        '/api/auth/google-setup',
        { challengeToken, studentId: phase === 'new' ? studentId : undefined, totpCode: normalizeTotpCode(setupTotpCode) }
      );
      await supabase.auth.setSession({ access_token: data.accessToken, refresh_token: data.refreshToken }).catch(() => null);
      setToken(data.accessToken, data.refreshToken);
      setUserFromCallback(camelize<User>(data.user));
      showSuccess('Account activated! Welcome to SchoolVote.');
      redirectAfterLogin();
    } catch (err) {
      showError((err as Error).message || 'Setup failed. Please try again.');
      setSetupCode('');
    } finally {
      otpSubmitInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const copySecret = async () => {
    await navigator.clipboard.writeText(secretKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex bg-[#F7F8FC]">

      {/* ── LEFT PANEL — matches LoginPage branding ───────────────────────── */}
      <aside className="hidden lg:flex lg:w-[44%] xl:w-[40%] relative flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0c1f4a] to-[#1E3A8A] p-12 text-white">
        {/* Decorative circles */}
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute top-1/2 -right-24 w-64 h-64 rounded-full bg-[#f2c94c]/10 pointer-events-none" />
        <div className="absolute -bottom-16 left-1/3 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '28px 28px' }}
        />

        {/* Brand */}
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
            <Vote className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            School<span className="text-[#f2c94c]">Vote</span>
          </span>
        </div>

        {/* Headline */}
        <div className="relative space-y-6">
          <div className="w-10 h-1 bg-[#f2c94c] rounded-full" />
          <h2 className="text-3xl xl:text-4xl font-extrabold leading-[1.15] tracking-tight">
            Almost there.<br />
            <span className="text-[#f2c94c]">Complete your</span><br />
            secure setup.
          </h2>
          <p className="text-blue-200/80 text-sm leading-relaxed max-w-xs">
            We're verifying your Google identity and setting up two-factor authentication to protect your account.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {['Google OAuth 2.0', 'TOTP 2FA', 'End-to-end encrypted'].map((pill) => (
              <span
                key={pill}
                className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-full px-3 py-1 text-[11px] font-medium text-white/80"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#f2c94c] flex-shrink-0" />
                {pill}
              </span>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <div className="relative text-xs text-blue-300/70 flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Protected by Supabase Auth · 256-bit encryption</span>
        </div>
      </aside>

      {/* ── RIGHT PANEL ───────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col">

        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#1E3A8A] flex items-center justify-center">
              <Vote className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold text-gray-900">
              School<span className="text-[#2563EB]">Vote</span>
            </span>
          </div>
          <span className="text-[11px] text-gray-400 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Secure connection
          </span>
        </div>

        {/* Content area */}
        <div className="flex-1 flex items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-[420px]">

            {/* ════════════════════════════════════
                PROCESSING — spinner
            ════════════════════════════════════ */}
            {phase === 'processing' && (
              <div className="flex flex-col items-center gap-5 py-10">
                <div className="w-16 h-16 rounded-2xl bg-[#EFF3FF] flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-[#1E3A8A] animate-spin" />
                </div>
                <div className="text-center">
                  <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Completing sign-in</h1>
                  <p className="text-sm text-gray-500 mt-1">Verifying your Google account…</p>
                </div>
                {/* Animated progress bar */}
                <div className="w-48 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#1E3A8A] rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
              </div>
            )}

            {/* ════════════════════════════════════
                ERROR
            ════════════════════════════════════ */}
            {phase === 'error' && (
              <div className="space-y-6">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
                    <AlertCircle className="w-6 h-6 text-red-500" />
                  </div>
                  <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Sign-in failed</h1>
                  <p className="text-sm text-gray-500 mt-2 leading-relaxed">{error}</p>
                </div>

                <div className="space-y-2.5">
                  <PrimaryBtn onClick={() => void restartGoogleSignIn()}>
                    Try Again with Google
                  </PrimaryBtn>
                  <OutlineBtn onClick={() => navigate('/login')}>
                    <ChevronLeft className="w-4 h-4" /> Back to Login
                  </OutlineBtn>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════
                RETURNING USER — TOTP
            ════════════════════════════════════ */}
            {phase === 'totp' && (
              <div className="space-y-6">
                <button
                  onClick={() => navigate('/login')}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Back to login
                </button>

                <div>
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                    <ShieldCheck className="w-6 h-6 text-[#1E3A8A]" />
                  </div>
                  <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Two-Factor Auth</h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Open your authenticator app and enter the current 6-digit code to complete sign-in.
                  </p>
                </div>

                <form onSubmit={handleVerifyTotp} className="space-y-4">
                  <FieldRow label="Verification code" hint="Code refreshes every 30 seconds">
                    <FieldInput
                      id="totp-code"
                      type="text"
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      placeholder="000 000"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="text-center text-2xl tracking-[0.35em] font-mono"
                      autoFocus
                      required
                    />
                  </FieldRow>

                  <PrimaryBtn type="submit" loading={isLoading} disabled={totpCode.length !== 6}>
                    {isLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Verifying…</span></>
                      : <><ShieldCheck className="w-4 h-4" /><span>Verify &amp; Sign In</span></>}
                  </PrimaryBtn>
                </form>
              </div>
            )}

            {/* ════════════════════════════════════
                NEW USER / TOTP_SETUP
            ════════════════════════════════════ */}
            {(phase === 'new' || phase === 'totp_setup') && (
              <div className="space-y-5">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mb-4">
                    <ShieldCheck className="w-6 h-6 text-green-600" />
                  </div>
                  <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">
                    {phase === 'new' ? 'Complete Registration' : 'Set Up Two-Factor Auth'}
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">
                    {phase === 'new'
                      ? `Welcome, ${prefillFirst}! Enter your School ID and scan the QR code to activate your account.`
                      : 'Scan the QR code with your authenticator app, then enter the 6-digit code.'}
                  </p>
                </div>

                {/* Pre-filled info badge — new users only */}
                {phase === 'new' && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 space-y-1">
                    <p className="text-xs font-semibold text-blue-800">
                      {prefillFirst} {prefillLast}
                    </p>
                    <p className="text-[11px] text-blue-600">{prefillEmail}</p>
                  </div>
                )}

                <form onSubmit={handleCompleteSetup} className="space-y-4">
                  {/* School ID — new users only */}
                  {phase === 'new' && (
                    <FieldRow label="School ID" hint="Must be exactly 6 digits">
                      <FieldInput
                        id="cb-student-id"
                        placeholder="123456"
                        maxLength={6}
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        autoComplete="off"
                        required
                      />
                    </FieldRow>
                  )}

                  {/* QR code + secret key */}
                  <TotpSetupBlock
                    otpauthUrl={otpauthUrl}
                    secretKey={secretKey}
                    copied={copiedSecret}
                    onCopy={copySecret}
                  />

                  {/* TOTP input */}
                  <FieldRow label="Enter code from your app">
                    <FieldInput
                      id="cb-totp"
                      type="text"
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      placeholder="000 000"
                      value={setupTotpCode}
                      onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      autoComplete="off"
                      className="text-center text-2xl tracking-[0.35em] font-mono"
                      required
                    />
                  </FieldRow>

                  <PrimaryBtn
                    type="submit"
                    loading={isLoading}
                    color="green"
                    disabled={setupTotpCode.length !== 6 || (phase === 'new' && studentId.length !== 6)}
                  >
                    {isLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Activating…</span></>
                      : <><ShieldCheck className="w-4 h-4" /><span>Activate Account</span></>}
                  </PrimaryBtn>
                </form>
              </div>
            )}

            {/* Bottom note */}
            <p className="mt-8 text-center text-[11px] text-gray-400 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3 h-3" /> Secured with 256-bit encryption
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
