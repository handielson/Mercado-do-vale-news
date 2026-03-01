import React, { useState, useEffect } from 'react';
import { getStoreStatus, StoreStatus } from '../../utils/storeStatus';
import { companySettingsService } from '../../services/companySettingsService';

export function StoreStatusBadge() {
    const [status, setStatus] = useState<StoreStatus | null>(null);

    useEffect(() => {
        let isMounted = true;

        const checkStatus = async () => {
            try {
                const settings = await companySettingsService.get();
                const currentStatus = await getStoreStatus(settings?.business_hours, settings?.holiday_overrides);
                console.log('[StoreStatus Check]', {
                    dayOfWeek: new Date().getDay(),
                    currentTime: `${new Date().getHours()}:${new Date().getMinutes()}`,
                    business_hours: settings?.business_hours,
                    holiday_overrides: settings?.holiday_overrides,
                    evaluatedStatus: currentStatus
                });
                if (isMounted) setStatus(currentStatus);
            } catch (error) {
                console.error('Failed to get store status:', error);
            }
        };

        checkStatus();

        // Refresh every minute
        const interval = setInterval(checkStatus, 60000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    if (!status) return null;

    const colors = {
        open: 'bg-green-50 text-green-700 border-green-200',
        closing_soon: 'bg-amber-50 text-amber-700 border-amber-200',
        closed: 'bg-slate-50 text-slate-600 border-slate-200',
        holiday: 'bg-orange-50 text-orange-700 border-orange-200'
    };

    const dotColors = {
        open: 'bg-green-500',
        closing_soon: 'bg-amber-500',
        closed: 'bg-slate-400',
        holiday: 'bg-orange-500'
    };

    const tooltips = {
        open: 'A loja está recebendo pedidos e fazendo entregas.',
        closing_soon: 'A loja fechará em breve! Finalize seu pedido agora.',
        closed: 'Neste momento a loja não está fazendo entregas.',
        holiday: 'Neste momento a loja não está fazendo entregas.'
    };

    return (
        <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${colors[status.status]} transition-colors shadow-sm cursor-help hover:opacity-80`}
            title={tooltips[status.status]}
        >
            <div className={`w-2 h-2 rounded-full ${dotColors[status.status]} ${(status.status === 'open' || status.status === 'closing_soon') ? 'animate-pulse' : ''}`}></div>
            {status.message}
        </div>
    );
}
