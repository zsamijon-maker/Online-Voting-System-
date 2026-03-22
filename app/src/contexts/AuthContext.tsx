import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type {
  User,
  UserRole,
  LoginCredentials,
  RegisterData,
  RegistrationSetupData,
} from '@/types';
import { api, setToken, clearToken, getToken, camelize } from '@/lib/api';

interface LoginResult {
  success: boolean;
  requires2FA?: boolean;
  isFirstSetup?: boolean;
  challengeToken?: string;
  otpauthUrl?: string;
  secretKey?: string;
  error?: string;
}

interface RegisterResult {
  success: boolean;
  setupData?: RegistrationSetupData;
  error?: string;
}

interface VerifyTotpResult {
  success: boolean;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<LoginResult>;
  verifyLoginTotp: (challengeToken: string, totpCode: string) => Promise<VerifyTotpResult>;
  setupStaffTotp: (challengeToken: string, totpCode: string) => Promise<VerifyTotpResult>;
  register: (data: RegisterData) => Promise<RegisterResult>;
  verifyRegistrationTotp: (challengeToken: string, totpCode: string) => Promise<VerifyTotpResult>;
  // Called by AuthCallback after Google OAuth completes
  setUserFromCallback: (user: User) => void;
  logout: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  hasPermission: (permission: string) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeTotpCode(input: string): string {
  return String(input ?? '').trim().replace(/\s+/g, '').replace(/\D/g, '').slice(0, 6);
}

// Role permissions mapping
const rolePermissions: Record<UserRole, string[]> = {
  admin: ['*'],
  voter: ['election:view', 'election:vote', 'profile:manage'],
  election_committee: ['election:manage', 'candidate:manage', 'voter:verify', 'results:view'],
  pageant_committee: ['pageant:manage', 'contestant:manage', 'criteria:manage', 'judge:assign'],
  judge: ['pageant:view', 'contestant:score', 'score:submit'],
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: if a token exists, fetch the current user from the backend
  useEffect(() => {
    const token = getToken();
    if (token) {
      api.get<unknown>('/api/users/me')
        .then(data => setUser(camelize<User>(data)))
        .catch(() => clearToken())
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  // ── Login Step 1: verify password, receive challenge token ──────────────
  const login = useCallback(async (credentials: LoginCredentials): Promise<LoginResult> => {
    try {
      const data = await api.post<{
        requires2FA?: boolean;
        isFirstSetup?: boolean;
        challengeToken?: string;
        otpauthUrl?: string;
        secretKey?: string;
      }>('/api/auth/login', credentials);
      return {
        success: true,
        requires2FA:  data.requires2FA,
        isFirstSetup: data.isFirstSetup,
        challengeToken: data.challengeToken,
        otpauthUrl: data.otpauthUrl,
        secretKey:  data.secretKey,
      };
    } catch (error) {
      return { success: false, error: (error as Error).message || 'Login failed' };
    }
  }, []);

  // ── Login Step 2: verify TOTP code, receive full session ──────────────────
  const verifyLoginTotp = useCallback(
    async (challengeToken: string, totpCode: string): Promise<VerifyTotpResult> => {
      const normalizedTotpCode = normalizeTotpCode(totpCode);
      try {
        const data = await api.post<{ accessToken: string; refreshToken: string; user: unknown }>(
          '/api/auth/verify-totp',
          { challengeToken, totpCode: normalizedTotpCode }
        );
        setToken(data.accessToken, data.refreshToken);
        setUser(camelize<User>(data.user));
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message || 'Verification failed' };
      }
    },
    []
  );

  // ── Staff first-login 2FA setup: verify first TOTP code, receive full session ──
  const setupStaffTotp = useCallback(
    async (challengeToken: string, totpCode: string): Promise<VerifyTotpResult> => {
      const normalizedTotpCode = normalizeTotpCode(totpCode);
      try {
        const data = await api.post<{ accessToken: string; refreshToken: string; user: unknown }>(
          '/api/auth/setup-staff-totp',
          { challengeToken, totpCode: normalizedTotpCode }
        );
        setToken(data.accessToken, data.refreshToken);
        setUser(camelize<User>(data.user));
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message || 'Verification failed' };
      }
    },
    []
  );

  // ── Registration Step 1: validate + create account, receive QR setup data ─
  const register = useCallback(async (data: RegisterData): Promise<RegisterResult> => {
    try {
      const result = await api.post<RegistrationSetupData>('/api/auth/register', {
        email:      data.email,
        password:   data.password,
        firstName:  data.firstName,
        lastName:   data.lastName,
        studentId:  data.studentId,
        role:       data.role,
      });
      return { success: true, setupData: result };
    } catch (error) {
      return { success: false, error: (error as Error).message || 'Registration failed' };
    }
  }, []);

  // ── Registration Step 2: verify TOTP to activate account ─────────────────
  const verifyRegistrationTotp = useCallback(
    async (challengeToken: string, totpCode: string): Promise<VerifyTotpResult> => {
      const normalizedTotpCode = normalizeTotpCode(totpCode);
      try {
        await api.post('/api/auth/register/verify-totp', { challengeToken, totpCode: normalizedTotpCode });
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message || 'Verification failed' };
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout', {});
    } catch {
      // Ignore logout errors
    } finally {
      clearToken();
      setUser(null);
    }
  }, []);

  const hasRole = useCallback((role: UserRole): boolean => {
    if (!user) return false;
    return user.roles.includes(role);
  }, [user]);

  const hasAnyRole = useCallback((roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.some(role => user.roles.includes(role));
  }, [user]);

  const hasPermission = useCallback((permission: string): boolean => {
    if (!user) return false;
    return user.roles.some(role => {
      const permissions = rolePermissions[role];
      return permissions?.includes('*') || permissions?.includes(permission);
    });
  }, [user]);

  // Called by AuthCallback after Google OAuth + TOTP completes
  const setUserFromCallback = useCallback((u: User) => {
    setUser(u);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await api.get<unknown>('/api/users/me');
      setUser(camelize<User>(data));
    } catch {
      clearToken();
      setUser(null);
    }
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    verifyLoginTotp,
    setupStaffTotp,
    register,
    verifyRegistrationTotp,
    setUserFromCallback,
    logout,
    hasRole,
    hasAnyRole,
    hasPermission,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook for role-based access control
export function useRoleAccess() {
  const { hasRole, hasAnyRole, hasPermission } = useAuth();

  const isAdmin = hasRole('admin');
  const isVoter = hasRole('voter');
  const isElectionCommittee = hasRole('election_committee');
  const isPageantCommittee = hasRole('pageant_committee');
  const isJudge = hasRole('judge');

  const canManageUsers = hasPermission('user:manage');
  const canManageElections = hasPermission('election:manage');
  const canVote = hasPermission('election:vote');
  const canManagePageants = hasPermission('pageant:manage');
  const canScore = hasPermission('contestant:score');
  const canViewResults = hasPermission('results:view');
  const canViewAudit = hasPermission('audit:view');

  return {
    isAdmin,
    isVoter,
    isElectionCommittee,
    isPageantCommittee,
    isJudge,
    canManageUsers,
    canManageElections,
    canVote,
    canManagePageants,
    canScore,
    canViewResults,
    canViewAudit,
    hasRole,
    hasAnyRole,
    hasPermission,
  };
}
