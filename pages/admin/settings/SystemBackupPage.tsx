import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, DatabaseBackup, HardDrive, Loader2, Play, RefreshCw, Save, Server } from 'lucide-react';
import { toast } from 'sonner';
import {
  getSystemBackupSnapshot,
  retrySystemBackupSynologyMirror,
  runSystemBackupNow,
  saveSystemBackupSchedule,
  type SystemBackupSnapshot,
} from '../../../services/systemBackupService';

function formatDateTime(value?: string | null): string {
  if (!value) return 'Ainda nao registrado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data invalida';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function statusTone(state: string): string {
  if (state === 'success') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (state === 'partial') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (state === 'running') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (state === 'failed') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

function statusLabel(state: string): string {
  switch (state) {
    case 'success': return 'Ultimo backup concluido';
    case 'partial': return 'Backup salvo na VPS; Synology pendente';
    case 'running': return 'Backup em andamento';
    case 'failed': return 'Ultimo backup falhou';
    default: return 'Aguardando primeiro backup';
  }
}

function backupProgress(snapshot: SystemBackupSnapshot | null): number {
  const value = snapshot?.status.progress;
  if (typeof value !== 'number' || Number.isNaN(value)) return snapshot?.status.state === 'running' ? 5 : 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function backupEvents(snapshot: SystemBackupSnapshot | null) {
  const events = snapshot?.status.events || [];
  if (events.length) return events;
  if (!snapshot?.status.startedAt) return [];
  return [{
    at: snapshot.status.startedAt,
    progress: backupProgress(snapshot),
    step: snapshot.status.step || snapshot.status.message || 'Backup registrado',
    state: snapshot.status.state === 'failed' ? 'failed' : snapshot.status.state === 'partial' ? 'warning' : snapshot.status.state === 'success' ? 'success' : 'running',
    detail: snapshot.status.error || snapshot.status.vpsPackage || null,
  }];
}

function eventTone(state: string): string {
  if (state === 'success') return 'bg-emerald-500';
  if (state === 'warning') return 'bg-amber-500';
  if (state === 'failed') return 'bg-red-500';
  return 'bg-blue-500';
}

const fallbackCoverage = [
  'Site publicado e releases',
  'API da VPS',
  'Banco MySQL com vendas, clientes, aparelhos e produtos',
  'Pagamentos, entregas e retiradas',
  'Manifesto e hash SHA256',
];

export const SystemBackupPage: React.FC = () => {
  const [snapshot, setSnapshot] = useState<SystemBackupSnapshot | null>(null);
  const [scheduleTime, setScheduleTime] = useState('00:00');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [mirroring, setMirroring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await getSystemBackupSnapshot();
      setSnapshot(data);
      setScheduleTime(data.config.scheduleTime);
      setEnabled(data.config.enabled);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar backup do sistema');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (snapshot?.status.state !== 'running') return undefined;
    const timer = window.setInterval(() => {
      load();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [load, snapshot?.status.state]);

  const coverage = useMemo(() => snapshot?.coverage?.length ? snapshot.coverage : fallbackCoverage, [snapshot]);
  const progress = backupProgress(snapshot);
  const events = useMemo(() => backupEvents(snapshot), [snapshot]);
  const isBackupRunning = snapshot?.status.state === 'running';
  const isSynologyPending = snapshot?.status.state === 'partial';
  const synologyPendingDetail = snapshot?.status.synologyMirror?.error || snapshot?.status.error || 'O pacote ja esta salvo na VPS. Esse aviso fica ate o envio ao Synology funcionar, voce tentar enviar novamente, ou um proximo backup concluir com espelho OK.';

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const data = await saveSystemBackupSchedule(scheduleTime, enabled);
      setSnapshot(data);
      toast.success('Agendamento do backup salvo');
    } catch (err: any) {
      const message = err?.message || 'Falha ao salvar agendamento';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRunNow() {
    setRunning(true);
    setError(null);
    try {
      const data = await runSystemBackupNow();
      setSnapshot(data);
      toast.success('Backup iniciado na VPS');
    } catch (err: any) {
      const message = err?.message || 'Falha ao iniciar backup';
      setError(message);
      toast.error(message);
    } finally {
      setRunning(false);
    }
  }

  async function handleRetrySynology() {
    setMirroring(true);
    setError(null);
    try {
      const data = await retrySystemBackupSynologyMirror();
      setSnapshot(data);
      toast.success(data.status.state === 'success' ? 'Backup enviado ao Synology' : 'Tentativa registrada');
    } catch (err: any) {
      const message = err?.message || 'Falha ao tentar enviar para Synology';
      setError(message);
      toast.error(message);
    } finally {
      setMirroring(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <DatabaseBackup className="text-blue-600" size={28} />
            Backup do Sistema
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Backup geral da VPS com espelho no canal Synology.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading || refreshing ? 'animate-spin' : ''} />
            {loading || refreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
          <button
            type="button"
            onClick={handleRunNow}
            disabled={running || isBackupRunning}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60"
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            Fazer backup agora
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        <section className="bg-white border border-slate-200 rounded-lg shadow-sm">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Agendamento automatico</h2>
              <p className="text-sm text-slate-500">A VPS executa o backup todos os dias no horario definido.</p>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
              {enabled ? 'Ativo' : 'Pausado'}
            </span>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Clock size={16} />
                Horario diario
              </span>
              <input
                type="time"
                value={scheduleTime}
                onChange={(event) => setScheduleTime(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="block text-xs text-slate-500">Horario de Sao Paulo. Padrao recomendado: 00:00.</span>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4 bg-slate-50">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-800">Executar automaticamente</span>
                <span className="block text-xs text-slate-500 mt-1">Quando ativo, o sistema agenda o proximo backup assim que a API da VPS inicia.</span>
              </span>
            </label>

            <div className="md:col-span-2 flex items-center justify-between gap-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-blue-900">Proxima execucao</p>
                <p className="text-sm text-blue-700">{enabled ? formatDateTime(snapshot?.nextRunAt) : 'Backup automatico pausado'}</p>
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Salvar
              </button>
            </div>
          </div>
        </section>

        <aside className="bg-white border border-slate-200 rounded-lg shadow-sm p-5 space-y-4">
          <div className={`rounded-lg border px-4 py-3 ${statusTone(snapshot?.status.state || 'idle')}`}>
            <p className="text-sm font-bold">{statusLabel(snapshot?.status.state || 'idle')}</p>
            <p className="text-xs mt-1">{snapshot?.status.message || snapshot?.status.error || 'Nenhuma execucao registrada ainda.'}</p>
          </div>

          {isSynologyPending && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-bold text-amber-800">Synology pendente</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-700">{synologyPendingDetail}</p>
              <button
                type="button"
                onClick={handleRetrySynology}
                disabled={mirroring}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {mirroring ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Tentar enviar para Synology
              </button>
            </div>
          )}

          {(isBackupRunning || progress > 0) && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-800">{snapshot?.status.step || 'Preparando backup'}</p>
                <p className="text-sm font-bold text-blue-700">{progress}%</p>
              </div>
              <div
                className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs font-bold uppercase text-slate-400">Inicio</p>
              <p className="text-slate-700">{formatDateTime(snapshot?.status.startedAt)}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-slate-400">Fim</p>
              <p className="text-slate-700">{formatDateTime(snapshot?.status.finishedAt)}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-slate-400">Pacote VPS</p>
              <p className="text-slate-700 break-all">{snapshot?.status.vpsPackage || 'Ainda nao criado'}</p>
            </div>
          </div>
        </aside>
      </div>

      {events.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Lista de detalhes do backup</h2>
              <p className="text-sm text-slate-500">Etapas registradas pela VPS durante a execucao e o espelhamento.</p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-500">
              {events.length} etapa{events.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {events.map((event, index) => (
              <div key={`${event.at}-${event.step}-${index}`} className="flex items-start gap-3 py-3">
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${eventTone(event.state)}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-slate-800">{event.step}</p>
                    <p className="text-xs font-semibold text-slate-400">{formatDateTime(event.at)} - {Math.round(event.progress)}%</p>
                  </div>
                  {event.detail && <p className="mt-1 break-all text-xs text-slate-500">{event.detail}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <Server className="text-slate-500 mb-3" size={22} />
          <h3 className="font-bold text-slate-900">VPS</h3>
          <p className="text-sm text-slate-500 mt-1 break-all">{snapshot?.locations.vps || '/var/backups/mdv-system'}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <HardDrive className="text-slate-500 mb-3" size={22} />
          <h3 className="font-bold text-slate-900">Synology</h3>
          <p className="text-sm text-slate-500 mt-1 break-all">{snapshot?.locations.synology || 'backup-mercadodovale/db'}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <CheckCircle2 className="text-slate-500 mb-3" size={22} />
          <h3 className="font-bold text-slate-900">Cobertura</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {coverage.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </section>
    </div>
  );
};

export default SystemBackupPage;
