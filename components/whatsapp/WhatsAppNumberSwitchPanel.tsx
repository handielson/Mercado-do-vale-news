import React from 'react';
import { AlertTriangle, CheckCircle2, PauseCircle, Power, QrCode, RefreshCw, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { autoResponderService, type WhatsAppSwitchStatus } from '../../services/autoResponderService';

function formatValue(value: unknown, fallback = '-'): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function isSwitchReadyToConfirm(status: WhatsAppSwitchStatus | null): boolean {
  return Boolean(
    status?.evolution?.state === 'open'
    && status?.evolution?.instance?.phone
    && status?.webhook?.valid
  );
}

function getQrCode(status: WhatsAppSwitchStatus | null): string | null {
  const base64 = status?.connect?.base64?.trim();
  if (!base64) return null;
  return base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
}

function StatusPill({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
      {children}
    </span>
  );
}

export function WhatsAppNumberSwitchPanel() {
  const [status, setStatus] = React.useState<WhatsAppSwitchStatus | null>(null);
  const [busyAction, setBusyAction] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadStatus = React.useCallback(async () => {
    const next = await autoResponderService.getWhatsAppSwitchStatus();
    setStatus(next);
    return next;
  }, []);

  React.useEffect(() => {
    loadStatus().catch((err) => {
      setError(err instanceof Error ? err.message : 'Falha ao carregar status da troca.');
    });
  }, [loadStatus]);

  React.useEffect(() => {
    if (!status) return;
    const shouldPoll = status.step === 'awaiting_qr_scan' || (status.control?.paused === true && status.evolution?.state !== 'open');
    if (!shouldPoll) return;
    const interval = window.setInterval(() => {
      loadStatus().catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(interval);
  }, [loadStatus, status]);

  async function runAction(label: string, action: () => Promise<WhatsAppSwitchStatus>, successMessage: string) {
    setBusyAction(label);
    setError(null);
    try {
      const next = await action();
      setStatus(next);
      toast.success(successMessage);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao foi possivel concluir a acao.';
      setError(message);
      toast.error(message);
    } finally {
      setBusyAction(null);
    }
  }

  function handleStart() {
    void runAction(
      'start',
      () => autoResponderService.startWhatsAppNumberSwitch(),
      'Bot pausado para troca de numero'
    );
  }

  function handleDisconnect() {
    if (status?.control?.paused !== true) {
      toast.error('Pause o bot antes de desconectar o WhatsApp.');
      return;
    }
    if (!window.confirm('Desconectar o WhatsApp atual? O bot continuara pausado ate voce confirmar o novo numero.')) return;
    void runAction(
      'disconnect',
      () => autoResponderService.disconnectWhatsAppForSwitch(),
      'Desconexao solicitada'
    );
  }

  function handleConnect() {
    if (status?.control?.paused !== true) {
      toast.error('Pause o bot antes de gerar QR Code.');
      return;
    }
    void runAction(
      'connect',
      () => autoResponderService.connectWhatsAppForSwitch(),
      'QR Code solicitado'
    );
  }

  function handleConfirm() {
    if (!isSwitchReadyToConfirm(status)) {
      toast.error('Aguarde a Evolution ficar aberta com webhook valido antes de confirmar.');
      return;
    }
    void runAction(
      'confirm',
      () => autoResponderService.confirmWhatsAppNumberSwitch(true),
      'Numero confirmado e bot reativado'
    );
  }

  function handleKeepPaused() {
    void runAction(
      'keep-paused',
      () => autoResponderService.keepWhatsAppSwitchPaused(),
      'Bot mantido pausado para teste manual'
    );
  }

  const qrCode = getQrCode(status);
  const isBusy = Boolean(busyAction);
  const botPaused = status?.control?.paused === true;
  const evolutionOpen = status?.evolution?.state === 'open';
  const connectedPhone = status?.evolution?.instance?.phone;
  const canConfirm = isSwitchReadyToConfirm(status);
  const connectMessage = status?.connect?.message || status?.message || '';

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-amber-600">Troca segura de numero</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">Fluxo guiado para trocar WhatsApp do bot</h3>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Pause o bot, conecte o novo numero por QR Code e reative somente depois da validacao.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void runAction('refresh', loadStatus, 'Status atualizado');
          }}
          disabled={isBusy}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={busyAction === 'refresh' ? 'animate-spin' : undefined} size={16} />
          Atualizar
        </button>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs uppercase text-slate-400">Instancia</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{formatValue(status?.instanceName)}</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs uppercase text-slate-400">Numero conectado</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{formatValue(connectedPhone)}</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs uppercase text-slate-400">Evolution</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{formatValue(status?.evolution?.state)}</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs uppercase text-slate-400">Bot</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{botPaused ? 'Pausado' : 'Ativo'}</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={handleStart}
              disabled={isBusy}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
            >
              <PauseCircle size={18} />
              {busyAction === 'start' ? 'Pausando...' : 'Iniciar troca de numero'}
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={isBusy || status?.control?.paused !== true}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              <Power size={18} />
              {busyAction === 'disconnect' ? 'Desconectando...' : 'Desconectar WhatsApp atual'}
            </button>
            <button
              type="button"
              onClick={handleConnect}
              disabled={isBusy || status?.control?.paused !== true}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <QrCode size={18} />
              {busyAction === 'connect' ? 'Gerando...' : 'Gerar QR Code do novo numero'}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isBusy || !canConfirm}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <ShieldCheck size={18} />
              {busyAction === 'confirm' ? 'Confirmando...' : 'Confirmar este numero como oficial'}
            </button>
          </div>

          <button
            type="button"
            onClick={handleKeepPaused}
            disabled={isBusy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
          >
            <PauseCircle size={18} />
            Manter bot pausado e sair
          </button>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-700">
              <AlertTriangle className="mt-0.5 shrink-0" size={16} />
              <span>{error}</span>
            </div>
          )}

          {connectMessage && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm font-medium text-amber-800">
              <AlertTriangle className="mt-0.5 shrink-0" size={16} />
              <span>{connectMessage}</span>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <h4 className="text-sm font-semibold text-slate-900">QR Code</h4>
            {qrCode ? (
              <div className="mt-3 flex flex-col items-center gap-3 text-center">
                <img src={qrCode} alt="QR Code do novo WhatsApp" className="h-56 w-56 rounded-lg border border-slate-200 bg-white p-2" />
                {(status?.connect?.pairingCode || status?.connect?.code) && (
                  <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">
                    Codigo: {status.connect.pairingCode || status.connect.code}
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                O QR Code aparece depois que o bot estiver pausado e voce clicar em gerar conexao.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <h4 className="mb-3 text-sm font-semibold text-slate-900">Checklist final</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span>Evolution aberta</span>
                <StatusPill ok={evolutionOpen}>{evolutionOpen ? 'OK' : 'Pendente'}</StatusPill>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Webhook esperado</span>
                <StatusPill ok={status?.webhook?.valid === true}>{status?.webhook?.valid ? 'OK' : 'Pendente'}</StatusPill>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Numero detectado</span>
                <StatusPill ok={Boolean(connectedPhone)}>{connectedPhone ? 'OK' : 'Pendente'}</StatusPill>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Bot ativo</span>
                <StatusPill ok={!botPaused}>{botPaused ? 'Pausado' : 'OK'}</StatusPill>
              </div>
            </div>
            {canConfirm && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="mt-0.5 shrink-0" size={16} />
                <span>Numero pronto para confirmacao.</span>
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
