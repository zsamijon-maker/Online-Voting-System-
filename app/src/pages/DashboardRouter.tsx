import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, useRoleAccess } from '@/contexts/AuthContext';
import { isSafeRedirectUrl } from '@/utils/safeRedirect';
import { initializeLocalStorage } from '@/data/seedData';
import AdminDashboard from '@/dashboards/AdminDashboard';
import VoterDashboard from '@/dashboards/VoterDashboard';
import ElectionCommitteeDashboard from '@/dashboards/ElectionCommitteeDashboard';
import PageantCommitteeDashboard from '@/dashboards/PageantCommitteeDashboard';
import JudgeDashboard from '@/dashboards/JudgeDashboard';
import { Vote, ShieldOff, ArrowLeft } from 'lucide-react';

/**
 * Dashboard Router
 *
 * Routes users to their appropriate dashboard based on their role.
 * Users with multiple roles will see the dashboard of their highest priority role.
 *
 * Role Priority:
 * 1. Admin
 * 2. Election Committee
 * 3. Pageant Committee
 * 4. Judge
 * 5. Voter (Student)
 *
 * ─── UI ONLY changed — all logic, effects, and role checks are untouched ───
 */
export default function DashboardRouter() {
  // ── All logic unchanged ───────────────────────────────────────────────────
  const { isAuthenticated, isLoading } = useAuth();
  const { isAdmin, isElectionCommittee, isPageantCommittee, isJudge, isVoter } = useRoleAccess();
  const navigate  = useNavigate();
  const location  = useLocation();

  useEffect(() => {
    initializeLocalStorage();
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const currentPath = location.pathname + location.search;
      const returnTo = isSafeRedirectUrl(currentPath) ? currentPath : '/dashboard';
      navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, location]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8FC]">
        <div className="flex flex-col items-center gap-5">
          {/* Animated brand mark */}
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] flex items-center justify-center shadow-lg shadow-blue-200">
              <Vote className="w-8 h-8 text-white" />
            </div>
            {/* Spinning ring */}
            <div className="absolute inset-0 rounded-2xl border-2 border-transparent border-t-[#f2c94c] animate-spin" />
          </div>

          <div className="text-center">
            <p className="text-sm font-semibold text-gray-700">Loading your dashboard</p>
            <p className="text-xs text-gray-400 mt-1">Please wait a moment…</p>
          </div>

          {/* Subtle progress bar */}
          <div className="w-40 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] animate-pulse"
              style={{ width: '65%' }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Unauthenticated guard — redirect handled by effect above ─────────────
  if (!isAuthenticated) {
    return null;
  }

  // ── Role-based routing (priority order unchanged) ─────────────────────────
  if (isAdmin)              return <AdminDashboard />;
  if (isElectionCommittee)  return <ElectionCommitteeDashboard />;
  if (isPageantCommittee)   return <PageantCommitteeDashboard />;
  if (isJudge)              return <JudgeDashboard />;
  if (isVoter)              return <VoterDashboard />;

  // ── Fallback — no role assigned ───────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F8FC] px-4">
      <div className="w-full max-w-sm text-center space-y-6">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
          <ShieldOff className="w-8 h-8 text-red-400" />
        </div>

        {/* Copy */}
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Access Denied</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Your account does not have any assigned roles. Please contact an administrator to get access.
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-100" />

        {/* Action */}
        <button
          onClick={() => navigate('/login')}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-[#1E3A8A] bg-[#EFF3FF] hover:bg-[#dce5ff] rounded-xl transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </button>

        {/* Brand watermark */}
        <p className="text-[11px] text-gray-300 flex items-center justify-center gap-1.5">
          <Vote className="w-3 h-3" /> SchoolVote · BISU Calape
        </p>
      </div>
    </div>
  );
}
