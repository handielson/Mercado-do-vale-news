import React, { useState, useEffect, useRef } from 'react';
import { getStoreStatus, StoreStatus } from '../../utils/storeStatus';
import { companySettingsService } from '../../services/companySettingsService';

export function StoreStatusBadge() {
    const [status, setStatus] = useState<StoreStatus | null>(null);
    const [hoursText, setHoursText] = useState<string>('');
    const [showPopover, setShowPopover] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let isMounted = true;

        const checkStatus = async () => {
            try {
                const settings = await companySettingsService.get();
                const currentStatus = await getStoreStatus(settings?.business_hours, settings?.holiday_overrides, settings?.local_holidays);
                if (isMounted) {
                    setStatus(currentStatus);
                    setHoursText(settings?.business_hours_display_text || '');
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

    // Fecha popover ao clicar fora
    useEffect(() => {
        if (!showPopover) return;
        const handler = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setShowPopover(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showPopover]);

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

    const defaultTooltips = {
        open: 'A loja está recebendo pedidos e fazendo entregas.',
        closing_soon: 'A loja fechará em breve! Finalize seu pedido agora.',
        closed: 'Neste momento a loja não está fazendo entregas.',
        holiday: 'Neste momento a loja não está fazendo entregas.'
    };

    const hasHoursText = !!hoursText;

    return (
        <div className="relative" ref={popoverRef}>
            <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${colors[status.status]} transition-colors shadow-sm ${hasHoursText ? 'cursor-pointer hover:opacity-80' : 'cursor-help'}`}
                title={hasHoursText ? undefined : defaultTooltips[status.status]}
                onClick={() => hasHoursText && setShowPopover((v) => !v)}
            >
                <div className={`w-2 h-2 rounded-full ${dotColors[status.status]} ${(status.status === 'open' || status.status === 'closing_soon') ? 'animate-pulse' : ''}`}></div>
                {status.message}
                {hasHoursText && (
                    <span className="ml-0.5 opacity-50 text-[10px]">▾</span>
                )}
            </div>

            {/* Popover de horários */}
            {showPopover && hasHoursText && (
                <div className="absolute left-0 top-full mt-2 z-50 bg-white border border-slate-200 rounded-xl shadow-lg p-4 min-w-[220px] max-w-[320px]">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Horários de Atendimento</p>
                    <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                        {hoursText}
                    </pre>
                </div>
            )}
        </div>
    );
}
