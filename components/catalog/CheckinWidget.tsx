import React, { useState, useEffect, useCallback } from 'react';
import { Coins, CheckCircle2, LogIn, Flame, Info, ChevronRight, Gift } from 'lucide-react';
import { useSupabaseAuth } from '../../contexts/SupabaseAuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { performCheckin, getStreakStatus } from '../../services/checkinService';
import { CoinsInfoModal } from '../cashback/CoinsInfoModal';

type CheckinCardState = 'loading' | 'guest' | 'ready' | 'done';

interface CheckinStatus {
    streak: number;
    checkedInToday: boolean;
    todayCoins: number;
    dailyValues: number[];
    cyclePosition: number;
}

export function CheckinWidget() {
    const { user, customer } = useSupabaseAuth();
    const navigate = useNavigate();
    const [cardState, setCardState] = useState<CheckinCardState>('loading');
    const [status, setStatus] = useState<CheckinStatus | null>(null);
    const [checking, setChecking] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const loadStatus = useCallback(async () => {
        if (!user || !customer) {
            setCardState('guest');
            return;
        }
        try {
            const s = await getStreakStatus(customer.id);
            setStatus({
                streak: s.streak,
                checkedInToday: s.checkedInToday,
                todayCoins: s.todayCoins,
                dailyValues: s.dailyValues.length > 0 ? s.dailyValues : [5, 10, 15, 20, 25, 30, 50],
                cyclePosition: s.cyclePosition,
            });
            setCardState(s.checkedInToday ? 'done' : 'ready');
        } catch {
            setCardState('ready');
        }
    }, [user, customer]);

    useEffect(() => { loadStatus(); }, [loadStatus]);

    const handleClick = async () => {
        if (cardState === 'guest') { navigate('/cliente/login'); return; }
        if (cardState !== 'ready' || !customer || checking) return;
        setChecking(true);
        try {
            const result = await performCheckin(customer.id);
            if (result.success) {
                setCardState('done');
                setStatus(s => s ? { ...s, checkedInToday: true, streak: result.streak_day } : s);
                const msg = (result as any).is_cycle_complete
                    ? `🎉 Ciclo completo! +${result.coins_earned} Moedas do Vale!`
                    : `🪙 +${result.coins_earned} Moedas do Vale!`;
                toast.success(msg, { description: `Streak: ${result.streak_day} dias` });
            } else if (result.alreadyCheckedIn) {
                setCardState('done');
                toast.info('Você já coletou a moeda de hoje!');
            }
        } catch (error) {
            console.error('Check-in error:', error);
            toast.error('Erro ao fazer check-in. Tente novamente.');
        } finally {
            setChecking(false);
        }
    };

    if (cardState === 'loading') return null;

    // ----- VISITANTE -----
    if (cardState === 'guest') {
        return (
            <div
                onClick={handleClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="group relative flex items-center gap-3 px-4 py-3 rounded-full bg-white/80 backdrop-blur-md border border-slate-200/60 shadow-sm hover:shadow-md cursor-pointer transition-all duration-300"
            >
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-50 to-orange-50 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100 text-yellow-600 group-hover:scale-110 transition-transform">
                    <Coins className="w-4 h-4" />
                </div>
                <div className="relative flex flex-col items-start pr-2">
                    <span className="text-sm font-bold text-slate-800">Check-in Diário</span>
                    <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                        <LogIn className="w-3 h-3" /> Entre para ganhar moedas
                    </span>
                </div>
                <ChevronRight className={`relative w-4 h-4 text-slate-400 transition-transform duration-300 ${isHovered ? 'translate-x-1' : ''}`} />
            </div>
        );
    }

    const todayCoins = status?.todayCoins ?? 5;
    const isDone = cardState === 'done';
    const cyclePos = status?.cyclePosition ?? 1;
    const values = status?.dailyValues ?? [5, 10, 15, 20, 25, 30, 50];
    const isLastCycleDay = cyclePos === values.length;

    // ----- LOGADO -----
    return (
        <>
            <div
                onClick={isDone || checking ? undefined : handleClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={`relative flex items-center justify-between gap-3 p-1.5 pl-3 rounded-full transition-all duration-300 border backdrop-blur-md
                    ${isDone
                        ? 'bg-green-50/90 border-green-200/60 shadow-sm'
                        : 'bg-white/90 border-slate-200/60 shadow-sm hover:shadow-md hover:border-yellow-300/60 cursor-pointer'
                    }
                `}
                style={{ minWidth: '220px' }}
            >
                {/* Background brilho animado (apenas se nao tiver feito checkin) */}
                {!isDone && (
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-100/50 via-orange-50/50 to-transparent opacity-0 hover:opacity-100 transition-opacity overflow-hidden">
                        <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/80 to-transparent skew-x-[-20deg] animate-[shimmer_2s_infinite]" />
                    </div>
                )}

                <div className="relative flex items-center gap-3">
                    {/* Icone Esquerdo */}
                    <div className={`relative flex items-center justify-center w-9 h-9 rounded-full shrink-0 transition-all duration-500 
                        ${isDone
                            ? 'bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-inner scale-100'
                            : 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-md group-hover:scale-110'
                        }
                    `}>
                        {checking ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : isDone ? (
                            <CheckCircle2 className="w-5 h-5 animate-[scaleIn_0.3s_ease-out]" />
                        ) : isLastCycleDay ? (
                            <Gift className="w-5 h-5 animate-pulse" />
                        ) : (
                            <Coins className="w-5 h-5" />
                        )}

                        {/* Indicador de fogo (Streak) pequeno no botao se tiver streak */}
                        {!isDone && (status?.streak ?? 0) > 0 && (
                            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full shadow-sm border border-white">
                                <Flame className="w-2.5 h-2.5" />
                            </div>
                        )}
                    </div>

                    {/* Texto Central */}
                    <div className="relative flex flex-col items-start leading-tight">
                        <span className={`text-[13px] font-bold ${isDone ? 'text-green-800' : 'text-slate-800'}`}>
                            {isDone ? 'Check-in Realizado' : 'Resgatar Moedas'}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            {isDone ? (
                                <span className="text-[10px] font-medium text-green-600 flex items-center gap-1">
                                    <Flame className="w-3 h-3 text-orange-500" />
                                    {status?.streak} {status?.streak === 1 ? 'dia' : 'dias'} seguidos
                                </span>
                            ) : (
                                <span className="text-[11px] font-bold text-orange-600">
                                    +{todayCoins} hoje
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Botao de Info / Seta */}
                <div className="relative pr-1.5 pl-2 border-l border-slate-200/50 flex items-center h-full">
                    {isDone ? (
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowInfo(true); }}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            <Info className="w-4 h-4" />
                        </button>
                    ) : (
                        <ChevronRight className={`w-4 h-4 text-orange-400 transition-transform duration-300 ${isHovered ? 'translate-x-[2px]' : ''}`} />
                    )}
                </div>
            </div>

            {/* Modal de informações */}
            {showInfo && (
                <CoinsInfoModal
                    onClose={() => setShowInfo(false)}
                    dailyValues={status?.dailyValues}
                />
            )}
        </>
    );
}
