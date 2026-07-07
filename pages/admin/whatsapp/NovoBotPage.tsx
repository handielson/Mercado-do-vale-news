import React, { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  MessageCircle,
  Reply,
  RefreshCcw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Workflow,
  X,
} from 'lucide-react';
import {
  n8nBotControlService,
  type N8nBotAdminNumber,
  type N8nBotClientControl,
  type N8nBotConversation,
  type N8nBotGlobalControl,
  type N8nBotMessage,
} from '../../../services/n8nBotControlService';

function formatDate(value?: string | null, withYear = false) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    ...(withYear ? { year: 'numeric' as const } : {}),
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function isBlocked(value?: boolean | number | null) {
  return value === true || Number(value || 0) === 1;
}

function normalizeStatus(control?: N8nBotClientControl | null) {
  if (!control?.remote_jid) return 'Sem registro';
  return isBlocked(control.blocked) ? 'Bloqueado' : 'Ativo';
}

function displayPhone(value?: string | null) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits || String(value || '-');
}

function displayContactName(value?: string | null) {
  const name = String(value || '').trim();
  return name && !/^\+?\d{8,}$/.test(name.replace(/\s+/g, '')) ? name : '';
}

function messageTone(direction: string) {
  if (direction === 'outbound') return 'ml-auto border-blue-100 bg-blue-600 text-white';
  if (direction === 'internal') return 'mx-auto border-amber-200 bg-amber-50 text-amber-900';
  return 'mr-auto border-slate-200 bg-white text-slate-800';
}

export default function NovoBotPage() {
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [control, setControl] = useState<N8nBotClientControl | null>(null);
  const [conversations, setConversations] = useState<N8nBotConversation[]>([]);
  const [messages, setMessages] = useState<N8nBotMessage[]>([]);
  const [selectedRemoteJid, setSelectedRemoteJid] = useState('');
  const [expandedRemoteJid, setExpandedRemoteJid] = useState('');
  const [expandedMessagesByJid, setExpandedMessagesByJid] = useState<Record<string, N8nBotMessage[]>>({});
  const [expandedMessagesLoadingJid, setExpandedMessagesLoadingJid] = useState('');
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(false);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [manualReply, setManualReply] = useState('');
  const [manualPauseBot, setManualPauseBot] = useState(true);
  const [selectedReplyMessage, setSelectedReplyMessage] = useState<N8nBotMessage | null>(null);
  const [adminNumbers, setAdminNumbers] = useState<N8nBotAdminNumber[]>([]);
  const [adminPhone, setAdminPhone] = useState('');
  const [adminLabel, setAdminLabel] = useState('');
  const [globalControl, setGlobalControl] = useState<N8nBotGlobalControl | null>(null);
  const [adminSettingsLoading, setAdminSettingsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.remote_jid === selectedRemoteJid) || null,
    [conversations, selectedRemoteJid],
  );
  const status = useMemo(() => normalizeStatus(control), [control]);

  async function loadConversations(keepSelection = true) {
    setConversationsLoading(true);
    setError('');
    try {
      const data = await n8nBotControlService.listConversations({ limit: 60 });
      const rows = data.rows || [];
      setConversations(rows);
      if (!keepSelection || !selectedRemoteJid) {
        const first = rows[0];
        if (first) {
          setSelectedRemoteJid(first.remote_jid);
          setPhone(first.phone || first.remote_jid);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar conversas.');
    } finally {
      setConversationsLoading(false);
    }
  }

  async function loadMessages(remoteJid = selectedRemoteJid) {
    if (!remoteJid) {
      setMessages([]);
      return;
    }
    setMessagesLoading(true);
    setError('');
    try {
      const [history, lookup] = await Promise.all([
        n8nBotControlService.listMessages({ remoteJid, limit: 120 }),
        n8nBotControlService.lookup({ remoteJid }),
      ]);
      setMessages(history.rows || []);
      setControl(lookup.control);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar mensagens.');
    } finally {
      setMessagesLoading(false);
    }
  }

  async function refreshAll() {
    await loadConversations(true);
    await loadMessages(selectedRemoteJid);
  }

  async function runAction(action: () => Promise<{ control: N8nBotClientControl }>, success: string) {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const data = await action();
      setControl(data.control);
      setMessage(success);
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao executar acao');
    } finally {
      setLoading(false);
    }
  }

  async function loadAdminSettings() {
    setAdminSettingsLoading(true);
    try {
      const [numbers, global] = await Promise.all([
        n8nBotControlService.listAdminNumbers(),
        n8nBotControlService.getGlobalControl(),
      ]);
      setAdminNumbers(numbers.rows || []);
      setGlobalControl(global.control);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar comandos por WhatsApp.');
    } finally {
      setAdminSettingsLoading(false);
    }
  }

  async function saveAdminNumber() {
    if (!adminPhone.trim() || loading) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await n8nBotControlService.saveAdminNumber({ phone: adminPhone, label: adminLabel });
      setAdminPhone('');
      setAdminLabel('');
      setMessage('Numero admin salvo para comandos por WhatsApp.');
      await loadAdminSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar numero admin.');
    } finally {
      setLoading(false);
    }
  }

  async function removeAdminNumber(id: string) {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await n8nBotControlService.removeAdminNumber(id);
      setMessage('Numero admin removido.');
      await loadAdminSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover numero admin.');
    } finally {
      setLoading(false);
    }
  }

  async function setGlobalPaused(paused: boolean) {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const data = await n8nBotControlService.setGlobalControl({
        paused,
        reason: paused ? 'Pausado pelo painel Novo Bot' : '',
        changedBy: 'admin-panel',
      });
      setGlobalControl(data.control);
      setMessage(paused ? 'Bot pausado para todos os clientes.' : 'Bot reativado para todos os clientes.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao alterar pausa geral.');
    } finally {
      setLoading(false);
    }
  }

  async function sendManualReply() {
    const text = manualReply.trim();
    if (!selectedRemoteJid || !text || loading) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const result = await n8nBotControlService.sendManualMessage({
        ...actionIdentity,
        message: text,
        replyToMessageId: selectedReplyMessage?.id,
        replyToWaMessageId: selectedReplyMessage?.wa_message_id || '',
        replyToText: selectedReplyMessage?.message_text || '',
        pauseBot: manualPauseBot,
      });
      setManualReply('');
      setSelectedReplyMessage(null);
      setMessage(result.quoted ? 'Resposta enviada citando a pergunta marcada.' : 'Resposta enviada. A mensagem marcada antiga nao tinha ID do WhatsApp para citar.');
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar resposta manual.');
    } finally {
      setLoading(false);
    }
  }

  function selectConversation(conversation: N8nBotConversation) {
    setSelectedRemoteJid(conversation.remote_jid);
    setPhone(conversation.phone || conversation.remote_jid);
    setControl(null);
    setSelectedReplyMessage(null);
    setManualReply('');
  }

  async function toggleConversationExpansion(conversation: N8nBotConversation) {
    if (expandedRemoteJid === conversation.remote_jid) {
      setExpandedRemoteJid('');
      return;
    }

    setExpandedRemoteJid(conversation.remote_jid);
    if (expandedMessagesByJid[conversation.remote_jid]?.length) return;

    setExpandedMessagesLoadingJid(conversation.remote_jid);
    setError('');
    try {
      const data = await n8nBotControlService.listMessages({ remoteJid: conversation.remote_jid, limit: 10 });
      setExpandedMessagesByJid((current) => ({
        ...current,
        [conversation.remote_jid]: data.rows || [],
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar previa da conversa.');
    } finally {
      setExpandedMessagesLoadingJid('');
    }
  }

  useEffect(() => {
    void loadConversations(false);
    void loadAdminSettings();
  }, []);

  useEffect(() => {
    void loadMessages(selectedRemoteJid);
  }, [selectedRemoteJid]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const id = window.setInterval(() => {
      void refreshAll();
    }, 5000);
    return () => window.clearInterval(id);
  }, [autoRefresh, selectedRemoteJid]);

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((item) => (
      item.remote_jid.toLowerCase().includes(term)
      || displayPhone(item.phone).includes(term)
      || displayContactName(item.contact_name).toLowerCase().includes(term)
      || String(item.last_message || '').toLowerCase().includes(term)
    ));
  }, [conversations, search]);

  const actionIdentity = selectedRemoteJid ? { remoteJid: selectedRemoteJid } : { phone };
  const canSubmit = (selectedRemoteJid || phone.trim().length >= 8) && !loading;

  return (
    <div className="mx-auto max-w-7xl animate-in fade-in duration-500 pb-20">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900">
            <Workflow className="text-blue-600" size={28} />
            Novo Bot n8n
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Atendimento em tempo real do novo fluxo de vendas no WhatsApp, com acoes administrativas por cliente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Ao vivo
          </label>
          <button
            type="button"
            onClick={() => void refreshAll()}
            disabled={conversationsLoading || messagesLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw size={16} className={conversationsLoading || messagesLoading ? 'animate-spin' : undefined} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <MessageCircle className="text-blue-600" size={22} />
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Conversas</p>
              <p className="text-sm font-semibold text-slate-900">{conversations.length} monitoradas</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-emerald-600" size={22} />
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Status</p>
              <p className="text-sm font-semibold text-slate-900">{status}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Clock className="text-amber-600" size={22} />
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Ultima mensagem</p>
              <p className="text-sm font-semibold text-slate-900">{formatDate(selectedConversation?.last_message_at)}</p>
            </div>
          </div>
        </div>
      </div>

      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <ShieldCheck size={20} className="text-blue-600" />
              Comandos por WhatsApp
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Numeros cadastrados podem enviar pausar, continuar e status pelo WhatsApp.
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              Status geral: {globalControl?.paused ? 'Pausado' : 'Ativo'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Alterado em {formatDate(globalControl?.changed_at, true)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void setGlobalPaused(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
            >
              <Ban size={16} />
              Pausar geral
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void setGlobalPaused(false)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:opacity-50"
            >
              <CheckCircle2 size={16} />
              Continuar geral
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[220px_1fr_auto]">
          <label className="block text-xs font-bold uppercase text-slate-500">
            Numero admin
            <input
              value={adminPhone}
              onChange={(event) => setAdminPhone(event.target.value)}
              placeholder="5587999999999"
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm normal-case text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block text-xs font-bold uppercase text-slate-500">
            Nome opcional
            <input
              value={adminLabel}
              onChange={(event) => setAdminLabel(event.target.value)}
              placeholder="Admin"
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm normal-case text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <button
            type="button"
            disabled={!adminPhone.trim() || loading}
            onClick={() => void saveAdminNumber()}
            className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 lg:mt-[22px]"
          >
            Salvar admin
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          {adminSettingsLoading ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              Carregando admins...
            </div>
          ) : adminNumbers.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">Nenhum numero admin cadastrado.</p>
          ) : adminNumbers.map((item) => (
            <div key={item.id} className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-sm font-bold text-slate-900">{displayPhone(item.phone)}</p>
                <p className="text-xs text-slate-500">{item.label || item.remote_jid}</p>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={() => void removeAdminNumber(item.id)}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      </section>

      {(message || error) && (
        <div className="mb-4 space-y-2">
          {message && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{message}</p>}
          {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{error}</p>}
        </div>
      )}

      <div className="grid min-h-[640px] gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar telefone ou mensagem"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>

          <div className="max-h-[590px] overflow-y-auto">
            {conversationsLoading && filteredConversations.length === 0 ? (
              <div className="flex min-h-40 items-center justify-center gap-2 text-sm font-semibold text-slate-500">
                <Loader2 className="animate-spin" size={18} />
                Carregando conversas...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-slate-500">
                <MessageCircle size={28} className="text-slate-400" />
                Nenhuma conversa registrada ainda.
              </div>
            ) : filteredConversations.map((conversation) => {
              const selected = conversation.remote_jid === selectedRemoteJid;
              const expanded = conversation.remote_jid === expandedRemoteJid;
              const expandedMessages = expandedMessagesByJid[conversation.remote_jid] || [];
              const expandedLoading = expandedMessagesLoadingJid === conversation.remote_jid;
              const blocked = isBlocked(conversation.blocked);
              const contactName = displayContactName(conversation.contact_name);
              return (
                <div
                  key={conversation.remote_jid}
                  className={`border-b border-slate-100 transition-colors ${selected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-start gap-2 px-3 py-3">
                    <button
                      type="button"
                      onClick={() => void toggleConversationExpansion(conversation)}
                      aria-label={expanded ? 'Fechar conversa' : 'Abrir conversa'}
                      title={expanded ? 'Fechar conversa' : 'Abrir conversa'}
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white hover:text-blue-700"
                    >
                      {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>

                    <button
                      type="button"
                      onClick={() => selectConversation(conversation)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">{contactName || displayPhone(conversation.phone)}</p>
                          <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
                            {contactName ? displayPhone(conversation.phone) : conversation.remote_jid}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${blocked ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {blocked ? 'Bloq.' : 'Ativo'}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-600">{conversation.last_message || 'Sem mensagem recente.'}</p>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                        <span>{conversation.last_direction === 'outbound' ? 'Bot' : 'Cliente'}</span>
                        <span>{formatDate(conversation.last_message_at)}</span>
                      </div>
                    </button>
                  </div>

                  {expanded && (
                    <div className="mx-4 mb-3 ml-[52px] rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-[11px] font-bold uppercase text-slate-500">Conversas recentes</p>
                        {expandedLoading && <Loader2 className="animate-spin text-slate-400" size={14} />}
                      </div>
                      {expandedLoading && expandedMessages.length === 0 ? (
                        <p className="text-xs font-semibold text-slate-500">Carregando previa...</p>
                      ) : expandedMessages.length === 0 ? (
                        <p className="text-xs font-semibold text-slate-500">Sem mensagens nesta previa.</p>
                      ) : (
                        <div className="space-y-2">
                          {expandedMessages.map((item) => (
                            <div key={item.id} className="min-w-0">
                              <div className="mb-0.5 flex items-center justify-between gap-2 text-[10px] font-bold uppercase text-slate-400">
                                <span>{item.direction === 'outbound' ? 'Bot' : item.direction === 'internal' ? 'Sistema' : 'Cliente'}</span>
                                <span>{formatDate(item.created_at)}</span>
                              </div>
                              <p className={`line-clamp-2 rounded-md px-2 py-1.5 text-xs leading-relaxed ${
                                item.direction === 'outbound'
                                  ? 'bg-blue-50 text-blue-900'
                                  : item.direction === 'internal'
                                    ? 'bg-amber-50 text-amber-900'
                                    : 'bg-slate-50 text-slate-700'
                              }`}
                              >
                                {item.message_text || '-'}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                  <Smartphone size={20} className="text-blue-600" />
                  {selectedConversation ? (displayContactName(selectedConversation.contact_name) || displayPhone(selectedConversation.phone)) : 'Selecione uma conversa'}
                </h3>
                <p className="mt-1 break-all font-mono text-xs text-slate-500">
                  {selectedConversation && displayContactName(selectedConversation.contact_name)
                    ? `${displayPhone(selectedConversation.phone)} - ${selectedRemoteJid}`
                    : selectedRemoteJid || '-'}
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  Reset #{control?.reset_count ?? selectedConversation?.reset_count ?? 0}
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:w-[430px]">
                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={() => void runAction(
                    () => n8nBotControlService.reset({ ...actionIdentity, blockedBy: 'admin' }),
                    'Atendimento marcado para limpeza. Na proxima mensagem o bot usara memoria nova.',
                  )}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                  Limpar atendimento
                </button>
                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={() => void runAction(
                    () => n8nBotControlService.setBlocked({ ...actionIdentity, blocked: true, reason, blockedBy: 'admin' }),
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
                  onClick={() => void runAction(
                    () => n8nBotControlService.setBlocked({ ...actionIdentity, blocked: false, reason: '', blockedBy: 'admin' }),
                    'Fluxo liberado para este cliente.',
                  )}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle2 size={16} />
                  Desbloquear
                </button>
                <button
                  type="button"
                  disabled={!selectedRemoteJid || messagesLoading}
                  onClick={() => void loadMessages()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCcw size={16} className={messagesLoading ? 'animate-spin' : undefined} />
                  Recarregar
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_260px]">
              <label className="block text-xs font-bold uppercase text-slate-500">
                Telefone ou JID manual
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Ex: 5587999999999"
                  className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm normal-case text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="block text-xs font-bold uppercase text-slate-500">
                Motivo do bloqueio
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Atendimento assumido"
                  className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm normal-case text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
            {!selectedRemoteJid ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-center text-slate-500">
                <MessageCircle size={32} className="text-slate-400" />
                <p className="text-sm font-semibold">Escolha uma conversa para acompanhar o atendimento.</p>
              </div>
            ) : messagesLoading && messages.length === 0 ? (
              <div className="flex min-h-[420px] items-center justify-center gap-2 text-sm font-semibold text-slate-500">
                <Loader2 className="animate-spin" size={18} />
                Carregando mensagens...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-center text-slate-500">
                <MessageCircle size={32} className="text-slate-400" />
                <p className="text-sm font-semibold">Ainda nao ha mensagens salvas para este cliente.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((item) => (
                  <div
                    key={item.id}
                    className={`max-w-[82%] rounded-lg border px-4 py-3 shadow-sm ${messageTone(item.direction)}`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3 text-[11px] opacity-80">
                      <span className="font-bold uppercase">
                        {item.direction === 'outbound' ? 'Bot' : item.direction === 'internal' ? 'Sistema' : 'Cliente'}
                      </span>
                      <span>{formatDate(item.created_at, true)}</span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{item.message_text}</p>
                    {item.direction === 'inbound' && (
                      <button
                        type="button"
                        onClick={() => setSelectedReplyMessage(item)}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <Reply size={13} />
                        Responder
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedRemoteJid && (
            <div className="border-t border-slate-200 bg-white p-4">
              {selectedReplyMessage && (
                <div className="mb-3 flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
                  <Reply className="mt-0.5 shrink-0 text-blue-600" size={16} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase text-blue-700">Respondendo pergunta marcada</p>
                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-blue-950">{selectedReplyMessage.message_text}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedReplyMessage(null)}
                    aria-label="Remover mensagem marcada"
                    title="Remover mensagem marcada"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-blue-700 transition-colors hover:bg-blue-100"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <label className="min-w-0 flex-1 text-xs font-bold uppercase text-slate-500">
                  Resposta manual
                  <textarea
                    value={manualReply}
                    onChange={(event) => setManualReply(event.target.value)}
                    placeholder="Digite a resposta para o cliente"
                    rows={3}
                    className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm normal-case text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <div className="flex flex-col gap-2 lg:w-56">
                  <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={manualPauseBot}
                      onChange={(event) => setManualPauseBot(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Pausar bot depois
                  </label>
                  <button
                    type="button"
                    disabled={!manualReply.trim() || !selectedRemoteJid || loading}
                    onClick={() => void sendManualReply()}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    Enviar resposta
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
