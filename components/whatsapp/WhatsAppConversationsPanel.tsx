import React from 'react';
import { AlertCircle, Clock, MessageCircle, Pause, Play, RefreshCw, RotateCcw, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { autoResponderService } from '../../services/autoResponderService';
import type { AutoResponderConversation } from '../../types/autoResponder';

type ConversationStatusFilter = 'all' | 'active' | 'paused';

function isConversationPaused(conversation: AutoResponderConversation): boolean {
  if (!conversation.paused_until) return false;
  return new Date(conversation.paused_until).getTime() > Date.now();
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

export function WhatsAppConversationsPanel() {
  const [conversations, setConversations] = React.useState<AutoResponderConversation[]>([]);
  const [conversationStatusFilter, setConversationStatusFilter] = React.useState<ConversationStatusFilter>('all');
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionSender, setActionSender] = React.useState<string | null>(null);

  const loadConversations = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = conversationStatusFilter === 'all' ? undefined : conversationStatusFilter;
      const data = await autoResponderService.listConversations({ limit: 25, status });
      setConversations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar atendimentos.');
    } finally {
      setLoading(false);
    }
  }, [conversationStatusFilter]);

  React.useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

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

  const filteredConversations = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((conversation) =>
      [conversation.sender, conversation.contact_name, conversation.last_message, conversation.pause_reason]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [conversations, search]);

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
              const busy = actionSender === conversation.sender;
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
                            paused ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {paused ? 'Pausada' : 'Ativa'}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-xs text-slate-500">{conversation.sender}</p>
                      <p className="mt-3 line-clamp-2 text-sm text-slate-700">
                        {conversation.last_message || 'Sem mensagem registrada.'}
                      </p>
                      {conversation.pause_reason && (
                        <p className="mt-2 text-xs font-medium text-amber-700">Motivo da pausa: {conversation.pause_reason}</p>
                      )}
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
                      {paused ? (
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
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
