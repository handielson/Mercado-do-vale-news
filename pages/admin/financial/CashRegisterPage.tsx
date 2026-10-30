import React from 'react';
import { ArrowDownToLine, ArrowUpFromLine, History, Lock, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import CashClosingWizard from '../../../components/pdv/CashClosingWizard';
import CashOpeningModal from '../../../components/pdv/CashOpeningModal';
import { useCashSession } from '../../../hooks/useCashSession';
import { cashRegisterService } from '../../../services/cashRegisterService';
import { CASH_METHOD_LABELS, createEmptyCashSessionSummary, formatCashCents } from '../../../types/cashRegister';

type MovementType = 'sangria' | 'suprimento';
type SangriaDestination = 'Outro caixa' | 'Depósito em banco' | 'Outro destino';

export default function CashRegisterPage() {
    const { session, summary, isLoading, error, refresh } = useCashSession();
    const [showOpening, setShowOpening] = React.useState(false);
    const [showClosing, setShowClosing] = React.useState(false);
    const [movementType, setMovementType] = React.useState<MovementType>('sangria');
    const [movementValue, setMovementValue] = React.useState('');
    const [movementDescription, setMovementDescription] = React.useState('');
    const [sangriaDestination, setSangriaDestination] = React.useState<SangriaDestination>('Outro caixa');
    const [savingMovement, setSavingMovement] = React.useState(false);
    const summaryForSession = React.useMemo(
        () => (session ? summary || createEmptyCashSessionSummary(session) : null),
        [session, summary]
    );

    const submitMovement = async () => {
        if (!session) return;
        if (session.requires_closing) return toast.error('Feche o caixa anterior antes de registrar movimentos.');
        const amount = Math.round(Number(movementValue.replace(/\./g, '').replace(',', '.')) * 100);
        if (!Number.isFinite(amount) || amount <= 0) return toast.error('Informe um valor valido');
        if (!movementDescription.trim()) return toast.error(movementType === 'sangria' ? 'Identifique o destino da sangria' : 'Informe o motivo do suprimento');
        const description = movementType === 'sangria'
            ? `Destino: ${sangriaDestination}. ${movementDescription.trim()}`
            : movementDescription.trim();
        if (movementType === 'sangria' && !window.confirm(`Registrar sangria de ${formatCashCents(amount)} para ${sangriaDestination}?`)) return;
        setSavingMovement(true);
        try {
            await cashRegisterService.createMovement(session.id, { type: movementType, amount_cents: amount, description });
            setMovementValue('');
            setMovementDescription('');
            await refresh();
            toast.success(movementType === 'sangria' ? 'Sangria registrada na auditoria do caixa' : 'Suprimento registrado');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Erro ao registrar movimento');
        } finally {
            setSavingMovement(false);
        }
    };

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h1 className="text-2xl font-bold text-slate-900">Caixa</h1><p className="text-sm text-slate-500">Abertura, movimentos e fechamento do caixa PDV</p></div>
                <div className="flex gap-2">
                    <button type="button" onClick={() => refresh()} className="rounded-lg border border-slate-300 p-2 text-slate-600" title="Atualizar"><RefreshCw size={18} /></button>
                    {session && !session.requires_closing && <button type="button" onClick={() => { setMovementType('sangria'); document.getElementById('registrar-sangria')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-bold text-white"><ArrowUpFromLine size={17} /> Registrar sangria</button>}
                    <Link to="/admin/caixa/auditoria" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"><History size={17} /> Auditoria</Link>
                </div>
            </div>

            {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
            {isLoading ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Consultando caixa...</div> : !session ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                    <Lock size={42} className="mx-auto text-slate-400" /><h2 className="mt-3 text-lg font-bold">Nenhum caixa aberto</h2><p className="mt-1 text-sm text-slate-500">Abra o caixa para liberar novas vendas no PDV.</p>
                    <button type="button" onClick={() => setShowOpening(true)} className="mt-5 rounded-lg bg-emerald-600 px-5 py-2.5 font-bold text-white">Abrir caixa</button>
                </div>
            ) : (
                <>
                    {session.requires_closing && (
                        <div role="alert" className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5 text-amber-950">
                            <strong>Caixa #{session.session_number} bloqueado desde as 20h.</strong>
                            <p className="mt-1 text-sm">Confira e feche este caixa. A nova abertura ficará disponível a partir de 00h.</p>
                            <button type="button" onClick={() => setShowClosing(true)} className="mt-3 rounded-lg bg-rose-600 px-4 py-2 font-bold text-white">Fazer fechamento</button>
                        </div>
                    )}
                    <div className="grid gap-4 lg:grid-cols-3">
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5"><div className="text-sm text-emerald-700">Caixa aberto</div><div className="text-2xl font-bold text-emerald-900">#{session.session_number}</div><div className="mt-2 text-xs text-emerald-700">{session.operator_name || 'Operador'} · {new Date(session.opened_at).toLocaleString('pt-BR')}</div></div>
                        <div className="rounded-xl border border-slate-200 bg-white p-5"><div className="text-sm text-slate-500">Dinheiro esperado</div><div className="text-2xl font-bold text-slate-900">{formatCashCents(summaryForSession?.expected_cash_cents)}</div><div className="mt-2 text-xs text-slate-500">Abertura: {formatCashCents(session.opening_amount_cents)}</div></div>
                        <div className="rounded-xl border border-slate-200 bg-white p-5"><div className="text-sm text-slate-500">Entradas registradas</div><div className="text-2xl font-bold text-slate-900">{formatCashCents(summaryForSession?.total_in_cents)}</div><div className="mt-2 text-xs text-slate-500">{summaryForSession?.counts.sales || 0} venda(s) · {summaryForSession?.counts.pix_avulso || 0} Pix avulso(s)</div></div>
                    </div>

                    <div className="grid gap-5 lg:grid-cols-2">
                        <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-bold text-slate-900">Resumo por forma</h2><div className="mt-3 space-y-2">{Object.entries(summaryForSession?.by_method || {}).map(([method, amount]) => <div key={method} className="flex justify-between border-b border-slate-100 py-2 text-sm"><span>{CASH_METHOD_LABELS[method] || method}</span><strong>{formatCashCents(amount)}</strong></div>)}</div></section>
                        {!session.requires_closing && <section id="registrar-sangria" className="rounded-xl border border-rose-200 bg-white p-5"><h2 className="font-bold text-slate-900">Sangria do caixa</h2><p className="mt-1 text-xs text-slate-500">Use sangria para tirar dinheiro deste caixa, inclusive para levar a outro caixa ou depositar no banco. O valor reduz o dinheiro esperado e fica na Auditoria de Caixa. Ao levar a outro caixa, registre lá um suprimento para contabilizar a entrada.</p><div className="mt-3 grid grid-cols-2 gap-2">{(['sangria', 'suprimento'] as MovementType[]).map((type) => <button key={type} type="button" onClick={() => setMovementType(type)} className={`rounded-lg border px-3 py-2 text-sm font-semibold capitalize ${movementType === type ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200'}`}>{type === 'sangria' ? <ArrowUpFromLine className="mr-1 inline" size={15} /> : <ArrowDownToLine className="mr-1 inline" size={15} />}{type}</button>)}</div>{movementType === 'sangria' && <label className="mt-3 block text-sm font-medium text-slate-700">Destino da sangria<select value={sangriaDestination} onChange={(event) => setSangriaDestination(event.target.value as SangriaDestination)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"><option>Outro caixa</option><option>Depósito em banco</option><option>Outro destino</option></select></label>}<input value={movementValue} onChange={(e) => setMovementValue(e.target.value)} placeholder="Valor (R$)" inputMode="decimal" aria-label="Valor da movimentação" className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2" /><input value={movementDescription} onChange={(e) => setMovementDescription(e.target.value)} placeholder={movementType === 'sangria' ? 'Identifique o caixa, banco ou outro destino' : 'Motivo do suprimento'} aria-label={movementType === 'sangria' ? 'Identificação do destino' : 'Motivo do suprimento'} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" /><button type="button" onClick={submitMovement} disabled={savingMovement} className="mt-3 w-full rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{savingMovement ? 'Registrando...' : movementType === 'sangria' ? 'Confirmar sangria' : 'Registrar suprimento'}</button></section>}
                    </div>
                    <div className="flex justify-end"><button type="button" onClick={() => setShowClosing(true)} className="rounded-lg bg-rose-600 px-5 py-2.5 font-bold text-white">Fechar caixa</button></div>
                </>
            )}

            <CashOpeningModal
                isOpen={showOpening}
                onClose={() => setShowOpening(false)}
                onOpened={() => refresh()}
                onAlreadyOpen={() => refresh()}
            />
            {session && summaryForSession && <CashClosingWizard isOpen={showClosing} session={session} summary={summaryForSession} onClose={() => { setShowClosing(false); void refresh(); }} onClosed={() => undefined} />}
        </div>
    );
}
