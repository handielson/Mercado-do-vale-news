import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, MessageCircle, RefreshCw } from 'lucide-react';
import { metaMarketingConnectionService, type MetaAttendanceEvent, type MetaAttendanceStatus } from '../../../../services/metaMarketingConnectionService';

const EVENT_LABELS = { captured: 'Recebido', ignored: 'Sem resposta automática', unsupported: 'Tipo pendente de integração' };

export function MetaAttendanceView({ status, events, loading, error, refresh }: {
    status: MetaAttendanceStatus | null;
    events: MetaAttendanceEvent[];
    loading: boolean;
    error: string;
    refresh: () => void;
}) {
    const ready = status?.configured && status.storageReady;
    const active = status?.outboundEnabled === true;
    return <section className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
                <h4 className="flex items-center gap-2 text-sm font-black text-slate-900"><MessageCircle className="h-4 w-4 text-teal-700" />Atendimento Instagram e Facebook</h4>
                <p className="mt-1 text-xs text-slate-600">{active ? 'Direct e Messenger usam o mesmo atendimento de vendas do WhatsApp.' : 'Piloto de recebimento. As respostas automáticas ainda não estão ativas.'}</p>
            </div>
            <button type="button" onClick={refresh} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-white px-3 py-2 text-xs font-bold text-teal-800 disabled:opacity-50">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Atualizar recebimentos
            </button>
        </div>
        {error && <p role="status" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{error}</p>}
        {status && <>
            <div className="flex flex-wrap gap-2 text-xs font-bold">
                <span className={`rounded-full px-3 py-1 ${ready ? 'bg-teal-100 text-teal-900' : 'bg-amber-100 text-amber-900'}`}>{active ? 'Atendimento automático ativo' : ready ? 'Recebimento preparado' : 'Recebimento aguardando configuração'}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{active ? 'Histórico separado por canal · pausa ao responder manualmente' : 'Somente observação · envios bloqueados'}</span>
            </div>
            <p className="text-xs text-slate-600">{active ? 'Responde às novas mensagens privadas recebidas após a ativação. Comentários ficam disponíveis para acompanhamento. Mensagens antigas não são respondidas automaticamente.' : 'Direct, Messenger e comentários aparecem por canal. O recebimento ainda precisa ser validado em uma conversa real.'} Mensagens do Marketplace dependem de chegarem à Página conectada.</p>
            {status.activity?.some(item => ['failed', 'result_unknown'].includes(item.status) && Number(item.count) > 0) && <p role="status" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Há atendimentos que precisam de conferência. Respostas com resultado de envio desconhecido não são repetidas automaticamente.</p>}
            {events.length === 0 && <p className="rounded-lg border border-dashed border-teal-200 bg-white p-4 text-xs text-slate-500">Nenhum evento recebido neste piloto.</p>}
            {events.length > 0 && <div className="space-y-2">{events.map(event => <article key={event.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <p className="font-bold text-slate-800">{event.channel === 'instagram' ? 'Instagram' : 'Facebook Messenger'} · {event.surface === 'comment' ? 'Comentário' : event.surface === 'dm' ? 'Mensagem privada' : 'Atualização'}</p>
                    <span className="text-slate-500">{EVENT_LABELS[event.status]}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">{event.normalized_event.text || (event.normalized_event.attachments?.length ? 'Mensagem com anexo' : 'Evento sem texto')}</p>
            </article>)}</div>}
        </>}
    </section>;
}

export default function MetaAttendancePanel() {
    const [status, setStatus] = useState<MetaAttendanceStatus | null>(null);
    const [events, setEvents] = useState<MetaAttendanceEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const pending = useRef<AbortController | null>(null);
    const load = useCallback(async () => {
        pending.current?.abort();
        const controller = new AbortController();
        pending.current = controller;
        const { signal } = controller;
        setLoading(true);
        setError('');
        setEvents([]);
        try {
            const next = await metaMarketingConnectionService.getAttendanceStatus();
            if (signal.aborted) return;
            setStatus(next);
            if (next.storageReady) {
                const rows = await metaMarketingConnectionService.listAttendanceEvents();
                if (!signal.aborted) setEvents(rows);
            }
        } catch {
            if (!signal.aborted) setError('Não foi possível consultar o piloto. A preparação precisa estar publicada na API.');
        } finally { if (!signal.aborted) setLoading(false); }
    }, []);
    useEffect(() => {
        void load();
        return () => pending.current?.abort();
    }, [load]);
    return <MetaAttendanceView status={status} events={events} loading={loading} error={error} refresh={() => { void load(); }} />;
}
