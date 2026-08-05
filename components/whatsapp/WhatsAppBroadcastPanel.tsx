import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Megaphone, Plus, RefreshCw, Send, UserMinus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import {
  whatsappBroadcastService,
  type WhatsAppBroadcastSubscriber,
  type WhatsAppBroadcastTopic,
} from '../../services/whatsappBroadcastService';

const STATUS_LABELS: Record<string, string> = {
  invited: 'Convite enviado',
  selecting: 'Escolhendo listas',
  subscribed: 'Inscrito',
  opted_out: 'Saiu',
};

export function WhatsAppBroadcastPanel() {
  const [topics, setTopics] = useState<WhatsAppBroadcastTopic[]>([]);
  const [subscribers, setSubscribers] = useState<WhatsAppBroadcastSubscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [newTopic, setNewTopic] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [topicRows, subscriberRows] = await Promise.all([
        whatsappBroadcastService.listTopics(),
        whatsappBroadcastService.listSubscribers(),
      ]);
      setTopics(topicRows);
      setSubscribers(subscriberRows);
      setSelectedTopicId(current => current || topicRows.find(topic => Boolean(topic.active))?.id || '');
    } catch (error) {
      console.error('Erro ao carregar listas de transmissao:', error);
      toast.error('Erro ao carregar listas de transmissão');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const activeSubscribers = useMemo(
    () => subscribers.filter(subscriber => subscriber.consent_status === 'subscribed').length,
    [subscribers],
  );

  const handleInvite = async () => {
    if (!invitePhone.trim()) return toast.warning('Informe o WhatsApp do cliente');
    setBusy(true);
    try {
      await whatsappBroadcastService.invite(invitePhone, inviteName);
      toast.success('Convite enviado. O cliente escolherá as listas pelo WhatsApp.');
      setInviteName('');
      setInvitePhone('');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar convite');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateTopic = async () => {
    if (!newTopic.trim()) return;
    setBusy(true);
    try {
      await whatsappBroadcastService.createTopic(newTopic.trim());
      setNewTopic('');
      toast.success('Lista criada');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar lista');
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async () => {
    if (!selectedTopicId || !message.trim()) return toast.warning('Escolha a lista e escreva a atualização');
    const topic = topics.find(item => item.id === selectedTopicId);
    if (!window.confirm(`Enviar esta mensagem para ${topic?.subscriber_count || 0} inscrito(s) da lista ${topic?.name}?`)) return;
    setBusy(true);
    try {
      const result = await whatsappBroadcastService.send(selectedTopicId, message.trim());
      toast.success(`Envio concluído: ${result.sent} enviados, ${result.failed} falharam.`);
      setMessage('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro no envio da lista');
    } finally {
      setBusy(false);
    }
  };

  const handleUnsubscribe = async (subscriber: WhatsAppBroadcastSubscriber) => {
    if (!window.confirm(`Retirar ${subscriber.name || subscriber.phone} de todas as listas?`)) return;
    try {
      await whatsappBroadcastService.unsubscribe(subscriber.id);
      toast.success('Cliente retirado das listas');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao retirar cliente');
    }
  };

  return (
    <section className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Consentimento e interesses</p>
          <h3 className="mt-1 flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Megaphone className="h-5 w-5 text-emerald-600" /> Listas de transmissão
          </h3>
          <p className="mt-1 text-sm text-slate-500">O cliente escolhe os temas e pode sair automaticamente respondendo SAIR.</p>
        </div>
        <button type="button" onClick={() => void load()} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" title="Atualizar">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-4">
              <h4 className="flex items-center gap-2 font-semibold text-slate-800"><UserPlus size={17} /> Enviar convite</h4>
              <input value={inviteName} onChange={event => setInviteName(event.target.value)} placeholder="Nome do cliente" className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <input value={invitePhone} onChange={event => setInvitePhone(event.target.value)} placeholder="WhatsApp com DDD" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <button type="button" disabled={busy} onClick={() => void handleInvite()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                <Send size={16} /> Convidar
              </button>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <h4 className="font-semibold text-slate-800">Temas disponíveis</h4>
              <div className="mt-3 space-y-2">
                {topics.map(topic => (
                  <div key={topic.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span><strong>{topic.name}</strong><span className="ml-2 text-slate-500">{Number(topic.subscriber_count || 0)} inscritos</span></span>
                    <button type="button" onClick={async () => { await whatsappBroadcastService.updateTopic(topic.id, { active: !Boolean(topic.active) }); await load(); }} className={Boolean(topic.active) ? 'text-emerald-700' : 'text-slate-400'}>
                      {Boolean(topic.active) ? 'Ativa' : 'Pausada'}
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input value={newTopic} onChange={event => setNewTopic(event.target.value)} placeholder="Novo tema" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <button type="button" disabled={busy} onClick={() => void handleCreateTopic()} className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-700"><Plus size={18} /></button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <h4 className="font-semibold text-slate-800">Enviar atualização</h4>
              <select value={selectedTopicId} onChange={event => setSelectedTopicId(event.target.value)} className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">Escolha a lista</option>
                {topics.filter(topic => Boolean(topic.active)).map(topic => <option key={topic.id} value={topic.id}>{topic.name} ({topic.subscriber_count})</option>)}
              </select>
              <textarea value={message} onChange={event => setMessage(event.target.value)} rows={4} placeholder="Digite a novidade, oferta ou aviso..." className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <button type="button" disabled={busy} onClick={() => void handleSend()} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                <Send size={16} /> Enviar para a lista
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
              <h4 className="font-semibold text-slate-800">Clientes e consentimentos</h4>
              <span className="text-sm text-slate-500">{activeSubscribers} inscritos ativos</span>
            </div>
            <div className="max-h-80 overflow-auto">
              {subscribers.length === 0 ? <p className="p-4 text-sm text-slate-500">Nenhum convite enviado ainda.</p> : subscribers.map(subscriber => (
                <div key={subscriber.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm first:border-t-0">
                  <div>
                    <p className="font-medium text-slate-800">{subscriber.name || 'Cliente sem nome'} <span className="font-normal text-slate-500">{subscriber.phone}</span></p>
                    <p className="text-xs text-slate-500">{STATUS_LABELS[subscriber.consent_status] || subscriber.consent_status}{subscriber.topics ? ` · ${subscriber.topics}` : ''}</p>
                  </div>
                  {subscriber.consent_status !== 'opted_out' && (
                    <button type="button" onClick={() => void handleUnsubscribe(subscriber)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"><UserMinus size={14} /> Retirar</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
