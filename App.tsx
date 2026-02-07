
import React from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { SupabaseAuthProvider } from './contexts/SupabaseAuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { router } from './routes/index';
import { useFavicon } from './hooks/useFavicon';

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

  return (
    <HelmetProvider>
      <SupabaseAuthProvider>
        <ThemeProvider>
          <RouterProvider router={router} />
          <Toaster
            position="top-right"
            richColors
            closeButton
            duration={3000}
          />
        </ThemeProvider>
      </SupabaseAuthProvider>
    </HelmetProvider>
  );
};

export default App;
