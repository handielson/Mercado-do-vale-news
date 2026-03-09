import React, { useState, useEffect } from 'react';
import { Coins, Flame, ArrowUpRight, ArrowDownRight, Clock, Info } from 'lucide-react';
import { useSupabaseAuth } from '../../../hooks/useSupabaseAuth';
import { getCoinBalance, getCoinTransactions, coinsToReais, getCashbackSettings } from '../../../services/cashbackService';
import type { CoinBalance, CoinTransaction } from '../../../types/cashback';
import DailyCheckinWidget from '../../cashback/DailyCheckinWidget';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function CoinsTab() {
    const { customer } = useSupabaseAuth();
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

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-40 bg-slate-100 rounded-2xl w-full"></div>
                <div className="h-64 bg-slate-100 rounded-2xl w-full"></div>
            </div>
        );
    }

    if (!customer) return null;

    const translateType = (type: string) => {
        switch (type) {
            case 'earn_purchase': return 'Ganho em compra';
            case 'earn_checkin': return 'Check-in diário';
            case 'earn_streak': return 'Bônus de sequência (Streak)';
            case 'earn_manual': return 'Bônus manual';
            case 'spend_discount': return 'Usado em desconto';
            case 'refund_cancel': return 'Estorno de cancelamento';
            case 'expire': return 'Moedas expiradas';
            case 'admin_adjust': return 'Ajuste administrativo';
            default: return type;
        }
    };

    return (
        <div className="space-y-8 animate-[fadeIn_0.5s_ease-out]">
            {/* Cabecalho Principal */}
            <div>
                <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                    <div className="p-2 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-xl shadow-sm text-white">
                        <Coins className="w-5 h-5" />
                    </div>
                    Moedas do Vale
                </h2>
                <p className="text-slate-500 mt-2 text-sm leading-relaxed max-w-2xl">
                    Seu saldo funciona como dinheiro na nossa loja. Acumule através de compras e mantendo a sua ofensiva diária de check-in para ganhar descontos incríveis nos seus próximos pedidos!
                    {' '}<a href="/moedas-do-vale" target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:text-amber-700 font-medium hover:underline inline-flex items-center gap-1 transition-colors">
                        Ver Regulamento
                        <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                </p>
            </div>

            {/* Area Principal - Grid Divider */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Coluna Esquerda: Saldo e Check-in */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                    {/* Saldo Destaque */}
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700 shadow-xl p-8 text-white">
                        <div className="absolute top-0 right-0 p-32 bg-yellow-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                        <div className="relative z-10">
                            <h3 className="text-slate-400 font-medium text-sm flex items-center gap-1.5 uppercase tracking-widest mb-2">
                                Saldo Atual
                                <Info className="w-3.5 h-3.5 opacity-50" />
                            </h3>
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-black bg-gradient-to-b from-yellow-300 to-amber-500 bg-clip-text text-transparent drop-shadow-sm">
                                    {balance?.balance.toLocaleString('pt-BR') ?? '0'}
                                </span>
                                <span className="text-yellow-500 font-bold text-lg">moedas</span>
                            </div>

                            {balance && balance.balance > 0 && (
                                <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center gap-3">
                                    <div className="p-1.5 bg-green-500/20 text-green-400 rounded-lg">
                                        <ArrowUpRight className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-xs">Poder de compra disponível</p>
                                        <p className="text-white font-semibold flex items-center gap-1.5">
                                            R$ {coinsToReais(balance.balance, rate).toFixed(2).replace('.', ',')}
                                            <span className="text-[10px] text-green-400 uppercase tracking-wide font-bold bg-green-500/10 px-1.5 py-0.5 rounded">Em Descontos</span>
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Widget Original de Check-in (ou injetar o DailyCheckinWidget aqui, passando callback) */}
                    <DailyCheckinWidget
                        customerId={customer.id}
                        onCoinsEarned={() => loadData()}
                        hideBalance={true}
                    />
                </div>

                {/* Coluna Direita: Extrato / Historico de Transacoes */}
                <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-400" />
                            Extrato de Moedas
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">Histórico das suas últimas interações de moedas</p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2" style={{ maxHeight: '500px' }}>
                        {transactions.length === 0 ? (
                            <div className="flex items-center justify-center h-48 text-slate-400 text-sm italic">
                                Nenhuma transação encontrada.
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {transactions.map((tx) => {
                                    const isPositive = tx.amount > 0;
                                    const correctedAmount = tx.amount;
                                    const displayDesc = tx.description;
                                    const isPending = tx.status === 'pending';
                                    const isCancelled = tx.status === 'cancelled';

                                    let iconBg = isPositive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600';
                                    let amountColor = isPositive ? 'text-green-600' : 'text-red-600';

                                    if (isPending) {
                                        iconBg = 'bg-yellow-100 text-yellow-600';
                                        amountColor = 'text-yellow-600';
                                    } else if (isCancelled) {
                                        iconBg = 'bg-slate-100 text-slate-400';
                                        amountColor = 'text-slate-400 line-through';
                                    }

                                    return (
                                        <div key={tx.id} className={`flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-colors ${isCancelled ? 'opacity-60' : ''}`}>
                                            <div className="flex items-center gap-4">
                                                <div className={`p-2.5 rounded-2xl flex items-center justify-center shrink-0 ${iconBg}`}>
                                                    {isPending ? <Clock className="w-5 h-5" /> : (isPositive ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />)}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                                                        {translateType(tx.type)}
                                                        {isPending && <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full uppercase tracking-wide">Pendente</span>}
                                                        {isCancelled && <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-wide">Cancelado</span>}
                                                        {tx.type === 'earn_purchase' && tx.reference_id && (
                                                            <span className="ml-2 text-xs text-slate-400 font-normal">
                                                                (Pedido <span className="font-mono text-slate-500 uppercase">#{tx.reference_id.slice(0, 8)}</span>)
                                                            </span>
                                                        )}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs text-slate-400">
                                                            {format(new Date(tx.created_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                                                        </span>
                                                        {displayDesc && (
                                                            <>
                                                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                                <span className="text-xs text-slate-500 truncate max-w-[150px] sm:max-w-[200px]" title={displayDesc}>
                                                                    {displayDesc}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className={`font-bold text-base flex items-center justify-end gap-1 ${amountColor}`}>
                                                    {isPositive && !isCancelled ? '+' : ''}{correctedAmount}
                                                    <Coins className="w-3.5 h-3.5" />
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
