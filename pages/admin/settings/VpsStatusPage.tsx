import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Server, Database, HardDrive, Package, Image, Clock, Wifi, WifiOff, AlertCircle, CheckCircle } from 'lucide-react';

const VPS_BASE = import.meta.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const AUTO_REFRESH_MS = 30_000;

interface VpsStatus {
    ok: boolean;
    uptime_seconds: number;
    response_ms: number;
    memory: { rss_mb: number; heap_used_mb: number; heap_total_mb: number };
    mysql: { ok: boolean; ping_ms: number };
    disk: { total_gb: number | null; free_gb: number | null };
    products: { total: number; active: number };
    images: { total: number; size_mb: number };
}

function formatUptime(secs: number): string {
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${ok
            ? 'bg-green-100 text-green-700 border border-green-200'
            : 'bg-red-100 text-red-700 border border-red-200'}`}>
            {ok ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
            {label}
        </span>
    );
}

function UsageBar({ used, total, label, unit = '' }: { used: number; total: number; label: string; unit?: string }) {
    const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
    const color = pct > 85 ? 'bg-red-500' : pct > 65 ? 'bg-yellow-500' : 'bg-green-500';
    return (
        <div>
            <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>{label}</span>
                <span className="font-mono font-semibold">{used.toFixed(1)}{unit} / {total.toFixed(1)}{unit} ({pct.toFixed(0)}%)</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 flex-shrink-0">
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5 leading-none">{value}</p>
                {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
            </div>
        </div>
    );
}

export const VpsStatusPage: React.FC = () => {
    const [status, setStatus] = useState<VpsStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]    = useState<string | null>(null);
    const [lastCheck, setLastCheck] = useState<Date | null>(null);
    const [countdown, setCountdown] = useState(AUTO_REFRESH_MS / 1000);

    const fetch_status = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const res = await fetch(`${VPS_BASE}/status`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: VpsStatus = await res.json();
            setStatus(data);
            setLastCheck(new Date());
            setCountdown(AUTO_REFRESH_MS / 1000);
        } catch (e: any) {
            setError(e.message || 'Erro ao conectar à VPS');
            setStatus(null);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetch_status(); }, [fetch_status]);

    // Auto-refresh countdown
    useEffect(() => {
        const interval = setInterval(() => {
            setCountdown(c => {
                if (c <= 1) { fetch_status(); return AUTO_REFRESH_MS / 1000; }
                return c - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [fetch_status]);

    const diskUsed = status?.disk.total_gb != null && status?.disk.free_gb != null
        ? status.disk.total_gb - status.disk.free_gb : null;

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                        <Server className="w-8 h-8 text-blue-600" /> Status da VPS
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {VPS_BASE} &mdash; atualização automática a cada 30s
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">Próxima em {countdown}s</span>
                    <button
                        onClick={fetch_status}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        {loading ? 'Verificando...' : 'Atualizar'}
                    </button>
                </div>
            </div>

            {/* Last check */}
            {lastCheck && (
                <p className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock size={11} /> Última verificação: {lastCheck.toLocaleTimeString('pt-BR')}
                </p>
            )}

            {/* Error State */}
            {error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                    <WifiOff size={20} className="flex-shrink-0" />
                    <div>
                        <p className="font-semibold text-sm">VPS inacessível</p>
                        <p className="text-xs mt-0.5">{error}</p>
                    </div>
                </div>
            )}

            {/* Status Banner */}
            {status && (
                <div className={`flex items-center gap-3 p-4 rounded-xl border ${status.ok
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-red-50 border-red-200 text-red-800'}`}>
                    {status.ok ? <Wifi size={20} /> : <WifiOff size={20} />}
                    <div className="flex-1">
                        <p className="font-semibold text-sm">
                            {status.ok ? '✅ API Online' : '❌ API com problema'}
                        </p>
                        <p className="text-xs mt-0.5">
                            Resposta em {status.response_ms}ms &bull; Uptime: {formatUptime(status.uptime_seconds)}
                        </p>
                    </div>
                    <StatusBadge ok={status.mysql.ok} label={status.mysql.ok ? `MySQL OK (${status.mysql.ping_ms}ms)` : 'MySQL ERRO'} />
                </div>
            )}

            {/* Stats Grid */}
            {status && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard icon={<Package size={20} />} label="Produtos" value={status.products.total}
                        sub={`${status.products.active} ativos`} />
                    <StatCard icon={<Image size={20} />} label="Imagens" value={status.images.total}
                        sub={`${status.images.size_mb} MB`} />
                    <StatCard icon={<Server size={20} />} label="Memória RSS" value={`${status.memory.rss_mb} MB`}
                        sub={`heap: ${status.memory.heap_used_mb}/${status.memory.heap_total_mb} MB`} />
                    <StatCard icon={<Clock size={20} />} label="Uptime" value={formatUptime(status.uptime_seconds)}
                        sub={`API em ${status.response_ms}ms`} />
                </div>
            )}

            {/* Usage Bars */}
            {status && (
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                        <HardDrive size={16} /> Uso de Recursos
                    </h2>

                    {/* Memory */}
                    <UsageBar
                        used={status.memory.heap_used_mb}
                        total={status.memory.heap_total_mb}
                        label="Heap do Node.js"
                        unit=" MB"
                    />

                    {/* Disk */}
                    {diskUsed !== null && status.disk.total_gb !== null && (
                        <UsageBar
                            used={diskUsed}
                            total={status.disk.total_gb}
                            label="Disco da VPS"
                            unit=" GB"
                        />
                    )}

                    {/* Image space */}
                    {diskUsed !== null && status.disk.total_gb !== null && (
                        <UsageBar
                            used={status.images.size_mb / 1024}
                            total={status.disk.total_gb}
                            label="Banco de Imagens"
                            unit=" GB"
                        />
                    )}

                    {/* MySQL badge */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                            <Database size={16} className="text-slate-500" />
                            <span className="text-sm text-slate-600 font-medium">MySQL</span>
                        </div>
                        <StatusBadge ok={status.mysql.ok}
                            label={status.mysql.ok ? `Online · ${status.mysql.ping_ms}ms` : 'Offline'} />
                    </div>
                </div>
            )}

            {/* Loading skeleton */}
            {loading && !status && (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
                    ))}
                </div>
            )}
        </div>
    );
};
