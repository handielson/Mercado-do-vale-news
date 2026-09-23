import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useVpsAuth } from '../contexts/VpsAuthContext';
import { accountantPortalService } from '../services/accountantPortalService';

export function AccountantProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, customer, isLoading } = useVpsAuth();
  const location = useLocation();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  useEffect(() => {
    if (isLoading || !user || !customer) return;
    let active = true;
    accountantPortalService.list().then(result => { if (active) setAuthorized(result.companies.length > 0); }).catch(() => { if (active) setAuthorized(false); });
    return () => { active = false; };
  }, [isLoading, user, customer]);
  if (isLoading || (user && customer && authorized === null)) return <div className="min-h-screen grid place-items-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" /></div>;
  if (!user || !customer) return <Navigate to="/cliente/login?next=/contador" state={{ from: location }} replace />;
  if (!authorized) return <Navigate to="/" replace />;
  return <>{children}</>;
}
