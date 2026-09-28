import React from 'react';
import { print3dStorefrontSettingsService } from '../services/print3dStorefrontSettings';

const Print3dMaintenancePage = React.lazy(() => import('../pages/store/Print3dMaintenancePage'));
const PREVIEW_STORAGE_KEY = '@3DMV:maintenance_preview';

function previewTokenFromLocation(): { token: string; fromUrl: boolean } {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('maintenance_preview')?.trim() || '';
  return { token: fromUrl || window.sessionStorage.getItem(PREVIEW_STORAGE_KEY) || '', fromUrl: Boolean(fromUrl) };
}

function removePreviewTokenFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('maintenance_preview');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

export default function Print3dMaintenanceGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<{ checking: boolean; active: boolean; message: string; preview: boolean }>({
    checking: true,
    active: false,
    message: '',
    preview: false,
  });

  React.useEffect(() => {
    let mounted = true;
    const timeout = window.setTimeout(() => mounted && setState(current => ({ ...current, checking: false })), 5000);
    print3dStorefrontSettingsService.public()
      .then(async settings => {
        if (!settings.maintenance_mode) {
          if (mounted) setState({ checking: false, active: false, message: settings.maintenance_message, preview: false });
          return;
        }
        const candidate = previewTokenFromLocation();
        if (!candidate.token) {
          if (mounted) setState({ checking: false, active: true, message: settings.maintenance_message, preview: false });
          return;
        }
        try {
          const verification = await print3dStorefrontSettingsService.verifyPreview(candidate.token);
          if (!verification.valid) throw new Error('Prévia inválida.');
          window.sessionStorage.setItem(PREVIEW_STORAGE_KEY, candidate.token);
          if (candidate.fromUrl) removePreviewTokenFromUrl();
          if (mounted) setState({ checking: false, active: true, message: settings.maintenance_message, preview: true });
        } catch {
          window.sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
          if (candidate.fromUrl) removePreviewTokenFromUrl();
          if (mounted) setState({ checking: false, active: true, message: settings.maintenance_message, preview: false });
        }
      })
      .catch(() => mounted && setState({ checking: false, active: false, message: '', preview: false }))
      .finally(() => window.clearTimeout(timeout));
    return () => { mounted = false; window.clearTimeout(timeout); };
  }, []);

  if (state.checking) return <div className="min-h-screen bg-[#f7f5f0]" aria-label="Carregando 3DMV" />;
  if (state.active && !state.preview) return <React.Suspense fallback={null}><Print3dMaintenancePage message={state.message} /></React.Suspense>;
  if (state.preview) return <>
    <div className="sticky top-0 z-[100] bg-amber-400 px-4 py-2 text-center text-sm font-bold text-amber-950 shadow-sm">
      Prévia administrativa — o público continua vendo a página de manutenção.
    </div>
    {children}
  </>;
  return <>{children}</>;
}
