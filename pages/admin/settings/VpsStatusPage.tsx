import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    RefreshCw,
    Server,
    Database,
    HardDrive,
    Package,
    Image,
    Clock,
    Wifi,
    WifiOff,
    AlertCircle,
    CheckCircle,
    RotateCcw,
    Power,
    AlertTriangle,
    Copy,
} from 'lucide-react';
import { vpsClient } from '../../../services/vpsClient';
import { buildSynologyStatusViewModel } from '../../../services/synologyStatusViewModel';

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

interface SynologyCommandStatus {
    id: string;
    command: string;
    status: 'pending' | 'success' | 'failed' | 'expired' | string;
    enqueuedAt: string | null;
    completedAt: string | null;
    result: string | null;
}

interface SynologyStatusResponse {
    ok: boolean;
    state: 'online' | 'stale' | 'offline' | 'missing';
    snapshot: null | {
        hostname: string;
        model: string;
        timestamp: string | null;
        uptime_seconds: number;
        memory: {
            total_mb: number;
            used_mb: number;
            available_mb: number;
            used_percent: number;
            available_percent: number;
        };
        swap: {
            total_mb: number;
            used_mb: number;
            free_mb: number;
            used_percent: number;
        };
        cache?: {
            cached_mb: number;
            buffers_mb: number;
            slab_mb: number;
        };
        scheduled_reboot: {
            enabled: boolean;
            label: string;
        };
        health: {
            level: 'ok' | 'warning' | 'critical';
            message: string;
        };
        freshness: {
            state: 'online' | 'stale' | 'offline';
            age_ms: number | null;
        };
    };
    command?: SynologyCommandStatus | null;
}

interface NavigationLogItem {
    id: number;
    created_at: string;
    pathname: string;
    search?: string | null;
    hash_fragment?: string | null;
    full_url?: string | null;
    title?: string | null;
    referrer_path?: string | null;
    user_id?: string | null;
    customer_id?: string | null;
    user_agent?: string | null;
    metadata_json?: unknown;
}

interface NavigationLogResponse {
    ok: boolean;
    limit: number;
    items: NavigationLogItem[];
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

type BadgeTone = 'success' | 'warning' | 'danger' | 'muted';

function StatusBadge({ ok, tone, label }: { ok?: boolean; tone?: BadgeTone; label: string }) {
    const resolvedTone: BadgeTone = tone ?? (ok === undefined ? 'muted' : ok ? 'success' : 'danger');
    const classNameByTone: Record<BadgeTone, string> = {
        success: 'bg-green-100 text-green-700 border-green-200',
        warning: 'bg-amber-100 text-amber-800 border-amber-200',
        danger: 'bg-red-100 text-red-700 border-red-200',
        muted: 'bg-slate-100 text-slate-700 border-slate-200',
    };

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${classNameByTone[resolvedTone]}`}>
            {resolvedTone === 'success' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
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
                <span className="font-mono font-semibold">
                    {used.toFixed(1)}{unit} / {total.toFixed(1)}{unit} ({pct.toFixed(0)}%)
                </span>
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

function formatNavigationLogForClipboard(items: NavigationLogItem[]): string {
    if (!items.length) return 'Nenhum log de navegacao admin/PDV encontrado.';

    const lines = [
        `Logs de navegacao admin/PDV - ${new Date().toLocaleString('pt-BR')}`,
        `Total copiado: ${items.length}`,
        '',
    ];

    for (const item of items) {
        const when = item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : 'data indisponivel';
        const path = `${item.pathname || ''}${item.search || ''}${item.hash_fragment || ''}`;
        lines.push(`#${item.id} | ${when}`);
        lines.push(`Tela: ${path || item.full_url || 'N/D'}`);
        if (item.title) lines.push(`Titulo: ${item.title}`);
        if (item.customer_id || item.user_id) {
            lines.push(`Usuario: ${item.customer_id || 'sem customer'} / ${item.user_id || 'sem user'}`);
        }
        if (item.referrer_path) lines.push(`Origem: ${item.referrer_path}`);
        if (item.metadata_json) {
            const metadata = typeof item.metadata_json === 'string'
                ? item.metadata_json
                : JSON.stringify(item.metadata_json);
            lines.push(`Metadata: ${metadata}`);
        }
        lines.push('');
    }

    return lines.join('\n').trim();
}

export const VpsStatusPage: React.FC = () => {
    const [status, setStatus] = useState<VpsStatus | null>(null);
    const [synologyStatus, setSynologyStatus] = useState<SynologyStatusResponse | null>(null);
    const [synologyCommandStatus, setSynologyCommandStatus] = useState<SynologyCommandStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastCheck, setLastCheck] = useState<Date | null>(null);
    const [countdown, setCountdown] = useState(AUTO_REFRESH_MS / 1000);
    const [actionBusy, setActionBusy] = useState<'restart' | 'reboot' | null>(null);
    const [copyingNavigationLog, setCopyingNavigationLog] = useState(false);
    const refreshingRef = useRef(false);

    const fetchStatus = useCallback(async () => {
        if (refreshingRef.current) return;
        refreshingRef.current = true;
        setLoading(true);
        setError(null);

        try {
            const [vpsResult, synologyResult, commandResult] = await Promise.allSettled([
                vpsClient.get<VpsStatus>('/status'),
                vpsClient.get<SynologyStatusResponse>('/synology/status'),
                vpsClient.get<SynologyCommandStatus | null>('/synology/command-status'),
            ]);

            if (vpsResult.status === 'fulfilled') {
                setStatus(vpsResult.value);
            } else {
                setStatus(null);
                setError(vpsResult.reason?.message || 'Erro ao conectar à VPS');
            }

            let nextSynologyStatus: SynologyStatusResponse | null = null;
            let nextCommandStatus: SynologyCommandStatus | null = null;

            if (synologyResult.status === 'fulfilled') {
                nextSynologyStatus = synologyResult.value;
                nextCommandStatus = synologyResult.value.command ?? null;
            }

            if (commandResult.status === 'fulfilled') {
                nextCommandStatus = commandResult.value ?? nextCommandStatus;
            }

            setSynologyStatus(nextSynologyStatus);
            setSynologyCommandStatus(nextCommandStatus);
            setLastCheck(new Date());
            setCountdown(AUTO_REFRESH_MS / 1000);
        } finally {
            setLoading(false);
            refreshingRef.current = false;
        }
    }, []);

    useEffect(() => {
        void fetchStatus();
    }, [fetchStatus]);

    useEffect(() => {
        const interval = setInterval(() => {
            setCountdown((current) => {
                if (current <= 1) {
                    if (!refreshingRef.current) {
                        void fetchStatus();
                    }
                    return AUTO_REFRESH_MS / 1000;
                }
                return current - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [fetchStatus]);

    const synologyModel = buildSynologyStatusViewModel({
        synologyStatus,
        commandStatus: synologyCommandStatus,
        now: new Date(),
    });
    const hasSynologySnapshot = Boolean(synologyStatus?.snapshot);

    const diskUsed = status?.disk.total_gb != null && status?.disk.free_gb != null
        ? status.disk.total_gb - status.disk.free_gb
        : null;

    const showSynologyPanel = !loading || Boolean(status || synologyStatus || synologyCommandStatus || error);

    const handleRefreshNow = useCallback(async () => {
        await fetchStatus();
    }, [fetchStatus]);

    const handleRestartTunnel = useCallback(async () => {
        setActionBusy('restart');
        try {
            const result = await vpsClient.post<{ ok: boolean; command: SynologyCommandStatus }>('/synology/enqueue-restart', {});
            setSynologyCommandStatus(result.command);
            setLastCheck(new Date());
        } catch (err: any) {
            setError(err?.message || 'Falha ao reiniciar o túnel');
        } finally {
            setActionBusy(null);
        }
    }, []);

    const handleRebootNas = useCallback(async () => {
        const confirmed = window.confirm('Reiniciar o NAS agora? Isso interrompe o acesso até o equipamento voltar.');
        if (!confirmed) return;

        setActionBusy('reboot');
        try {
            const result = await vpsClient.post<{ ok: boolean; command: SynologyCommandStatus }>('/synology/enqueue-reboot', {});
            setSynologyCommandStatus(result.command);
            setLastCheck(new Date());
        } catch (err: any) {
            setError(err?.message || 'Falha ao enfileirar o reboot do NAS');
        } finally {
            setActionBusy(null);
        }
    }, []);

    const handleCopyNavigationLogs = useCallback(async () => {
        setCopyingNavigationLog(true);
        try {
            const response = await vpsClient.get<NavigationLogResponse>('/admin/navigation-log?limit=200');
            const text = formatNavigationLogForClipboard(response.items || []);
            try {
                await navigator.clipboard.writeText(text);
                window.alert('Logs de navegacao copiados para a area de transferencia.');
            } catch {
                window.alert(text);
            }
        } catch (err: any) {
            setError(err?.message || 'Falha ao copiar logs de navegacao');
        } finally {
            setCopyingNavigationLog(false);
        }
    }, []);

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-center justify-between gap-4">
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
                        onClick={handleCopyNavigationLogs}
                        disabled={copyingNavigationLog}
                        title="Copiar ultimos logs de navegacao admin/PDV"
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                    >
                        <Copy size={15} />
                        {copyingNavigationLog ? 'Copiando...' : 'Copiar logs'}
                    </button>
                    <button
                        onClick={handleRefreshNow}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        {loading ? 'Verificando...' : 'Atualizar'}
                    </button>
                </div>
            </div>

            {lastCheck && (
                <p className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock size={11} /> Última verificação: {lastCheck.toLocaleTimeString('pt-BR')}
                </p>
            )}

            {error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                    <WifiOff size={20} className="flex-shrink-0" />
                    <div>
                        <p className="font-semibold text-sm">VPS inacessível</p>
                        <p className="text-xs mt-0.5">{error}</p>
                    </div>
                </div>
            )}

            {status && (
                <div className={`flex items-center gap-3 p-4 rounded-xl border ${status.ok
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-red-50 border-red-200 text-red-800'}`}>
                    {status.ok ? <Wifi size={20} /> : <WifiOff size={20} />}
                    <div className="flex-1">
                        <p className="font-semibold text-sm">
                            {status.ok ? 'API online' : 'API com problema'}
                        </p>
                        <p className="text-xs mt-0.5">
                            Resposta em {status.response_ms}ms &bull; Uptime: {formatUptime(status.uptime_seconds)}
                        </p>
                    </div>
                    <StatusBadge
                        ok={status.mysql.ok}
                        label={status.mysql.ok ? `MySQL OK (${status.mysql.ping_ms}ms)` : 'MySQL ERRO'}
                    />
                </div>
            )}

            {showSynologyPanel && (
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">{synologyModel.title}</h2>
                            {synologyModel.subtitle && (
                                <p className="text-sm text-slate-500 mt-1">{synologyModel.subtitle}</p>
                            )}
                        </div>
                        <StatusBadge tone={synologyModel.status.tone} label={synologyModel.status.label} />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard
                            icon={<Server size={20} />}
                            label="RAM usada"
                            value={hasSynologySnapshot ? `${synologyModel.memory.usedMb.toFixed(0)} MB` : 'N/D'}
                            sub={hasSynologySnapshot ? `${synologyModel.memory.availableMb.toFixed(0)} MB livres` : synologyModel.heartbeat.label}
                        />
                        <StatCard
                            icon={<HardDrive size={20} />}
                            label="Swap usado"
                            value={hasSynologySnapshot ? `${synologyModel.swap.usedMb.toFixed(0)} MB` : 'N/D'}
                            sub={hasSynologySnapshot ? `${synologyModel.swap.freeMb.toFixed(0)} MB livres` : synologyModel.status.detail}
                        />
                        <StatCard
                            icon={<Clock size={20} />}
                            label="Uptime NAS"
                            value={hasSynologySnapshot ? formatUptime(synologyStatus?.snapshot?.uptime_seconds || 0) : 'N/D'}
                            sub={synologyModel.heartbeat.label}
                        />
                        <StatCard
                            icon={<AlertTriangle size={20} />}
                            label="Reboot semanal"
                            value={synologyModel.schedule.label}
                            sub={synologyModel.schedule.detail}
                        />
                    </div>

                    {synologyStatus?.snapshot && (
                        <>
                            <UsageBar
                                used={synologyModel.memory.usedMb}
                                total={synologyModel.memory.totalMb}
                                label="Memória RAM do NAS"
                                unit=" MB"
                            />
                            <UsageBar
                                used={synologyModel.swap.usedMb}
                                total={synologyModel.swap.totalMb}
                                label="Swap do NAS"
                                unit=" MB"
                            />
                        </>
                    )}

                    <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
                        <button
                            onClick={handleRefreshNow}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors disabled:opacity-60"
                        >
                            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                            {synologyModel.actions.refresh.label}
                        </button>
                        <button
                            onClick={handleRestartTunnel}
                            disabled={actionBusy !== null || synologyModel.actions.restartTunnel.disabled}
                            title={synologyModel.actions.restartTunnel.reason || undefined}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-sm font-medium transition-colors disabled:opacity-60"
                        >
                            <RotateCcw size={15} />
                            {actionBusy === 'restart' ? 'Enfileirando...' : synologyModel.actions.restartTunnel.label}
                        </button>
                        <button
                            onClick={handleRebootNas}
                            disabled={actionBusy !== null || synologyModel.actions.rebootNas.disabled}
                            title={synologyModel.actions.rebootNas.reason || undefined}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-900 text-sm font-medium transition-colors disabled:opacity-60"
                        >
                            <Power size={15} />
                            {actionBusy === 'reboot' ? 'Enfileirando...' : synologyModel.actions.rebootNas.label}
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <StatusBadge tone={synologyModel.command.tone} label={synologyModel.command.label} />
                        <span>{synologyModel.command.detail}</span>
                    </div>
                </div>
            )}

            {status && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                        icon={<Package size={20} />}
                        label="Produtos"
                        value={status.products.total}
                        sub={`${status.products.active} ativos`}
                    />
                    <StatCard
                        icon={<Image size={20} />}
                        label="Imagens"
                        value={status.images.total}
                        sub={`${status.images.size_mb} MB`}
                    />
                    <StatCard
                        icon={<Server size={20} />}
                        label="Memória RSS"
                        value={`${status.memory.rss_mb} MB`}
                        sub={`heap: ${status.memory.heap_used_mb}/${status.memory.heap_total_mb} MB`}
                    />
                    <StatCard
                        icon={<Clock size={20} />}
                        label="Uptime"
                        value={formatUptime(status.uptime_seconds)}
                        sub={`API em ${status.response_ms}ms`}
                    />
                </div>
            )}

            {status && (
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                        <HardDrive size={16} /> Uso de Recursos
                    </h2>

                    <UsageBar
                        used={status.memory.heap_used_mb}
                        total={status.memory.heap_total_mb}
                        label="Heap do Node.js"
                        unit=" MB"
                    />

                    {diskUsed !== null && status.disk.total_gb !== null && (
                        <UsageBar
                            used={diskUsed}
                            total={status.disk.total_gb}
                            label="Disco da VPS"
                            unit=" GB"
                        />
                    )}

                    {diskUsed !== null && status.disk.total_gb !== null && (
                        <UsageBar
                            used={status.images.size_mb / 1024}
                            total={status.disk.total_gb}
                            label="Banco de Imagens"
                            unit=" GB"
                        />
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                            <Database size={16} className="text-slate-500" />
                            <span className="text-sm text-slate-600 font-medium">MySQL</span>
                        </div>
                        <StatusBadge
                            ok={status.mysql.ok}
                            label={status.mysql.ok ? `Online · ${status.mysql.ping_ms}ms` : 'Offline'}
                        />
                    </div>
                </div>
            )}

            {loading && !status && (
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
                    ))}
                </div>
            )}
        </div>
    );
};
