import React, { createContext, useContext } from 'react';
import { useVpsAuth } from './VpsAuthContext';
import type { Customer } from '../types/customer';
import type { VpsUser } from '../types/auth';

interface AuthContextType {
  user: VpsUser | null;
  customer: Customer | null;
  isLoading: boolean;
  isAdmin: boolean;
  logout: () => Promise<void>;
  refreshCustomer: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, customer, isLoading, signOut } = useVpsAuth();

  const refreshCustomer = async () => {
    window.location.reload();
  };

  return (
    <AuthContext.Provider value={{
      user,
      customer,
      isLoading,
      isAdmin: customer?.customer_type === 'ADMIN',
      logout: signOut,
      refreshCustomer,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
