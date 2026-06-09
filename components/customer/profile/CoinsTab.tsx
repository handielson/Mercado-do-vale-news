import React, { useEffect, useMemo, useState } from 'react';
import { Coins, ArrowUpRight, ArrowDownRight, Clock, Info, Gift, Flame, ReceiptText } from 'lucide-react';
import { useVpsAuth } from '../../../hooks/useVpsAuth';
import { getCoinBalance, getCoinTransactions, coinsToReais, getCashbackSettings } from '../../../services/cashbackService';
import type { CoinBalance, CoinTransaction } from '../../../types/cashback';
import DailyCheckinWidget from '../../cashback/DailyCheckinWidget';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function CoinsTab() {
    const { customer } = useVpsAuth();
    const [balance, setBalance] = useState<CoinBalance | null>(null);
    const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [rate, setRate] = useState(100);

    const loadData = async () => {
        if (!customer) return;
        setLoading(true);
        try {
            const [bal, txs, settings] = await Promise.all([
                getCoinBalance(customer.id),
                getCoinTransactions(customer.id, 50),
                getCashbackSettings()
            ]);
            setBalance(bal);
            setTransactions(txs);
            setRate(settings.coins_to_brl_rate);
        } catch (error) {
            console.error('Error loading coins data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [customer]);

    const translateType = (type: string) => {
        switch (type) {
            case 'earn_purchase': return 'Ganho em compra';
            case 'earn_checkin': return 'Check-in diario';
            case 'earn_streak': return 'Bonus de sequencia';
            case 'earn_manual': return 'Bonus manual';
            case 'spend_discount': return 'Usado em desconto';
            case 'refund_cancel': return 'Estorno de cancelamento';
            case 'expire': return 'Moedas expiradas';
            case 'admin_adjust': return 'Ajuste administrativo';
            default: return type;
        }
    };

    const coinsSummary = useMemo(() => {
        const earned = transactions
            .filter((tx) => tx.amount > 0 && tx.status !== 'cancelled')
            .reduce((total, tx) => total + tx.amount, 0);
        const spent = transactions
            .filter((tx) => tx.amount < 0 && tx.status !== 'cancelled')
            .reduce((total, tx) => total + Math.abs(tx.amount), 0);

        return {
            balance: balance?.balance ?? 0,
            discountValue: coinsToReais(balance?.balance ?? 0, rate),
            earned,
            spent,
        };
    }, [balance?.balance, rate, transactions]);

    if (loading) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="h-32 w-full rounded-2xl bg-slate-100" />
                <div className="grid gap-4 lg:grid-cols-2">
                    <div className="h-64 rounded-2xl bg-slate-100" />
                    <div className="h-64 rounded-2xl bg-slate-100" />
                </div>
            </div>
        );
    }

    if (!customer) return null;

    return (
        <div className="space-y-6">
            <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-sm font-semibold text-amber-700">Central de moedas</p>
                        <h2 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-800">
                            <Coins className="h-6 w-6 text-amber-500" />
                            Moedas do Vale
                        </h2>
                        <p className="mt-2 text-sm text-slate-500 lg:max-w-3xl">
                            Acompanhe saldo, check-in diario, ganhos e usos das suas moedas em descontos.
                        </p>
                    </div>
                    <a
                        href="/moedas-do-vale"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-fit items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
                    >
                        Ver Regulamento
                        <ArrowUpRight className="h-4 w-4" />
                    </a>
                </div>
            </header>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-100">
                    <p className="text-xs font-bold uppercase text-amber-700">Saldo disponivel</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-800">{coinsSummary.balance.toLocaleString('pt-BR')}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
                    <p className="text-xs font-bold uppercase text-emerald-700">Valor em desconto</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-800">
                        R$ {coinsSummary.discountValue.toFixed(2).replace('.', ',')}
                    </p>
                </div>
                <div className="rounded-xl bg-blue-50 p-4 ring-1 ring-blue-100">
                    <p className="text-xs font-bold uppercase text-blue-700">Ganhos recentes</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-800">{coinsSummary.earned.toLocaleString('pt-BR')}</p>
                </div>
                <div className="rounded-xl bg-rose-50 p-4 ring-1 ring-rose-100">
                    <p className="text-xs font-bold uppercase text-rose-700">Usos recentes</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-800">{coinsSummary.spent.toLocaleString('pt-BR')}</p>
                </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
                <div className="space-y-5">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-bold uppercase text-slate-500">Saldo disponivel</p>
                                <div className="mt-2 flex items-baseline gap-2">
                                    <span className="text-4xl font-semibold text-slate-800">
                                        {coinsSummary.balance.toLocaleString('pt-BR')}
                                    </span>
                                    <span className="text-sm font-bold text-amber-600">moedas</span>
                                </div>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
                                <Coins className="h-6 w-6" />
                            </div>
                        </div>
                        <div className="mt-5 rounded-xl bg-slate-50 p-4">
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                <Info className="h-4 w-4 text-slate-400" />
                                Poder de compra
                            </div>
                            <p className="mt-2 text-lg font-semibold text-slate-800">
                                R$ {coinsSummary.discountValue.toFixed(2).replace('.', ',')} em descontos
                            </p>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center gap-2">
                            <Flame className="h-5 w-5 text-orange-500" />
                            <h3 className="text-lg font-semibold text-slate-800">Check-in diario</h3>
                        </div>
                        <DailyCheckinWidget
                            customerId={customer.id}
                            onCoinsEarned={() => loadData()}
                            hideBalance={true}
                        />
                    </div>

                    <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                            <Gift className="h-5 w-5" />
                        </div>
                        <h3 className="mt-4 text-lg font-semibold text-slate-800">Como ganhar moedas</h3>
                        <div className="mt-4 space-y-3 text-sm text-slate-600">
                            <p>1. Compre produtos participantes.</p>
                            <p>2. Faca check-in diario para manter sequencia.</p>
                            <p>3. Aproveite bonus e campanhas especiais.</p>
                            <p>4. Use o saldo como desconto em compras futuras.</p>
                        </div>
                    </aside>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 bg-slate-50 p-5">
                        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                            <ReceiptText className="h-5 w-5 text-slate-500" />
                            Extrato de Moedas
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">Historico das suas ultimas movimentacoes.</p>
                    </div>

                    <div className="max-h-[560px] overflow-y-auto p-3">
                        {transactions.length === 0 ? (
                            <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-400">
                                Nenhuma transacao encontrada.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {transactions.map((tx) => {
                                    const isPositive = tx.amount > 0;
                                    const isPending = tx.status === 'pending';
                                    const isCancelled = tx.status === 'cancelled';
                                    const iconBg = isPending
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : isCancelled
                                            ? 'bg-slate-100 text-slate-400'
                                            : isPositive
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-red-100 text-red-700';
                                    const amountColor = isPending
                                        ? 'text-yellow-700'
                                        : isCancelled
                                            ? 'text-slate-400 line-through'
                                            : isPositive
                                                ? 'text-emerald-700'
                                                : 'text-red-700';

                                    return (
                                        <div key={tx.id} className={`flex flex-col gap-3 rounded-xl border border-slate-100 p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between ${isCancelled ? 'opacity-60' : ''}`}>
                                            <div className="flex items-start gap-3">
                                                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
                                                    {isPending ? <Clock className="h-5 w-5" /> : (isPositive ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />)}
                                                </div>
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="text-sm font-bold text-slate-800">{translateType(tx.type)}</p>
                                                        {isPending && <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold uppercase text-yellow-700">Pendente</span>}
                                                        {isCancelled && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">Cancelado</span>}
                                                    </div>
                                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                                        <span>{format(new Date(tx.created_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}</span>
                                                        {tx.reference_id && (
                                                            <span className="font-mono uppercase text-slate-400">#{tx.reference_id.slice(0, 8)}</span>
                                                        )}
                                                        {tx.description && <span className="truncate sm:max-w-[240px]">{tx.description}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`flex items-center gap-1 text-lg font-semibold ${amountColor}`}>
                                                {isPositive && !isCancelled ? '+' : ''}{tx.amount}
                                                <Coins className="h-4 w-4" />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}
