import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import AuthCallback from '@/pages/AuthCallback';
import DashboardRouter from '@/pages/DashboardRouter';
import './App.css';

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
