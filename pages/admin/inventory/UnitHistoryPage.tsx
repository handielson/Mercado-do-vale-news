import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    ArrowDownToLine, Ban, Camera, History, Loader2, MapPin, PackageCheck, PackageOpen, Pencil, RotateCcw,
    Search, ShieldCheck, ShoppingBag, Smartphone, Tag, Undo2, Wrench, EyeOff, Eye, Trash2, ArrowRightLeft, AlertTriangle,
} from 'lucide-react';
import { getStockMismatches, type StockMismatch } from '@/services/unitLocationService';
import { UnitJournalModal } from '@/components/inventory/UnitJournalModal';
import {
    getUnitTimeline, isTimelineMatches,
    type UnitTimelineEvent, type UnitTimelineEventType, type UnitTimelineMatches, type UnitTimelineResponse,
} from '@/services/unitTimelineService';

const brl = (cents: number | null | undefined) =>
    cents == null ? '—' : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const when = (value: string | null) =>
    value ? new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : '';

const STATUS_LABEL: Record<string, string> = {
    available: 'Disponível', reserved: 'Reservado', sold: 'Vendido', rma: 'RMA', hidden: 'Oculto', scrapped: 'Descartado',
};
const STATUS_STYLE: Record<string, string> = {
    available: 'bg-emerald-100 text-emerald-800', reserved: 'bg-amber-100 text-amber-800', sold: 'bg-blue-100 text-blue-800',
    rma: 'bg-orange-100 text-orange-800', hidden: 'bg-slate-200 text-slate-700', scrapped: 'bg-red-100 text-red-800',
};
const EVENT_ICON: Record<UnitTimelineEventType, ReactNode> = {
    entry: <ArrowDownToLine className="h-4 w-4" />, legacy_entry: <History className="h-4 w-4" />, legacy_sale: <ShoppingBag className="h-4 w-4" />,
    data_corrected: <Pencil className="h-4 w-4" />, reserved: <Tag className="h-4 w-4" />, reservation_released: <PackageOpen className="h-4 w-4" />,
    sold: <ShoppingBag className="h-4 w-4" />, sale_cancelled: <Ban className="h-4 w-4" />, sale_refunded: <Undo2 className="h-4 w-4" />,
    returned_to_stock: <RotateCcw className="h-4 w-4" />, warranty_issued: <ShieldCheck className="h-4 w-4" />, warranty_signed: <ShieldCheck className="h-4 w-4" />,
    rma: <Wrench className="h-4 w-4" />, hidden: <EyeOff className="h-4 w-4" />, unhidden: <Eye className="h-4 w-4" />, scrapped: <Trash2 className="h-4 w-4" />,
    transfer: <ArrowRightLeft className="h-4 w-4" />, location_set: <MapPin className="h-4 w-4" />, returned_to_incoming: <RotateCcw className="h-4 w-4" />,
};

function Mismatches() {
    const [rows, setRows] = useState<StockMismatch[] | null>(null);
    useEffect(() => { getStockMismatches().then(setRows).catch(() => setRows(null)); }, []);
    if (!rows?.length) return null;
    return <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <h2 className="mb-1 flex items-center gap-2 font-semibold text-amber-900"><AlertTriangle className="h-4 w-4" />Produtos com saldo sem IMEI</h2>
        <p className="mb-3 text-sm text-amber-900">O saldo desses produtos é diferente da quantidade de aparelhos cadastrados. Cadastre os IMEIs que faltam ou corrija o saldo.</p>
        <ul className="divide-y divide-amber-200 text-sm">{rows.map(r => <li key={r.productId} className="flex justify-between gap-3 py-2">
            <Link to={`/admin/products/${r.productId}`} className="text-amber-950 underline">{r.name}{r.sku ? ` · ${r.sku}` : ''}</Link>
            <span className="whitespace-nowrap text-amber-900">{r.units} IMEI · saldo {r.balance}</span>
        </li>)}</ul>
    </section>;
}

function SearchBox({ initial }: { initial: string }) {
    const navigate = useNavigate();
    const [value, setValue] = useState(initial);
    useEffect(() => setValue(initial), [initial]);
    const submit = (e: FormEvent) => {
        e.preventDefault();
        const clean = value.trim();
        if (clean) navigate(`/admin/aparelhos/${encodeURIComponent(clean)}`);
    };
    return <form onSubmit={submit} className="flex gap-2">
        <input value={value} onChange={e => setValue(e.target.value)} placeholder="IMEI 1, IMEI 2 ou serial" aria-label="IMEI 1, IMEI 2 ou serial"
            maxLength={100} inputMode="text" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2" />
        <button className="rounded-xl bg-blue-600 px-4 text-white" aria-label="Buscar aparelho"><Search className="h-4 w-4" /></button>
    </form>;
}

function Field({ label, value }: { label: string; value: ReactNode }) {
    return <div><dt className="text-xs text-slate-500">{label}</dt><dd className="break-all font-medium text-slate-800">{value || '—'}</dd></div>;
}

function EventItem({ event }: { event: UnitTimelineEvent }) {
    return <li className="relative pl-10">
        <span className="absolute left-0 top-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600">{EVENT_ICON[event.type] || <History className="h-4 w-4" />}</span>
        <p className="text-xs text-slate-500">{when(event.at)}</p>
        <p className="font-medium text-slate-900">{event.title}</p>
        {event.detail && <p className="text-sm text-slate-600">{event.detail}</p>}
        {event.actor && <p className="text-xs text-slate-500">Por {event.actor}</p>}
        <div className="mt-1 flex flex-wrap gap-3 text-sm">
            {event.saleId && <Link className="text-blue-700 underline" to={`/admin/sales?sale=${encodeURIComponent(event.saleId)}`}>Abrir venda</Link>}
            {event.intakeId && <span className="inline-flex items-center gap-1 text-slate-500"><Camera className="h-3.5 w-3.5" />Entrada por foto</span>}
        </div>
    </li>;
}

function Matches({ data }: { data: UnitTimelineMatches }) {
    return <section className="rounded-2xl border bg-white p-4">
        <h2 className="mb-3 font-semibold">Mais de um aparelho com esse número. Escolha:</h2>
        <ul className="divide-y">{data.matches.map(m => <li key={m.id}>
            <Link to={`/admin/aparelhos/${m.id}`} className="block py-3 hover:bg-slate-50">
                <p className="font-medium">{m.productName || 'Produto não encontrado'}</p>
                <p className="text-sm text-slate-600">IMEI 1: {m.imei1 || '—'} · IMEI 2: {m.imei2 || '—'} · Serial: {m.serial || '—'} · {STATUS_LABEL[m.status] || m.status}</p>
            </Link>
        </li>)}</ul>
    </section>;
}

function Summary({ data, onTechnical }: { data: UnitTimelineResponse; onTechnical: () => void }) {
    const { unit, product, current } = data;
    const where = current.deposit
        ? [current.deposit.name, current.location?.name].filter(Boolean).join(' / ')
        : 'Local não registrado';
    return <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex gap-3">
            {product?.image_url
                ? <img src={product.image_url} alt="" className="h-16 w-16 rounded-xl object-contain" />
                : <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100"><Smartphone className="h-7 w-7 text-slate-400" /></span>}
            <div className="min-w-0 flex-1">
                <h1 className="font-semibold leading-tight text-slate-900">{product?.name || 'Produto não encontrado'}</h1>
                <p className="text-sm text-slate-500">{product?.sku}</p>
                <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[current.status] || 'bg-slate-100 text-slate-700'}`}>{current.statusLabel}</span>
            </div>
        </div>
        {unit.deleted && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">
            O cadastro deste aparelho foi apagado. Os dados abaixo são o último registro guardado no diário.
        </p>}
        {current.sale && <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
            Vendido para <strong>{current.sale.customerName}</strong> na venda #{current.sale.code} · <Link className="underline" to={`/admin/sales?sale=${encodeURIComponent(current.sale.id)}`}>Abrir venda</Link>
        </p>}
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Field label="IMEI 1" value={unit.imei_1 || unit.imei} />
            <Field label="IMEI 2" value={unit.imei_2} />
            <Field label="Serial" value={unit.serial} />
            <Field label="Onde está" value={<span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{where}</span>} />
            <Field label="Condição" value={unit.condition === 'new' ? 'Novo' : unit.condition === 'used' ? 'Usado' : unit.condition} />
            <Field label="Custo" value={brl(current.costCents)} />
            <Field label="Preço" value={brl(current.priceCents)} />
            <Field label="Dias em estoque" value={current.daysInStock == null ? '—' : String(current.daysInStock)} />
            <Field label="Vendido / devolvido" value={`${current.timesSold}× / ${current.timesReturned}×`} />
        </dl>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {product && <Link to={`/admin/products/${product.id}`} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5"><PackageCheck className="h-4 w-4" />Abrir produto</Link>}
            <button type="button" onClick={onTechnical} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5"><History className="h-4 w-4" />Ver dados técnicos</button>
        </div>
    </section>;
}

export default function UnitHistoryPage() {
    const { identifier = '' } = useParams();
    const [data, setData] = useState<UnitTimelineResponse | UnitTimelineMatches | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [technical, setTechnical] = useState(false);

    useEffect(() => {
        let alive = true;
        setData(null); setError(''); setTechnical(false);
        if (!identifier) return;
        setLoading(true);
        getUnitTimeline(identifier)
            .then(result => { if (alive) setData(result); })
            .catch(err => {
                if (!alive) return;
                const message = err instanceof Error ? err.message : String(err);
                setError(/^\[VPS\] 404\b/.test(message) ? 'Nenhum aparelho com esse IMEI ou serial.'
                    : /^\[VPS\] 40[13]\b/.test(message) ? 'Sua sessão expirou. Entre de novo.'
                    : 'Não foi possível carregar o histórico do aparelho.');
            })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [identifier]);

    const timeline = data && !isTimelineMatches(data) ? data : null;
    return <div className="mx-auto max-w-3xl space-y-4 p-4">
        <div className="flex items-center gap-2"><Smartphone className="h-5 w-5 text-slate-600" /><h1 className="text-lg font-semibold">Aparelhos</h1></div>
        <SearchBox initial={identifier} />
        <Link to="/admin/aparelhos/transferir" className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm"><ArrowRightLeft className="h-4 w-4" />Transferir aparelhos</Link>
        {!identifier && <Mismatches />}
        {!identifier && <p className="text-sm text-slate-500">Bipe ou digite o IMEI ou serial para ver a vida do aparelho: entrada, vendas, devoluções e onde está agora.</p>}
        {loading && <p className="flex items-center gap-2 text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</p>}
        {error && <p className="rounded-xl bg-amber-50 p-3 text-amber-900">{error}</p>}
        {data && isTimelineMatches(data) && <Matches data={data} />}
        {timeline && <>
            <Summary data={timeline} onTechnical={() => setTechnical(true)} />
            <section className="rounded-2xl border bg-white p-4">
                <h2 className="mb-4 font-semibold">Linha do tempo</h2>
                {timeline.events.length === 0
                    ? <p className="text-sm text-slate-500">Nenhum registro encontrado para este aparelho.</p>
                    : <ol className="space-y-5 border-l border-slate-200 pl-0 [&>li]:ml-[-14px]">{timeline.events.map(e => <EventItem key={e.key} event={e} />)}</ol>}
            </section>
            {technical && <UnitJournalModal unitId={timeline.unit.id} onClose={() => setTechnical(false)} />}
        </>}
    </div>;
}
