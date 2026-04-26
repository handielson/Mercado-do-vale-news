import React from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { SupabaseAuthProvider } from './contexts/SupabaseAuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { CompareProvider } from './contexts/CompareContext';
import { CompareBar } from './components/catalog/CompareBar';
import { OAuthHashRedirect } from './components/auth/OAuthHashRedirect';
import { router } from './routes/index';
import { useFavicon } from './hooks/useFavicon';
import { useGoogleAnalytics } from './hooks/useGoogleAnalytics';



/**
 * App Root
 * Serves as the provider hub for the entire SaaS ecosystem.
 * All logic is delegated to specialized contexts and the router.
 * 
 * CRITICAL FIX: Removed duplicate AuthContext to prevent race condition
 * that was causing AbortError in production when both contexts called
 * getSession() simultaneously on mount.
 */
const App: React.FC = () => {
  // Aplicar favicon e título da empresa dinamicamente
  useFavicon();
  // Injetar Google Analytics dinamicamente (se configurado nos Dados da Empresa)
  useGoogleAnalytics();

  return (
    <HelmetProvider>
      <SupabaseAuthProvider>
        <ThemeProvider>
          <CompareProvider>
            <OAuthHashRedirect />
            <RouterProvider router={router} />
            <CompareBar />
            <Toaster
              position="top-right"
              richColors
              closeButton
              duration={3000}
            />
          </CompareProvider>
        </ThemeProvider>
      </SupabaseAuthProvider>
    </HelmetProvider>
  );
};

export default App;
