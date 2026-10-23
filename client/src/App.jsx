import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { NotificationProvider } from './context/NotificationContext';
import { ChatProvider } from './context/ChatContext';
import ChatDock from './components/ChatDock';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import MobileBottomNav from './components/MobileBottomNav';

// Pages
import HomePage from './pages/HomePage';
import JobsPage from './pages/JobsPage';
import JobDetailsPage from './pages/JobDetailsPage';
import ApplicationsPage from './pages/ApplicationsPage';
import EmployerDashboard from './pages/employer/EmployerDashboard';
import EmployerPendingStatus from './pages/employer/EmployerPendingStatus';
import EmployerPayment from './pages/employer/EmployerPayment';
import PostJobPage from './pages/employer/PostJobPage';
import ApplicantsPage from './pages/employer/ApplicantsPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';
import EmailVerifyBanner from './components/EmailVerifyBanner';
import { syncClock } from './utils/time';
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';
import LegalPage from './pages/LegalPage';
import DeveloperPortalPage from './pages/DeveloperPortalPage';
import './App.css';

// Waits for the saved session to load, then sends guests to login and wrong roles home
function Guard({ roles, children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="grid place-items-center py-32 text-sm text-zinc-500" role="status">…</div>;
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(loc.pathname)}`} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <LanguageProvider>
        <AuthProvider>
          <NotificationProvider>
            <ChatProvider>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/jobs" element={<JobsPage />} />
                  <Route path="/jobs/:id" element={<JobDetailsPage />} />
                  <Route path="/applications" element={<Guard roles={['employee']}><ApplicationsPage /></Guard>} />

                  <Route path="/employer/dashboard" element={<Guard roles={['employer']}><EmployerDashboard /></Guard>} />
                  <Route path="/employer/status" element={<Guard roles={['employer']}><EmployerPendingStatus /></Guard>} />
                  <Route path="/employer/payment" element={<Guard roles={['employer']}><EmployerPayment /></Guard>} />
                  <Route path="/employer/jobs/new" element={<Guard roles={['employer']}><PostJobPage /></Guard>} />
                  <Route path="/employer/applicants" element={<Navigate to="/employer/dashboard" replace />} />
                  <Route path="/employer/applicants/:jobId" element={<Guard roles={['employer']}><ApplicantsPage /></Guard>} />

                  <Route path="/admin" element={<Guard roles={['admin']}><AdminDashboard /></Guard>} />

                  <Route path="/terms" element={<LegalPage which="terms" />} />
                  <Route path="/privacy" element={<LegalPage which="privacy" />} />
                  <Route path="/developers" element={<DeveloperPortalPage />} />
                  <Route path="/api" element={<Navigate to="/developers" replace />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/verify-email" element={<VerifyEmailPage />} />
                  <Route path="/profile" element={<Guard roles={undefined}><ProfilePage /></Guard>} />
                </Route>
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
          </ChatProvider>
          </NotificationProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}

function AppLayout() {
  // Use the server's Rwanda-time clock, not the device clock
  useEffect(() => {
    syncClock();
    const id = setInterval(syncClock, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="min-h-screen flex flex-col text-zinc-900 font-sans selection:bg-blue-700 selection:text-white pb-16 md:pb-0">
      <Navbar />
      <EmailVerifyBanner />
      <main className="flex-1"><Outlet /></main>
      <Footer />
      <ChatDock />
      <MobileBottomNav />
    </div>
  );
}