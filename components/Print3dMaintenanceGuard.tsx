import React from 'react';
import { print3dStorefrontSettingsService } from '../services/print3dStorefrontSettings';

const Print3dMaintenancePage = React.lazy(() => import('../pages/store/Print3dMaintenancePage'));

export default function Print3dMaintenanceGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<{ checking: boolean; active: boolean; message: string }>({
    checking: true,
    active: false,
    message: '',
  });

  React.useEffect(() => {
    let mounted = true;
    const timeout = window.setTimeout(() => mounted && setState(current => ({ ...current, checking: false })), 5000);
    print3dStorefrontSettingsService.public()
      .then(settings => mounted && setState({ checking: false, active: settings.maintenance_mode, message: settings.maintenance_message }))
      .catch(() => mounted && setState({ checking: false, active: false, message: '' }))
      .finally(() => window.clearTimeout(timeout));
    return () => { mounted = false; window.clearTimeout(timeout); };
  }, []);

  if (state.checking) return <div className="min-h-screen bg-[#f7f5f0]" aria-label="Carregando 3DMV" />;
  if (state.active) return <React.Suspense fallback={null}><Print3dMaintenancePage message={state.message} /></React.Suspense>;
  return <>{children}</>;
}
