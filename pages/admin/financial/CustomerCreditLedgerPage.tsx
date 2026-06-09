import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calendar, CreditCard, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { customerService } from '../../../services/customers';
import { getSaleById } from '../../../services/saleService';
import {
    formatCurrencyCents,
    listCustomerDebtPayments,
    listCustomerDebts,
    registerCustomerDebtPayment,
    toCents,
    type CustomerDebt,
    type CustomerDebtPayment,
} from '../../../services/customerDebtService';
import type { Customer } from '../../../types/customer';
import type { SaleWithItems } from '../../../types/sale';

const paymentMethodOptions = [
    { value: 'pix', label: 'Pix' },
    { value: 'dinheiro', label: 'Dinheiro' },
    { value: 'cartao', label: 'Cartao' },
    { value: 'outro', label: 'Outra' },
];

function formatSaleMoney(value: unknown): string {
    return formatCurrencyCents(value);
}

function formatDate(value?: string): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('pt-BR');
}

function normalizeStatus(status?: string): string {
    return String(status || '').toLowerCase();
}

function statusLabel(status?: string): string {
    const normalized = normalizeStatus(status);
    if (normalized === 'paid') return 'Pago';
    if (normalized === 'partial') return 'Parcial';
    if (normalized === 'cancelled' || normalized === 'canceled') return 'Cancelado';
    return 'Pendente';
}

function statusClass(status?: string): string {
    const normalized = normalizeStatus(status);
    if (normalized === 'paid') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (normalized === 'partial') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (normalized === 'cancelled' || normalized === 'canceled') return 'bg-slate-50 text-slate-500 border-slate-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
}

export default function CustomerCreditLedgerPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const customerId = searchParams.get('customer_id') || '';
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [debts, setDebts] = useState<CustomerDebt[]>([]);
    const [payments, setPayments] = useState<CustomerDebtPayment[]>([]);
    const [linkedSales, setLinkedSales] = useState<Record<string, SaleWithItems>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [paymentDebt, setPaymentDebt] = useState<CustomerDebt | null>(null);
    const [paymentValue, setPaymentValue] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('pix');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [savingPayment, setSavingPayment] = useState(false);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const [debtData, paymentData, customerData] = await Promise.all([
                listCustomerDebts(customerId),
                listCustomerDebtPayments(customerId),
                customerId ? customerService.getById(customerId).catch(() => null) : Promise.resolve(null),
            ]);
            const nextDebts = debtData;
            setDebts(nextDebts);
            setPayments(paymentData);
            setCustomer(customerData);
            const saleIds = Array.from(new Set(nextDebts.map(debt => debt.sale_id).filter(Boolean))) as string[];
            const salePairs = await Promise.all(
                saleIds.map(async (saleId) => [saleId, await getSaleById(saleId).catch(() => null)] as const)
            );
            setLinkedSales(Object.fromEntries(salePairs.filter(([, sale]) => sale)) as Record<string, SaleWithItems>);
        } catch (err: any) {
            setError(err?.message || 'Erro ao carregar crediario');
            setDebts([]);
            setPayments([]);
            setLinkedSales({});
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [customerId]);

    const filteredDebts = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return debts;
        return debts.filter((debt) => [
            debt.descricao,
            debt.sale_id,
            debt.customer_id,
            debt.status,
        ].some((value) => String(value || '').toLowerCase().includes(term)));
    }, [debts, searchTerm]);

    const summary = useMemo(() => {
        return debts.reduce((acc, debt) => {
            const status = normalizeStatus(debt.status);
            const total = toCents(debt.valor_total);
            const balance = toCents(debt.saldo_devedor);
            const cancelled = status === 'cancelled' || status === 'canceled';
            const paid = status === 'paid' || balance <= 0;

            acc.total += total;
            if (!cancelled && !paid) acc.open += balance;
            if (paid) acc.paid += total;
            else acc.paid += Math.max(0, total - balance);
            return acc;
        }, { total: 0, open: 0, paid: 0 });
    }, [debts]);

    const paymentsByDebtId = useMemo(() => {
        const map = new Map<string, CustomerDebtPayment[]>();
        payments.forEach((payment) => {
            const current = map.get(payment.debt_id) || [];
            current.push(payment);
            map.set(payment.debt_id, current);
        });
        return map;
    }, [payments]);

    const openPaymentModal = (debt: CustomerDebt) => {
        const balance = toCents(debt.saldo_devedor);
        setPaymentDebt(debt);
        setPaymentValue((balance / 100).toFixed(2).replace('.', ','));
        setPaymentMethod('pix');
        setPaymentNotes('');
    };

    const closePaymentModal = () => {
        if (savingPayment) return;
        setPaymentDebt(null);
        setPaymentValue('');
        setPaymentNotes('');
    };

    const parseMoneyToCents = (value: string) => {
        const normalized = value.replace(/\./g, '').replace(',', '.').trim();
        const amount = Number(normalized);
        return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
    };

    const submitPayment = async () => {
        if (!paymentDebt) return;
        const valueCents = parseMoneyToCents(paymentValue);
        const balance = toCents(paymentDebt.saldo_devedor);
        if (valueCents <= 0) {
            toast.error('Informe um valor valido para a baixa');
            return;
        }
        if (valueCents > balance) {
            toast.error('O valor da baixa nao pode ser maior que o saldo');
            return;
        }
        setSavingPayment(true);
        try {
            await registerCustomerDebtPayment({
                debt_id: paymentDebt.id,
                valor_pago: valueCents,
                data_pagamento: new Date().toISOString().slice(0, 10),
                metodo_pagamento: paymentMethod,
                observacoes: paymentNotes || undefined,
            });
            toast.success('Baixa registrada');
            setPaymentDebt(null);
            setPaymentValue('');
            setPaymentNotes('');
            await load();
        } catch (err: any) {
            toast.error(err?.message || 'Erro ao registrar baixa');
        } finally {
            setSavingPayment(false);
        }
    };

    const clearCustomerFilter = () => {
        const next = new URLSearchParams(searchParams);
        next.delete('customer_id');
        setSearchParams(next);
    };

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                        <CreditCard size={20} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Crediario</h1>
                        <p className="text-sm text-slate-500">
                            {customer ? customer.name : 'Saldos de clientes e vendas a prazo'}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {customerId && (
                        <button
                            onClick={clearCustomerFilter}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                        >
                            Ver todos
                        </button>
                    )}
                    <Link
                        to={customerId ? `/admin/customers/${encodeURIComponent(customerId)}` : '/admin/customers'}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                        <ArrowLeft size={16} />
                        Cliente
                    </Link>
                    <button
                        onClick={load}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        Atualizar
                    </button>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-xs font-bold uppercase text-slate-500">Saldo em aberto</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">{formatCurrencyCents(summary.open)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-xs font-bold uppercase text-slate-500">Pago</p>
                    <p className="mt-1 text-2xl font-black text-emerald-700">{formatCurrencyCents(summary.paid)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-xs font-bold uppercase text-slate-500">Total gerado</p>
                    <p className="mt-1 text-2xl font-black text-blue-700">{formatCurrencyCents(summary.total)}</p>
                </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Buscar por pedido, descricao ou status..."
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    />
                </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-5 py-4">
                    <h2 className="text-lg font-bold text-slate-900">Historico de pagamentos</h2>
                </div>
                {error && (
                    <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {error}
                    </div>
                )}
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
                        <Loader2 className="animate-spin" size={22} />
                        Carregando crediario...
                    </div>
                ) : filteredDebts.length === 0 || payments.length === 0 ? (
                    <div className="py-16 text-center text-slate-400">
                        <CreditCard size={40} className="mx-auto mb-3 opacity-30" />
                        <p className="font-medium">Nenhum pagamento encontrado</p>
                    </div>
                ) : (
                    <div className="space-y-5 p-5">
                        {filteredDebts.map((debt) => {
                            const debtPayments = paymentsByDebtId.get(debt.id) || [];
                            if (debtPayments.length === 0) return null;
                            const sale = debt?.sale_id ? linkedSales[debt.sale_id] : null;
                            return (
                                <div key={debt.id} className="space-y-3">
                                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Conta vinculada</p>
                                                <h3 className="mt-1 text-lg font-bold text-slate-900">{debt.descricao || 'Venda a prazo'}</h3>
                                                <p className="mt-1 text-sm text-slate-500">
                                                    Total: <strong>{formatCurrencyCents(debt.valor_total)}</strong>
                                                    {' | '}
                                                    Saldo: <strong>{formatCurrencyCents(debt.saldo_devedor)}</strong>
                                                </p>
                                            </div>
                                            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
                                                {debtPayments.length} baixa{debtPayments.length === 1 ? '' : 's'}
                                            </div>
                                        </div>
                                    </div>

                                    {sale && (
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Pedido vinculado</p>
                                            <h3 className="mt-1 text-lg font-bold text-slate-900">Venda PDV #{sale.id.slice(0, 8).toUpperCase()}</h3>
                                            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                    <p className="text-sm font-black uppercase text-slate-700">Venda PDV #{sale.id.slice(0, 8).toUpperCase()}</p>
                                                    <p className="text-sm font-semibold text-slate-600">Total da venda: {formatSaleMoney(sale.total)}</p>
                                                </div>
                                                <div className="mt-3 space-y-1">
                                                    {sale.items.map((item) => (
                                                        <div key={item.id} className="flex items-start justify-between gap-4 text-sm">
                                                            <span className="font-medium text-slate-800">
                                                                {item.quantity}x {item.product_name}
                                                                {item.product_sku && <span className="text-slate-500"> | {item.product_sku}</span>}
                                                            </span>
                                                            <span className="whitespace-nowrap font-semibold text-slate-800">{formatSaleMoney(item.total)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        {debtPayments.map((payment) => (
                                            <div key={payment.id} className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                    <div>
                                                        <p className="text-xs font-black uppercase text-emerald-700">Pagamento recebido</p>
                                                        <p className="mt-1 text-2xl font-black text-emerald-800">{formatCurrencyCents(payment.valor_pago)}</p>
                                                    </div>
                                                    <div className="text-sm text-slate-700 sm:text-right">
                                                        <p><strong>Data:</strong> {formatDate(payment.data_pagamento)}</p>
                                                        <p><strong>Forma:</strong> {payment.metodo_pagamento || payment.forma_pagamento || '-'}</p>
                                                        {payment.recibo_numero && <p><strong>Recibo:</strong> {payment.recibo_numero}</p>}
                                                    </div>
                                                </div>
                                                {payment.observacoes && (
                                                    <div className="mt-3 rounded border border-emerald-100 bg-white/80 px-3 py-2 text-sm text-slate-700">
                                                        <strong>Observacoes:</strong> {payment.observacoes}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
                        <Loader2 className="animate-spin" size={22} />
                        Carregando debitos...
                    </div>
                ) : filteredDebts.length === 0 ? (
                    <div className="py-16 text-center text-slate-400">
                        <CreditCard size={40} className="mx-auto mb-3 opacity-30" />
                        <p className="font-medium">Nenhum debito encontrado</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50">
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Referencia</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Vencimento</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Total</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Saldo</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Status</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Acoes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredDebts.map((debt) => (
                                    <tr key={debt.id} className="border-b border-slate-100 last:border-0">
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-slate-800">{debt.descricao || 'Venda a prazo'}</p>
                                            <p className="text-xs text-slate-500">
                                                {debt.sale_id ? `Pedido #${debt.sale_id.slice(0, 8).toUpperCase()}` : debt.id}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600">
                                            <span className="inline-flex items-center gap-1">
                                                <Calendar size={14} />
                                                {formatDate(debt.data_vencimento)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrencyCents(debt.valor_total)}</td>
                                        <td className="px-4 py-3 text-right font-black text-slate-900">{formatCurrencyCents(debt.saldo_devedor)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(debt.status)}`}>
                                                {statusLabel(debt.status)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {toCents(debt.saldo_devedor) > 0 && normalizeStatus(debt.status) !== 'paid' && (
                                                <button
                                                    type="button"
                                                    onClick={() => openPaymentModal(debt)}
                                                    className="inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                                                >
                                                    Dar baixa
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {paymentDebt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
                    <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Registrar baixa</h2>
                                <p className="text-sm text-slate-500">{paymentDebt.descricao || 'Debito do cliente'}</p>
                            </div>
                            <button type="button" onClick={closePaymentModal} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="space-y-4 px-5 py-4">
                            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                                Saldo atual: <strong>{formatCurrencyCents(paymentDebt.saldo_devedor)}</strong>
                            </div>
                            <label className="block">
                                <span className="text-sm font-semibold text-slate-700">Valor da baixa</span>
                                <div className="mt-1 flex gap-2">
                                    <input
                                        value={paymentValue}
                                        onChange={(event) => setPaymentValue(event.target.value)}
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                        placeholder="0,00"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setPaymentValue((toCents(paymentDebt.saldo_devedor) / 100).toFixed(2).replace('.', ','))}
                                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                                    >
                                        Total
                                    </button>
                                </div>
                            </label>
                            <label className="block">
                                <span className="text-sm font-semibold text-slate-700">Forma da baixa</span>
                                <select
                                    value={paymentMethod}
                                    onChange={(event) => setPaymentMethod(event.target.value)}
                                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                >
                                    {paymentMethodOptions.map(option => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="block">
                                <span className="text-sm font-semibold text-slate-700">Observacoes</span>
                                <textarea
                                    value={paymentNotes}
                                    onChange={(event) => setPaymentNotes(event.target.value)}
                                    className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                    placeholder="Opcional"
                                />
                            </label>
                        </div>
                        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
                            <button type="button" onClick={closePaymentModal} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={submitPayment}
                                disabled={savingPayment}
                                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                                {savingPayment && <Loader2 size={16} className="animate-spin" />}
                                Registrar baixa
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
