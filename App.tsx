import React from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { RouterProvider } from 'react-router-dom';
import { VpsAuthProvider } from './contexts/VpsAuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { CompareProvider } from './contexts/CompareContext';
import { CompareBar } from './components/catalog/CompareBar';
import { OAuthHashRedirect } from './components/auth/OAuthHashRedirect';
import { router } from './routes/index';
import { useFavicon } from './hooks/useFavicon';
import { useGoogleAnalytics } from './hooks/useGoogleAnalytics';
import { installAdminNavigationLogger } from './services/adminNavigationLogService';

const LazyToaster = React.lazy(() => import('sonner').then((module) => ({ default: module.Toaster })));

function isCatalogRouteFallback() {
  if (typeof window === 'undefined') return false;
  const pathname = window.location.pathname;
  return pathname === '/' || pathname === '/produtos' || pathname.startsWith('/produtos/');
}

const CatalogSkeletonCard: React.FC = () => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-pulse">
    <div className="aspect-[4/3] bg-slate-200" />
    <div className="p-3 sm:p-4">
      <div className="h-4 bg-slate-200 rounded mb-2" />
      <div className="h-3 bg-slate-100 rounded w-2/3 mb-4" />
      <div className="h-6 bg-slate-200 rounded w-1/2 mb-3" />
      <div className="h-10 bg-slate-100 rounded" />
    </div>
  </div>
);

const CatalogRouteFallback: React.FC = () => (
  <div className="min-h-screen bg-slate-50">
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-28 rounded bg-slate-200 animate-pulse" />
          <div className="hidden sm:block h-8 w-px bg-slate-100" />
          <div className="hidden sm:block h-8 w-28 rounded bg-slate-100 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block h-8 w-24 rounded-full bg-slate-100 animate-pulse" />
          <div className="h-9 w-28 rounded-lg bg-slate-200 animate-pulse" />
        </div>
      </div>
      <div className="sm:hidden border-t border-slate-100 px-4 py-2">
        <div className="h-7 w-48 rounded bg-slate-100 animate-pulse" />
      </div>
    </header>

    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
      <div className="aspect-[21/9] w-full rounded-xl bg-slate-200 animate-pulse" />

      <div className="mt-5 flex items-center gap-2 overflow-hidden">
        {['w-20', 'w-24', 'w-16', 'w-28', 'w-24', 'w-32'].map((widthClass, index) => (
          <div key={index} className={`h-9 shrink-0 rounded-full bg-slate-100 animate-pulse ${widthClass}`} />
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-11 rounded-xl bg-white border border-slate-200 animate-pulse sm:w-96" />
        <div className="flex gap-2">
          <div className="h-10 w-24 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-10 w-40 rounded-xl bg-slate-100 animate-pulse" />
        </div>
      </div>

      <section className="py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="h-7 w-40 rounded bg-slate-200 animate-pulse" />
            <div className="mt-2 h-4 w-64 max-w-full rounded bg-slate-100 animate-pulse" />
          </div>
          <div className="h-5 w-16 rounded bg-slate-100 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5 md:gap-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <CatalogSkeletonCard key={index} />
          ))}
        </div>
      </section>

      <section className="py-4">
        <div className="mb-6 h-8 w-48 rounded bg-slate-200 animate-pulse" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5 md:gap-6">
          {Array.from({ length: 10 }).map((_, index) => (
            <CatalogSkeletonCard key={index} />
          ))}
        </div>
      </section>
    </main>
  </div>
);

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

const RouteFallback: React.FC = () => (
  isCatalogRouteFallback() ? <CatalogRouteFallback /> : <AppRouteFallback />
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
  React.useEffect(() => installAdminNavigationLogger(router), []);

  return (
    <HelmetProvider>
      <VpsAuthProvider>
        <ThemeProvider>
          <CompareProvider>
            <OAuthHashRedirect />
            <React.Suspense fallback={<RouteFallback />}>
              <RouterProvider router={router} />
            </React.Suspense>
            <CompareBar />
            <DeferredToaster />
          </CompareProvider>
        </ThemeProvider>
      </VpsAuthProvider>
    </HelmetProvider>
  );
};

export default App;
