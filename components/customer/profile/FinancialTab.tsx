import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Clock3, CreditCard, ExternalLink, Loader2, ReceiptText, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { Customer } from '../../../types/customer';
import {
    createCustomerDebtMercadoPagoIntent,
    formatCurrencyCents,
    listCustomerDebtPayments,
    listCustomerDebts,
    refreshCustomerDebtMercadoPagoIntentStatus,
    toCents,
    type CustomerDebtAllocationInput,
    type CustomerDebt,
    type CustomerDebtMercadoPagoIntent,
    type CustomerDebtPayment,
} from '../../../services/customerDebtService';

interface FinancialTabProps {
    customer: Customer;
}

const CUSTOMER_DEBT_PAYMENT_POLL_INTERVAL_MS = 5000;

function normalizeStatus(status?: string): string {
    return String(status || '').toLowerCase();
}

function isOverdue(dateValue?: string): boolean {
    if (!dateValue) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const normalizedDate = /^\d{4}-\d{2}-\d{2}$/.test(dateValue) ? `${dateValue}T00:00:00` : dateValue;
    const dueDate = new Date(normalizedDate);
    if (Number.isNaN(dueDate.getTime())) return false;
    return dueDate < today;
}

function formatDate(dateValue?: string): string {
    if (!dateValue) return 'Sem data';
    const normalizedDate = /^\d{4}-\d{2}-\d{2}$/.test(dateValue) ? `${dateValue}T00:00:00` : dateValue;
    const date = new Date(normalizedDate);
    if (Number.isNaN(date.getTime())) return 'Sem data';
    return date.toLocaleDateString('pt-BR');
}

function formatDateTime(dateValue?: string): string {
    if (!dateValue) return 'Sem data';
    const normalizedDate = /^\d{4}-\d{2}-\d{2}$/.test(dateValue) ? `${dateValue}T00:00:00` : dateValue;
    const date = new Date(normalizedDate);
    if (Number.isNaN(date.getTime())) return formatDate(dateValue);
    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function paymentMethodLabel(payment: CustomerDebtPayment): string {
    const method = String(payment.metodo_pagamento || payment.forma_pagamento || '').trim();
    const observation = String(payment.observacoes || '').toLowerCase();
    const isMercadoPago = Boolean(payment.mercado_pago_id || payment.mercado_pago_link || observation.includes('mercado pago'));
    if (isMercadoPago) return 'Pago via Mercado Pago';
    if (method) return method;
    return 'Metodo nao informado';
}

function statusLabel(debt: CustomerDebt): string {
    const status = normalizeStatus(debt.status);
    const balance = toCents(debt.saldo_devedor);
    if (status === 'paid' || balance <= 0) return 'Quitado';
    if (status === 'cancelled' || status === 'canceled') return 'Cancelado';
    if (isOverdue(debt.data_vencimento)) return 'Vencido';
    if (status === 'partial') return 'Parcial';
    return 'Em aberto';
}

function statusClass(label: string): string {
    if (label === 'Quitado') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
    if (label === 'Vencido') return 'bg-red-50 text-red-700 ring-red-100';
    if (label === 'Cancelado') return 'bg-slate-100 text-slate-500 ring-slate-200';
    return 'bg-amber-50 text-amber-700 ring-amber-100';
}

function formatFeePercent(value?: number | string): string {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) return '0,00%';
    const percentage = Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
    return `${percentage.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function parseCurrencyToCents(value: string): number {
    const digits = String(value || '').replace(/\D/g, '');
    return digits ? Number(digits) : 0;
}

function formatCurrencyInput(cents: number): string {
    if (!cents) return '';
    return formatCurrencyCents(cents);
}

export const FinancialTab: React.FC<FinancialTabProps> = ({ customer }) => {
    const [debts, setDebts] = useState<CustomerDebt[]>([]);
    const [payments, setPayments] = useState<CustomerDebtPayment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedDebtIds, setExpandedDebtIds] = useState<Set<string>>(new Set());
    const [creatingPaymentDebtId, setCreatingPaymentDebtId] = useState<string | null>(null);
    const [refreshingPaymentIntentId, setRefreshingPaymentIntentId] = useState<string | null>(null);
    const [mercadoPagoIntentsByDebtId, setMercadoPagoIntentsByDebtId] = useState<Record<string, CustomerDebtMercadoPagoIntent>>({});
    const [paymentAmountByDebtId, setPaymentAmountByDebtId] = useState<Record<string, number>>({});

    const loadFinancialData = useCallback(async (showLoading = true) => {
        if (showLoading) setLoading(true);
        setError(null);
        try {
            const [debtRows, paymentRows] = await Promise.all([
                listCustomerDebts(customer.id),
                listCustomerDebtPayments(customer.id),
            ]);
            setDebts(debtRows);
            setPayments(paymentRows);
        } catch (err: any) {
            setError(err?.message || 'Nao foi possivel carregar o financeiro do cliente.');
        } finally {
            if (showLoading) setLoading(false);
        }
    }, [customer.id]);

    useEffect(() => {
        void loadFinancialData();
    }, [loadFinancialData]);

    const summary = useMemo(() => {
        return debts.reduce((acc, debt) => {
            const total = toCents(debt.valor_total);
            const balance = toCents(debt.saldo_devedor);
            const label = statusLabel(debt);
            const paid = Math.max(0, total - balance);

            acc.totalDebt += total;
            acc.paid += label === 'Quitado' ? total : paid;
            if (label !== 'Quitado' && label !== 'Cancelado') acc.open += balance;
            if (label === 'Vencido') acc.overdue += balance;
            return acc;
        }, { open: 0, overdue: 0, paid: 0, totalDebt: 0 });
    }, [debts]);

    const paymentsByDebtId = useMemo(() => {
        return payments.reduce<Record<string, CustomerDebtPayment[]>>((acc, payment) => {
            if (!payment.debt_id) return acc;
            if (!acc[payment.debt_id]) acc[payment.debt_id] = [];
            acc[payment.debt_id].push(payment);
            return acc;
        }, {});
    }, [payments]);

    const toggleDebtPayments = (debtId: string) => {
        setExpandedDebtIds((current) => {
            const next = new Set(current);
            if (next.has(debtId)) {
                next.delete(debtId);
            } else {
                next.add(debtId);
            }
            return next;
        });
    };

    const openDebts = useMemo(() => {
        return debts.filter((debt) => {
            const label = statusLabel(debt);
            return label !== 'Quitado' && label !== 'Cancelado' && toCents(debt.saldo_devedor) > 0;
        });
    }, [debts]);

    const handlePaymentAmountChange = (debtId: string, rawValue: string) => {
        const cents = Math.min(parseCurrencyToCents(rawValue), summary.open);
        setPaymentAmountByDebtId((current) => ({ ...current, [debtId]: cents }));
    };

    const setFullDebtPaymentAmount = (debt: CustomerDebt) => {
        const balance = toCents(debt.saldo_devedor);
        setPaymentAmountByDebtId((current) => ({ ...current, [debt.id]: Math.min(balance, summary.open) }));
    };

    const setAllDebtsPaymentAmount = (debt: CustomerDebt) => {
        setPaymentAmountByDebtId((current) => ({ ...current, [debt.id]: summary.open }));
        setExpandedDebtIds((current) => new Set(current).add(debt.id));
    };

    const buildPaymentAllocations = (primaryDebt: CustomerDebt, requestedAmount: number): CustomerDebtAllocationInput[] => {
        let remaining = Math.min(Math.max(0, requestedAmount), summary.open);
        const orderedDebts = [
            primaryDebt,
            ...openDebts.filter((debt) => debt.id !== primaryDebt.id),
        ];

        const allocations: CustomerDebtAllocationInput[] = [];
        for (const debt of orderedDebts) {
            if (remaining <= 0) break;
            const debtBalance = toCents(debt.saldo_devedor);
            const amount = Math.min(debtBalance, remaining);
            if (amount > 0) {
                allocations.push({ debt_id: debt.id, valor_liquido: amount });
                remaining -= amount;
            }
        }
        return allocations;
    };

    const createMercadoPagoPayment = async (debt: CustomerDebt, metodo: 'pix' | 'card') => {
        const requestedAmount = paymentAmountByDebtId[debt.id] || toCents(debt.saldo_devedor);
        const cappedAmount = Math.min(requestedAmount, summary.open);
        const allocations = buildPaymentAllocations(debt, cappedAmount);

        if (cappedAmount <= 0 || allocations.length === 0) {
            toast.error('Informe um valor em aberto para pagar');
            return;
        }

        setCreatingPaymentDebtId(`${debt.id}:${metodo}`);
        try {
            const intent = await createCustomerDebtMercadoPagoIntent({
                debt_id: debt.id,
                valor_liquido: cappedAmount,
                metodo,
                allocations: buildPaymentAllocations(debt, cappedAmount),
            });
            setMercadoPagoIntentsByDebtId((current) => ({ ...current, [debt.id]: intent }));
            setExpandedDebtIds((current) => new Set(current).add(debt.id));
            toast.success(metodo === 'pix' ? 'Pix gerado' : 'Pagamento por cartao gerado');
        } catch (err: any) {
            toast.error(err?.message || 'Erro ao gerar pagamento Mercado Pago');
        } finally {
            setCreatingPaymentDebtId(null);
        }
    };

    const handleRefreshMercadoPagoPayment = useCallback(async (debtId: string, intentId: string, silent = false) => {
        setRefreshingPaymentIntentId(intentId);
        try {
            const intent = await refreshCustomerDebtMercadoPagoIntentStatus(intentId);
            if (intent.status === 'approved') {
                setMercadoPagoIntentsByDebtId((current) => {
                    const next = { ...current };
                    delete next[debtId];
                    return next;
                });
                await loadFinancialData(false);
                if (!silent) toast.success('Pagamento Mercado Pago confirmado');
                return;
            }

            setMercadoPagoIntentsByDebtId((current) => ({ ...current, [debtId]: intent }));
            if (!silent) {
                if (intent.status === 'failed' || intent.status === 'cancelled' || intent.status === 'expired') {
                    toast.error('Pagamento Mercado Pago nao aprovado. Gere uma nova cobranca se necessario.');
                } else {
                    toast.info('Pagamento ainda pendente');
                }
            }
        } catch (err: any) {
            if (!silent) toast.error(err?.message || 'Erro ao conferir pagamento Mercado Pago');
        } finally {
            setRefreshingPaymentIntentId(null);
        }
    }, [loadFinancialData]);

    useEffect(() => {
        const pendingIntents = Object.values(mercadoPagoIntentsByDebtId).filter((intent) => (
            intent?.id &&
            intent.metodo === 'pix' &&
            !['approved', 'failed', 'cancelled', 'expired'].includes(String(intent.status || '').toLowerCase())
        ));
        if (pendingIntents.length === 0) return;

        const interval = setInterval(() => {
            pendingIntents.forEach((intent) => {
                void handleRefreshMercadoPagoPayment(intent.debt_id, intent.id, true);
            });
        }, CUSTOMER_DEBT_PAYMENT_POLL_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [handleRefreshMercadoPagoPayment, mercadoPagoIntentsByDebtId]);

    if (loading) {
        return (
            <div className="flex min-h-[220px] items-center justify-center text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Carregando financeiro...
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">
                <AlertCircle className="mb-2 h-5 w-5" />
                {error}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <p className="text-xs font-semibold uppercase text-blue-700">Financeiro</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-800">Crediario e pagamentos</h2>
                <p className="mt-1 text-sm text-slate-500">Acompanhe saldos, vencimentos e pagamentos registrados.</p>
            </div>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <Clock3 className="mb-3 h-5 w-5 text-amber-600" />
                    <p className="text-xs font-semibold uppercase text-slate-500">Em aberto</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrencyCents(summary.open)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <AlertCircle className="mb-3 h-5 w-5 text-red-600" />
                    <p className="text-xs font-semibold uppercase text-slate-500">Vencido</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrencyCents(summary.overdue)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <CheckCircle2 className="mb-3 h-5 w-5 text-emerald-600" />
                    <p className="text-xs font-semibold uppercase text-slate-500">Pago</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrencyCents(summary.paid)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <ReceiptText className="mb-3 h-5 w-5 text-blue-600" />
                    <p className="text-xs font-semibold uppercase text-slate-500">Total em registros</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrencyCents(summary.totalDebt)}</p>
                </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                    <h3 className="font-semibold text-slate-800">Debitos</h3>
                    <p className="mt-1 text-sm text-slate-500">{debts.length} registro(s) de crediario</p>
                </div>
                <div className="divide-y divide-slate-100">
                    {debts.length === 0 ? (
                        <div className="px-5 py-8 text-center text-sm text-slate-500">Nenhum debito registrado para este cliente.</div>
                    ) : debts.map((debt) => {
                        const label = statusLabel(debt);
                        const debtPayments = paymentsByDebtId[debt.id] || [];
                        const paidForDebt = debtPayments.reduce((total, payment) => total + toCents(payment.valor_pago), 0);
                        const isExpanded = expandedDebtIds.has(debt.id);
                        const ToggleIcon = isExpanded ? ChevronDown : ChevronRight;
                        const openBalance = toCents(debt.saldo_devedor);
                        const selectedPaymentAmount = Math.min(paymentAmountByDebtId[debt.id] || openBalance, summary.open);
                        const mercadoPagoIntent = mercadoPagoIntentsByDebtId[debt.id];
                        const mercadoPagoFee = mercadoPagoIntent
                            ? Math.max(0, toCents(mercadoPagoIntent.valor_cobrado) - toCents(mercadoPagoIntent.valor_liquido))
                            : 0;
                        return (
                            <div key={debt.id} className="px-5 py-4">
                                <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => toggleDebtPayments(debt.id)}
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                                                aria-expanded={isExpanded}
                                                aria-label={isExpanded ? 'Ocultar pagamentos' : 'Mostrar pagamentos'}
                                            >
                                                <ToggleIcon className="h-4 w-4" />
                                            </button>
                                            <p className="font-semibold text-slate-800">{debt.descricao || `Debito #${debt.id.slice(0, 8)}`}</p>
                                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${statusClass(label)}`}>
                                                {label}
                                            </span>
                                        </div>
                                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 pl-10 text-sm text-slate-500">
                                            <span>Vencimento: {formatDate(debt.data_vencimento)}</span>
                                            <span className="font-medium text-slate-600">
                                                {debtPayments.length} pagamento(s) - {formatCurrencyCents(paidForDebt)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-left md:text-right">
                                        <p className="text-sm text-slate-500">Saldo</p>
                                        <p className="text-lg font-bold text-slate-900">{formatCurrencyCents(debt.saldo_devedor)}</p>
                                        <p className="text-xs text-slate-400">Total {formatCurrencyCents(debt.valor_total)}</p>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="mt-4 space-y-3">
                                        {openBalance > 0 && (
                                            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                                                <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                                                    <div className="space-y-3">
                                                        <p className="text-sm font-semibold text-emerald-800">Pagamento Mercado Pago</p>
                                                        <p className="mt-1 text-xs text-emerald-700">
                                                            Valor escolhido: {formatCurrencyCents(selectedPaymentAmount)}. Limite total em aberto: {formatCurrencyCents(summary.open)}.
                                                        </p>
                                                        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                                                            <label className="space-y-1">
                                                                <span className="text-xs font-semibold uppercase text-emerald-800">Valor parcial</span>
                                                                <input
                                                                    type="text"
                                                                    inputMode="numeric"
                                                                    value={formatCurrencyInput(selectedPaymentAmount)}
                                                                    onChange={(event) => handlePaymentAmountChange(debt.id, event.target.value)}
                                                                    placeholder="R$ 0,00"
                                                                    className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                                                                />
                                                            </label>
                                                            <button
                                                                type="button"
                                                                onClick={() => setFullDebtPaymentAmount(debt)}
                                                                className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                                                            >
                                                                Pagar saldo total
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setAllDebtsPaymentAmount(debt)}
                                                                className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                                                            >
                                                                Pagar todos os debitos
                                                            </button>
                                                        </div>
                                                        <p className="text-xs text-emerald-700">
                                                            A taxa do Mercado Pago entra no total cobrado do cliente.
                                                        </p>
                                                    </div>
                                                    <div className="grid gap-2 sm:grid-cols-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => createMercadoPagoPayment(debt, 'pix')}
                                                            disabled={creatingPaymentDebtId === `${debt.id}:pix`}
                                                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                                                        >
                                                            {creatingPaymentDebtId === `${debt.id}:pix` ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                                                            Pagar via Pix
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => createMercadoPagoPayment(debt, 'card')}
                                                            disabled={creatingPaymentDebtId === `${debt.id}:card`}
                                                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                                                        >
                                                            {creatingPaymentDebtId === `${debt.id}:card` ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                                                            Pagar com Cartao
                                                        </button>
                                                    </div>
                                                </div>

                                                {mercadoPagoIntent && (
                                                    <div className="mt-4 rounded-lg border border-emerald-100 bg-white p-3">
                                                        <p className="text-xs font-bold uppercase text-slate-500">Mercado Pago</p>
                                                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                                            <div className="rounded-lg bg-slate-50 p-3">
                                                                <p className="text-xs font-semibold uppercase text-slate-500">Saldo liquido</p>
                                                                <p className="mt-1 font-bold text-slate-900">{formatCurrencyCents(mercadoPagoIntent.valor_liquido)}</p>
                                                            </div>
                                                            <div className="rounded-lg bg-slate-50 p-3">
                                                                <p className="text-xs font-semibold uppercase text-slate-500">Taxa Mercado Pago</p>
                                                                <p className="mt-1 font-bold text-slate-900">
                                                                    {formatCurrencyCents(mercadoPagoFee)}
                                                                    <span className="ml-1 text-xs font-semibold text-slate-500">({formatFeePercent(mercadoPagoIntent.taxa_pct)})</span>
                                                                </p>
                                                            </div>
                                                            <div className="rounded-lg bg-emerald-50 p-3">
                                                                <p className="text-xs font-semibold uppercase text-emerald-700">Total cobrado do cliente</p>
                                                                <p className="mt-1 font-bold text-emerald-900">{formatCurrencyCents(mercadoPagoIntent.valor_cobrado)}</p>
                                                            </div>
                                                        </div>
                                                        {mercadoPagoIntent.qr_code_base64 && (
                                                            <img
                                                                src={`data:image/png;base64,${mercadoPagoIntent.qr_code_base64}`}
                                                                alt="QR Code Pix Mercado Pago"
                                                                className="mx-auto mt-3 h-40 w-40 rounded-lg bg-white p-2"
                                                            />
                                                        )}
                                                        {mercadoPagoIntent.qr_code && (
                                                            <textarea
                                                                readOnly
                                                                value={mercadoPagoIntent.qr_code}
                                                                className="mt-3 h-20 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"
                                                            />
                                                        )}
                                                        {mercadoPagoIntent.checkout_url && (
                                                            <a
                                                                href={mercadoPagoIntent.checkout_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700"
                                                            >
                                                                <ExternalLink className="h-4 w-4" />
                                                                Abrir Mercado Pago
                                                            </a>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRefreshMercadoPagoPayment(debt.id, mercadoPagoIntent.id)}
                                                            disabled={refreshingPaymentIntentId === mercadoPagoIntent.id}
                                                            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                                                        >
                                                            {refreshingPaymentIntentId === mercadoPagoIntent.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                                            Conferir pagamento
                                                        </button>
                                                        <p className="mt-2 text-xs text-slate-500">A baixa acontece automaticamente quando o Mercado Pago confirmar o pagamento.</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="rounded-xl border border-slate-100 bg-slate-50">
                                            {debtPayments.length === 0 ? (
                                                <div className="px-4 py-4 text-sm text-slate-500">Nenhum pagamento registrado para esta conta.</div>
                                            ) : debtPayments.map((payment) => (
                                                <div key={payment.id} className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <CreditCard className="h-4 w-4 text-slate-400" />
                                                            <p className="truncate font-semibold text-slate-800">{payment.recibo_numero || `Pagamento #${payment.id.slice(0, 8)}`}</p>
                                                        </div>
                                                        <p className="mt-1 text-sm text-slate-500">{formatDateTime(payment.created_at || payment.data_pagamento)} - {paymentMethodLabel(payment)}</p>
                                                    </div>
                                                    <p className="shrink-0 text-lg font-bold text-emerald-700">{formatCurrencyCents(payment.valor_pago)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
};
