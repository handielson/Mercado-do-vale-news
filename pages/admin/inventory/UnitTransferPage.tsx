import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightLeft, Loader2, MapPin, ScanLine, Smartphone, X } from 'lucide-react';
import { stockLocationService } from '@/services/stockLocationService';
import { getUnitTimeline, isTimelineMatches } from '@/services/unitTimelineService';
import { transferUnits } from '@/services/unitLocationService';
import type { StockDeposit, StockLocation } from '@/types/stock-location';

type Row = { identifier: string; status: 'loading' | 'ok' | 'error'; product?: string; where?: string; message?: string };

const errorText = (err: unknown) => {
    const text = err instanceof Error ? err.message : String(err);
    const detail = text.split(' — ').slice(1).join(' — ');
    try { return JSON.parse(detail).error || detail || text; } catch { return detail || text; }
};

export default function UnitTransferPage() {
    const [deposits, setDeposits] = useState<StockDeposit[]>([]);
    const [locations, setLocations] = useState<StockLocation[]>([]);
    const [depositId, setDepositId] = useState('');
    const [locationId, setLocationId] = useState('');
    const [code, setCode] = useState('');
    const [rows, setRows] = useState<Row[]>([]);
    const [reason, setReason] = useState('');
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const input = useRef<HTMLInputElement>(null);

    useEffect(() => { stockLocationService.listDeposits().then(list => setDeposits(list.filter(d => (d as any).is_active !== false))).catch(() => setError('Não foi possível carregar os depósitos.')); }, []);
    useEffect(() => {
        setLocationId(''); setLocations([]);
        if (depositId) stockLocationService.listLocations(depositId).then(list => setLocations(list.filter(l => l.is_active !== false))).catch(() => setError('Não foi possível carregar os locais.'));
    }, [depositId]);

    const add = async (e: FormEvent) => {
        e.preventDefault();
        const identifier = code.trim();
        setCode(''); setNotice(''); setError('');
        input.current?.focus();
        if (!identifier) return;
        if (rows.some(r => r.identifier === identifier)) { setNotice(`${identifier} já está na lista.`); return; }
        setRows(list => [...list, { identifier, status: 'loading' }]);
        try {
            const data = await getUnitTimeline(identifier);
            const row: Row = isTimelineMatches(data)
                ? { identifier, status: 'error', message: 'Mais de um aparelho com esse número. Use o outro IMEI ou o serial.' }
                : {
                    identifier, status: 'ok', product: data.product?.name || 'Produto não encontrado',
                    where: data.current.deposit ? [data.current.deposit.name, data.current.location?.name].filter(Boolean).join(' / ') : 'Local não registrado',
                    message: ['available', 'reserved'].includes(data.current.status) ? undefined : `Está ${data.current.statusLabel.toLowerCase()} e não pode ser transferido.`,
                };
            setRows(list => list.map(r => (r.identifier === identifier ? row : r)));
        } catch (err) {
            const message = /\b404\b/.test(String(err)) ? 'IMEI ou serial não encontrado.' : 'Não foi possível consultar este aparelho.';
            setRows(list => list.map(r => (r.identifier === identifier ? { identifier, status: 'error', message } : r)));
        }
    };

    const ready = rows.filter(r => r.status === 'ok' && !r.message);
    const submit = async () => {
        if (!depositId || !locationId || !ready.length) return;
        setSaving(true); setError(''); setNotice('');
        try {
            const result = await transferUnits({ identifiers: ready.map(r => r.identifier), toDepositId: depositId, toLocationId: locationId, reason });
            const dest = [deposits.find(d => d.id === depositId)?.name, locations.find(l => l.id === locationId)?.name].filter(Boolean).join(' / ');
            const skipped = result.skipped || [];
            const skippedText = skipped.length ? ` ${skipped.length} já estava(m) nesse local: ${skipped.map(s => s.identifier).join(', ')}.` : '';
            setNotice(`${result.moved.length} aparelho(s) transferido(s) para ${dest}.${skippedText}`);
            setRows(list => list.filter(r => !ready.includes(r)));
        } catch (err) {
            setError(errorText(err));
        } finally { setSaving(false); }
    };

    return <div className="mx-auto max-w-3xl space-y-4 p-4">
        <div className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5 text-slate-600" /><h1 className="text-lg font-semibold">Transferir aparelhos</h1></div>
        <section className="space-y-3 rounded-2xl border bg-white p-4">
            <h2 className="font-semibold">Para onde vão</h2>
            <div className="grid gap-2 sm:grid-cols-2">
                <select value={depositId} onChange={e => setDepositId(e.target.value)} aria-label="Depósito de destino" className="rounded-xl border border-slate-300 px-3 py-2">
                    <option value="">Depósito</option>
                    {deposits.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <select value={locationId} onChange={e => setLocationId(e.target.value)} disabled={!depositId} aria-label="Local de destino" className="rounded-xl border border-slate-300 px-3 py-2">
                    <option value="">Local</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
            </div>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Motivo (opcional), ex.: vitrine" aria-label="Motivo" maxLength={200} className="w-full rounded-xl border border-slate-300 px-3 py-2" />
        </section>
        <section className="space-y-3 rounded-2xl border bg-white p-4">
            <form onSubmit={add} className="flex gap-2">
                <input ref={input} value={code} onChange={e => setCode(e.target.value)} autoFocus placeholder="Bipe ou digite o IMEI ou serial" aria-label="Bipe ou digite o IMEI ou serial" maxLength={100} className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2" />
                <button className="rounded-xl bg-blue-600 px-4 text-white" aria-label="Adicionar aparelho"><ScanLine className="h-4 w-4" /></button>
            </form>
            {notice && <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">{notice}</p>}
            {error && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
            {rows.length === 0
                ? <p className="text-sm text-slate-500">Nenhum aparelho na lista ainda.</p>
                : <ul className="divide-y">{rows.map(r => <li key={r.identifier} className="flex items-start gap-3 py-3">
                    <Smartphone className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div className="min-w-0 flex-1">
                        <Link to={`/admin/aparelhos/${encodeURIComponent(r.identifier)}`} className="font-mono text-sm text-blue-700 underline">{r.identifier}</Link>
                        {r.status === 'loading' && <p className="flex items-center gap-1 text-sm text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Consultando…</p>}
                        {r.product && <p className="text-sm text-slate-800">{r.product}</p>}
                        {r.where && <p className="flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3 w-3" />Agora: {r.where}</p>}
                        {r.message && <p className="text-sm text-red-700">{r.message}</p>}
                    </div>
                    <button type="button" onClick={() => setRows(list => list.filter(x => x !== r))} aria-label={`Tirar ${r.identifier} da lista`} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
                </li>)}</ul>}
            <button type="button" onClick={submit} disabled={saving || !depositId || !locationId || !ready.length}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-50">
                {saving ? 'Transferindo…' : `Transferir ${ready.length} aparelho${ready.length === 1 ? '' : 's'}`}
            </button>
        </section>
    </div>;
}
