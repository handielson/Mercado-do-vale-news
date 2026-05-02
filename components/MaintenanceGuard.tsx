import React, { useEffect, useState } from 'react';
import { matchesPublicMaintenanceBypass, publicCompanySettingsService } from '../services/publicCompanySettings';

const MaintenancePage = React.lazy(() =>
    import('../pages/store/MaintenancePage').then((module) => ({ default: module.MaintenancePage })),
);

export const MaintenanceGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isChecking, setIsChecking] = useState(true);
    const [isMaintenance, setIsMaintenance] = useState(false);

    useEffect(() => {
        let mounted = true;

        const timeout = setTimeout(() => {
            if (mounted) {
                console.warn('[MaintenanceGuard] Timeout atingido - liberando catalogo por seguranca.');
                setIsChecking(false);
                setIsMaintenance(false);
            }
        }, 5000);

        const checkMaintenanceStatus = async () => {
            try {
                const settings = await publicCompanySettingsService.get();
                if (!mounted) return;

                const bypassKey = localStorage.getItem('@MercadoDoVale:maintenance_bypass');
                const isBypassed = await matchesPublicMaintenanceBypass(settings, bypassKey);
                setIsMaintenance(Boolean(settings?.maintenance_mode && !isBypassed));
            } catch (error: any) {
                if (!mounted) return;

                if (error?.name !== 'AbortError' && error?.message !== 'AbortError') {
                    console.error('Maintenance Check Error:', error);
                }

                setIsMaintenance(false);
            } finally {
                if (mounted) {
                    clearTimeout(timeout);
                    setIsChecking(false);
                }
            }
        };

        checkMaintenanceStatus();

        return () => {
            mounted = false;
            clearTimeout(timeout);
        };
    }, []);

    if (!isChecking && isMaintenance) {
        return (
            <React.Suspense fallback={null}>
                <MaintenancePage onBypassComplete={() => window.location.reload()} />
            </React.Suspense>
        );
    }

    return <>{children}</>;
};
