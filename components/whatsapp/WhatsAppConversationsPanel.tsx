import React from 'react';
import { AlertCircle, Ban, Bot, CheckCircle2, ChevronDown, ChevronUp, Clock, MessageCircle, Pause, Play, RefreshCw, RotateCcw, Save, Search, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { autoResponderService } from '../../services/autoResponderService';
import type { AutoResponderAttendant, AutoResponderConversation, AutoResponderConversationLog, AutoResponderTag } from '../../types/autoResponder';

type ConversationStatusFilter = 'all' | 'active' | 'paused' | 'finished';

const DEFAULT_FINISH_MESSAGE = 'Atendimento finalizado, mas qualquer duvida estamos por aqui.';
const HUMAN_HANDOFF_REASON = 'human_handoff';
const MANUAL_FINISHED_REASON = 'manual_finished';
const UNASSIGNED_ATTENDANT_FILTER = '__none__';

function isConversationPaused(conversation: AutoResponderConversation): boolean {
  if (!conversation.paused_until) return false;
  return new Date(conversation.paused_until).getTime() > Date.now();
}

function isConversationFinished(conversation: AutoResponderConversation): boolean {
  return conversation.pause_reason === MANUAL_FINISHED_REASON;
}

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatNumber(value?: number): string {
  return new Intl.NumberFormat('pt-BR').format(Number(value || 0));
}

function formatResponseTime(value?: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return '-';
  return `${formatNumber(Number(value))} ms`;
}

function formatPauseReason(value?: string | null): string {
  if (value === HUMAN_HANDOFF_REASON) return 'Atendimento humano';
  if (value === MANUAL_FINISHED_REASON) return 'Atendimento finalizado';
  return value || '-';
}

export function WhatsAppConversationsPanel() {
  const [conversations, setConversations] = React.useState<AutoResponderConversation[]>([]);
  const [conversationLogsBySender, setConversationLogsBySender] = React.useState<Record<string, AutoResponderConversationLog[]>>({});
  const [conversationStatusFilter, setConversationStatusFilter] = React.useState<ConversationStatusFilter>('all');
  const [attendantFilter, setAttendantFilter] = React.useState('all');
  const [selectedConversationSender, setSelectedConversationSender] = React.useState<string | null>(null);
  const [manualMessageDrafts, setManualMessageDrafts] = React.useState<Record<string, string>>({});
  const [selectedSendTagBySender, setSelectedSendTagBySender] = React.useState<Record<string, string>>({});
  const [selectedAttendantBySender, setSelectedAttendantBySender] = React.useState<Record<string, string>>({});
  const [sendTags, setSendTags] = React.useState<AutoResponderTag[]>([]);
  const [attendants, setAttendants] = React.useState<AutoResponderAttendant[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [logsLoadingSender, setLogsLoadingSender] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [actionSender, setActionSender] = React.useState<string | null>(null);

  const loadConversations = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = conversationStatusFilter === 'all' ? undefined : conversationStatusFilter;
      const attendant_name = attendantFilter === 'all' ? undefined : attendantFilter;
      const data = await autoResponderService.listConversations({ limit: 25, status, attendant_name });
      setConversations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar atendimentos.');
    } finally {
      setLoading(false);
    }
  }, [attendantFilter, conversationStatusFilter]);

  const loadAttendants = React.useCallback(async () => {
    try {
      const data = await autoResponderService.listAttendants({ active: 1 });
      setAttendants(data.filter((attendant) => attendant.active === true || String(attendant.active) === '1'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar atendentes.');
    }
  }, []);

  React.useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  React.useEffect(() => {
    void loadAttendants();
  }, [loadAttendants]);

  React.useEffect(() => {
    setSelectedAttendantBySender((current) => {
      const next = { ...current };
      conversations.forEach((conversation) => {
        next[conversation.sender] = conversation.attendant_name || '';
      });
      return next;
    });
  }, [conversations]);

  React.useEffect(() => {
    let mounted = true;
    autoResponderService.listTags({ scope: 'conversation' })
      .then((tags) => {
        if (mounted) setSendTags(tags);
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : 'Falha ao carregar tags de envio.');
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function runConversationAction(sender: string, action: () => Promise<unknown>, successMessage: string) {
    setActionSender(sender);
    setError(null);
    try {
      await action();
      await loadConversations();
      toast.success(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar atendimento.');
    } finally {
      setActionSender(null);
    }
  }

  async function loadConversationLogs(sender: string) {
    setLogsLoadingSender(sender);
    setError(null);
    try {
      const logs = await autoResponderService.listConversationLogs(sender, { limit: 20 });
      setConversationLogsBySender((current) => ({ ...current, [sender]: logs }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar historico da conversa.');
    } finally {
      setLogsLoadingSender(null);
    }
  }

  async function saveConversationAttendant(conversation: AutoResponderConversation) {
    const sender = conversation.sender;
    const attendantName = selectedAttendantBySender[sender] || '';
    await runConversationAction(
      sender,
      () => autoResponderService.updateConversationAttendant(sender, attendantName || null),
      attendantName ? 'Atendente da conversa atualizado' : 'Conversa sem atendente definido'
    );
    if (selectedConversationSender === sender) {
      await loadConversationLogs(sender);
    }
  }

  async function blockConversation(conversation: AutoResponderConversation) {
    if (!window.confirm(`Bloquear o numero ${conversation.sender} para o bot?`)) return;
    await runConversationAction(
      conversation.sender,
      async () => {
        await autoResponderService.createBlocklistEntry({
          pattern: conversation.sender,
          pattern_type: 'exact',
          contact_name: conversation.contact_name || null,
          reason: 'Bloqueado pelo Centro WhatsApp',
          active: true,
        });
        await autoResponderService.pauseConversation(conversation.sender, 60 * 24 * 3650, 'blocklist_whatsapp_center');
      },
      'Numero bloqueado para o bot'
    );
  }

  async function sendManualMessage(conversation: AutoResponderConversation, finishAttendance = false) {
    const sender = conversation.sender;
    const attendantName = selectedAttendantBySender[sender] || conversation.attendant_name || '';
    const message = finishAttendance ? DEFAULT_FINISH_MESSAGE : (manualMessageDrafts[sender] || '').trim();
    const sendTagValue = selectedSendTagBySender[sender] || '';

    if (!attendantName) {
      setError('Selecione um atendente antes de enviar a mensagem manual.');
      return;
    }
    if (!message) {
      setError('Digite uma mensagem antes de enviar.');
      return;
    }

    await runConversationAction(
      sender,
      async () => {
        if ((conversation.attendant_name || '') !== attendantName) {
          await autoResponderService.updateConversationAttendant(sender, attendantName);
        }
        return autoResponderService.sendManualMessage(sender, {
          message,
          attendant_name: attendantName,
          send_tag_id: sendTagValue ? Number(sendTagValue) : null,
          finish_attendance: finishAttendance,
          pause_minutes: finishAttendance ? undefined : 240,
        });
      },
      finishAttendance ? 'Atendimento finalizado' : 'Mensagem enviada pelo WhatsApp'
    );

    setManualMessageDrafts((current) => ({ ...current, [sender]: '' }));
    if (selectedConversationSender === sender) {
      await loadConversationLogs(sender);
    }
  }

  async function toggleConversationDetails(sender: string) {
    if (selectedConversationSender === sender) {
      setSelectedConversationSender(null);
      return;
    }
    setSelectedConversationSender(sender);
    if (!conversationLogsBySender[sender]) {
      await loadConversationLogs(sender);
    }
  }

  const filteredConversations = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    const statusFiltered = conversations.filter((conversation) => {
      const paused = isConversationPaused(conversation);
      const finished = isConversationFinished(conversation);
      if (conversationStatusFilter === 'finished') return finished;
      if (conversationStatusFilter === 'active') return !paused && !finished;
      if (conversationStatusFilter === 'paused') return paused && !finished;
      return true;
    });
    if (!term) return statusFiltered;
    return statusFiltered.filter((conversation) =>
      [conversation.sender, conversation.contact_name, conversation.last_message, conversation.pause_reason]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [conversationStatusFilter, conversations, search]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-emerald-600">Atendimento WhatsApp</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">Conversas recentes</h3>
          <p className="mt-1 text-sm text-slate-500">
            Acompanhe conversas ativas e pausadas sem sair do Centro WhatsApp.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar conversa"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 sm:w-56"
            />
          </label>
          <select
            value={conversationStatusFilter}
            onChange={(event) => setConversationStatusFilter(event.target.value as ConversationStatusFilter)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="all">Todas</option>
            <option value="active">Ativas</option>
            <option value="paused">Pausadas</option>
            <option value="finished">Atendimento finalizado</option>
          </select>
          <select
            value={attendantFilter}
            onChange={(event) => setAttendantFilter(event.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="all">Todos atendentes</option>
            <option value={UNASSIGNED_ATTENDANT_FILTER}>Sem atendente</option>
            {attendants.map((attendant) => (
              <option key={attendant.id} value={attendant.name}>{attendant.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              void loadConversations();
            }}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={loading ? 'animate-spin' : undefined} size={16} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="p-4">
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-700">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {attendants.length === 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
            Cadastre pelo menos um atendente no painel Equipe de atendimento para enviar mensagens manuais.
          </div>
        )}

        {loading && conversations.length === 0 ? (
          <div className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-lg border border-slate-100 bg-slate-50 text-slate-500">
            <RefreshCw className="animate-spin" size={26} />
            <span className="text-sm font-semibold">Carregando atendimentos...</span>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-lg border border-slate-100 bg-slate-50 text-center">
            <MessageCircle className="text-slate-400" size={30} />
            <h4 className="text-sm font-semibold text-slate-900">Nenhuma conversa encontrada</h4>
            <p className="max-w-md text-sm text-slate-500">
              Ajuste os filtros ou atualize a lista para buscar os atendimentos mais recentes.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredConversations.map((conversation) => {
              const paused = isConversationPaused(conversation);
              const finished = isConversationFinished(conversation);
              const statusLabel = finished ? 'Atendimento finalizado' : paused ? 'Com humano' : 'Bot ativo';
              const busy = actionSender === conversation.sender;
              const expanded = selectedConversationSender === conversation.sender;
              const logs = conversationLogsBySender[conversation.sender] || [];
              const loadingLogs = logsLoadingSender === conversation.sender;
              return (
                <article key={conversation.sender} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="truncate text-sm font-semibold text-slate-900">
                          {conversation.contact_name || conversation.sender}
                        </h4>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            finished
                              ? 'bg-slate-200 text-slate-700'
                              : paused
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-xs text-slate-500">{conversation.sender}</p>
                      <p className="mt-3 line-clamp-2 text-sm text-slate-700">
                        {conversation.last_message || 'Sem mensagem registrada.'}
                      </p>
                      {conversation.pause_reason && (
                        <p className="mt-2 text-xs font-medium text-amber-700">Motivo da pausa: {formatPauseReason(conversation.pause_reason)}</p>
                      )}
                      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold uppercase text-slate-500">Pausa humana</p>
                        <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-4">
                          <span>
                            <strong className="text-slate-800">Status:</strong> {statusLabel}
                          </span>
                          <span>
                            <strong className="text-slate-800">Atendente:</strong> {conversation.attendant_name || '-'}
                          </span>
                          <span>
                            <strong className="text-slate-800">Pausada ate:</strong> {paused ? formatDateTime(conversation.paused_until) : '-'}
                          </span>
                          <span>
                            <strong className="text-slate-800">Motivo:</strong> {formatPauseReason(conversation.pause_reason)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center lg:w-64">
                      <div className="rounded-lg bg-white p-2">
                        <p className="text-xs text-slate-400">Mensagens</p>
                        <p className="text-sm font-bold text-slate-900">{formatNumber(conversation.total_messages)}</p>
                      </div>
                      <div className="rounded-lg bg-white p-2">
                        <p className="text-xs text-slate-400">Respostas</p>
                        <p className="text-sm font-bold text-slate-900">{formatNumber(conversation.reply_count)}</p>
                      </div>
                      <div className="rounded-lg bg-white p-2">
                        <p className="text-xs text-slate-400">Fallbacks</p>
                        <p className="text-sm font-bold text-slate-900">{formatNumber(conversation.consecutive_fallbacks)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={14} />
                        Ultima mensagem: {formatDateTime(conversation.last_message_at)}
                      </span>
                      {paused && <span>Pausada ate: {formatDateTime(conversation.paused_until)}</span>}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={loadingLogs}
                        onClick={() => {
                          void toggleConversationDetails(conversation.sender);
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                      >
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {expanded ? 'Ocultar historico' : 'Ver historico'}
                      </button>
                      {paused || finished ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            void runConversationAction(
                              conversation.sender,
                              () => autoResponderService.resumeConversation(conversation.sender),
                              'Atendimento retomado'
                            );
                          }}
                          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          <Play size={14} />
                          Retomar
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              void runConversationAction(
                                conversation.sender,
                                () => autoResponderService.pauseConversation(conversation.sender, 60, 'admin_whatsapp_center'),
                                'Atendimento pausado por 1h'
                              );
                            }}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                          >
                            <Pause size={14} />
                            Pausar 1h
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              void runConversationAction(
                                conversation.sender,
                                () => autoResponderService.pauseConversation(conversation.sender, 240, 'admin_whatsapp_center'),
                                'Atendimento pausado por 4h'
                              );
                            }}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                          >
                            <Pause size={14} />
                            Pausar 4h
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (!window.confirm('Resetar contadores desta conversa?')) return;
                          void runConversationAction(
                            conversation.sender,
                            () => autoResponderService.resetConversationCounters(conversation.sender),
                            'Contadores resetados'
                          );
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                      >
                        <RotateCcw size={14} />
                        Resetar contadores
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          void blockConversation(conversation);
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        <Ban size={14} />
                        Bloquear numero
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                      <div className="mb-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                        <div className="grid gap-3 lg:grid-cols-2">
                          <div>
                            <label className="text-xs font-semibold uppercase text-emerald-700">
                              Atendente atual
                              <select
                                value={selectedAttendantBySender[conversation.sender] || ''}
                                onChange={(event) => setSelectedAttendantBySender((current) => ({
                                  ...current,
                                  [conversation.sender]: event.target.value,
                                }))}
                                className="mt-1 h-10 w-full rounded-lg border border-emerald-100 bg-white px-3 text-sm font-medium normal-case text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                              >
                                <option value="">Sem atendente</option>
                                {attendants.map((attendant) => (
                                  <option key={attendant.id} value={attendant.name}>{attendant.name}</option>
                                ))}
                              </select>
                            </label>
                            <button
                              type="button"
                              disabled={busy || (selectedAttendantBySender[conversation.sender] || '') === (conversation.attendant_name || '')}
                              onClick={() => {
                                void saveConversationAttendant(conversation);
                              }}
                              className="mt-2 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                            >
                              <Save size={14} />
                              Salvar atendente
                            </button>
                          </div>

                          <label className="text-xs font-semibold uppercase text-emerald-700">
                            Tag de envio
                            <select
                              value={selectedSendTagBySender[conversation.sender] || ''}
                              onChange={(event) => setSelectedSendTagBySender((current) => ({
                                ...current,
                                [conversation.sender]: event.target.value,
                              }))}
                              className="mt-1 h-10 w-full rounded-lg border border-emerald-100 bg-white px-3 text-sm font-medium normal-case text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                            >
                              <option value="">Sem tag de envio</option>
                              {sendTags.map((tag) => (
                                <option key={tag.id} value={tag.id}>{tag.name}</option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <label className="mt-3 block text-xs font-semibold uppercase text-emerald-700">
                          Mensagem manual
                          <textarea
                            value={manualMessageDrafts[conversation.sender] || ''}
                            onChange={(event) => setManualMessageDrafts((current) => ({
                              ...current,
                              [conversation.sender]: event.target.value,
                            }))}
                            placeholder="Digite a resposta para o cliente"
                            rows={3}
                            className="mt-1 w-full resize-y rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm font-medium normal-case text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          />
                        </label>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={busy || !selectedAttendantBySender[conversation.sender] || !(manualMessageDrafts[conversation.sender] || '').trim()}
                            onClick={() => {
                              void sendManualMessage(conversation, false);
                            }}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            <MessageCircle size={14} />
                            Enviar mensagem
                          </button>
                          <button
                            type="button"
                            disabled={busy || !selectedAttendantBySender[conversation.sender]}
                            onClick={() => {
                              if (!window.confirm('Enviar mensagem de atendimento finalizado?')) return;
                              void sendManualMessage(conversation, true);
                            }}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                          >
                            <CheckCircle2 size={14} />
                            Finalizar atendimento
                          </button>
                          <span className="text-xs text-emerald-800">{DEFAULT_FINISH_MESSAGE}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase text-emerald-600">Historico da conversa</p>
                          <h5 className="mt-1 text-sm font-semibold text-slate-900">Ultimos registros do bot</h5>
                        </div>
                        <button
                          type="button"
                          disabled={loadingLogs}
                          onClick={() => {
                            void loadConversationLogs(conversation.sender);
                          }}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          <RefreshCw className={loadingLogs ? 'animate-spin' : undefined} size={14} />
                          Atualizar historico
                        </button>
                      </div>

                      {loadingLogs && logs.length === 0 ? (
                        <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                          <RefreshCw className="animate-spin" size={16} />
                          Carregando historico...
                        </div>
                      ) : logs.length === 0 ? (
                        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                          Nenhum registro recente encontrado para esta conversa.
                        </div>
                      ) : (
                        <div className="mt-4 space-y-3">
                          {logs.map((log) => (
                            <div key={log.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                                <span>{formatDateTime(log.created_at)}</span>
                                <span className="rounded-full bg-white px-2 py-1 font-semibold text-slate-700">
                                  {log.intent || 'sem_intencao'}
                                </span>
                              </div>
                              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                                <div className="rounded-lg bg-white p-3">
                                  <p className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                                    <UserRound size={14} />
                                    Cliente
                                  </p>
                                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{log.question || '-'}</p>
                                </div>
                                <div className="rounded-lg bg-white p-3">
                                  <p className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                                    <Bot size={14} />
                                    Bot
                                  </p>
                                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{log.reply_text || '-'}</p>
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                                <span>Matches: {formatNumber(log.matched_count)}</span>
                                <span>Tempo: {formatResponseTime(log.response_time_ms)}</span>
                                {log.ai_assisted ? <span>IA: {log.ai_model || 'ativa'}</span> : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
