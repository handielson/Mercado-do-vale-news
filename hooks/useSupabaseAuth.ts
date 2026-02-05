import { useContext } from 'react';
import { SupabaseAuthContext } from '../contexts/SupabaseAuthContext';

/**
 * Hook to access Supabase Auth context
 * Provides authentication methods and user state for customer authentication
 */
export const useSupabaseAuth = () => {
    const context = useContext(SupabaseAuthContext);

    if (!context) {
        throw new Error('useSupabaseAuth must be used within SupabaseAuthProvider');
    }

    return context;
};
