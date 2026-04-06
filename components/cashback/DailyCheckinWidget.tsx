import React, { useState, useEffect } from 'react';
import { Coins, Flame, Gift, ChevronRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { performCheckin, getStreakStatus } from '../../services/checkinService';
import { getCoinBalance, getCashbackSettings, coinsToReais } from '../../services/cashbackService';
import type { CoinBalance } from '../../types/cashback';

interface DailyCheckinWidgetProps {
    customerId: string;
    onCoinsEarned?: (amount: number) => void;
    hideBalance?: boolean;
}

export default function DailyCheckinWidget({ customerId, onCoinsEarned, hideBalance = false }: DailyCheckinWidgetProps) {
    const [balance, setBalance] = useState<CoinBalance | null>(null);
    const [checkedInToday, setCheckedInToday] = useState(false);
    const [streak, setStreak] = useState(0);
    const [loading, setLoading] = useState(true);
    const [checking, setChecking] = useState(false);
    const [rate, setRate] = useState(100);

    const load = async () => {
        setLoading(true);
        try {
            const [bal, status, settings] = await Promise.all([
                getCoinBalance(customerId),
                getStreakStatus(customerId),
                getCashbackSettings(),
            ]);
            setBalance(bal);
            setCheckedInToday(status.checkedInToday);
            setStreak(status.streak);
            setRate(settings.coins_to_brl_rate);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [customerId]);

    const handleCheckin = async () => {
        setChecking(true);
        try {
            const result = await performCheckin(customerId);
            if (result.alreadyCheckedIn) {
                toast.info('Você já fez check-in hoje! Volte amanhã 😊');
            } else if (result.success) {
                toast.success(`🪙 +${result.coins_earned} Moedas do Vale! Streak: dia ${result.streak_day}`, {
                    description: result.next_milestone
                        ? `Faltam ${result.next_milestone.day - result.streak_day} dias para o bônus de ${result.next_milestone.bonus} moedas!`
                        : undefined,
                });
                onCoinsEarned?.(result.coins_earned);
                await load();
            }
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setChecking(false);
        }
    };

    if (loading) return <div className="h-24 bg-slate-100 rounded-2xl animate-pulse" />;

    return (
        <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-2xl p-5 space-y-4">
            {/* Saldo */}
            <div className={`flex items-center ${hideBalance ? 'justify-center border-b border-yellow-200/50 pb-4 mb-2' : 'justify-between'}`}>
                {!hideBalance && (
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-yellow-400 rounded-xl">
                            <Coins className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-xs text-amber-700 font-medium uppercase tracking-wide">Moedas do Vale</p>
                            <p className="text-2xl font-bold text-amber-900">
                                {balance?.balance.toLocaleString('pt-BR') ?? '0'}
                                <span className="text-sm font-normal text-amber-600 ml-1">moedas</span>
                            </p>
                            {balance && balance.balance > 0 && (
                                <p className="text-xs text-amber-600">
                                    ≈ R$ {coinsToReais(balance.balance, rate).toFixed(2).replace('.', ',')} em descontos
                                </p>
                            )}
                        </div>
                    </div>
                )}
                {/* Streak */}
                <div className="text-center">
                    <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold ${streak > 0 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                        <Flame className="w-4 h-4" />
                        {streak} dias
                    </div>
                    <p className="text-xs text-slate-400 mt-1">streak</p>
                </div>
            </div>

            {/* Botão de Check-in */}
            {checkedInToday ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <div>
                        <p className="text-sm font-semibold text-green-800">Check-in feito hoje! ✅</p>
                        <p className="text-xs text-green-600">Volte amanhã para manter seu streak de {streak} dias</p>
                    </div>
                </div>
            ) : (
                <button
                    onClick={handleCheckin}
                    disabled={checking}
                    className="w-full flex items-center justify-between bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-white rounded-xl px-4 py-3 font-semibold transition-all shadow-sm hover:shadow-md disabled:opacity-60"
                >
                    <div className="flex items-center gap-2">
                        <Gift className="w-5 h-5" />
                        {checking ? 'Verificando...' : 'Fazer Check-in Diário'}
                    </div>
                    <ChevronRight className="w-4 h-4" />
                </button>
            )}

            {/* Mini progress bar de streak */}
            {streak > 0 && (
                <div>
                    <div className="flex justify-between text-xs text-amber-600 mb-1">
                        <span>Streak atual</span>
                        <span>Próximo bônus: dia {Math.ceil(streak / 7) * 7}</span>
                    </div>
                    <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, ((streak % 7) / 7) * 100)}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
