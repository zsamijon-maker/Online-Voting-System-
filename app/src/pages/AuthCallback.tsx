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
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Vote, ShieldCheck, Copy, CheckCheck, Loader2, AlertCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabaseClient';
import { api, setToken, camelize } from '@/lib/api';
import type { User } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// ─── Types ────────────────────────────────────────────────────────────────────
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

export default function AuthCallback() {
  const navigate    = useNavigate();
  const { setUserFromCallback } = useAuth();
  const { showError, showSuccess } = useNotification();

  const [phase, setPhase]               = useState<Phase>('processing');
  const [error, setError]               = useState('');
  const [isLoading, setIsLoading]       = useState(false);
  const [challengeToken, setChallenge]  = useState('');
  const [copiedSecret, setCopied]       = useState(false);

  // TOTP phase — return user
  const [totpCode, setTotpCode]         = useState('');

  // New / setup phase
  const [otpauthUrl, setOtpauthUrl]     = useState('');
  const [secretKey, setSecretKey]       = useState('');
  const [prefillEmail, setPrefillEmail] = useState('');
  const [prefillFirst, setPrefillFirst] = useState('');
  const [prefillLast, setPrefillLast]   = useState('');
  const [studentId, setStudentId]       = useState('');
  const [setupTotpCode, setSetupCode]   = useState('');
  const otpSubmitInFlightRef            = useRef(false);
  const callbackSubmitInFlightRef       = useRef(false);
  const callbackHandledRef              = useRef(false);

  const normalizeTotpCode = (input: string) => String(input ?? '').trim().replace(/\s+/g, '').replace(/\D/g, '').slice(0, 6);

  // ── On mount: listen for the Supabase OAuth session then hand off to backend
  useEffect(() => {
    let done = false;

    const handleSession = async (accessToken: string, refreshToken: string) => {
      if (callbackSubmitInFlightRef.current || callbackHandledRef.current) return;
      callbackSubmitInFlightRef.current = true;
      try {
        // Tell our backend about this Google OAuth session
        const response = await api.post<BackendResponse>('/api/auth/google-callback', {
          accessToken,
          refreshToken,
        });

        callbackHandledRef.current = true;

        setChallenge(response.challengeToken);

        if (response.status === 'new' || response.status === 'totp_setup') {
          setOtpauthUrl(response.otpauthUrl || '');
          setSecretKey(response.secretKey  || '');
          setPrefillEmail(response.email   || '');
          setPrefillFirst(response.firstName || '');
          setPrefillLast(response.lastName  || '');
          setPhase(response.status);
        } else {
          setPhase('totp');
        }
      } catch (err) {
        const msg = (err as Error).message || 'Something went wrong during sign-in.';
        setError(
          msg === 'Failed to fetch'
            ? 'Cannot reach the server. Please make sure the backend is running on port 5000 and try again.'
            : msg
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
      } catch {
        // Keep listener path active as fallback.
      }
    };

    // onAuthStateChange fires with the session as soon as the PKCE code
    // exchange completes — this is more reliable than calling getSession()
    // directly (which can hang while the exchange is still in-flight).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (done || !session) return;
      done = true;
      subscription.unsubscribe();
      void handleSession(session.access_token, session.refresh_token ?? '');
    });

    void consumeExistingSession();

    // Safety net: if no session arrives within 30 s, surface a clear error
    const timeout = setTimeout(() => {
      if (!done) {
        done = true;
        subscription.unsubscribe();
        setError('Sign-in timed out. The Google session may have expired — please try again.');
        setPhase('error');
      }
    }, 30_000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // ── Returning user: verify TOTP ───────────────────────────────────────────
  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpSubmitInFlightRef.current) return;
    otpSubmitInFlightRef.current = true;
    setIsLoading(true);
    try {
      const data = await api.post<{ accessToken: string; refreshToken: string; user: unknown }>(
        '/api/auth/verify-totp',
        { challengeToken, totpCode: normalizeTotpCode(totpCode) }
      );
      setToken(data.accessToken, data.refreshToken);
      setUserFromCallback(camelize<User>(data.user));
      await supabase.auth.signOut({ scope: 'local' });
      showSuccess('Signed in with Google!');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      showError((err as Error).message || 'Invalid code. Please try again.');
      setTotpCode('');
    } finally {
      otpSubmitInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  // ── New / setup user: complete profile + TOTP activation ─────────────────
  const handleCompleteSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupTotpCode || setupTotpCode.length !== 6) return;
    if (otpSubmitInFlightRef.current) return;

    otpSubmitInFlightRef.current = true;
    setIsLoading(true);
    try {
      const data = await api.post<{ accessToken: string; refreshToken: string; user: unknown }>(
        '/api/auth/google-setup',
        {
          challengeToken,
          studentId: phase === 'new' ? studentId : undefined,
          totpCode: normalizeTotpCode(setupTotpCode),
        }
      );
      setToken(data.accessToken, data.refreshToken);
      setUserFromCallback(camelize<User>(data.user));
      await supabase.auth.signOut({ scope: 'local' });
      showSuccess('Account activated! Welcome to SchoolVote.');
      navigate('/dashboard', { replace: true });
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

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <div className="w-8 h-8 bg-[#295acc] rounded-lg flex items-center justify-center">
              <Vote className="w-5 h-5 text-white" />
            </div>
            <span className="ml-2 text-xl font-bold text-gray-900">SchoolVote</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          <Card>
            {/* ── Processing ── */}
            {phase === 'processing' && (
              <CardContent className="flex flex-col items-center py-12 gap-4">
                <Loader2 className="w-10 h-10 text-[#295acc] animate-spin" />
                <p className="text-sm text-gray-600">Completing sign-in with Google…</p>
              </CardContent>
            )}

            {/* ── Error ── */}
            {phase === 'error' && (
              <>
                <CardHeader className="text-center">
                  <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
                  <CardTitle className="text-xl text-red-700">Sign-in Failed</CardTitle>
                  <CardDescription className="text-red-600">{error}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <Button
                    className="touch-target w-full bg-[#295acc] hover:bg-[#1e4db3]"
                    onClick={() =>
                      supabase.auth.signInWithOAuth({
                        provider: 'google',
                        options: {
                          redirectTo: `${window.location.origin}/auth/callback`,
                          queryParams: { access_type: 'offline', prompt: 'select_account' },
                        },
                      })
                    }
                  >
                    Try Again with Google
                  </Button>
                  <Button
                    className="touch-target w-full"
                    variant="outline"
                    onClick={() => navigate('/login')}
                  >
                    ← Back to Login
                  </Button>
                </CardContent>
              </>
            )}

            {/* ── Returning user: TOTP ── */}
            {phase === 'totp' && (
              <>
                <CardHeader className="text-center">
                  <div className="w-14 h-14 bg-[#295acc] rounded-xl flex items-center justify-center mx-auto mb-3">
                    <ShieldCheck className="w-7 h-7 text-white" />
                  </div>
                  <CardTitle className="text-xl">Two-Factor Verification</CardTitle>
                  <CardDescription>
                    Open your authenticator app and enter the current 6-digit code to complete sign-in.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleVerifyTotp} className="space-y-4">
                    <div>
                      <Label htmlFor="totp-code">Verification Code</Label>
                      <Input
                        id="totp-code"
                        type="text"
                        inputMode="numeric"
                        pattern="\d{6}"
                        maxLength={6}
                        placeholder="000000"
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="text-center text-2xl tracking-widest font-mono mt-1"
                        autoFocus
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1 text-center">
                        Code refreshes every 30 seconds
                      </p>
                    </div>
                    <Button
                      type="submit"
                      className="touch-target w-full bg-[#295acc] hover:bg-[#1e4db3]"
                      disabled={isLoading || totpCode.length !== 6}
                    >
                      {isLoading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying…</>
                      ) : (
                        <><ShieldCheck className="w-4 h-4 mr-2" />Verify & Sign In</>
                      )}
                    </Button>
                    <button
                      type="button"
                      onClick={() => navigate('/login')}
                      className="touch-target w-full text-sm text-gray-500 hover:text-gray-700 underline"
                    >
                      ← Back to login
                    </button>
                  </form>
                </CardContent>
              </>
            )}

            {/* ── New user / totp_setup: profile completion + TOTP setup ── */}
            {(phase === 'new' || phase === 'totp_setup') && (
              <>
                <CardHeader className="text-center">
                  <div className="w-14 h-14 bg-green-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <ShieldCheck className="w-7 h-7 text-white" />
                  </div>
                  <CardTitle className="text-xl">
                    {phase === 'new' ? 'Complete Your Registration' : 'Set Up Two-Factor Authentication'}
                  </CardTitle>
                  <CardDescription>
                    {phase === 'new'
                      ? `Welcome, ${prefillFirst}! Enter your School ID and set up your authenticator app to activate your account.`
                      : 'Scan the QR code and enter the 6-digit code to activate two-factor authentication.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCompleteSetup} className="space-y-5">
                    {/* Pre-filled read-only info */}
                    {phase === 'new' && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 space-y-1">
                        <p><strong>Name:</strong> {prefillFirst} {prefillLast}</p>
                        <p><strong>Email:</strong> {prefillEmail}</p>
                      </div>
                    )}

                    {/* School ID — only for brand-new users */}
                    {phase === 'new' && (
                      <div>
                        <Label htmlFor="cb-student-id">School ID</Label>
                        <Input
                          id="cb-student-id"
                          placeholder="123456"
                          maxLength={6}
                          value={studentId}
                          onChange={(e) => setStudentId(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          required
                        />
                        <p className="text-xs text-gray-500 mt-1">Must be exactly 6 digits</p>
                      </div>
                    )}

                    {/* QR Code */}
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2 text-center">
                        Scan with your authenticator app
                      </p>
                      <div className="flex justify-center">
                        <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-sm inline-block">
                          <QRCodeSVG value={otpauthUrl} size={170} level="M" />
                        </div>
                      </div>
                    </div>

                    {/* Secret key fallback */}
                    <div>
                      <p className="text-xs text-gray-500 text-center mb-1">
                        Can't scan? Enter this key manually:
                      </p>
                      <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
                        <code className="flex-1 text-xs font-mono text-gray-800 break-all select-all">
                          {secretKey}
                        </code>
                        <button
                          type="button"
                          onClick={copySecret}
                          className="flex-shrink-0 rounded p-2 text-gray-500 hover:text-gray-700"
                          title="Copy"
                        >
                          {copiedSecret
                            ? <CheckCheck className="w-4 h-4 text-green-600" />
                            : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* TOTP code */}
                    <div>
                      <Label htmlFor="cb-totp">6-Digit Code from Your App</Label>
                      <Input
                        id="cb-totp"
                        type="text"
                        inputMode="numeric"
                        pattern="\d{6}"
                        maxLength={6}
                        placeholder="000000"
                        value={setupTotpCode}
                        onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="text-center text-2xl tracking-widest font-mono mt-1"
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      className="touch-target w-full bg-green-600 hover:bg-green-700"
                      disabled={
                        isLoading ||
                        setupTotpCode.length !== 6 ||
                        (phase === 'new' && studentId.length !== 6)
                      }
                    >
                      {isLoading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Activating…</>
                      ) : (
                        <><ShieldCheck className="w-4 h-4 mr-2" />Activate Account</>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}


