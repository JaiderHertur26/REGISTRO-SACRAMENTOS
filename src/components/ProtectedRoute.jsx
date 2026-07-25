import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ROLE_TYPES } from '@/config/supabaseConfig';

const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, loading, getRedirectPath } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4AF37]"></div>
      </div>
    );
  }

  // Not authenticated -> Login
  if (!user) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  // Role check (normalized)
  if (requiredRole) {
    const userRole = String(user.role || '').trim().toLowerCase();
    const required = String(requiredRole || '').trim().toLowerCase();

  if (userRole !== required) {
    const correctPath = getRedirectPath(user.role);
    return <Navigate to={correctPath} replace />;
    }
  }

  return children;
};

export default ProtectedRoute;