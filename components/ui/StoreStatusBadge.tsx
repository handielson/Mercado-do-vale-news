import React, { useState, useEffect } from 'react';
import { getStoreStatus, StoreStatus } from '../../utils/storeStatus';
import { publicCompanySettingsService } from '../../services/publicCompanySettings';

interface StoreLabels {
    open: string;
    closed: string;
    closing_soon: string;
    lunch: string;
}

const DEFAULT_LABELS: StoreLabels = {
    open: 'Loja Aberta',
    closed: 'Fechado',
    closing_soon: 'Fechando em breve',
    lunch: 'Retorna às',
};

export function StoreStatusBadge() {
    const [status, setStatus] = useState<StoreStatus | null>(null);
    const [labels, setLabels] = useState<StoreLabels>(DEFAULT_LABELS);

    useEffect(() => {
        let isMounted = true;

        const checkStatus = async () => {
            try {
                const settings = await publicCompanySettingsService.get();
                const currentStatus = await getStoreStatus(settings?.business_hours, settings?.holiday_overrides, settings?.local_holidays);

                if (isMounted) {
                    setStatus(currentStatus);
                    setLabels({
                        open: settings?.store_label_open || DEFAULT_LABELS.open,
                        closed: settings?.store_label_closed || DEFAULT_LABELS.closed,
                        closing_soon: settings?.store_label_closing_soon || DEFAULT_LABELS.closing_soon,
                        lunch: settings?.store_label_lunch || DEFAULT_LABELS.lunch,
                    });
                }
            } catch (error) {
                try {
                    const fallbackStatus = await getStoreStatus();
                    if (isMounted) setStatus(fallbackStatus);
                } catch {
                    // silenciar completamente
                }
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

    // Substitui o texto dinamicamente pelo label customizado, mantendo partes dinâmicas (ex: horários)
    const getDisplayMessage = () => {
        const s = status.status;
        if (s === 'open') return labels.open;
        if (s === 'closing_soon') return labels.closing_soon;
        // Para closed e holiday: mantém mensagens dinâmicas (ex: "Abre às 08:00", "Retorna às 13:30", "Feriado")
        // Substituindo só o texto base "Fechado" e "Fechado Hoje" pelo label customizado
        if (s === 'closed' || s === 'holiday') {
            const msg = status.message;
            // Se for mensagem simples (só "Fechado" ou "Fechado Hoje"), substitui
            if (msg === 'Fechado' || msg === 'Fechado Hoje') {
                return labels.closed;
            }
            // Se começar com "Retorna às", substitui o prefixo
            if (msg.startsWith('Retorna às')) {
                return msg.replace('Retorna às', labels.lunch);
            }
            // Demais casos (Feriado, "Abre às X", etc.) mantém como está
            return msg;
        }
        return status.message;
    };

    return (
        <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${colors[status.status]} transition-colors shadow-sm cursor-help hover:opacity-80`}
            title={tooltips[status.status]}
        >
            <div className={`w-2 h-2 rounded-full ${dotColors[status.status]} ${(status.status === 'open' || status.status === 'closing_soon') ? 'animate-pulse' : ''}`}></div>
            {getDisplayMessage()}
        </div>
    );
}
