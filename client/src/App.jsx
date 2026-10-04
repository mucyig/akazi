import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { NotificationProvider } from './context/NotificationContext';
import { ChatProvider } from './context/ChatContext';
import ChatDock from './components/ChatDock';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

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
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';
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

export default function App() {
  return (
    <BrowserRouter>
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

                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
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
  return (
    <div className="min-h-screen flex flex-col text-zinc-900 font-sans selection:bg-blue-700 selection:text-white">
      <Navbar />
      <main className="flex-1"><Outlet /></main>
      <Footer />
      <ChatDock />
    </div>
  );
}
