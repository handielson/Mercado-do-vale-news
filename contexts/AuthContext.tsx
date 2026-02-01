
import React, { createContext, useContext, useEffect, useState } from 'react';
import { pb } from '../services/pb';
import { ClientTypes } from '../utils/field-standards';

interface AuthContextType {
  user: any | null;
  clientType: ClientTypes;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Development mode mock user
const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';
const MOCK_USER = {
  id: 'dev-user-123',
  email: 'dev@mercadodovale.com',
  name: 'Usuário Desenvolvimento',
  type: ClientTypes.ATACADO,
  cpf: '12345678901'
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(DEV_MODE ? MOCK_USER : pb.authStore.model);
  const [isLoading, setIsLoading] = useState(!DEV_MODE);

  useEffect(() => {
    if (DEV_MODE) {
      console.log('🔧 DEV MODE: Using mock authentication');
      setIsLoading(false);
      return;
    }

    // Sync state on mount and changes
    const unsub = pb.authStore.onChange((token, model) => {
      setUser(model);
    });

    setIsLoading(false);
    return () => unsub();
  }, []);

  const logout = () => {
    if (DEV_MODE) {
      console.log('🔧 DEV MODE: Mock logout');
      return;
    }
    pb.authStore.clear();
    setUser(null);
  };

  // Derive ClientType: Defaults to VAREJO if not logged in or invalid type
  const clientType = (user?.type as ClientTypes) || ClientTypes.VAREJO;

  return (
    <AuthContext.Provider value={{ user, clientType, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
