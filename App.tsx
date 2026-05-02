import React from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { RouterProvider } from 'react-router-dom';
import { SupabaseAuthProvider } from './contexts/SupabaseAuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { CompareProvider } from './contexts/CompareContext';
import { CompareBar } from './components/catalog/CompareBar';
import { OAuthHashRedirect } from './components/auth/OAuthHashRedirect';
import { router } from './routes/index';
import { useFavicon } from './hooks/useFavicon';
import { useGoogleAnalytics } from './hooks/useGoogleAnalytics';

const LazyToaster = React.lazy(() => import('sonner').then((module) => ({ default: module.Toaster })));

const AppRouteFallback: React.FC = () => (
  <div className="min-h-screen bg-slate-50">
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-200 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-32 rounded bg-slate-200 animate-pulse" />
            <div className="h-3 w-20 rounded bg-slate-100 animate-pulse" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-20 rounded-lg bg-slate-100 animate-pulse" />
          <div className="h-8 w-24 rounded-lg bg-slate-200 animate-pulse" />
        </div>
      </div>
    </header>

    <main className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="aspect-square rounded-2xl bg-slate-200 animate-pulse" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="aspect-square rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="h-4 w-24 rounded bg-slate-100 animate-pulse" />
          <div className="space-y-3">
            <div className="h-8 w-4/5 rounded bg-slate-200 animate-pulse" />
            <div className="h-8 w-3/5 rounded bg-slate-200 animate-pulse" />
          </div>
          <div className="h-5 w-32 rounded bg-slate-100 animate-pulse" />
          <div className="h-12 w-48 rounded bg-slate-200 animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-12 rounded-xl bg-slate-200 animate-pulse" />
            <div className="h-12 rounded-xl bg-slate-100 animate-pulse" />
          </div>
          <div className="space-y-3 pt-4">
            <div className="h-16 rounded-xl bg-white border border-slate-100 animate-pulse" />
            <div className="h-16 rounded-xl bg-white border border-slate-100 animate-pulse" />
          </div>
        </div>
      </div>
    </main>
  </div>
);

const DeferredToaster: React.FC = () => {
  const [enabled, setEnabled] = React.useState(false);

  React.useEffect(() => {
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(() => setEnabled(true), { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }

    const id = window.setTimeout(() => setEnabled(true), 2500);
    return () => window.clearTimeout(id);
  }, []);

  if (!enabled) return null;

  return (
    <React.Suspense fallback={null}>
      <LazyToaster
        position="top-right"
        richColors
        closeButton
        duration={3000}
      />
    </React.Suspense>
  );
};

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
            <React.Suspense fallback={<AppRouteFallback />}>
              <RouterProvider router={router} />
            </React.Suspense>
            <CompareBar />
            <DeferredToaster />
          </CompareProvider>
        </ThemeProvider>
      </SupabaseAuthProvider>
    </HelmetProvider>
  );
};

export default App;
