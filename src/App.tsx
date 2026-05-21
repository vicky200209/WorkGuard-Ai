import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ToastProvider } from './components/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import ManagerDashboard from './pages/manager/ManagerDashboard';
import SupervisorDashboard from './pages/supervisor/SupervisorDashboard';
import WorkerDashboard from './pages/worker/WorkerDashboard';

import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';

// Dashboard Shell to connect Navigation state seamlessly
function DashboardShell({ children, defaultSection }: { children: (currentSection: string) => React.ReactNode; defaultSection: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentSection, setCurrentSection] = useState(defaultSection);

  return (
    <div className="min-h-screen bg-[#0A0D14] text-[#E4E6EB] flex flex-col md:flex-row font-sans">
      <Sidebar 
        currentSection={currentSection} 
        setCurrentSection={setCurrentSection} 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto bg-[#0C0F16]">
          {children(currentSection)}
        </main>
      </div>
    </div>
  );
}

// Redirect helpers for smart landing pages
function HomeRedirect() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0C10] flex flex-col justify-center items-center">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-xs font-mono text-gray-500 tracking-widest uppercase">Connecting to SiteSync...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to their specific dashboard based on role
  if (profile) {
    switch (profile.role) {
      case 'admin':
        return <Navigate to="/admin" replace />;
      case 'site_manager':
        return <Navigate to="/manager" replace />;
      case 'supervisor':
        return <Navigate to="/supervisor" replace />;
      case 'worker':
        return <Navigate to="/worker" replace />;
      default:
        return <Navigate to="/login" replace />;
    }
  }

  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/login" element={<Login />} />

            {/* Admin HQ Dashboard */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <DashboardShell defaultSection="stats">
                    {(currentSection) => <AdminDashboard activeSection={currentSection} />}
                  </DashboardShell>
                </ProtectedRoute>
              } 
            />

            {/* Site Manager Dashboard */}
            <Route 
              path="/manager" 
              element={
                <ProtectedRoute allowedRoles={['site_manager']}>
                  <DashboardShell defaultSection="assigned_site">
                    {(currentSection) => <ManagerDashboard activeSection={currentSection} />}
                  </DashboardShell>
                </ProtectedRoute>
              } 
            />

            {/* Supervisor Control Dashboard */}
            <Route 
              path="/supervisor" 
              element={
                <ProtectedRoute allowedRoles={['supervisor']}>
                  <DashboardShell defaultSection="mysite">
                    {(currentSection) => <SupervisorDashboard activeSection={currentSection} />}
                  </DashboardShell>
                </ProtectedRoute>
              } 
            />

            {/* Worker Shift Dashboard */}
            <Route 
              path="/worker" 
              element={
                <ProtectedRoute allowedRoles={['worker']}>
                  <DashboardShell defaultSection="tasks">
                    {(currentSection) => <WorkerDashboard activeSection={currentSection} />}
                  </DashboardShell>
                </ProtectedRoute>
              } 
            />

            {/* Catch missing routes */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
