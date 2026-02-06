import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { User } from '@supabase/supabase-js';

interface Customer {
  id: string;
  user_id: string;
  name: string;
  email: string;
  customer_type: 'retail' | 'wholesale' | 'resale' | 'ADMIN';
  cpf_cnpj?: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  customer: Customer | null;
  isLoading: boolean;
  isAdmin: boolean;
  logout: () => Promise<void>;
  refreshCustomer: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCustomer = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching customer:', error);
        return null;
      }

      return data as Customer;
    } catch (error) {
      console.error('Error fetching customer:', error);
      return null;
    }
  };

  const refreshCustomer = async () => {
    if (user) {
      const customerData = await fetchCustomer(user.id);
      setCustomer(customerData);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchCustomer(session.user.id).then(setCustomer);
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const customerData = await fetchCustomer(session.user.id);
        setCustomer(customerData);
      } else {
        setCustomer(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCustomer(null);
  };

  const isAdmin = customer?.customer_type === 'ADMIN';

  return (
    <AuthContext.Provider value={{ user, customer, isLoading, isAdmin, logout, refreshCustomer }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
