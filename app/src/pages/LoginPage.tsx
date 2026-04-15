import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Vote, Eye, EyeOff, Lock, Mail, ArrowRight,
  UserPlus, ShieldCheck, Copy, CheckCheck, ChevronLeft,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import { getSafeRedirectUrl } from '@/utils/safeRedirect';
import type { RegistrationSetupData } from '@/types';

const DEFAULT_POST_LOGIN_REDIRECT = 'https://online-voting-system-fejgnxjwk-zsamijon-makers-projects.vercel.app/dashboard';

// ─── Google logo SVG (official brand colors, unchanged) ──────────────────────
const GoogleIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

// ─── Phase types (unchanged) ─────────────────────────────────────────────────
type LoginPhase    = 'credentials' | 'totp' | 'staff-totp-setup';
type RegisterPhase = 'form' | 'setup';

// ─── Reusable styled primitives ──────────────────────────────────────────────
const FieldInput = ({
  id, type = 'text', placeholder, value, onChange, required, autoFocus,
  prefix, suffix, inputMode, pattern, maxLength, className = '',
}: {
  id: string; type?: string; placeholder?: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean; autoFocus?: boolean;
  prefix?: React.ReactNode; suffix?: React.ReactNode;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  pattern?: string; maxLength?: number; className?: string;
}) => (
  <div className="relative">
    {prefix && (
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        {prefix}
      </span>
    )}
    <input
      id={id}
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      required={required}
      autoFocus={autoFocus}
      inputMode={inputMode}
      pattern={pattern}
      maxLength={maxLength}
      className={[
        'w-full rounded-xl border border-gray-200 bg-gray-50/60 px-3.5 py-2.5 text-sm text-gray-900',
        'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/30 focus:border-[#1E3A8A]',
        'transition-all duration-150',
        prefix  ? 'pl-10' : '',
        suffix  ? 'pr-10' : '',
        className,
      ].join(' ')}
    />
    {suffix && (
      <span className="absolute right-2 top-1/2 -translate-y-1/2">{suffix}</span>
    )}
  </div>
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
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
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

const OutlineBtn = ({
  onClick, disabled, children,
}: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="
      w-full flex items-center justify-center gap-2.5 px-4 py-2.5
      text-sm font-medium text-gray-700 rounded-xl border border-gray-200
      bg-white hover:bg-gray-50 transition-all duration-150
      disabled:opacity-50 disabled:cursor-not-allowed
    "
  >
    {children}
  </button>
);

const Divider = () => (
  <div className="flex items-center gap-3 my-1">
    <div className="flex-1 h-px bg-gray-200" />
    <span className="text-[11px] font-semibold text-gray-400 tracking-wider uppercase">or</span>
    <div className="flex-1 h-px bg-gray-200" />
  </div>
);

const FieldRow = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-gray-700 tracking-wide">{label}</label>
    {children}
    {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
  </div>
);

// ─── QR + Secret block (shared between register & staff setup) ───────────────
const TotpSetup = ({
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
          type="button"
          onClick={onCopy}
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
export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = getSafeRedirectUrl(searchParams.get('returnTo'), '/dashboard');
  const postLoginRedirectUrl = (import.meta.env.VITE_POST_LOGIN_REDIRECT_URL || DEFAULT_POST_LOGIN_REDIRECT).trim();

  const redirectAfterLogin = () => {
    const target = returnTo === '/dashboard'
      ? postLoginRedirectUrl
      : `${window.location.origin}${returnTo}`;
    window.location.assign(target);
  };

  // ── All auth hooks unchanged ──────────────────────────────────────────────
  const { login, verifyLoginTotp, setupStaffTotp, register, verifyRegistrationTotp } = useAuth();
  const { showError, showSuccess } = useNotification();

  // ── All state unchanged ───────────────────────────────────────────────────
  const [showPassword, setShowPassword]       = useState(false);
  const [isLoading, setIsLoading]             = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [activeTab, setActiveTab]             = useState<'login' | 'register'>('login');
  const [copiedSecret, setCopiedSecret]       = useState(false);

  const [loginPhase, setLoginPhase]               = useState<LoginPhase>('credentials');
  const [loginChallengeToken, setLoginChallenge]  = useState('');
  const [loginData, setLoginData]                 = useState({ email: '', password: '' });
  const [loginTotpCode, setLoginTotpCode]         = useState('');

  const [staffSetupData, setStaffSetupData]         = useState<{ challengeToken: string; otpauthUrl: string; secretKey: string } | null>(null);
  const [staffTotpCode, setStaffTotpCode]           = useState('');
  const [copiedStaffSecret, setCopiedStaffSecret]   = useState(false);

  const [registerPhase, setRegisterPhase]         = useState<RegisterPhase>('form');
  const [registrationSetup, setRegistrationSetup] = useState<RegistrationSetupData | null>(null);
  const [registerData, setRegisterData] = useState({
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '', studentId: '',
  });
  const [registerTotpCode, setRegisterTotpCode] = useState('');
  const otpSubmitInFlightRef = useRef(false);

  // ── All handlers unchanged ────────────────────────────────────────────────
  const normalizeTotpCode = (input: string) =>
    String(input ?? '').trim().replace(/\s+/g, '').replace(/\D/g, '').slice(0, 6);

  const handleGoogleSignIn = async () => {
    if (isGoogleLoading) return;
    setIsGoogleLoading(true);
    try {
      await supabase.auth.signOut({ scope: 'local' });
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { access_type: 'offline', prompt: 'select_account' },
        },
      });
    } catch {
      setIsGoogleLoading(false);
      showError('Could not start Google sign-in. Please try again.');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = await login({ email: loginData.email, password: loginData.password });
      if (result.success && result.isFirstSetup && result.challengeToken) {
        setStaffSetupData({ challengeToken: result.challengeToken, otpauthUrl: result.otpauthUrl!, secretKey: result.secretKey! });
        setLoginPhase('staff-totp-setup');
      } else if (result.success && result.requires2FA && result.challengeToken) {
        setLoginChallenge(result.challengeToken);
        setLoginPhase('totp');
      } else if (result.success) {
        showSuccess('Login successful!');
        redirectAfterLogin();
      } else if (!result.success) {
        showError(result.error || 'Login failed');
      }
    } catch { showError('An error occurred during login'); }
    finally { setIsLoading(false); }
  };

  const handleVerifyLoginTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginChallengeToken) { showError('Your verification session expired. Please log in again.'); resetLoginFlow(); return; }
    if (otpSubmitInFlightRef.current) return;
    otpSubmitInFlightRef.current = true;
    setIsLoading(true);
    try {
      const result = await verifyLoginTotp(loginChallengeToken, normalizeTotpCode(loginTotpCode));
      if (result.success) { showSuccess('Login successful!'); redirectAfterLogin(); }
      else { showError(result.error || 'Invalid verification code'); setLoginTotpCode(''); }
    } catch { showError('An error occurred during verification'); }
    finally { otpSubmitInFlightRef.current = false; setIsLoading(false); }
  };

  const resetLoginFlow = () => {
    setLoginPhase('credentials'); setLoginChallenge(''); setLoginTotpCode('');
    setStaffSetupData(null); setStaffTotpCode('');
  };

  const handleVerifyStaffTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffSetupData) return;
    if (!staffSetupData.challengeToken) { showError('Your setup session expired. Please log in again.'); resetLoginFlow(); return; }
    if (otpSubmitInFlightRef.current) return;
    otpSubmitInFlightRef.current = true;
    setIsLoading(true);
    try {
      const result = await setupStaffTotp(staffSetupData.challengeToken, normalizeTotpCode(staffTotpCode));
      if (result.success) { showSuccess('Two-factor authentication activated! Welcome.'); redirectAfterLogin(); }
      else { showError(result.error || 'Invalid verification code'); setStaffTotpCode(''); }
    } catch { showError('An error occurred during verification'); }
    finally { otpSubmitInFlightRef.current = false; setIsLoading(false); }
  };

  const copyStaffSecret = async () => {
    if (!staffSetupData) return;
    await navigator.clipboard.writeText(staffSetupData.secretKey);
    setCopiedStaffSecret(true); setTimeout(() => setCopiedStaffSecret(false), 2000);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerData.password !== registerData.confirmPassword) { showError('Passwords do not match'); return; }
    if (registerData.password.length < 8) { showError('Password must be at least 8 characters'); return; }
    if (!/^\d{6}$/.test(registerData.studentId)) { showError('School ID must be exactly 6 digits'); return; }
    setIsLoading(true);
    try {
      const result = await register({
        email: registerData.email, password: registerData.password,
        firstName: registerData.firstName, lastName: registerData.lastName,
        studentId: registerData.studentId, role: 'voter',
      });
      if (result.success && result.setupData) { setRegistrationSetup(result.setupData ?? null); setRegisterPhase('setup'); }
      else { showError(result.error || 'Registration failed'); }
    } catch { showError('An error occurred during registration'); }
    finally { setIsLoading(false); }
  };

  const handleVerifyRegistrationTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registrationSetup) return;
    if (otpSubmitInFlightRef.current) return;
    otpSubmitInFlightRef.current = true;
    setIsLoading(true);
    try {
      const result = await verifyRegistrationTotp(registrationSetup.challengeToken, normalizeTotpCode(registerTotpCode));
      if (result.success) {
        showSuccess('Account activated! You can now log in.');
        setRegisterPhase('form'); setRegistrationSetup(null);
        setRegisterData({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '', studentId: '' });
        setRegisterTotpCode('');
        setLoginData({ email: registerData.email, password: '' });
        setActiveTab('login');
      } else { showError(result.error || 'Invalid verification code'); setRegisterTotpCode(''); }
    } catch { showError('An error occurred during verification'); }
    finally { otpSubmitInFlightRef.current = false; setIsLoading(false); }
  };

  const copySecret = async () => {
    if (!registrationSetup) return;
    await navigator.clipboard.writeText(registrationSetup.secretKey);
    setCopiedSecret(true); setTimeout(() => setCopiedSecret(false), 2000);
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex bg-[#F7F8FC]">

      {/* ── LEFT PANEL — decorative branding (hidden on mobile) ──────────── */}
      <aside className="hidden lg:flex lg:w-[44%] xl:w-[40%] relative flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0c1f4a] to-[#1E3A8A] p-12 text-white">
        {/* Decorative circles */}
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute top-1/2 -right-24 w-64 h-64 rounded-full bg-[#f2c94c]/10 pointer-events-none" />
        <div className="absolute -bottom-16 left-1/3 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
        {/* Dot grid accent */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Top — brand */}
        <div className="relative">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Vote className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              School<span className="text-[#f2c94c]">Vote</span>
            </span>
          </button>
        </div>

        {/* Middle — headline */}
        <div className="relative space-y-6">
          <div className="w-10 h-1 bg-[#f2c94c] rounded-full" />
          <h2 className="text-3xl xl:text-4xl font-extrabold leading-[1.15] tracking-tight">
            Your voice matters.<br />
            <span className="text-[#f2c94c]">Cast it with</span><br />
            confidence.
          </h2>
          <p className="text-blue-200/80 text-sm leading-relaxed max-w-xs">
            BISU Calape's secure digital voting platform — protecting the integrity of every student election and pageant.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 pt-2">
            {['End-to-end encrypted', 'Audit trail', 'One vote per student'].map((pill) => (
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

        {/* Bottom — trust note */}
        <div className="relative flex items-center gap-2 text-xs text-blue-300/70">
          <Lock className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Protected by 256-bit encryption · Supabase Auth</span>
        </div>
      </aside>

      {/* ── RIGHT PANEL — form area ───────────────────────────────────────── */}
      <main className="flex-1 flex flex-col">
        {/* Mobile-only top bar */}
        <div className="lg:hidden flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-xl bg-[#1E3A8A] flex items-center justify-center">
              <Vote className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold text-gray-900">
              School<span className="text-[#2563EB]">Vote</span>
            </span>
          </button>
          <span className="text-[11px] text-gray-400 flex items-center gap-1">
            <Lock className="w-3 h-3" /> Secure connection
          </span>
        </div>

        {/* Scrollable form area */}
        <div className="flex-1 flex items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-[420px]">

            {/* ── TAB SWITCHER ─────────────────────────────────────────── */}
            {/* Only show tabs when not in a multi-step phase */}
            {loginPhase === 'credentials' && registerPhase === 'form' && (
              <div className="flex bg-gray-100 rounded-2xl p-1 mb-8">
                {(['login', 'register'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); resetLoginFlow(); }}
                    className={`
                      flex-1 py-2 text-sm font-semibold rounded-xl transition-all duration-200
                      ${activeTab === tab
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'}
                    `}
                  >
                    {tab === 'login' ? 'Sign In' : 'Register'}
                  </button>
                ))}
              </div>
            )}

            {/* ════════════════════════════════════════════════════════
                LOGIN — CREDENTIALS
            ════════════════════════════════════════════════════════ */}
            {activeTab === 'login' && loginPhase === 'credentials' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Welcome back</h1>
                  <p className="text-sm text-gray-500 mt-1">Sign in to your BISU Calape account</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <FieldRow label="Email address">
                    <FieldInput
                      id="email"
                      type="email"
                      placeholder="you@bisu.edu.ph"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      prefix={<Mail className="w-4 h-4" />}
                      required
                    />
                  </FieldRow>

                  <FieldRow label="Password">
                    <FieldInput
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      prefix={<Lock className="w-4 h-4" />}
                      suffix={
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      }
                      required
                    />
                  </FieldRow>

                  <PrimaryBtn type="submit" loading={isLoading}>
                    {isLoading ? 'Signing in…' : <><span>Sign In</span><ArrowRight className="w-4 h-4" /></>}
                  </PrimaryBtn>
                </form>

                <Divider />

                <OutlineBtn onClick={handleGoogleSignIn} disabled={isGoogleLoading || isLoading}>
                  <GoogleIcon />
                  {isGoogleLoading ? 'Redirecting…' : 'Continue with BISU Email'}
                </OutlineBtn>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════
                LOGIN — TOTP VERIFICATION
            ════════════════════════════════════════════════════════ */}
            {activeTab === 'login' && loginPhase === 'totp' && (
              <div className="space-y-6">
                {/* Back link */}
                <button
                  onClick={resetLoginFlow}
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
                    Open your authenticator app and enter the current 6-digit code.
                  </p>
                </div>

                <form onSubmit={handleVerifyLoginTotp} className="space-y-4">
                  <FieldRow label="Verification code" hint="Code refreshes every 30 seconds">
                    <FieldInput
                      id="login-totp"
                      type="text"
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      placeholder="000 000"
                      value={loginTotpCode}
                      onChange={(e) => setLoginTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="text-center text-2xl tracking-[0.35em] font-mono"
                      autoFocus
                      required
                    />
                  </FieldRow>

                  <PrimaryBtn type="submit" loading={isLoading} disabled={loginTotpCode.length !== 6}>
                    {isLoading ? 'Verifying…' : <><ShieldCheck className="w-4 h-4" /><span>Verify &amp; Sign In</span></>}
                  </PrimaryBtn>
                </form>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════
                LOGIN — STAFF FIRST-LOGIN 2FA SETUP
            ════════════════════════════════════════════════════════ */}
            {activeTab === 'login' && loginPhase === 'staff-totp-setup' && staffSetupData && (
              <div className="space-y-5">
                <button
                  onClick={resetLoginFlow}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Back to login
                </button>

                <div>
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
                    <ShieldCheck className="w-6 h-6 text-amber-600" />
                  </div>
                  <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Set Up Two-Factor Auth</h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Your account requires 2FA. Scan the QR code, then enter your first code to activate it.
                  </p>
                </div>

                <TotpSetup
                  otpauthUrl={staffSetupData.otpauthUrl}
                  secretKey={staffSetupData.secretKey}
                  copied={copiedStaffSecret}
                  onCopy={copyStaffSecret}
                />

                <form onSubmit={handleVerifyStaffTotp} className="space-y-4">
                  <FieldRow label="Enter code from your app">
                    <FieldInput
                      id="staff-totp"
                      type="text"
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      placeholder="000 000"
                      value={staffTotpCode}
                      onChange={(e) => setStaffTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="text-center text-2xl tracking-[0.35em] font-mono"
                      autoFocus
                      required
                    />
                  </FieldRow>

                  <PrimaryBtn type="submit" loading={isLoading} disabled={staffTotpCode.length !== 6}>
                    {isLoading ? 'Activating…' : <><ShieldCheck className="w-4 h-4" /><span>Activate &amp; Sign In</span></>}
                  </PrimaryBtn>
                </form>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════
                REGISTER — FORM
            ════════════════════════════════════════════════════════ */}
            {activeTab === 'register' && registerPhase === 'form' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Create account</h1>
                  <p className="text-sm text-gray-500 mt-1">Register as a BISU Calape student voter</p>
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <FieldRow label="First name">
                      <FieldInput
                        id="firstName"
                        placeholder="Juan"
                        value={registerData.firstName}
                        onChange={(e) => setRegisterData({ ...registerData, firstName: e.target.value })}
                        required
                      />
                    </FieldRow>
                    <FieldRow label="Last name">
                      <FieldInput
                        id="lastName"
                        placeholder="Dela Cruz"
                        value={registerData.lastName}
                        onChange={(e) => setRegisterData({ ...registerData, lastName: e.target.value })}
                        required
                      />
                    </FieldRow>
                  </div>

                  <FieldRow label="Email address">
                    <FieldInput
                      id="register-email"
                      type="email"
                      placeholder="you@bisu.edu.ph"
                      value={registerData.email}
                      onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                      prefix={<Mail className="w-4 h-4" />}
                      required
                    />
                  </FieldRow>

                  <FieldRow label="School ID" hint="Must be exactly 6 digits">
                    <FieldInput
                      id="studentId"
                      placeholder="123456"
                      maxLength={6}
                      value={registerData.studentId}
                      onChange={(e) => setRegisterData({ ...registerData, studentId: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                      required
                    />
                  </FieldRow>

                  <FieldRow label="Password" hint="At least 8 characters">
                    <FieldInput
                      id="register-password"
                      type="password"
                      placeholder="••••••••"
                      value={registerData.password}
                      onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                      prefix={<Lock className="w-4 h-4" />}
                      required
                    />
                  </FieldRow>

                  <FieldRow label="Confirm password">
                    <FieldInput
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={registerData.confirmPassword}
                      onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                      prefix={<Lock className="w-4 h-4" />}
                      required
                    />
                  </FieldRow>

                  <PrimaryBtn type="submit" loading={isLoading}>
                    {isLoading ? 'Creating account…' : <><UserPlus className="w-4 h-4" /><span>Create Account</span></>}
                  </PrimaryBtn>
                </form>

                <Divider />

                <OutlineBtn onClick={handleGoogleSignIn} disabled={isGoogleLoading}>
                  <GoogleIcon />
                  Continue with BISU Google
                </OutlineBtn>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════
                REGISTER — 2FA SETUP
            ════════════════════════════════════════════════════════ */}
            {activeTab === 'register' && registerPhase === 'setup' && registrationSetup && (
              <div className="space-y-5">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mb-4">
                    <ShieldCheck className="w-6 h-6 text-green-600" />
                  </div>
                  <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Almost there!</h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Scan this QR code with your authenticator app, then enter the 6-digit code to activate your account.
                  </p>
                </div>

                <TotpSetup
                  otpauthUrl={registrationSetup.otpauthUrl}
                  secretKey={registrationSetup.secretKey}
                  copied={copiedSecret}
                  onCopy={copySecret}
                />

                <form onSubmit={handleVerifyRegistrationTotp} className="space-y-4">
                  <FieldRow label="Enter code from your app">
                    <FieldInput
                      id="register-totp"
                      type="text"
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      placeholder="000 000"
                      value={registerTotpCode}
                      onChange={(e) => setRegisterTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="text-center text-2xl tracking-[0.35em] font-mono"
                      autoFocus
                      required
                    />
                  </FieldRow>

                  <PrimaryBtn type="submit" loading={isLoading} disabled={registerTotpCode.length !== 6} color="green">
                    {isLoading ? 'Activating…' : <><ShieldCheck className="w-4 h-4" /><span>Activate Account</span></>}
                  </PrimaryBtn>
                </form>
              </div>
            )}

            {/* Bottom encryption note — always visible */}
            <p className="mt-8 text-center text-[11px] text-gray-400 flex items-center justify-center gap-1.5">
              <Lock className="w-3 h-3" /> Secured with 256-bit encryption
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
