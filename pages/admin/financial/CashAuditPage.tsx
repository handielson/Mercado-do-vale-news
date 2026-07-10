import React from 'react';
import { ArrowLeft, FileText, RefreshCw, RotateCcw, Search, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { cashRegisterService, type CashSessionListFilters } from '../../../services/cashRegisterService';
import { cashReportPdfBase64, downloadCashReportPdf } from '../../../utils/cashReportPdf';
import { CASH_EVENT_LABELS, formatCashCents, type CashDocument, type CashReportSnapshot, type CashSessionDetail, type CashSessionListItem } from '../../../types/cashRegister';

function today(daysAgo = 0): string {
    const value = new Date();
    value.setDate(value.getDate() - daysAgo);
    return value.toISOString().slice(0, 10);
}

export default function CashAuditPage() {
    const [filters, setFilters] = React.useState<CashSessionListFilters>({ date_from: today(30), date_to: today(), limit: 100 });
    const [rows, setRows] = React.useState<CashSessionListItem[]>([]);
    const [selected, setSelected] = React.useState<CashSessionDetail | null>(null);
    const [loading, setLoading] = React.useState(false);

    const loadRows = React.useCallback(async () => {
        setLoading(true);
        try {
            const result = await cashRegisterService.listSessions(filters);
            setRows(result.rows || []);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Erro ao consultar auditoria');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    React.useEffect(() => { void loadRows(); }, []);

    const openDetail = async (id: string) => {
        setLoading(true);
        try { setSelected(await cashRegisterService.getSessionDetail(id, { includeSnapshot: true })); }
        catch (error) { toast.error(error instanceof Error ? error.message : 'Erro ao abrir caixa'); }
        finally { setLoading(false); }
    };

    const reopen = async () => {
        if (!selected) return;
        const reason = window.prompt('Motivo obrigatorio da reabertura:')?.trim();
        if (!reason) return;
        await cashRegisterService.reopenSession(selected.session.id, reason);
        toast.success('Caixa reaberto com auditoria registrada');
        setSelected(await cashRegisterService.getSessionDetail(selected.session.id, { includeSnapshot: true }));
        await loadRows();
    };

    const rectify = async () => {
        if (!selected) return;
        const reason = window.prompt('Motivo obrigatorio da retificacao:')?.trim();
        if (!reason) return;
        const raw = window.prompt('Novo valor contado em reais (deixe vazio para manter):')?.trim();
        const cents = raw ? Math.round(Number(raw.replace(/\./g, '').replace(',', '.')) * 100) : undefined;
        if (raw && (!Number.isFinite(cents) || Number(cents) < 0)) return toast.error('Valor invalido');
        const result = await cashRegisterService.rectifySession(selected.session.id, { reason, new_counted_cash_cents: cents });
        const refreshed = await cashRegisterService.getSessionDetail(selected.session.id, { includeSnapshot: true });
        const source = [...refreshed.closings].reverse().find((item) => item.id === result.rectification.closing_id && item.report_snapshot)?.report_snapshot;
        if (source) {
            const values = result.rectification.new_values || {};
            const rectifiedSnapshot: CashReportSnapshot = {
                ...source,
                generated_at: new Date().toISOString(),
                closing: {
                    ...source.closing,
                    counted_cash_cents: values.counted_cash_cents ?? source.closing.counted_cash_cents,
                    difference_cents: values.difference_cents ?? source.closing.difference_cents,
                    justification: values.justification !== undefined ? values.justification : source.closing.justification,
                },
            };
            try { await cashRegisterService.uploadDocument(result.document_id, cashReportPdfBase64(rectifiedSnapshot)); }
            catch { toast.error('Retificacao salva; o PDF ficou pendente para nova tentativa'); }
        }
        toast.success('Retificacao registrada sem alterar o fechamento original');
        setSelected(await cashRegisterService.getSessionDetail(selected.session.id, { includeSnapshot: true }));
        await loadRows();
    };

    const buildDocumentSnapshot = (detail: CashSessionDetail, document: CashDocument): CashReportSnapshot | null => {
        const closing = [...detail.closings].reverse().find((item) => item.id === document.closing_id && item.report_snapshot);
        if (!closing?.report_snapshot) return null;
        const rectification = document.rectification_id ? detail.rectifications.find((item) => item.id === document.rectification_id) : null;
        if (!rectification) return closing.report_snapshot;
        return {
            ...closing.report_snapshot,
            generated_at: rectification.created_at,
            closing: {
                ...closing.report_snapshot.closing,
                counted_cash_cents: rectification.new_values.counted_cash_cents ?? closing.report_snapshot.closing.counted_cash_cents,
                difference_cents: rectification.new_values.difference_cents ?? closing.report_snapshot.closing.difference_cents,
                justification: rectification.new_values.justification !== undefined ? rectification.new_values.justification : closing.report_snapshot.closing.justification,
            },
        };
    };

    const retryDocument = async (document: CashDocument) => {
        if (!selected) return;
        const snapshot = buildDocumentSnapshot(selected, document);
        if (!snapshot) return toast.error('Snapshot do fechamento indisponivel');
        await cashRegisterService.uploadDocument(document.id, cashReportPdfBase64(snapshot));
        toast.success('Relatorio arquivado');
        setSelected(await cashRegisterService.getSessionDetail(selected.session.id, { includeSnapshot: true }));
    };

    return (
        <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><Link to="/admin/caixa" className="rounded-lg border border-slate-300 p-2"><ArrowLeft size={18} /></Link><div><h1 className="text-2xl font-bold">Auditoria de Caixa</h1><p className="text-sm text-slate-500">Historico imutavel de aberturas, fechamentos e correcoes</p></div></div><ShieldCheck className="text-emerald-600" /></div>
            <section className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-6">
                <input type="date" value={filters.date_from || ''} onChange={(e) => setFilters((v) => ({ ...v, date_from: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input type="date" value={filters.date_to || ''} onChange={(e) => setFilters((v) => ({ ...v, date_to: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input placeholder="Numero do caixa" value={filters.session_number || ''} onChange={(e) => setFilters((v) => ({ ...v, session_number: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input placeholder="Operador" value={filters.operator || ''} onChange={(e) => setFilters((v) => ({ ...v, operator: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <select value={filters.status || ''} onChange={(e) => setFilters((v) => ({ ...v, status: e.target.value as CashSessionListFilters['status'] }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Todos</option><option value="open">Abertos</option><option value="closed">Fechados</option><option value="rectified">Retificados</option></select>
                <button type="button" onClick={loadRows} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white"><Search size={16} /> Filtrar</button>
            </section>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-200 px-4 py-3 font-bold">Caixas encontrados {loading && <RefreshCw className="ml-2 inline animate-spin" size={15} />}</div><div className="divide-y divide-slate-100">{rows.map((row) => <button type="button" key={row.id} onClick={() => openDetail(row.id)} className="grid w-full grid-cols-4 gap-2 px-4 py-3 text-left text-sm hover:bg-slate-50"><span className="font-bold">#{row.session_number}</span><span>{row.operator_name || row.operator_user_id}</span><span>{new Date(row.opened_at).toLocaleString('pt-BR')}</span><span className="text-right"><span className={`rounded-full px-2 py-1 text-xs font-bold ${row.rectification_count ? 'bg-amber-100 text-amber-800' : row.status === 'open' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{row.rectification_count ? 'RETIFICADO' : row.status === 'open' ? 'ABERTO' : 'FECHADO'}</span></span></button>)}{!rows.length && !loading && <div className="p-8 text-center text-sm text-slate-500">Nenhum caixa encontrado.</div>}</div></section>

                <section className="rounded-xl border border-slate-200 bg-white p-4">{!selected ? <div className="py-16 text-center text-sm text-slate-500">Selecione um caixa para ver a linha do tempo.</div> : <div className="space-y-5"><div className="flex items-start justify-between"><div><h2 className="text-lg font-bold">Caixa #{selected.session.session_number}</h2><p className="text-xs text-slate-500">{selected.session.operator_name || selected.session.operator_user_id}</p></div><div className="flex gap-2">{selected.session.status === 'closed' && <button type="button" onClick={reopen} title="Reabrir" className="rounded-lg border border-slate-300 p-2"><RotateCcw size={16} /></button>}<button type="button" onClick={rectify} title="Retificar" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold">Retificar</button></div></div>
                    <div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-lg bg-slate-50 p-3"><span className="text-xs text-slate-500">Total de entradas</span><div className="font-bold">{formatCashCents(selected.summary.total_in_cents)}</div></div><div className="rounded-lg bg-slate-50 p-3"><span className="text-xs text-slate-500">Dinheiro esperado</span><div className="font-bold">{formatCashCents(selected.summary.expected_cash_cents)}</div></div></div>
                    <div><h3 className="mb-2 text-sm font-bold">Documentos</h3><div className="space-y-2">{selected.documents.map((doc) => <div key={doc.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-xs"><FileText size={15} /><span className="min-w-0 flex-1 truncate">{doc.file_name}</span><span className={doc.status === 'uploaded' ? 'text-emerald-700' : 'text-amber-700'}>{doc.status}</span>{doc.status !== 'uploaded' && <button type="button" onClick={() => retryDocument(doc)} className="font-bold text-blue-700">Tentar novamente</button>}{doc.status === 'uploaded' && <button type="button" onClick={async () => { const result = await cashRegisterService.registerReprint(doc.id); const snapshot = buildDocumentSnapshot(selected, doc); if (snapshot) downloadCashReportPdf(snapshot, doc.file_name); else if (result.cdn_url) window.open(result.cdn_url, '_blank'); }} className="font-bold text-blue-700">Reimprimir</button>}</div>)}</div></div>
                    <div><h3 className="mb-2 text-sm font-bold">Linha do tempo</h3><div className="space-y-3 border-l-2 border-slate-200 pl-4">{selected.events.map((event) => <div key={event.id} className="relative"><span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-slate-500" /><div className="text-sm font-semibold">{CASH_EVENT_LABELS[event.event_type] || event.event_type}</div><div className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString('pt-BR')} · {event.auth_user_name || 'Sistema'}</div></div>)}</div></div>
                </div>}</section>
            </div>
        </div>
    );
}
