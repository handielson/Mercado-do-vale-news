import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, RotateCcw } from 'lucide-react';
import { REFUND_METHOD_LABELS, listPendingReturns, type SaleReturnRecord } from '@/services/saleReturnService';

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const when = (value: string) => new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

// Devoluções que ainda esperam recibo assinado ou comprovante de estorno.
export default function SaleReturnsPage() {
    const [rows, setRows] = useState<SaleReturnRecord[] | null>(null);
    const [error, setError] = useState('');
    useEffect(() => { listPendingReturns().then(setRows).catch(() => setError('Não foi possível carregar as devoluções.')); }, []);
    return <div className="mx-auto max-w-3xl space-y-4 p-4">
        <div className="flex items-center gap-2"><RotateCcw className="h-5 w-5 text-slate-600" /><h1 className="text-lg font-semibold">Devoluções pendentes</h1></div>
        <p className="text-sm text-slate-500">Falta o recibo assinado pela cliente e/ou o comprovante do estorno (Pix, transferência ou cartão). Abra a venda para completar.</p>
        {error && <p className="rounded-xl bg-amber-50 p-3 text-amber-900">{error}</p>}
        {!rows && !error && <p className="flex items-center gap-2 text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</p>}
        {rows?.length === 0 && <p className="rounded-xl bg-emerald-50 p-3 text-emerald-900">Nenhuma devolução pendente.</p>}
        {rows && rows.length > 0 && <ul className="divide-y rounded-2xl border bg-white">{rows.map(r => <li key={r.id} className="p-4">
            <div className="flex justify-between gap-3">
                <p className="font-medium">Devolução #{r.code} · {brl(r.total_cents)}</p>
                <Link to={`/admin/sales?sale=${encodeURIComponent(r.sale_id)}`} className="whitespace-nowrap text-blue-700 underline">Abrir venda</Link>
            </div>
            <p className="text-xs text-slate-500">{when(r.created_at)} · venda #{r.sale_id.slice(0, 8).toUpperCase()} · {r.reason}</p>
            <p className="mt-1 text-sm text-amber-800">
                Falta: {[r.missing_signed ? 'recibo assinado' : '', ...(r.missing_proofs || []).map(id => {
                    const refund = r.refunds.find(x => x.id === id);
                    return `comprovante ${REFUND_METHOD_LABELS[refund?.method || ''] || refund?.method || ''}`;
                })].filter(Boolean).join(', ')}
            </p>
        </li>)}</ul>}
    </div>;
}
