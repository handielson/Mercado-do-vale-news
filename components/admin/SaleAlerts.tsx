import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, X } from 'lucide-react';
import { vpsClient } from '../../services/vpsClient';
import { classifySaleAlerts } from '../../services/saleAlertFeed';

type SaleAlert = {
  id: string;
  channel: 'online' | 'pdv' | 'shopee' | 'tiktok';
  external_id: string;
  display_id?: string;
  created_at: string;
};

const STORAGE_KEY = 'mdv-admin-sale-alerts-v1';
const CHANNELS: Record<SaleAlert['channel'], { label: string; path: string }> = {
  online: { label: 'Loja online', path: '/admin/pedidos-online' },
  pdv: { label: 'PDV', path: '/admin/sales' },
  shopee: { label: 'Shopee', path: '/admin/settings/shopee' },
  tiktok: { label: 'TikTok Shop', path: '/admin/settings/tiktok-shop' },
};

function readSeenIds(): string[] | null {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved === null) return null;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : null;
  } catch {
    return null;
  }
}

export const SaleAlerts: React.FC = () => {
  const [alerts, setAlerts] = useState<SaleAlert[]>([]);
  const seenRef = useRef<string[] | null>(readSeenIds());

  useEffect(() => {
    let active = true;
    let inFlight = false;
    const check = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await vpsClient.get<{ sales: SaleAlert[] }>('/admin/sale-alerts?limit=50');
        if (!active || !Array.isArray(response.sales)) return;
        const seenIds = seenRef.current;
        const result = classifySaleAlerts(response.sales, seenIds || [], seenIds !== null);
        seenRef.current = result.seenIds;
        try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result.seenIds)); } catch { /* In-memory dedup still works. */ }
        if (result.alerts.length) {
          setAlerts((current) => [...current, ...result.alerts].slice(-10));
        }
      } catch {
        // Keep the previous cursor: a failed poll must not discard a new sale.
      } finally {
        inFlight = false;
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 20_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  if (!alerts.length) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[180] max-h-[80vh] w-[min(24rem,calc(100vw-2rem))] space-y-2 overflow-y-auto" role="status" aria-live="polite">
      {alerts.map((alert) => {
        const channel = CHANNELS[alert.channel];
        if (!channel) return null;
        return (
          <div key={alert.id} className="rounded-xl border border-blue-200 bg-white p-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <BellRing className="mt-0.5 h-5 w-5 flex-none text-blue-600" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">Nova venda · {channel.label}</p>
                <p className="mt-1 break-all text-sm text-slate-600">
                  {alert.channel === 'pdv'
                    ? `Pedido #${alert.display_id || alert.external_id.split('-')[0].toUpperCase()}`
                    : `Pedido ${alert.external_id}`}
                </p>
                <Link to={channel.path} onClick={() => setAlerts((current) => current.filter((item) => item.id !== alert.id))} className="mt-2 inline-block text-sm font-semibold text-blue-700 hover:underline">Ver no sistema</Link>
              </div>
              <button type="button" aria-label="Fechar aviso de venda" onClick={() => setAlerts((current) => current.filter((item) => item.id !== alert.id))} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X size={16} /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
