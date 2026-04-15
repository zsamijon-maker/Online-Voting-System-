import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import AuthCallback from '@/pages/AuthCallback';
import DashboardRouter from '@/pages/DashboardRouter';
import './App.css';

function OAuthCodeRecovery() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const hasOAuthCode = params.has('code');
    const onCallbackRoute = location.pathname === '/auth/callback';

    // If OAuth lands on a non-callback route (e.g., '/?code=...'), reroute
    // to the callback page so token exchange can complete.
    if (hasOAuthCode && !onCallbackRoute) {
      navigate(
        {
          pathname: '/auth/callback',
          search: location.search,
          hash: location.hash,
        },
        { replace: true }
      );
    }
  }, [location.hash, location.pathname, location.search, navigate]);

  return null;
}

/**
 * School Voting System - Main Application
 * 
 * A secure, role-based online voting system for:
 * - School Elections (Student Government, Class Representatives, Club Officers)
 * - Pageant Competitions (Judging and Scoring)
 * 
 * User Roles:
 * - Administrator: Full system control
 * - Election Committee: Manage elections and candidates
 * - Pageant Committee: Manage pageants, contestants, and criteria
 * - Judge: Score contestants in pageants
 * - Voter (Student): Cast votes in elections
 */

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <Router>
            <OAuthCodeRecovery />
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/callback" element={<AuthCallback />} />

              {/* Protected Dashboard Route */}
              <Route path="/dashboard" element={<DashboardRouter />} />

              {/* Fallback Route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
