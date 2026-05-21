import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F1115] text-[#E4E6EB] flex flex-col justify-center items-center font-sans">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" id="protected-loader"></div>
        <p className="text-sm font-mono tracking-wider text-amber-500 animate-pulse">SYNCHRONIZING SITESYNC SECURE SESSION...</p>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If roles are specified, check if user's role matches
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    // Redirect to correct dashboard
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

  return children;
}
