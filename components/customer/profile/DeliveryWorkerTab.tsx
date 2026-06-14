import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bike, CreditCard, ExternalLink, Loader2, MessageCircle, PlusCircle, ReceiptText } from 'lucide-react';
import { toast } from 'sonner';
import type { Customer } from '../../../types/customer';
import { formatCurrencyCents, listCustomerDebts, toCents, type CustomerDebt } from '../../../services/customerDebtService';
import {
    adminCompleteDeliveryJob,
    createCustomerDeliveryAdjustment,
    getCustomerDeliveryJobLogs,
    getCustomerDeliveryLedger,
    getCustomerDeliveryJobs,
    getCustomerDeliverySettings,
    offsetCustomerDeliveryBalance,
    registerCustomerDeliveryPayment,
    updateCustomerDeliverySettings,
    type CustomerDeliveryJob,
    type CustomerDeliveryJobLog,
    type CustomerDeliveryLedgerEntry,
    type CustomerDeliverySettings,
    type CustomerDeliverySettlement,
} from '../../../services/customerDeliveryService';

interface DeliveryWorkerTabProps {
    customer: Customer;
    mode?: 'admin' | 'viewer';
}

function todayDateTimeLocal(): string {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
}

export const DeliveryWorkerTab: React.FC<DeliveryWorkerTabProps> = ({ customer, mode = 'viewer' }) => {
    const isAdminMode = mode === 'admin';
    const [ledger, setLedger] = useState<CustomerDeliveryLedgerEntry[]>([]);
    const [settlements, setSettlements] = useState<CustomerDeliverySettlement[]>([]);
    const [jobs, setJobs] = useState<CustomerDeliveryJob[]>([]);
    const [debts, setDebts] = useState<CustomerDebt[]>([]);
    const [loading, setLoading] = useState(true);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentDescription, setPaymentDescription] = useState('Pagamento de entregas');
    const [paidAt, setPaidAt] = useState(todayDateTimeLocal());
    const [offsetDebtId, setOffsetDebtId] = useState('');
    const [offsetAmount, setOffsetAmount] = useState('');
    const [adminReasonByToken, setAdminReasonByToken] = useState<Record<string, string>>({});
    const [settings, setSettings] = useState<CustomerDeliverySettings | null>(null);
    const [settingsDraft, setSettingsDraft] = useState('');
    const [adjustmentAmount, setAdjustmentAmount] = useState('');
    const [adjustmentDescription, setAdjustmentDescription] = useState('');
    const [adjustmentObservation, setAdjustmentObservation] = useState('');
    const [adjustmentSaleId, setAdjustmentSaleId] = useState('');
    const [logsByToken, setLogsByToken] = useState<Record<string, CustomerDeliveryJobLog[]>>({});
    const [saving, setSaving] = useState(false);

    const reload = async () => {
        setLoading(true);
        try {
            const [deliveryData, deliveryJobs, customerDebts, deliverySettings] = await Promise.all([
                getCustomerDeliveryLedger(customer.id),
                getCustomerDeliveryJobs(customer.id),
                listCustomerDebts(customer.id),
                getCustomerDeliverySettings(),
            ]);
            setLedger(deliveryData.ledger);
            setSettlements(deliveryData.settlements);
            setJobs(deliveryJobs);
            setDebts(customerDebts.filter((debt) => toCents(debt.saldo_devedor) > 0));
            setSettings(deliverySettings);
            setSettingsDraft(deliverySettings.completion_whatsapp_template || '');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void reload(); }, [customer.id]);

    const earned = useMemo(() => ledger.reduce((sum, item) => sum + toCents(item.amount), 0), [ledger]);
    const settled = useMemo(() => settlements.reduce((sum, item) => sum + toCents(item.amount), 0), [settlements]);
    const payable = earned - settled;
    const openJobs = useMemo(() => jobs.filter((job) => job.delivery_status !== 'delivered'), [jobs]);

    const submitPayment = async () => {
        const amount = Math.round(Number(paymentAmount.replace(',', '.')) * 100);
        if (amount <= 0 || amount > payable) return toast.error('Valor de pagamento invalido');
        if (!paymentDescription.trim()) return toast.error('Informe a descricao do pagamento');
        setSaving(true);
        try {
            await registerCustomerDeliveryPayment(customer.id, { amount, description: paymentDescription.trim(), paid_at: paidAt });
            toast.success('Pagamento do entregador registrado');
            setPaymentAmount('');
            await reload();
        } finally {
            setSaving(false);
        }
    };

    const submitOffset = async () => {
        const amount = Math.round(Number(offsetAmount.replace(',', '.')) * 100);
        if (!offsetDebtId) return toast.error('Escolha um debito para abater');
        if (amount <= 0 || amount > payable) return toast.error('Valor de abatimento invalido');
        setSaving(true);
        try {
            await offsetCustomerDeliveryBalance(customer.id, { debt_id: offsetDebtId, amount, description: 'Abatimento com saldo de entregas' });
            toast.success('Saldo de entregas abatido do debito');
            setOffsetAmount('');
            await reload();
        } finally {
            setSaving(false);
        }
    };

    const submitAdminComplete = async (job: CustomerDeliveryJob) => {
        const reason = String(adminReasonByToken[job.token] || '').trim();
        if (!reason) return toast.error('Informe o motivo da baixa administrativa');
        setSaving(true);
        try {
            await adminCompleteDeliveryJob(job.token, { admin_completion_reason: reason });
            toast.success('Entrega baixada pelo admin');
            setAdminReasonByToken((current) => ({ ...current, [job.token]: '' }));
            await reload();
        } finally {
            setSaving(false);
        }
    };

    const submitSettings = async () => {
        if (!settingsDraft.trim()) return toast.error('Informe a mensagem de agradecimento');
        setSaving(true);
        try {
            const updated = await updateCustomerDeliverySettings({
                completion_whatsapp_enabled: settings?.completion_whatsapp_enabled ?? true,
                completion_whatsapp_template: settingsDraft.trim(),
            });
            setSettings(updated);
            setSettingsDraft(updated.completion_whatsapp_template || '');
            toast.success('Mensagem de entrega salva');
        } finally {
            setSaving(false);
        }
    };

    const submitAdjustment = async () => {
        const amount = Math.round(Number(adjustmentAmount.replace(',', '.')) * 100);
        if (!amount) return toast.error('Informe um valor positivo ou negativo');
        if (!adjustmentDescription.trim()) return toast.error('Informe a descricao do lancamento');
        setSaving(true);
        try {
            await createCustomerDeliveryAdjustment(customer.id, {
                amount,
                description: adjustmentDescription.trim(),
                observation: adjustmentObservation.trim() || undefined,
                sale_id: adjustmentSaleId.trim() || undefined,
                order_number: adjustmentSaleId.trim() || undefined,
            });
            toast.success('Lancamento avulso registrado');
            setAdjustmentAmount('');
            setAdjustmentDescription('');
            setAdjustmentObservation('');
            setAdjustmentSaleId('');
            await reload();
        } finally {
            setSaving(false);
        }
    };

    const toggleLogs = async (job: CustomerDeliveryJob) => {
        if (logsByToken[job.token]) {
            setLogsByToken((current) => {
                const next = { ...current };
                delete next[job.token];
                return next;
            });
            return;
        }
        try {
            const logs = await getCustomerDeliveryJobLogs(job.token);
            setLogsByToken((current) => ({ ...current, [job.token]: logs }));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Erro ao carregar logs da entrega');
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[220px] items-center justify-center text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />Carregando entregas...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <p className="text-xs font-semibold uppercase text-blue-700">Entregador</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-800">Historico de entregas</h2>
                <p className="mt-1 text-sm text-slate-500">Entregas feitas, saldo a pagar e abatimentos no crediario.</p>
            </div>

            <section className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <Bike className="mb-3 h-5 w-5 text-blue-600" />
                    <p className="text-xs font-semibold uppercase text-slate-500">Gerado em entregas</p>
                    <p className="mt-1 text-xl font-bold">{formatCurrencyCents(earned)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <CreditCard className="mb-3 h-5 w-5 text-emerald-600" />
                    <p className="text-xs font-semibold uppercase text-slate-500">Pago/abatido</p>
                    <p className="mt-1 text-xl font-bold">{formatCurrencyCents(settled)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <ReceiptText className="mb-3 h-5 w-5 text-amber-600" />
                    <p className="text-xs font-semibold uppercase text-slate-500">Saldo a pagar</p>
                    <p className="mt-1 text-xl font-bold">{formatCurrencyCents(payable)}</p>
                </div>
            </section>

            {isAdminMode && (
            <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="font-semibold text-slate-800">Registrar pagamento</h3>
                    <input className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Valor em reais" />
                    <input className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2" type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
                    <textarea className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2" value={paymentDescription} onChange={(e) => setPaymentDescription(e.target.value)} />
                    <button className="mt-3 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving || payable <= 0} onClick={submitPayment}>Registrar pagamento</button>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="font-semibold text-slate-800">Abater em debito do cliente</h3>
                    <select className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2" value={offsetDebtId} onChange={(e) => setOffsetDebtId(e.target.value)}>
                        <option value="">Escolha um debito</option>
                        {debts.map((debt) => <option key={debt.id} value={debt.id}>{debt.descricao} - {formatCurrencyCents(debt.saldo_devedor)}</option>)}
                    </select>
                    <input className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2" value={offsetAmount} onChange={(e) => setOffsetAmount(e.target.value)} placeholder="Valor em reais" />
                    <button className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving || payable <= 0} onClick={submitOffset}>Abater saldo</button>
                </div>
            </section>
            )}

            {isAdminMode && (
            <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5 text-emerald-600" />
                        <h3 className="font-semibold text-slate-800">Mensagem ao cliente</h3>
                    </div>
                    <label className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-700">
                        <input
                            type="checkbox"
                            checked={settings?.completion_whatsapp_enabled ?? true}
                            onChange={(event) => setSettings((current) => ({
                                ...(current || { completion_whatsapp_template: settingsDraft }),
                                completion_whatsapp_enabled: event.target.checked,
                            }))}
                        />
                        Enviar agradecimento automatico no WhatsApp ao finalizar entrega
                    </label>
                    <textarea
                        className="mt-3 h-32 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        value={settingsDraft}
                        onChange={(event) => setSettingsDraft(event.target.value)}
                        placeholder="Ola, {cliente}! Obrigado pela compra..."
                    />
                    <p className="mt-2 text-xs text-slate-500">Tags: {'{cliente}'}, {'{pedido}'}, {'{valor_entrega}'}, {'{data_entrega}'}.</p>
                    <button className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving} onClick={submitSettings}>
                        Salvar mensagem
                    </button>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                        <PlusCircle className="h-5 w-5 text-blue-600" />
                        <h3 className="font-semibold text-slate-800">Lancamento avulso</h3>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <input className="rounded-xl border border-slate-200 px-3 py-2" value={adjustmentAmount} onChange={(e) => setAdjustmentAmount(e.target.value)} placeholder="Valor: 15 ou -10" />
                        <input className="rounded-xl border border-slate-200 px-3 py-2" value={adjustmentSaleId} onChange={(e) => setAdjustmentSaleId(e.target.value)} placeholder="Venda/pedido opcional" />
                    </div>
                    <input className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2" value={adjustmentDescription} onChange={(e) => setAdjustmentDescription(e.target.value)} placeholder="Descricao do servico ou ajuste" />
                    <textarea className="mt-3 h-20 w-full rounded-xl border border-slate-200 px-3 py-2" value={adjustmentObservation} onChange={(e) => setAdjustmentObservation(e.target.value)} placeholder="Observacao para explicar receita positiva ou negativa" />
                    <button className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving} onClick={submitAdjustment}>
                        Registrar lancamento
                    </button>
                </div>
            </section>
            )}

            <section className="rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
                <div className="border-b border-amber-100 px-5 py-4">
                    <h3 className="font-semibold text-slate-800">Entregas em aberto</h3>
                    {isAdminMode && <p className="mt-1 text-sm text-amber-800">Use a baixa administrativa apenas quando precisar concluir uma entrega fora do fluxo normal.</p>}
                </div>
                {openJobs.length === 0 ? <p className="px-5 py-6 text-sm text-slate-500">Nenhuma entrega em aberto para este entregador.</p> : openJobs.map((job) => (
                    <div key={job.id} className="grid gap-3 border-b border-amber-100 bg-white px-5 py-4 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_220px]">
                        <div>
                            <p className="text-sm font-semibold text-slate-800">Pedido {job.order_number || job.sale_id}</p>
                            <p className="mt-1 text-xs text-slate-500">{job.buyer_name} - {formatCurrencyCents(job.delivery_amount)}</p>
                            <p className="mt-1 text-xs text-slate-500">Pagamento: {job.payment_status} | Entrega: {job.delivery_status}</p>
                            {job.completion_whatsapp_error && (
                                <p className="mt-2 inline-flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                                    <AlertTriangle className="h-3 w-3" /> WhatsApp: {job.completion_whatsapp_error}
                                </p>
                            )}
                            {isAdminMode && <textarea
                                className="mt-3 w-full rounded-xl border border-amber-200 px-3 py-2 text-sm"
                                value={adminReasonByToken[job.token] || ''}
                                onChange={(event) => setAdminReasonByToken((current) => ({ ...current, [job.token]: event.target.value }))}
                                placeholder="Motivo da baixa administrativa"
                            />}
                        </div>
                        {isAdminMode && <button
                            className="self-end rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            disabled={saving || !String(adminReasonByToken[job.token] || '').trim()}
                            onClick={() => submitAdminComplete(job)}
                        >
                            Baixar como entregue
                        </button>}
                        {isAdminMode && <button
                            className="self-end rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                            disabled={saving}
                            onClick={() => toggleLogs(job)}
                        >
                            {logsByToken[job.token] ? 'Ocultar logs' : 'Ver logs'}
                        </button>}
                        {isAdminMode && logsByToken[job.token] && (
                            <div className="lg:col-span-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                                {logsByToken[job.token].length === 0 ? 'Nenhum log registrado para esta entrega.' : logsByToken[job.token].map((log) => (
                                    <p key={log.id} className={log.level === 'error' ? 'text-red-700' : 'text-slate-600'}>
                                        {new Date(log.created_at).toLocaleString('pt-BR')} - {log.event_type}: {log.message}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4"><h3 className="font-semibold text-slate-800">Entregas registradas</h3></div>
                {ledger.length === 0 ? <p className="px-5 py-6 text-sm text-slate-500">Nenhuma entrega registrada.</p> : ledger.map((item) => (
                    <div key={item.id} className="grid gap-3 border-b border-slate-100 px-5 py-4 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_auto]">
                        <div>
                            <p className="text-sm font-semibold text-slate-800">{item.description}</p>
                            <p className="mt-1 text-xs text-slate-500">Pedido {item.order_number || item.sale_id} - {item.buyer_name || 'Cliente'}</p>
                            <p className="mt-1 text-xs text-slate-500">{item.delivery_address_text}</p>
                            {item.proof_image_url && (
                                <a className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700" href={item.proof_image_url} target="_blank" rel="noreferrer">
                                    Foto de comprovacao <ExternalLink className="h-3 w-3" />
                                </a>
                            )}
                            {jobs.find((job) => job.id === item.job_id)?.completion_whatsapp_error && (
                                <p className="mt-2 inline-flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                                    <AlertTriangle className="h-3 w-3" /> Erro WhatsApp salvo para correcao
                                </p>
                            )}
                        </div>
                        <span className="font-semibold text-slate-900">{formatCurrencyCents(item.amount)}</span>
                    </div>
                ))}
            </section>
        </div>
    );
};
