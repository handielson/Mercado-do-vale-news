import React, { useEffect, useState } from 'react';
import { getCompanyData } from '../services/companyService';
import { MaintenancePage } from '../pages/store/MaintenancePage';

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
                const company = await getCompanyData();
                if (!mounted) return;

                const bypassKey = localStorage.getItem('@MercadoDoVale:maintenance_bypass');
                setIsMaintenance(Boolean(company.maintenanceMode && bypassKey !== company.maintenanceBypassKey));
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
        return <MaintenancePage onBypassComplete={() => window.location.reload()} />;
    }

    return <>{children}</>;
};
