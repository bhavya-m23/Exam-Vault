import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import NotificationToast from './components/NotificationToast';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import DocumentDetails from './pages/DocumentDetails';
import AccessPolicies from './pages/AccessPolicies';
import SecurityActivity from './pages/SecurityActivity';
import AuditLogs from './pages/AuditLogs';

const ProtectedLayout = ({ children }) => {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center text-cyan-400 font-mono text-xs">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="tracking-wider uppercase">Authenticating Vault Session...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <div className="flex min-h-screen bg-navy-950 text-slate-100 font-sans selection:bg-blue-600 selection:text-white">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        {children}
      </div>
      <NotificationToast />
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedLayout>
                <Dashboard />
              </ProtectedLayout>
            }
          />

          <Route
            path="/documents"
            element={
              <ProtectedLayout>
                <Documents />
              </ProtectedLayout>
            }
          />

          <Route
            path="/documents/:id"
            element={
              <ProtectedLayout>
                <DocumentDetails />
              </ProtectedLayout>
            }
          />

          <Route
            path="/policies"
            element={
              <ProtectedLayout>
                <AccessPolicies />
              </ProtectedLayout>
            }
          />

          <Route
            path="/security"
            element={
              <ProtectedLayout>
                <SecurityActivity />
              </ProtectedLayout>
            }
          />

          <Route
            path="/audit"
            element={
              <ProtectedLayout>
                <AuditLogs />
              </ProtectedLayout>
            }
          />

          {/* Catch-all redirect to Dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
