import { useEffect, useRef, useState } from 'react';
import { History, Loader2, Search, X, Printer, MessageCircle } from 'lucide-react';
import { vpsClient } from '@/services/vpsClient';
import { collectJournal, journalText, journalSummary, journalSummaryText, journalPrintHtml, type JournalEvent, type JournalResponse } from '@/utils/unitJournalExport';
const labels: Record<string, string> = {
    baseline: 'Registro inicial de uma unidade já cadastrada',
    existing_sale_reference: 'Venda anterior localizada no sistema',
    unit_insert: 'Cadastro da unidade', unit_update: 'Alteração da unidade', unit_delete: 'Cadastro removido',
    product_update: 'Alteração dos dados do produto', product_delete: 'Produto removido',
    sale_items_insert: 'Unidade registrada na venda', sale_items_update: 'Item da venda alterado', sale_items_delete: 'Item da venda removido',
    sale_update: 'Venda alterada', sale_delete: 'Venda removida',
    order_update: 'Pedido alterado', order_delete: 'Pedido removido', order: 'Pedido',
    product_stock_locations_insert: 'Saldo criado em um local', product_stock_locations_update: 'Saldo do local alterado', product_stock_locations_delete: 'Saldo removido de um local',
    stock_location_movements_insert: 'Movimentação de estoque', stock_location_movements_update: 'Movimentação alterada', stock_location_movements_delete: 'Movimentação removida',
    unit: 'Aparelho', product: 'Produto', sale: 'Venda', sale_items: 'Item da venda',
    product_stock_locations: 'Saldo por local', stock_location_movements: 'Movimentação',
    id: 'Identificador', product_id: 'Produto vinculado', name: 'Nome', sku: 'SKU', specs: 'Características',
    imei: 'IMEI', imei_1: 'IMEI 1', imei_2: 'IMEI 2', serial: 'Serial', status: 'Situação', condition: 'Condição',
    ram: 'RAM', storage: 'Armazenamento', color: 'Cor', created_at: 'Data de cadastro', updated_at: 'Última alteração',
    sold_at: 'Data da venda', reserved_at: 'Data da reserva', sale_id: 'Venda vinculada', order_id: 'Pedido vinculado',
    internal_notes: 'Observações internas', notes: 'Observações', quantity: 'Quantidade', stock_quantity: 'Saldo do produto',
    reserved_quantity: 'Quantidade reservada', deposit_id: 'Depósito', location_id: 'Local',
    available: 'Disponível', sold: 'Vendida', reserved: 'Reservada', hidden: 'Oculta', rma: 'RMA', scrapped: 'Descartada',
};
function date(value: string) {
    return new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}
function DataView({ value }: { value: unknown }) {
    if (value == null) return <span className="text-slate-400">Não informado</span>;
    if (typeof value === 'string' && /^[\[{]/.test(value)) {
        try { return <DataView value={JSON.parse(value)} />; } catch { /* plain text */ }
    }
    if (typeof value === 'object') {
        return <dl className="space-y-2">{Object.entries(value).map(([key, item]) => <div key={key} className="border-l border-slate-200 pl-3">
            <dt className="font-medium text-slate-500">{labels[key] || key}</dt>
            <dd className="break-words whitespace-pre-wrap"><DataView value={item} /></dd>
        </div>)}</dl>;
    }
    const text = String(value);
    if (text.startsWith('data:image/')) return <img src={text} alt="Imagem preservada neste registro" className="max-h-48 object-contain" />;
    return <span>{labels[text] || text}</span>;
}

export function UnitJournalModal({ unitId, productId, productIds = [], productName, onClose }: { unitId?: string; productId?: string; productIds?: string[]; productName?: string; onClose: () => void }) {
    const [identifier, setIdentifier] = useState('');
    const [target, setTarget] = useState(unitId || productId || '');
    const [events, setEvents] = useState<JournalEvent[]>([]);
    const [next, setNext] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [exporting, setExporting] = useState(false);
    const [notice, setNotice] = useState('');
    const [includeFullData, setIncludeFullData] = useState(false);
    const request = useRef(0);
    const title = productId ? `Histórico do produto${productName ? ` — ${productName}` : ''}` : 'Diário do aparelho';
    const productIdsKey = productIds.join(',');
    function read(cursor?: string) {
        const path = productId ? `/admin/products/${encodeURIComponent(productId)}/journal?include=${encodeURIComponent(productIdsKey)}` : unitId ? `/admin/units/${encodeURIComponent(unitId)}/journal` : `/admin/units/journal?identifier=${encodeURIComponent(target)}`;
        return vpsClient.get<JournalResponse>(`${path}${cursor ? `${path.includes('?') ? '&' : '?'}before=${encodeURIComponent(cursor)}` : ''}`);
    }
    async function exportHistory(mode: 'print' | 'whatsapp') {
        const popup = window.open('', '_blank', mode === 'print' ? 'width=900,height=700' : undefined);
        if (!popup) { setError('Permita abrir uma nova janela para imprimir ou compartilhar.'); return; }
        popup.document.body.textContent = 'Preparando o histórico completo…';
        popup.opener = null;
        setExporting(true); setError(''); setNotice('');
        const ticket = request.current;
        try {
            const complete = await collectJournal(read);
            if (ticket !== request.current) { popup.close(); return; }
            const summary = journalSummaryText(title, complete, labels);
            const text = includeFullData ? journalText(title, complete, labels) : summary;
            if (mode === 'print') {
                popup.document.open(); popup.document.write(journalPrintHtml(title, text)); popup.document.close();
                popup.focus(); popup.print();
            } else {
                let message = text;
                if (encodeURIComponent(text).length > 6000) {
                    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
                    const link = document.createElement('a'); link.href = url; link.download = 'historico-mercado-do-vale.txt'; link.click();
                    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
                    message = encodeURIComponent(summary).length <= 5500 ? `${summary}\n\nSegue arquivo do histórico em anexo.` : `Mercado do Vale — ${title}\nHistórico: ${complete.length} registros. Segue arquivo do histórico em anexo.`;
                    setNotice('O histórico completo foi baixado. Anexe o arquivo historico-mercado-do-vale.txt na conversa do WhatsApp antes de enviar.');
                }
                popup.location.replace(`https://wa.me/?text=${encodeURIComponent(message)}`);
            }
        } catch (err) {
            popup.close();
            if (ticket === request.current) setError(err instanceof Error ? err.message : 'Não foi possível exportar o histórico completo.');
        } finally { setExporting(false); }
    }
    async function load(cursor?: string) {
        const ticket = ++request.current;
        setLoading(true); setError('');
        try {
            const data = await read(cursor);
            if (ticket !== request.current) return;
            setEvents(previous => cursor ? [...previous, ...data.events] : data.events);
            setNext(data.next);
        } catch (err) {
            if (ticket === request.current) setError(err instanceof Error ? err.message : 'Não foi possível carregar o diário.');
        } finally { if (ticket === request.current) setLoading(false); }
    }
    useEffect(() => {
        setEvents([]); setNext(null);
        if (target) void load();
        return () => { request.current++; };
    }, [target, unitId, productId, productIdsKey]);
    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-5"><h2 className="flex items-center gap-2 font-semibold"><History className="h-5 w-5" />{title}</h2><button type="button" onClick={onClose} aria-label="Fechar diário"><X className="h-5 w-5" /></button></div>
            <div className="overflow-auto p-5 space-y-4">
                <p className="text-sm text-slate-600">Registros permanentes de cadastro, alterações e saídas. Uma correção gera um novo registro; os anteriores são preservados.</p>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void exportHistory('print')} disabled={loading || exporting || !events.length} className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm disabled:opacity-50"><Printer className="h-4 w-4" />Imprimir histórico</button>
                    <button type="button" onClick={() => void exportHistory('whatsapp')} disabled={loading || exporting || !events.length} className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm text-white disabled:opacity-50"><MessageCircle className="h-4 w-4" />Compartilhar via WhatsApp</button>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={includeFullData} onChange={e => setIncludeFullData(e.target.checked)} disabled={exporting} />Incluir dados completos na impressão e no compartilhamento</label>
                {exporting && <p role="status" className="text-sm">Preparando todos os registros do histórico…</p>}
                {notice && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{notice}</p>}
                {!unitId && !productId && <form onSubmit={e => { e.preventDefault(); setTarget(identifier.trim()); }} className="flex gap-2">
                    <input value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="IMEI 1, IMEI 2 ou serial completo" aria-label="Identificador do aparelho" required maxLength={100} className="min-w-0 flex-1 rounded-xl border p-2" />
                    <button aria-label="Consultar diário" className="rounded-xl bg-blue-600 px-4 text-white" disabled={loading || exporting}><Search className="h-4 w-4" /></button>
                </form>}
                {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                {!loading && !error && target && events.length === 0 && <p className="text-sm text-slate-500">Nenhum registro encontrado neste diário.</p>}
                {events.length > 0 && <section aria-label="Extrato resumido" className="rounded-xl border border-slate-200">
                    <div className="border-b bg-slate-50 p-3"><h3 className="font-semibold">Extrato resumido</h3><p className="mt-1 text-xs text-slate-500">{events.length} registros exibidos{next ? ' · Há registros anteriores para carregar' : ''} · Horário de São Paulo</p><div className="mt-2 flex flex-wrap gap-3 text-xs"><span className="font-medium text-emerald-700">↓ Entrada</span><span className="font-medium text-red-700">↑ Saída</span><span className="text-slate-500">Registro inicial / alteração</span></div></div>
                    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Data</th><th className="p-3">Aparelho</th><th className="p-3">Ocorrência</th><th className="p-3">Situação</th></tr></thead><tbody>{events.map(event => {
                        const row = journalSummary(event, labels);
                        const tone = row.direction === 'in' ? 'bg-emerald-50/70' : row.direction === 'out' ? 'bg-red-50/70' : '';
                        return <tr key={row.id} data-direction={row.direction} className={`border-t align-top ${tone}`}><td className="whitespace-nowrap p-3 text-xs">{row.date}</td><td className="p-3 text-xs">{row.device}</td><td className="min-w-56 p-3">{row.direction !== 'neutral' && <span className={`mb-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${row.direction === 'in' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{row.direction === 'in' ? '↓ Entrada' : '↑ Saída'}</span>}<div>{row.description}</div></td><td className="p-3">{row.status}</td></tr>;
                    })}</tbody></table></div>
                    <p className="border-t p-3 text-xs text-slate-500">Saldo por local é contexto do produto; não comprova movimentação física deste aparelho. Os dados completos estão abaixo.</p>
                </section>}
                {events.map(event => <article key={event.id} className="rounded-xl border border-slate-200 p-4 space-y-2">
                    <h3 className="font-semibold">{labels[event.event_type] || event.event_type}</h3>
                    {productId && <p className="text-xs text-slate-500">Unidade: {event.unit_id}</p>}
                    <p className="text-xs text-slate-500">Registrado em {date(event.recorded_at)}</p>
                    {event.event_type === 'baseline' && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Estado encontrado na implantação do diário. A data de cadastro está nos dados preservados. Alterações e saídas anteriores não podem ser reconstruídas sem evidência.</p>}
                    {event.event_type === 'existing_sale_reference' && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">Referência encontrada nos registros existentes. A data da venda está nos dados preservados; este registro foi incluído no diário na data acima.</p>}
                    <p className="text-xs text-slate-500">Origem: banco de dados. Conta técnica: {event.db_actor}. O responsável comercial, quando registrado, aparece nos dados da venda ou movimentação.</p>
                    <div className="grid gap-3 md:grid-cols-2">{event.before_data && <details className="rounded-lg bg-slate-50 p-3"><summary className="cursor-pointer text-sm font-medium">Dados anteriores</summary><div className="mt-3 text-xs"><DataView value={event.before_data} /></div></details>}
                    {event.after_data && <details className="rounded-lg bg-slate-50 p-3"><summary className="cursor-pointer text-sm font-medium">Dados completos registrados</summary><div className="mt-3 text-xs"><DataView value={event.after_data} /></div></details>}</div>
                </article>)}
                {loading && <div role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Carregando diário…</div>}
                {next && <button onClick={() => void load(next)} disabled={loading || exporting} className="rounded-xl border px-4 py-2 text-sm">Carregar registros anteriores</button>}
            </div>
        </div>
    </div>;
}
