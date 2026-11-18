import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileUp, Loader2, MessageCircle, Printer, RotateCcw, X } from 'lucide-react';
import { companySettingsService } from '@/services/companySettingsService';
import { resolveRefundCashSessionId } from '@/services/saleService';
import {
    REFUND_METHOD_LABELS, createSaleReturn, getSaleReturns, openReturnFile, previewSaleReturn, sendReturnReceiptWhatsApp, uploadReturnFile,
    type ReturnableItem, type SaleReturnPreview, type SaleReturnRecord,
} from '@/services/saleReturnService';
import { buildReturnReceiptPdf } from '@/utils/saleReturnReceiptPdf';

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const toCents = (text: string) => Math.round(Number(String(text).replace(/\./g, '').replace(',', '.')) * 100);
const apiError = (err: unknown) => {
    const text = err instanceof Error ? err.message : String(err);
    const detail = text.split(' — ').slice(1).join(' — ');
    try { return JSON.parse(detail).error || detail || text; } catch { return detail || text; }
};
const OTHER_METHODS = ['money', 'pix', 'transfer', 'card', 'other'];
const NEEDS_PROOF = new Set(['pix', 'transfer', 'card', 'credit', 'debit']);

type SaleLike = {
    id: string; created_at?: string; customer?: { name?: string; cpf_cnpj?: string | null } | null;
    items: Array<{ id: string; product_name: string; quantity: number; total: number; product_id?: string | null; combo_selections?: unknown; comboSelections?: unknown }>;
};

export function SaleReturnModal({ sale, existing, onClose, onDone }: { sale: SaleLike; existing?: SaleReturnRecord | null; onClose: () => void; onDone: () => void }) {
    const [returnable, setReturnable] = useState<ReturnableItem[]>([]);
    const [qty, setQty] = useState<Record<string, number>>({});
    const [reason, setReason] = useState('');
    const [mode, setMode] = useState<'same' | 'other'>('same');
    const [amountText, setAmountText] = useState('');
    const [otherRows, setOtherRows] = useState<Array<{ method: string; amount: string }>>([{ method: 'money', amount: '' }]);
    const [preview, setPreview] = useState<SaleReturnPreview | null>(null);
    const [result, setResult] = useState<SaleReturnRecord | null>(existing || null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    // Uma chave por abertura do modal: repetir o envio (rede, duas abas) não cria outra devolução.
    const [requestId] = useState(() => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`));

    useEffect(() => {
        if (existing) return;
        getSaleReturns(sale.id).then(data => setReturnable(data.returnable)).catch(err => setError(apiError(err)));
    }, [sale.id, existing]);

    const chosen = useMemo(() => returnable.filter(r => (qty[r.saleItemId] || 0) > 0).map(r => ({ sale_item_id: r.saleItemId, quantity: qty[r.saleItemId] })), [returnable, qty]);
    const request = async () => ({
        items: chosen, reason: reason.trim(), refund_mode: mode,
        amount_cents: amountText ? toCents(amountText) : undefined,
        refunds: mode === 'other' ? otherRows.filter(r => r.amount).map(r => ({ method: r.method, amount_cents: toCents(r.amount) })) : undefined,
        cash_session_id: await resolveRefundCashSessionId(),
        client_request_id: requestId,
    });

    // Prévia: o servidor calcula valor e divisão sem gravar nada.
    useEffect(() => {
        setPreview(null);
        if (!chosen.length || existing) return;
        let alive = true;
        const timer = window.setTimeout(async () => {
            try {
                const body = await request();
                const data = await previewSaleReturn(sale.id, { ...body, reason: body.reason || 'prévia' });
                if (alive) { setPreview(data); setError(''); }
            } catch (err) { if (alive) setError(apiError(err)); }
        }, 300);
        return () => { alive = false; window.clearTimeout(timer); };
    }, [JSON.stringify(chosen), mode, amountText, JSON.stringify(otherRows)]);

    const confirm = async () => {
        if (!reason.trim()) { setError('Informe o motivo da devolução.'); return; }
        setBusy(true); setError('');
        try {
            const combos = new Map(sale.items.filter(i => i.product_id).map(i => [String(i.product_id), i.combo_selections || i.comboSelections || null]));
            const created = await createSaleReturn(sale.id, await request(), combos);
            if (created.replay) { onDone(); onClose(); return; }
            setResult(created); onDone();
            if (created.warnings?.length) setError(created.warnings.join(' '));
        } catch (err) { setError(apiError(err)); } finally { setBusy(false); }
    };

    const receipt = async () => buildReturnReceiptPdf({ company: await companySettingsService.get().catch(() => ({})), sale, customer: sale.customer || null, ret: result! });
    const print = async () => { const { blob } = await receipt(); const url = URL.createObjectURL(blob); window.open(url, '_blank', 'noopener'); window.setTimeout(() => URL.revokeObjectURL(url), 60000); };
    const whatsapp = async () => {
        setBusy(true); setNotice(''); setError('');
        try { await sendReturnReceiptWhatsApp(result!.id, (await receipt()).blob); setNotice('Recibo enviado no WhatsApp da cliente.'); }
        catch (err) { setError(apiError(err)); } finally { setBusy(false); }
    };
    const upload = async (kind: 'proof' | 'signed', file: File | undefined, refundId?: string) => {
        if (!file || !result) return;
        setBusy(true); setNotice(''); setError('');
        try {
            const saved = await uploadReturnFile(result.id, { kind, refundId, file });
            const files = [...(result.files || []), { id: saved.id, kind, refund_id: refundId || null, file_name: file.name, mime: file.type, created_at: new Date().toISOString() }];
            setResult({ ...result, status: saved.status, files });
            setNotice(saved.status === 'finalizada' ? 'Devolução finalizada: recibo assinado e comprovantes no sistema.' : 'Arquivo salvo.');
            onDone();
        } catch (err) { setError(apiError(err)); } finally { setBusy(false); }
    };

    return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3" role="dialog" aria-modal="true" aria-label="Devolver itens">
        <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-4">
                <h2 className="flex items-center gap-2 font-semibold"><RotateCcw className="h-5 w-5" />{result ? `Devolução #${result.code}` : 'Devolver itens'}</h2>
                <button type="button" onClick={onClose} aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 overflow-y-auto p-4 text-sm">
                {error && <p className="rounded-xl bg-amber-50 p-3 text-amber-900">{error}</p>}
                {notice && <p className="rounded-xl bg-emerald-50 p-3 text-emerald-900">{notice}</p>}
                {!result && <>
                    <section className="space-y-2">
                        <h3 className="font-semibold">O que voltou</h3>
                        {returnable.map(r => <label key={r.saleItemId} className="flex items-center gap-3 rounded-xl border p-3">
                            <div className="min-w-0 flex-1">
                                <p className="font-medium">{r.name}</p>
                                <p className="text-xs text-slate-500">{r.imei ? `IMEI ${r.imei} · ` : ''}pago {brl(r.paidValueCents)} · vendido {r.quantity}{r.returnedQuantity ? ` · já devolvido ${r.returnedQuantity}` : ''}</p>
                            </div>
                            {r.returnableQuantity === 0 ? <span className="text-xs text-slate-500">Já devolvido</span>
                                : r.returnableQuantity === 1
                                    ? <input type="checkbox" checked={(qty[r.saleItemId] || 0) === 1} onChange={e => setQty({ ...qty, [r.saleItemId]: e.target.checked ? 1 : 0 })} aria-label={`Devolver ${r.name}`} className="h-5 w-5" />
                                    : <input type="number" min={0} max={r.returnableQuantity} value={qty[r.saleItemId] || 0} onChange={e => setQty({ ...qty, [r.saleItemId]: Math.max(0, Math.min(r.returnableQuantity, Number(e.target.value) || 0)) })} aria-label={`Quantidade de ${r.name}`} className="w-16 rounded-lg border px-2 py-1" />}
                        </label>)}
                    </section>
                    <label className="block"><span className="font-semibold">Motivo da devolução</span>
                        <input value={reason} onChange={e => setReason(e.target.value)} maxLength={300} placeholder="ex.: cliente desistiu" className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
                    <section className="space-y-2">
                        <h3 className="font-semibold">Estorno</h3>
                        <div className="flex gap-2">
                            {(['same', 'other'] as const).map(m => <button key={m} type="button" onClick={() => setMode(m)} className={`flex-1 rounded-xl border px-3 py-2 ${mode === m ? 'border-blue-600 bg-blue-50 font-semibold' : ''}`}>{m === 'same' ? 'Mesma forma em que entrou' : 'Outra forma'}</button>)}
                        </div>
                        <label className="block">Valor devolvido (R$) {preview && <span className="text-slate-500">— sugerido {brl(preview.suggested_cents)}</span>}
                            <input value={amountText} onChange={e => setAmountText(e.target.value)} inputMode="decimal" placeholder={preview ? (preview.suggested_cents / 100).toFixed(2).replace('.', ',') : ''} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
                        {mode === 'other' && <div className="space-y-2">{otherRows.map((row, i) => <div key={i} className="flex gap-2">
                            <select value={row.method} onChange={e => setOtherRows(otherRows.map((r, j) => (j === i ? { ...r, method: e.target.value } : r)))} className="rounded-xl border px-2 py-2">
                                {OTHER_METHODS.map(m => <option key={m} value={m}>{REFUND_METHOD_LABELS[m]}</option>)}
                            </select>
                            <input value={row.amount} onChange={e => setOtherRows(otherRows.map((r, j) => (j === i ? { ...r, amount: e.target.value } : r)))} inputMode="decimal" placeholder="Valor" className="min-w-0 flex-1 rounded-xl border px-3 py-2" />
                        </div>)}
                            <button type="button" onClick={() => setOtherRows([...otherRows, { method: 'pix', amount: '' }])} className="text-blue-700 underline">+ outra forma</button>
                        </div>}
                        {preview && <ul className="rounded-xl bg-slate-50 p-3">{preview.refunds.map((r, i) => <li key={i}>{REFUND_METHOD_LABELS[r.method] || r.method}: <strong>{brl(r.refund_cents)}</strong>{r.refund_cents !== r.goods_cents ? ` (inclui juros do cartão)` : ''}{r.method === 'pix' && r.gateway_payment_id ? ' · estorno automático no Mercado Pago' : ''}{NEEDS_PROOF.has(r.method) && !(r.method === 'pix' && r.gateway_payment_id) ? ' · precisa de comprovante' : ''}</li>)}</ul>}
                    </section>
                    <button type="button" onClick={confirm} disabled={busy || !chosen.length || !preview} className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white disabled:opacity-50">
                        {busy ? 'Registrando…' : `Confirmar devolução${preview ? ` de ${brl(preview.total_cents)}` : ''}`}
                    </button>
                    <p className="text-xs text-slate-500">Os itens voltam ao estoque na hora (aparelho vai para Depósito / Entrada / Conferencia). Cartão: faça o estorno na maquininha e suba o comprovante.</p>
                </>}
                {result && <>
                    <p className={`flex items-center gap-2 rounded-xl p-3 ${result.status === 'finalizada' ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
                        {result.status === 'finalizada' ? <CheckCircle2 className="h-4 w-4" /> : <Loader2 className="h-4 w-4" />}
                        {result.status === 'finalizada' ? 'Finalizada' : 'Pendente: falta o recibo assinado e/ou comprovante.'}
                    </p>
                    <p>Total devolvido: <strong>{brl(result.total_cents)}</strong> · {result.items.length} item(ns)</p>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={print} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2"><Printer className="h-4 w-4" />Imprimir recibo</button>
                        <button type="button" onClick={whatsapp} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2"><MessageCircle className="h-4 w-4" />Enviar no WhatsApp</button>
                    </div>
                    <section className="space-y-2">
                        <h3 className="font-semibold">Recibo assinado</h3>
                        {(result.files || []).filter(f => f.kind === 'signed').map(f => <button key={f.id} type="button" onClick={() => openReturnFile(result.id, f.id)} className="block text-blue-700 underline">{f.file_name}</button>)}
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2"><FileUp className="h-4 w-4" />Subir recibo assinado (foto ou PDF)
                            <input type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={e => upload('signed', e.target.files?.[0])} /></label>
                    </section>
                    {result.refunds.filter(r => NEEDS_PROOF.has(r.method) && !(r.method === 'pix' && r.gateway_refund_id)).map(r => <section key={r.id} className="space-y-2">
                        <h3 className="font-semibold">Comprovante · {REFUND_METHOD_LABELS[r.method] || r.method} {brl(r.refund_cents)}</h3>
                        {(result.files || []).filter(f => f.kind === 'proof' && f.refund_id === r.id).map(f => <button key={f.id} type="button" onClick={() => openReturnFile(result.id, f.id)} className="block text-blue-700 underline">{f.file_name}</button>)}
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2"><FileUp className="h-4 w-4" />Subir comprovante
                            <input type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={e => upload('proof', e.target.files?.[0], r.id)} /></label>
                    </section>)}
                </>}
            </div>
        </div>
    </div>;
}
