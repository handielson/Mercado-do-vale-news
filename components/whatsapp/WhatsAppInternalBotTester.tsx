import React from 'react';
import { Bot, RefreshCw, Send, Trash2, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { autoResponderService } from '../../services/autoResponderService';

type ChatMessage = {
  id: string;
  role: 'customer' | 'bot' | 'system';
  text: string;
  meta?: string;
};

function buildDefaultSender(): string {
  return `laboratorio-whatsapp-${Date.now()}`;
}

function normalizeReplyText(reply: { message?: string } | string): string {
  if (typeof reply === 'string') return reply;
  return String(reply?.message || '').trim();
}

export function WhatsAppInternalBotTester() {
  const [sender, setSender] = React.useState(buildDefaultSender);
  const [contactFirstName, setContactFirstName] = React.useState('Cliente');
  const [draft, setDraft] = React.useState('');
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'system',
      text: 'Laboratorio interno: as mensagens passam pelo motor do bot, mas nao sao enviadas ao WhatsApp real.',
    },
  ]);
  const [sending, setSending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  async function sendMessage() {
    const text = draft.trim();
    if (!text || sending) return;

    const customerMessage: ChatMessage = {
      id: `customer-${Date.now()}`,
      role: 'customer',
      text,
    };

    setMessages((current) => [...current, customerMessage]);
    setDraft('');
    setSending(true);

    try {
      const result = await autoResponderService.sendInternalChatMessage({
        sender,
        contactFirstName,
        message: text,
      });

      const replies = result.replies
        .map(normalizeReplyText)
        .filter(Boolean);

      setMessages((current) => [
        ...current,
        ...(replies.length > 0
          ? replies.map((replyText, index) => ({
              id: `bot-${Date.now()}-${index}`,
              role: 'bot' as const,
              text: replyText,
              meta: `${result.response_time_ms}ms`,
            }))
          : [{
              id: `bot-empty-${Date.now()}`,
              role: 'system' as const,
              text: 'O motor nao retornou resposta para esta mensagem.',
              meta: `HTTP ${result.status_code}`,
            }]),
      ]);
    } catch (err) {
      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: 'system',
          text: err instanceof Error ? err.message : 'Falha ao testar mensagem no laboratorio.',
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function resetChat() {
    setSending(true);
    try {
      await autoResponderService.resetInternalChat({ sender });
      const nextSender = buildDefaultSender();
      setSender(nextSender);
      setMessages([
        {
          id: `reset-${Date.now()}`,
          role: 'system',
          text: 'Conversa interna limpa. Um novo cliente de teste foi criado.',
        },
      ]);
      toast.success('Laboratorio reiniciado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao limpar laboratorio.');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase text-emerald-600">
            <Bot size={15} />
            WhatsApp interno
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">Laboratorio do bot</h3>
          <p className="mt-1 text-sm text-slate-500">
            Teste conversas completas sem enviar mensagem real e sem limite curto de fluxo.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void resetChat();
          }}
          disabled={sending}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <Trash2 size={16} />
          Limpar conversa
        </button>
      </div>

      <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
          <label className="block text-xs font-semibold uppercase text-slate-500">
            Nome do cliente
            <input
              value={contactFirstName}
              onChange={(event) => setContactFirstName(event.target.value)}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold normal-case text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="mt-4 block text-xs font-semibold uppercase text-slate-500">
            Sender interno
            <input
              value={sender}
              onFocus={(event) => event.currentTarget.select()}
              onClick={(event) => event.currentTarget.select()}
              onChange={(event) => setSender(event.target.value)}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold normal-case text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <button
            type="button"
            onClick={() => setSender(buildDefaultSender())}
            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
          >
            <RefreshCw size={15} />
            Novo cliente de teste
          </button>

          <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
            Use o mesmo sender para continuar o estado da compra. Use limpar conversa para apagar logs e estado desse teste.
          </div>
        </aside>

        <div className="flex min-h-[520px] flex-col bg-slate-50">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === 'customer'
                    ? 'justify-end'
                    : message.role === 'bot'
                      ? 'justify-start'
                      : 'justify-center'
                }`}
              >
                {message.role === 'system' ? (
                  <div className="max-w-[90%] rounded-full bg-white px-3 py-1.5 text-center text-xs font-medium text-slate-500 shadow-sm">
                    {message.text}
                  </div>
                ) : (
                  <div
                    className={`max-w-[82%] rounded-lg px-3 py-2 text-sm leading-6 shadow-sm ${
                      message.role === 'customer'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-slate-800'
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold opacity-80">
                      {message.role === 'customer' ? <UserRound size={13} /> : <Bot size={13} />}
                      {message.role === 'customer' ? contactFirstName || 'Cliente' : 'Bot'}
                    </div>
                    <div className="whitespace-pre-wrap">{message.text}</div>
                    {message.meta && (
                      <div className="mt-1 text-right text-[11px] opacity-60">{message.meta}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-500 shadow-sm">
                  Bot processando...
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          <div className="border-t border-slate-200 bg-white p-3">
            <div className="flex gap-2">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="Digite como se fosse o cliente..."
                rows={2}
                className="min-h-[48px] flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
              <button
                type="button"
                onClick={() => {
                  void sendMessage();
                }}
                disabled={sending || !draft.trim()}
                className="inline-flex w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                aria-label="Enviar mensagem no WhatsApp interno"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
