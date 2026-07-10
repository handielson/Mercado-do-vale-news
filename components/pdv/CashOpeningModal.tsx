import React from 'react';
import { X as XIcon, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { cashRegisterService } from '../../services/cashRegisterService';
import { computeDenominationTotalCents, type CashSession, type DenominationCount } from '../../types/cashRegister';
import CashDenominationCounter, { type CashCountMode } from './CashDenominationCounter';

interface CashOpeningModalProps {
    isOpen: boolean;
    onClose: () => void;
    onOpened: (session: CashSession) => void;
}

function getDeviceKey(): string {
    return localStorage.getItem('standalone_pix_cashier_key') || localStorage.getItem('pdv_cashier_key') || 'caixa-01';
}

/**
 * Modal de abertura de caixa: operador (usuario logado), data/hora automaticas,
 * saldo inicial em especie por valor total ou contagem por denominacao.
 */
export default function CashOpeningModal({ isOpen, onClose, onOpened }: CashOpeningModalProps) {
    const { user } = useAuth();
    const [mode, setMode] = React.useState<CashCountMode>('total');
    const [totalCents, setTotalCents] = React.useState(0);
    const [count, setCount] = React.useState<DenominationCount>({});
    const [notes, setNotes] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);

    if (!isOpen) return null;

    const operatorName = user?.user_metadata?.full_name || user?.email || 'Operador';
    const now = new Date();

    const handleOpen = async () => {
        setIsSaving(true);
        try {
            const payload = mode === 'count'
                ? { opening_count_json: count, opening_amount_cents: computeDenominationTotalCents(count) }
                : { opening_amount_cents: totalCents };
            const session = await cashRegisterService.openSession({
                ...payload,
                notes: notes.trim() || undefined,
                device_key: getDeviceKey(),
            });
            toast.success(`Caixa #${session.session_number} aberto`);
            onOpened(session);
            onClose();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao abrir caixa';
            toast.error(message.includes('Ja existe') ? 'Já existe um caixa aberto para este operador' : message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div className="flex items-center gap-2">
                        <Unlock size={20} className="text-emerald-600" />
                        <h2 className="text-lg font-bold text-slate-800">Abrir Caixa</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                        <XIcon size={18} />
                    </button>
                </div>

                <div className="space-y-4 px-5 py-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-lg bg-slate-50 px-3 py-2">
                            <div className="text-xs text-slate-500">Operador</div>
                            <div className="font-semibold text-slate-800">{operatorName}</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 px-3 py-2">
                            <div className="text-xs text-slate-500">Data / Hora</div>
                            <div className="font-semibold text-slate-800">
                                {now.toLocaleDateString('pt-BR')} {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="mb-2 text-sm font-semibold text-slate-700">Saldo inicial em espécie</div>
                        <p className="mb-2 text-xs text-slate-500">
                            Informe apenas o dinheiro físico existente no caixa. PIX, cartões e meios eletrônicos
                            são registrados automaticamente pelas transações.
                        </p>
                        <CashDenominationCounter
                            mode={mode}
                            onModeChange={setMode}
                            totalCents={totalCents}
                            onTotalCentsChange={setTotalCents}
                            count={count}
                            onCountChange={setCount}
                            disabled={isSaving}
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Observação (opcional)</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            disabled={isSaving}
                            rows={2}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            placeholder="Ex: troco conferido com o gerente"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleOpen}
                        disabled={isSaving}
                        className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                        {isSaving ? 'Abrindo...' : 'Abrir Caixa'}
                    </button>
                </div>
            </div>
        </div>
    );
}
