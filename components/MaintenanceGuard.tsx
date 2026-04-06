import React, { useEffect, useState } from 'react';
import { getCompanyData } from '../services/companyService';
import { MaintenancePage } from '../pages/store/MaintenancePage';
import { Loader2 } from 'lucide-react';

export const MaintenanceGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isChecking, setIsChecking] = useState(true);
    const [isMaintenance, setIsMaintenance] = useState(false);

    useEffect(() => {
        let mounted = true;

        // Timeout de segurança: se o fetch demorar mais de 5s ou abortar, libera o catálogo
        const timeout = setTimeout(() => {
            if (mounted) {
                console.warn('[MaintenanceGuard] Timeout atingido – liberando catálogo por segurança.');
                setIsChecking(false);
                setIsMaintenance(false);
            }
        }, 5000);

        const checkMaintenanceStatus = async () => {
            try {
                const company = await getCompanyData();
                if (!mounted) return;

                const bypassKey = localStorage.getItem('@MercadoDoVale:maintenance_bypass');
                if (company.maintenanceMode && bypassKey !== company.maintenanceBypassKey) {
                    setIsMaintenance(true);
                } else {
                    setIsMaintenance(false);
                }
            } catch (error: any) {
                if (!mounted) return;
                // AbortError é esperado no React StrictMode (double-invoke) – não bloquear
                if (error?.name !== 'AbortError' && error?.message !== 'AbortError') {
                    console.error("Maintenance Check Error:", error);
                }
                setIsMaintenance(false); // Em caso de erro, libera o catálogo por segurança.
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

    if (isChecking) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
                <Loader2 className="animate-spin text-blue-500 mb-4" size={40} />
                <p className="text-slate-500 font-medium animate-pulse">Estabelecendo Conexão Segura...</p>
            </div>
        );
    }

    if (isMaintenance) {
        return <MaintenancePage onBypassComplete={() => window.location.reload()} />;
    }

    // Se estiver tudo OK (Sem manutenção, ou com Bypass válido ativado), renderiza a Loja:
    return <>{children}</>;
};
