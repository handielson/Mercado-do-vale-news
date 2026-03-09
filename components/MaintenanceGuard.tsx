import React, { useEffect, useState } from 'react';
import { getCompanyData } from '../services/companyService';
import { MaintenancePage } from '../pages/store/MaintenancePage';
import { Loader2 } from 'lucide-react';

export const MaintenanceGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isChecking, setIsChecking] = useState(true);
    const [isMaintenance, setIsMaintenance] = useState(false);

    useEffect(() => {
        const checkMaintenanceStatus = async () => {
            try {
                const company = await getCompanyData();
                const bypassKey = localStorage.getItem('@MercadoDoVale:maintenance_bypass');

                // Se o banco apontar que não está em manutenção, ou se a chave bypass armazenada for igual a configurada no admin, está liberado:
                if (company.maintenanceMode && bypassKey !== company.maintenanceBypassKey) {
                    setIsMaintenance(true);
                } else {
                    setIsMaintenance(false);
                }
            } catch (error) {
                console.error("Maintenance Check Error:", error);
                setIsMaintenance(false); // Em caso de erro na checagem da empresa, libera o catálogo por segurança.
            } finally {
                setIsChecking(false);
            }
        };

        checkMaintenanceStatus();
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
