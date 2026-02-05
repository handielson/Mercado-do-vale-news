
import React from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import { SupabaseAuthProvider } from './contexts/SupabaseAuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { router } from './routes/index';
import { useFavicon } from './hooks/useFavicon';

/**
 * App Root
 * Serves as the provider hub for the entire SaaS ecosystem.
 * All logic is delegated to specialized contexts and the router.
 */
const App: React.FC = () => {
  // Aplicar favicon e título da empresa dinamicamente
  useFavicon();

  return (
    <HelmetProvider>
      <SupabaseAuthProvider>
        <AuthProvider>
          <ThemeProvider>
            <RouterProvider router={router} />
            <Toaster
              position="top-right"
              richColors
              closeButton
              duration={3000}
            />
          </ThemeProvider>
        </AuthProvider>
      </SupabaseAuthProvider>
    </HelmetProvider>
  );
};

export default App;
