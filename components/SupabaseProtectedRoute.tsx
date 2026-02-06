import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';

interface SupabaseProtectedRouteProps {
    children: React.ReactNode;
    requireAdmin?: boolean;
}

/**
 * Protected Route for Supabase-authenticated users
 * 
 * - If requireAdmin=true, only ADMIN customer_type can access
 * - If requireAdmin=false, any authenticated user can access
 * - Redirects to /cliente/login if not authenticated
 * - Redirects to /catalog if authenticated but not admin (when admin required)
 */
export const SupabaseProtectedRoute: React.FC<SupabaseProtectedRouteProps> = ({
    children,
    requireAdmin = false
}) => {
    const { user, customer, loading } = useSupabaseAuth();
    const location = useLocation();

    // Wait for auth to load
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // Not authenticated - redirect to login
    if (!user) {
        return <Navigate to="/cliente/login" state={{ from: location }} replace />;
    }

    // Admin required but user is not admin
    if (requireAdmin && customer?.customer_type !== 'ADMIN') {
        return <Navigate to="/catalog" replace />;
    }

    return <>{children}</>;
};
