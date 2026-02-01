
import React from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { router } from './routes/index';

/**
 * App Root
 * Serves as the provider hub for the entire SaaS ecosystem.
 * All logic is delegated to specialized contexts and the router.
 */
const App: React.FC = () => {
  return (
    <HelmetProvider>
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
    </HelmetProvider>
  );
};

export default App;
