import React, { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Loader2,
  MessageCircle,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Workflow,
} from 'lucide-react';
import { n8nBotControlService, type N8nBotClientControl } from '../../../services/n8nBotControlService';

function formatDate(value?: string | null) {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function normalizeStatus(control?: N8nBotClientControl | null) {
  if (!control?.remote_jid) return 'Sem registro';
  if (Boolean(Number(control.blocked))) return 'Bloqueado';
  return 'Ativo';
}

export default function NovoBotPage() {
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [control, setControl] = useState<N8nBotClientControl | null>(null);
  const [recent, setRecent] = useState<N8nBotClientControl[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const status = useMemo(() => normalizeStatus(control), [control]);

  async function refreshRecent() {
    const data = await n8nBotControlService.recent();
    setRecent(data.rows || []);
  }

  async function runAction(action: () => Promise<{ control: N8nBotClientControl }>, success: string) {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const data = await action();
      setControl(data.control);
      setMessage(success);
      await refreshRecent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao executar acao');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshRecent().catch(() => undefined);
  }, []);

  const canSubmit = phone.trim().length >= 8 && !loading;

  return (
    <div className="mx-auto max-w-7xl animate-in fade-in duration-500 pb-20">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900">
            <Workflow className="text-blue-600" size={28} />
            Novo Bot n8n
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Controle administrativo separado para o novo fluxo de vendas no WhatsApp. Use esta tela para resetar contexto e pausar o bot por cliente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refreshRecent()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          <RefreshCcw size={16} />
          Atualizar
        </button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-emerald-600" size={22} />
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Reset</p>
              <p className="text-sm font-semibold text-slate-900">Somente administrativo</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Ban className="text-rose-600" size={22} />
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Bloqueio</p>
              <p className="text-sm font-semibold text-slate-900">Por telefone/cliente</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <MessageCircle className="text-blue-600" size={22} />
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Memoria</p>
              <p className="text-sm font-semibold text-slate-900">Sessao versionada apos reset</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Smartphone size={20} className="text-blue-600" />
            Cliente
          </h3>

          <label className="mt-4 block text-xs font-bold uppercase text-slate-500" htmlFor="novo-bot-phone">
            Telefone ou JID
          </label>
          <input
            id="novo-bot-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Ex: 5587999999999"
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />

          <label className="mt-4 block text-xs font-bold uppercase text-slate-500" htmlFor="novo-bot-reason">
            Motivo do bloqueio
          </label>
          <textarea
            id="novo-bot-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="Ex: atendimento assumido pelo vendedor"
            className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => runAction(
                () => n8nBotControlService.lookup({ phone }),
                'Status carregado.',
              )}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Ver status
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => runAction(
                () => n8nBotControlService.reset({ phone, blockedBy: 'admin' }),
                'Conversa marcada para reset. Na proxima mensagem o bot usara uma memoria nova.',
              )}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw size={16} />
              Limpar conversa
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => runAction(
                () => n8nBotControlService.setBlocked({ phone, blocked: true, reason, blockedBy: 'admin' }),
                'Fluxo bloqueado para este cliente.',
              )}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Ban size={16} />
              Bloquear fluxo
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => runAction(
                () => n8nBotControlService.setBlocked({ phone, blocked: false, reason: '', blockedBy: 'admin' }),
                'Fluxo liberado para este cliente.',
              )}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 size={16} />
              Desbloquear
            </button>
          </div>

          {message && <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{message}</p>}
          {error && <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{error}</p>}

          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase text-slate-500">Status atual</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{status}</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="font-bold text-slate-500">Sessao</dt>
                <dd className="mt-1 text-slate-900">Reset #{control?.reset_count ?? 0}</dd>
              </div>
              <div>
                <dt className="font-bold text-slate-500">Atualizado</dt>
                <dd className="mt-1 text-slate-900">{formatDate(control?.updated_at)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="font-bold text-slate-500">JID</dt>
                <dd className="mt-1 break-all font-mono text-slate-900">{control?.remote_jid || '-'}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900">Controles recentes</h3>
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Cliente</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Reset</th>
                  <th className="px-4 py-3 font-bold">Atualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-slate-500" colSpan={4}>Nenhum controle registrado.</td>
                  </tr>
                ) : recent.map((item) => (
                  <tr key={item.remote_jid}>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setPhone(item.phone || item.remote_jid);
                          setControl(item);
                        }}
                        className="text-left font-mono text-xs font-semibold text-blue-700 hover:underline"
                      >
                        {item.phone || item.remote_jid}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${Boolean(Number(item.blocked)) ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {Boolean(Number(item.blocked)) ? 'Bloqueado' : 'Ativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.reset_count || 0}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(item.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
