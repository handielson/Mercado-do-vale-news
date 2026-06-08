import React from 'react';
import { Bot, CheckCircle2, Power, QrCode, RefreshCw, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { autoResponderService } from '../../services/autoResponderService';

type WhatsAppState = 'loading' | 'open' | 'connecting' | 'close' | 'error';

function formatDebugValue(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(formatDebugValue).filter(Boolean).join('; ');
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalizeConnectionState(value: unknown): WhatsAppState {
  const state = String(value || '').toLowerCase();
  if (state === 'open') return 'open';
  if (state === 'connecting') return 'connecting';
  if (state === 'close' || state === 'closed') return 'close';
  return 'close';
}

function summarizeDebug(debug: any) {
  const instance = Array.isArray(debug?.fetchInstances?.body)
    ? debug.fetchInstances.body.find((item: any) => item?.name === debug?.instanceName) || debug.fetchInstances.body[0]
    : null;
  const rawLastError = instance?.disconnectionObject || debug?.connectionState?.body?.response?.message || '';

  return {
    version: debug?.evolutionStatus?.body?.version || '-',
    instanceName: debug?.instanceName || '-',
    number: instance?.number || '-',
    state: debug?.connectionState?.body?.instance?.state || instance?.connectionStatus || '-',
    lastError: formatDebugValue(rawLastError),
  };
}

export function WhatsAppConnectionPanel() {
  const [state, setState] = React.useState<WhatsAppState>('loading');
  const [qrCode, setQrCode] = React.useState<string | null>(null);
  const [pairingCode, setPairingCode] = React.useState<string | null>(null);
  const [debug, setDebug] = React.useState<any | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const loadState = React.useCallback(async () => {
    try {
      setError(null);
      const result = await autoResponderService.getWhatsAppConnectionState();
      setState(normalizeConnectionState(result?.instance?.state));
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Falha ao verificar conexao do WhatsApp.');
    }
  }, []);

  const loadDebug = React.useCallback(async () => {
    try {
      const result = await autoResponderService.getWhatsAppDebug();
      setDebug(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar debug da Evolution.');
    }
  }, []);

  React.useEffect(() => {
    void loadState();
    void loadDebug();
  }, [loadDebug, loadState]);

  React.useEffect(() => {
    if (state !== 'connecting') return;
    const interval = window.setInterval(() => {
      void loadState();
      void loadDebug();
    }, 4000);
    return () => window.clearInterval(interval);
  }, [loadDebug, loadState, state]);

  async function handleConnect() {
    setBusy(true);
    setError(null);
    try {
      const result = await autoResponderService.connectWhatsApp();
      setQrCode(result?.base64 || null);
      setPairingCode(result?.pairingCode || null);
      setState(result?.instance?.state === 'open' ? 'open' : 'connecting');
      await loadDebug();
      toast.success('QR Code gerado para conexao do WhatsApp');
    } catch (err) {
      setState('close');
      setError(err instanceof Error ? err.message : 'Nao foi possivel gerar o QR Code.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm('Tem certeza de que deseja desconectar o WhatsApp?')) return;
    setBusy(true);
    setError(null);
    try {
      await autoResponderService.disconnectWhatsApp();
      setQrCode(null);
      setPairingCode(null);
      await loadState();
      await loadDebug();
      toast.success('WhatsApp desconectado');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao desconectar WhatsApp.');
    } finally {
      setBusy(false);
    }
  }

  const debugSummary = summarizeDebug(debug);
  const isConnected = state === 'open';

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-blue-600">Conexao WhatsApp</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">Evolution API</h3>
          <p className="mt-1 text-sm text-slate-500">
            Conecte o numero da loja para receber mensagens e responder pela nossa ferramenta.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void loadState();
              void loadDebug();
            }}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={16} />
            Atualizar
          </button>
          {isConnected ? (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              <Power size={16} />
              Desconectar WhatsApp
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <QrCode size={16} />
              {busy ? 'Gerando...' : 'Gerar QR Code / Conectar'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
          {state === 'loading' && (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-slate-500">
              <RefreshCw className="animate-spin" size={28} />
              <span className="text-sm font-semibold">Verificando conexao...</span>
            </div>
          )}

          {isConnected && (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 size={30} />
              </div>
              <h4 className="text-base font-semibold text-slate-900">WhatsApp conectado</h4>
              <p className="max-w-md text-sm text-slate-500">
                A loja ja pode receber mensagens pela Evolution e responder usando a nossa ferramenta.
              </p>
            </div>
          )}

          {state !== 'loading' && !isConnected && qrCode && (
            <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
              <h4 className="text-base font-semibold text-slate-900">Leia o QR Code abaixo</h4>
              <img src={qrCode} alt="QR Code do WhatsApp" className="h-64 w-64 rounded-lg border border-slate-200 bg-white p-2" />
              {pairingCode && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">
                  Codigo: {pairingCode}
                </div>
              )}
            </div>
          )}

          {state !== 'loading' && !isConnected && !qrCode && (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <WifiOff size={30} />
              </div>
              <h4 className="text-base font-semibold text-slate-900">WhatsApp desconectado</h4>
              <p className="max-w-md text-sm text-slate-500">
                Gere um QR Code para conectar o numero da loja na Evolution API.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}
        </div>

        <aside className="rounded-lg border border-slate-100 bg-slate-50 p-4">
          <div className="mb-3 flex items-center gap-2 text-slate-900">
            <Bot size={18} />
            <h4 className="text-sm font-semibold">Debug Evolution</h4>
          </div>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase text-slate-400">Versao</dt>
              <dd className="font-medium text-slate-700">{debugSummary.version}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-400">Instancia</dt>
              <dd className="font-medium text-slate-700">{debugSummary.instanceName}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-400">Numero</dt>
              <dd className="font-medium text-slate-700">{debugSummary.number}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-400">Estado</dt>
              <dd className="font-medium text-slate-700">{debugSummary.state}</dd>
            </div>
          </dl>
          {debugSummary.lastError && (
            <details className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
              <summary className="cursor-pointer font-semibold text-slate-700">Ultimo erro</summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words">{debugSummary.lastError}</pre>
            </details>
          )}
        </aside>
      </div>
    </section>
  );
}
