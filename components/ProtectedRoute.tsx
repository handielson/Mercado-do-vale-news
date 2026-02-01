
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ClientTypes } from '../utils/field-standards';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: ClientTypes | ClientTypes[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { user, clientType, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return null; // Wait for AuthContext to resolve

  console.log('🔒 [ProtectedRoute] user:', user, 'isLoading:', isLoading);

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!roles.includes(clientType)) {
      // If unauthorized, redirect to their default home
      const target = clientType === ClientTypes.VAREJO ? '/store' : '/admin';
      return <Navigate to={target} replace />;
    }
  }

  return <>{children}</>;
};
