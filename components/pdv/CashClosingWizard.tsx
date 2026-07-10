import React from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cashRegisterService } from '../../services/cashRegisterService';
import { cashReportPdfBase64, downloadCashReportPdf } from '../../utils/cashReportPdf';
import {
    CASH_METHOD_LABELS,
    computeDenominationTotalCents,
    formatCashCents,
    type CashReportSnapshot,
    type CashSession,
    type CashSessionSummary,
    type DenominationCount,
} from '../../types/cashRegister';
import CashDenominationCounter, { type CashCountMode } from './CashDenominationCounter';

interface CashClosingWizardProps {
    isOpen: boolean;
    session: CashSession;
    summary: CashSessionSummary;
    onClose: () => void;
    onClosed: () => void | Promise<void>;
}

function getDeviceKey(): string {
    return localStorage.getItem('standalone_pix_cashier_key') || localStorage.getItem('pdv_cashier_key') || 'caixa-01';
}

export default function CashClosingWizard({ isOpen, session, summary, onClose, onClosed }: CashClosingWizardProps) {
    const [step, setStep] = React.useState(1);
    const [mode, setMode] = React.useState<CashCountMode>('total');
    const [totalCents, setTotalCents] = React.useState(0);
    const [count, setCount] = React.useState<DenominationCount>({});
    const [justification, setJustification] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);
    const [snapshot, setSnapshot] = React.useState<CashReportSnapshot | null>(null);
    const [uploadFailed, setUploadFailed] = React.useState(false);

    React.useEffect(() => {
        if (!isOpen) return;
        setStep(1);
        setMode('total');
        setTotalCents(0);
        setCount({});
        setJustification('');
        setSnapshot(null);
        setUploadFailed(false);
    }, [isOpen]);

    if (!isOpen) return null;
    const countedCents = mode === 'count' ? computeDenominationTotalCents(count) : totalCents;
    const differenceCents = countedCents - summary.expected_cash_cents;

    const completeClose = async () => {
        if (differenceCents !== 0 && !justification.trim()) {
            toast.error('Informe a justificativa da diferenca');
            return;
        }
        setIsSaving(true);
        try {
            const result = await cashRegisterService.closeSession(session.id, {
                counted_cash_cents: countedCents,
                counted_count_json: mode === 'count' ? count : null,
                justification: justification.trim() || undefined,
                device_key: getDeviceKey(),
            });
            setSnapshot(result.report_snapshot);
            try {
                await cashRegisterService.uploadDocument(result.document_id, cashReportPdfBase64(result.report_snapshot));
                setUploadFailed(false);
                toast.success('Fechamento concluido e arquivado');
            } catch (error) {
                setUploadFailed(true);
                toast.error('Caixa fechado, mas o PDF ficou pendente de arquivamento');
            }
            setStep(4);
            await onClosed();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Erro ao fechar caixa');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Fechar Caixa #{session.session_number}</h2>
                        <p className="text-xs text-slate-500">Etapa {step} de 4</p>
                    </div>
                    <button type="button" onClick={onClose} disabled={isSaving} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
                </div>

                <div className="max-h-[72vh] overflow-y-auto p-5">
                    {step === 1 && (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                                <div className="text-sm text-emerald-700">Dinheiro esperado no caixa</div>
                                <div className="mt-1 text-3xl font-bold text-emerald-900">{formatCashCents(summary.expected_cash_cents)}</div>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {Object.entries(summary.by_method || {}).map(([method, amount]) => (
                                    <div key={method} className="flex justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                                        <span>{CASH_METHOD_LABELS[method] || method}</span><strong>{formatCashCents(amount)}</strong>
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-slate-500">Confira os totais e avance para contar somente o dinheiro fisico.</p>
                        </div>
                    )}

                    {step === 2 && (
                        <CashDenominationCounter mode={mode} onModeChange={setMode} totalCents={totalCents} onTotalCentsChange={setTotalCents} count={count} onCountChange={setCount} disabled={isSaving} />
                    )}

                    {step === 3 && (
                        <div className="space-y-4">
                            <div className="grid gap-3 sm:grid-cols-3">
                                <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Esperado</div><strong>{formatCashCents(summary.expected_cash_cents)}</strong></div>
                                <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Contado</div><strong>{formatCashCents(countedCents)}</strong></div>
                                <div className={`rounded-lg p-3 ${differenceCents === 0 ? 'bg-emerald-50' : 'bg-amber-50'}`}><div className="text-xs text-slate-500">Diferenca</div><strong>{formatCashCents(differenceCents)}</strong></div>
                            </div>
                            {differenceCents !== 0 && (
                                <div>
                                    <label className="mb-1 block text-sm font-semibold text-slate-700">Justificativa obrigatoria</label>
                                    <textarea value={justification} onChange={(event) => setJustification(event.target.value)} rows={4} className="w-full rounded-lg border border-amber-300 px-3 py-2 focus:border-amber-500 focus:outline-none" placeholder="Explique a sobra ou falta encontrada" />
                                </div>
                            )}
                            <div className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><AlertTriangle className="shrink-0" size={18} /> O fechamento cria um registro imutavel. Correcoes posteriores ficam registradas como retificacao.</div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="py-6 text-center">
                            <CheckCircle2 size={54} className="mx-auto text-emerald-600" />
                            <h3 className="mt-3 text-xl font-bold text-slate-900">Caixa fechado</h3>
                            <p className={`mt-2 text-sm ${uploadFailed ? 'text-amber-700' : 'text-slate-600'}`}>{uploadFailed ? 'O relatorio sera exibido como pendente na auditoria para nova tentativa.' : 'O relatorio foi arquivado no Synology.'}</p>
                            {snapshot && <button type="button" onClick={() => downloadCashReportPdf(snapshot)} className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Baixar copia do relatorio</button>}
                        </div>
                    )}
                </div>

                <div className="flex justify-between border-t border-slate-200 px-5 py-4">
                    <button type="button" onClick={step === 1 || step === 4 ? onClose : () => setStep((value) => value - 1)} disabled={isSaving} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">{step === 1 || step === 4 ? 'Fechar' : 'Voltar'}</button>
                    {step < 3 && <button type="button" onClick={() => setStep((value) => value + 1)} className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700">Continuar</button>}
                    {step === 3 && <button type="button" onClick={completeClose} disabled={isSaving || (differenceCents !== 0 && !justification.trim())} className="rounded-lg bg-rose-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{isSaving ? 'Fechando...' : 'Confirmar fechamento'}</button>}
                </div>
            </div>
        </div>
    );
}
