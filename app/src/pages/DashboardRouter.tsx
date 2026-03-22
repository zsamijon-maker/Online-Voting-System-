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

/**
 * Dashboard Router
 * 
 * This component routes users to their appropriate dashboard based on their role.
 * Users with multiple roles will see the dashboard of their highest priority role.
 * 
 * Role Priority:
 * 1. Admin
 * 2. Election Committee
 * 3. Pageant Committee
 * 4. Judge
 * 5. Voter (Student)
 */

export default function DashboardRouter() {
  const { isAuthenticated, isLoading } = useAuth();
  const { isAdmin, isElectionCommittee, isPageantCommittee, isJudge, isVoter } = useRoleAccess();
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize local storage with seed data
  useEffect(() => {
    initializeLocalStorage();
  }, []);

  // Redirect to login if not authenticated.
  // Encode the current path as `returnTo` so the user arrives back here after
  // a successful login.  The path is validated by isSafeRedirectUrl before
  // being embedded in the URL to prevent open-redirect attacks.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const currentPath = location.pathname + location.search;
      const returnTo = isSafeRedirectUrl(currentPath) ? currentPath : '/dashboard';
      navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, location]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#295acc] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Route to appropriate dashboard based on role priority
  // Priority: Admin > Election Committee > Pageant Committee > Judge > Voter
  if (isAdmin) {
    return <AdminDashboard />;
  }

  if (isElectionCommittee) {
    return <ElectionCommitteeDashboard />;
  }

  if (isPageantCommittee) {
    return <PageantCommitteeDashboard />;
  }

  if (isJudge) {
    return <JudgeDashboard />;
  }

  if (isVoter) {
    return <VoterDashboard />;
  }

  // Fallback - should not reach here if user has at least one role
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
        <p className="text-gray-600 mb-6">
          You do not have any assigned roles. Please contact an administrator.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="text-[#295acc] hover:underline"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}
