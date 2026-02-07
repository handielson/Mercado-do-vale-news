import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSupabaseAuth } from '../contexts/SupabaseAuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

/**
 * ProtectedRoute - Supabase Authentication
 * 
 * Protects routes requiring authentication
 * Optionally requires ADMIN customer_type
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAdmin = false }) => {
  const { user, customer, isLoading } = useSupabaseAuth();
  const location = useLocation();

  // Wait for auth to load
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Not logged in - redirect to appropriate login
  if (!user || !customer) {
    const loginPath = requireAdmin ? '/admin/login' : '/cliente/login';
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  // Requires admin but user is not admin
  if (requireAdmin && customer.customer_type !== 'ADMIN') {
    return <Navigate to="/catalog" replace />;
  }

  return <>{children}</>;
};
