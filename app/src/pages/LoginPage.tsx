import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Vote, Eye, EyeOff, Lock, Mail, ArrowRight,
  UserPlus, ShieldCheck, Copy, CheckCheck,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import { getSafeRedirectUrl } from '@/utils/safeRedirect';
import type { RegistrationSetupData } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Google logo SVG (official brand colors, no external dependency)
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

// ─── Login phase ─────────────────────────────────────────────────────────────
type LoginPhase = 'credentials' | 'totp' | 'staff-totp-setup';

// ─── Registration phase ──────────────────────────────────────────────────────
type RegisterPhase = 'form' | 'setup';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = getSafeRedirectUrl(searchParams.get('returnTo'), '/dashboard');
  const { login, verifyLoginTotp, setupStaffTotp, register, verifyRegistrationTotp } = useAuth();
  const { showError, showSuccess } = useNotification();

  const [showPassword, setShowPassword]   = useState(false);
  const [isLoading, setIsLoading]         = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [activeTab, setActiveTab]         = useState('login');
  const [copiedSecret, setCopiedSecret]   = useState(false);

  // ── Login state ─────────────────────────────────────────────────────────────
  const [loginPhase, setLoginPhase]             = useState<LoginPhase>('credentials');
  const [loginChallengeToken, setLoginChallenge] = useState('');
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [loginTotpCode, setLoginTotpCode]       = useState('');
  // ── Staff first-login 2FA setup state ───────────────────────────────────────────
  const [staffSetupData, setStaffSetupData] = useState<{ challengeToken: string; otpauthUrl: string; secretKey: string } | null>(null);
  const [staffTotpCode, setStaffTotpCode]   = useState('');
  const [copiedStaffSecret, setCopiedStaffSecret] = useState(false);
  // ── Registration state ──────────────────────────────────────────────────────
  const [registerPhase, setRegisterPhase]           = useState<RegisterPhase>('form');
  const [registrationSetup, setRegistrationSetup]   = useState<RegistrationSetupData | null>(null);
  const [registerData, setRegisterData] = useState({
    firstName: '', lastName: '', email: '',
    password: '', confirmPassword: '', studentId: '',
  });
  const [registerTotpCode, setRegisterTotpCode] = useState('');
  const otpSubmitInFlightRef = useRef(false);

  const normalizeTotpCode = (input: string) => String(input ?? '').trim().replace(/\s+/g, '').replace(/\D/g, '').slice(0, 6);

  // ── Google OAuth ────────────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    if (isGoogleLoading) return;
    setIsGoogleLoading(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            // Request the user's name so Google passes it in user_metadata
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });
      // The function returns — browser will redirect to Google immediately
    } catch {
      setIsGoogleLoading(false);
      showError('Could not start Google sign-in. Please try again.');
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // LOGIN — Step 1: verify password
  // ════════════════════════════════════════════════════════════════════════════
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = await login({ email: loginData.email, password: loginData.password });
      if (result.success && result.isFirstSetup && result.challengeToken) {
        // Staff account with no 2FA yet — forced first-time setup
        setStaffSetupData({
          challengeToken: result.challengeToken,
          otpauthUrl:     result.otpauthUrl!,
          secretKey:      result.secretKey!,
        });
        setLoginPhase('staff-totp-setup');
      } else if (result.success && result.requires2FA && result.challengeToken) {
        setLoginChallenge(result.challengeToken);
        setLoginPhase('totp');
      } else if (!result.success) {
        showError(result.error || 'Login failed');
      }
    } catch {
      showError('An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  // LOGIN — Step 2: verify TOTP code
  const handleVerifyLoginTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpSubmitInFlightRef.current) return;
    otpSubmitInFlightRef.current = true;
    setIsLoading(true);
    try {
      const result = await verifyLoginTotp(loginChallengeToken, normalizeTotpCode(loginTotpCode));
      if (result.success) {
        showSuccess('Login successful!');
        navigate(returnTo, { replace: true });
      } else {
        showError(result.error || 'Invalid verification code');
        setLoginTotpCode('');
      }
    } catch {
      showError('An error occurred during verification');
    } finally {
      otpSubmitInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const resetLoginFlow = () => {
    setLoginPhase('credentials');
    setLoginChallenge('');
    setLoginTotpCode('');
    setStaffSetupData(null);
    setStaffTotpCode('');
  };
  // LOGIN — Staff first-login 2FA setup: verify first code and activate 2FA
  const handleVerifyStaffTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffSetupData) return;
    if (otpSubmitInFlightRef.current) return;
    otpSubmitInFlightRef.current = true;
    setIsLoading(true);
    try {
      const result = await setupStaffTotp(staffSetupData.challengeToken, normalizeTotpCode(staffTotpCode));
      if (result.success) {
        showSuccess('Two-factor authentication activated! Welcome.');
        navigate(returnTo, { replace: true });
      } else {
        showError(result.error || 'Invalid verification code');
        setStaffTotpCode('');
      }
    } catch {
      showError('An error occurred during verification');
    } finally {
      otpSubmitInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const copyStaffSecret = async () => {
    if (!staffSetupData) return;
    await navigator.clipboard.writeText(staffSetupData.secretKey);
    setCopiedStaffSecret(true);
    setTimeout(() => setCopiedStaffSecret(false), 2000);
  };
  // ════════════════════════════════════════════════════════════════════════════
  // REGISTRATION — Step 1: validate + create account
  // ════════════════════════════════════════════════════════════════════════════
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (registerData.password !== registerData.confirmPassword) {
      showError('Passwords do not match');
      return;
    }
    if (registerData.password.length < 8) {
      showError('Password must be at least 8 characters');
      return;
    }
    if (!/^\d{6}$/.test(registerData.studentId)) {
      showError('School ID must be exactly 6 digits');
      return;
    }

    setIsLoading(true);
    try {
      const result = await register({
        email:     registerData.email,
        password:  registerData.password,
        firstName: registerData.firstName,
        lastName:  registerData.lastName,
        studentId: registerData.studentId,
        role:      'voter',
      });
      if (result.success && result.setupData) {
        setRegistrationSetup(result.setupData);
        setRegisterPhase('setup');
      } else {
        showError(result.error || 'Registration failed');
      }
    } catch {
      showError('An error occurred during registration');
    } finally {
      setIsLoading(false);
    }
  };

  // REGISTRATION — Step 2: verify TOTP to activate account
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
        // Reset registration state and switch to login tab
        setRegisterPhase('form');
        setRegistrationSetup(null);
        setRegisterData({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '', studentId: '' });
        setRegisterTotpCode('');
        setLoginData({ email: registerData.email, password: '' });
        setActiveTab('login');
      } else {
        showError(result.error || 'Invalid verification code');
        setRegisterTotpCode('');
      }
    } catch {
      showError('An error occurred during verification');
    } finally {
      otpSubmitInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const copySecret = async () => {
    if (!registrationSetup) return;
    await navigator.clipboard.writeText(registrationSetup.secretKey);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-16 items-center justify-between py-3 sm:h-16 sm:py-0">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 bg-[#1E3A8A] rounded-lg flex items-center justify-center">
                <Vote className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900 sm:text-xl">SchoolVote</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-6 sm:px-6 sm:py-12 lg:px-8">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-[#1E3A8A] rounded-xl flex items-center justify-center mx-auto mb-4">
                <Vote className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl">Welcome</CardTitle>
              <CardDescription>Sign in or create a student account</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); resetLoginFlow(); }}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login" className="text-xs sm:text-sm">Login</TabsTrigger>
                  <TabsTrigger value="register" className="text-xs sm:text-sm">Student Registration</TabsTrigger>
                </TabsList>

                {/* ════════════ LOGIN TAB ════════════ */}
                <TabsContent value="login">
                  {loginPhase === 'credentials' && (
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <div className="relative mt-1">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            id="email"
                            type="email"
                            placeholder="you@school.edu"
                            value={loginData.email}
                            onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                            className="pl-10"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="password">Password</Label>
                        <div className="relative mt-1">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={loginData.password}
                            onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                            className="pl-10 pr-10"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-2 text-gray-400 hover:text-gray-600"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        className="touch-target w-full bg-[#1E3A8A] hover:bg-[#162d6b]"
                        disabled={isLoading}
                      >
                        {isLoading ? 'Verifying...' : (
                          <>Sign In <ArrowRight className="w-4 h-4 ml-2" /></>
                        )}
                      </Button>
                    </form>
                  )}

                  {/* ── Google SSO divider (credentials phase only) ── */}
                  {loginPhase === 'credentials' && (
                    <>
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-xs text-gray-400 font-medium">OR</span>
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="touch-target w-full gap-3 border-gray-300 font-medium hover:bg-gray-50"
                        onClick={handleGoogleSignIn}
                        disabled={isGoogleLoading || isLoading}
                      >
                        <GoogleIcon />
                        {isGoogleLoading ? 'Redirecting to Google...' : 'Continue with BISU Email'}
                      </Button>
                    </>
                  )}

                  {loginPhase === 'totp' && (
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                        <ShieldCheck className="w-8 h-8 text-[#1E3A8A] mx-auto mb-2" />
                        <p className="text-sm font-medium text-[#1E3A8A]">Two-Factor Authentication</p>
                        <p className="text-xs text-[#1E3A8A] mt-1">
                          Open your authenticator app and enter the current 6-digit code.
                        </p>
                      </div>

                      <form onSubmit={handleVerifyLoginTotp} className="space-y-4">
                        <div>
                          <Label htmlFor="login-totp">6-Digit Verification Code</Label>
                          <Input
                            id="login-totp"
                            type="text"
                            inputMode="numeric"
                            pattern="\d{6}"
                            maxLength={6}
                            placeholder="000000"
                            value={loginTotpCode}
                            onChange={(e) => setLoginTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="text-center text-2xl tracking-widest font-mono mt-1"
                            autoFocus
                            required
                          />
                          <p className="text-xs text-gray-500 mt-1 text-center">
                            Code changes every 30 seconds
                          </p>
                        </div>

                        <Button
                          type="submit"
                          className="touch-target w-full bg-[#1E3A8A] hover:bg-[#162d6b]"
                          disabled={isLoading || loginTotpCode.length !== 6}
                        >
                          {isLoading ? 'Verifying...' : (
                            <><ShieldCheck className="w-4 h-4 mr-2" />Verify & Sign In</>
                          )}
                        </Button>

                        <button
                          type="button"
                          onClick={resetLoginFlow}
                          className="touch-target w-full text-sm text-gray-500 hover:text-gray-700 underline"
                        >
                          ← Back to login
                        </button>
                      </form>
                    </div>
                  )}

                  {/* ── Staff first-login forced 2FA setup ── */}
                  {loginPhase === 'staff-totp-setup' && staffSetupData && (
                    <div className="space-y-5">
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
                        <ShieldCheck className="w-6 h-6 text-amber-600 mx-auto mb-1" />
                        <p className="text-sm font-medium text-amber-900">Set Up Two-Factor Authentication</p>
                        <p className="text-xs text-amber-700 mt-1">
                          Your account requires 2FA. Scan the QR code with an authenticator app, then enter the 6-digit code to activate it.
                        </p>
                      </div>

                      {/* QR Code */}
                      <div className="flex justify-center">
                        <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-sm inline-block">
                          <QRCodeSVG
                            value={staffSetupData.otpauthUrl}
                            size={180}
                            level="M"
                          />
                        </div>
                      </div>

                      {/* Secret Key (manual entry fallback) */}
                      <div>
                        <p className="text-xs text-gray-500 text-center mb-1">
                          Can't scan? Enter this key manually in your authenticator app:
                        </p>
                        <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
                          <code className="flex-1 text-xs font-mono text-gray-800 break-all select-all">
                            {staffSetupData.secretKey}
                          </code>
                          <button
                            type="button"
                            onClick={copyStaffSecret}
                            className="flex-shrink-0 rounded p-2 text-gray-500 hover:text-gray-700"
                            title="Copy secret key"
                          >
                            {copiedStaffSecret ? <CheckCheck className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* TOTP Code Input */}
                      <form onSubmit={handleVerifyStaffTotp} className="space-y-3">
                        <div>
                          <Label htmlFor="staff-totp">Enter the 6-Digit Code from Your App</Label>
                          <Input
                            id="staff-totp"
                            type="text"
                            inputMode="numeric"
                            pattern="\d{6}"
                            maxLength={6}
                            placeholder="000000"
                            value={staffTotpCode}
                            onChange={(e) => setStaffTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="text-center text-2xl tracking-widest font-mono mt-1"
                            autoFocus
                            required
                          />
                        </div>

                        <Button
                          type="submit"
                          className="touch-target w-full bg-[#1E3A8A] hover:bg-[#162d6b]"
                          disabled={isLoading || staffTotpCode.length !== 6}
                        >
                          {isLoading ? 'Activating...' : (
                            <><ShieldCheck className="w-4 h-4 mr-2" />Activate & Sign In</>
                          )}
                        </Button>

                        <button
                          type="button"
                          onClick={resetLoginFlow}
                          className="touch-target w-full text-sm text-gray-500 hover:text-gray-700 underline"
                        >
                          ← Back to login
                        </button>
                      </form>
                    </div>
                  )}


                </TabsContent>

                {/* ════════════ REGISTER TAB ════════════ */}
                <TabsContent value="register">
                  {registerPhase === 'form' && (
                    <>
                      <form onSubmit={handleRegister} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <Label htmlFor="firstName">First Name</Label>
                            <Input
                              id="firstName"
                              placeholder="Juan"
                              value={registerData.firstName}
                              onChange={(e) => setRegisterData({ ...registerData, firstName: e.target.value })}
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="lastName">Last Name</Label>
                            <Input
                              id="lastName"
                              placeholder="Dela Cruz"
                              value={registerData.lastName}
                              onChange={(e) => setRegisterData({ ...registerData, lastName: e.target.value })}
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="register-email">Email</Label>
                          <Input
                            id="register-email"
                            type="email"
                            placeholder="you@school.edu"
                            value={registerData.email}
                            onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                            required
                          />
                        </div>

                        <div>
                          <Label htmlFor="studentId">School ID</Label>
                          <Input
                            id="studentId"
                            placeholder="123456"
                            maxLength={6}
                            value={registerData.studentId}
                            onChange={(e) => setRegisterData({ ...registerData, studentId: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                            required
                          />
                          <p className="text-xs text-gray-500 mt-1">Must be exactly 6 digits</p>
                        </div>

                        <div>
                          <Label htmlFor="register-password">Password</Label>
                          <Input
                            id="register-password"
                            type="password"
                            placeholder="••••••••"
                            value={registerData.password}
                            onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                            required
                          />
                          <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
                        </div>

                        <div>
                          <Label htmlFor="confirmPassword">Confirm Password</Label>
                          <Input
                            id="confirmPassword"
                            type="password"
                            placeholder="••••••••"
                            value={registerData.confirmPassword}
                            onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                            required
                          />
                        </div>

                        <Button
                          type="submit"
                          className="touch-target w-full bg-[#1E3A8A] hover:bg-[#162d6b]"
                          disabled={isLoading}
                        >
                          {isLoading ? 'Creating account...' : (
                            <><UserPlus className="w-4 h-4 mr-2" />Create Account</>
                          )}
                        </Button>
                      </form>

                      {/* Google signup alternative */}
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-xs text-gray-400 font-medium">OR</span>
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="touch-target w-full gap-3 border-gray-300 font-medium hover:bg-gray-50"
                        onClick={handleGoogleSignIn}
                      >
                        <GoogleIcon />
                        Register with BISU Email
                      </Button>
                    </>
                  )}

                  {registerPhase === 'setup' && registrationSetup && (
                    <div className="space-y-5">
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                        <ShieldCheck className="w-6 h-6 text-green-600 mx-auto mb-1" />
                        <p className="text-sm font-medium text-green-900">Set Up Two-Factor Authentication</p>
                        <p className="text-xs text-green-700 mt-1">
                          Scan the QR code with your authenticator app, then enter the 6-digit code to activate your account.
                        </p>
                      </div>

                      {/* QR Code */}
                      <div className="flex justify-center">
                        <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-sm inline-block">
                          <QRCodeSVG
                            value={registrationSetup.otpauthUrl}
                            size={180}
                            level="M"
                          />
                        </div>
                      </div>

                      {/* Secret Key (manual entry fallback) */}
                      <div>
                        <p className="text-xs text-gray-500 text-center mb-1">
                          Can't scan? Enter this key manually in your authenticator app:
                        </p>
                        <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
                          <code className="flex-1 text-xs font-mono text-gray-800 break-all select-all">
                            {registrationSetup.secretKey}
                          </code>
                          <button
                            type="button"
                            onClick={copySecret}
                            className="flex-shrink-0 rounded p-2 text-gray-500 hover:text-gray-700"
                            title="Copy secret key"
                          >
                            {copiedSecret ? <CheckCheck className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* TOTP Code Input */}
                      <form onSubmit={handleVerifyRegistrationTotp} className="space-y-3">
                        <div>
                          <Label htmlFor="register-totp">Enter the 6-Digit Code from Your App</Label>
                          <Input
                            id="register-totp"
                            type="text"
                            inputMode="numeric"
                            pattern="\d{6}"
                            maxLength={6}
                            placeholder="000000"
                            value={registerTotpCode}
                            onChange={(e) => setRegisterTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="text-center text-2xl tracking-widest font-mono mt-1"
                            autoFocus
                            required
                          />
                        </div>

                        <Button
                          type="submit"
                          className="touch-target w-full bg-green-600 hover:bg-green-700"
                          disabled={isLoading || registerTotpCode.length !== 6}
                        >
                          {isLoading ? 'Activating...' : (
                            <><ShieldCheck className="w-4 h-4 mr-2" />Activate Account</>
                          )}
                        </Button>
                      </form>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Security Notice */}
          <div className="mt-6 text-center">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Lock className="w-4 h-4" />
              <span>Secure, encrypted connection</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}



