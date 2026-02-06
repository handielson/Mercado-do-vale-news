import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';

/**
 * Admin Dashboard Page
 * 
 * Redirects to the main admin panel at /admin
 * This ensures Supabase-authenticated admins can access the full admin system
 */
export const AdminDashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const { customer } = useSupabaseAuth();

    useEffect(() => {
        // Redirect to main admin panel
        if (customer?.customer_type === 'ADMIN') {
            navigate('/admin', { replace: true });
        }
    }, [customer, navigate]);


    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-600">Redirecionando para painel administrativo...</p>
            </div>
        </div>
    );
};
