import React, { useState, useEffect, useCallback } from 'react';
import { Grid, Smartphone, Tablet, Box, Package, Coins, CheckCircle2, LogIn, Flame, Info } from 'lucide-react';
import { useSupabaseAuth } from '../../contexts/SupabaseAuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { performCheckin, getStreakStatus } from '../../services/checkinService';
import { CoinsInfoModal } from '../cashback/CoinsInfoModal';

interface Category {
    id: string | null;
    name: string;
    icon: React.ReactNode;
    count?: number;
}

interface CategoryNavProps {
    activeCategory: string | null;
    onCategoryChange: (categoryId: string | null) => void;
    categories: Array<{ id?: string; name: string; count: number }>;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    'TODOS': <Grid className="w-8 h-8" />,
    'CELULARES': <Smartphone className="w-8 h-8" />,
    'TABLETS': <Tablet className="w-8 h-8" />,
    'RECEPTOR': <Box className="w-8 h-8" />,
    'OUTROS': <Package className="w-8 h-8" />,
};

// ============================================================
// CARD DE CHECK-IN
// ============================================================
type CheckinCardState = 'loading' | 'guest' | 'ready' | 'done';

interface CheckinStatus {
    streak: number;
    checkedInToday: boolean;
    todayCoins: number;
    dailyValues: number[];
    cyclePosition: number;
}

function CheckinCard() {
    const { user, customer } = useSupabaseAuth();
    const navigate = useNavigate();
    const [cardState, setCardState] = useState<CheckinCardState>('loading');
    const [status, setStatus] = useState<CheckinStatus | null>(null);
    const [checking, setChecking] = useState(false);
    const [showInfo, setShowInfo] = useState(false);

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
        } catch {
            toast.error('Erro ao fazer check-in. Tente novamente.');
        } finally {
            setChecking(false);
        }
    };

    if (cardState === 'loading') return null;

    // ----- VISITANTE -----
    if (cardState === 'guest') {
        return (
            <button
                onClick={handleClick}
                className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-yellow-300 bg-yellow-50 hover:border-yellow-400 hover:bg-yellow-100 transition-all min-w-[120px] sm:min-w-0 group"
            >
                <Coins className="w-8 h-8 text-yellow-500 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold uppercase tracking-wide text-yellow-700">Check-in</span>
                <span className="flex items-center gap-0.5 text-[10px] text-yellow-600 mt-1">
                    <LogIn className="w-3 h-3" /> Entrar para ganhar
                </span>
            </button>
        );
    }

    const values = status?.dailyValues ?? [5, 10, 15, 20, 25, 30, 50];
    const cyclePos = status?.cyclePosition ?? 1; // 1-based posição atual no ciclo
    const todayCoins = status?.todayCoins ?? values[0];
    const isDone = cardState === 'done';

    // ----- LOGADO: card com mini-calendário progressivo -----
    return (
        <>
            <button
                onClick={handleClick}
                disabled={isDone || checking}
                className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all min-w-[140px] sm:min-w-0
                ${isDone
                        ? 'border-green-300 bg-green-50 cursor-default'
                        : 'border-yellow-400 bg-gradient-to-b from-yellow-50 to-amber-50 hover:from-yellow-100 hover:to-amber-100 hover:shadow-md'
                    }
            `}
            >
                {/* Título */}
                <div className="flex items-center gap-1 mb-2">
                    {isDone
                        ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                        : <Coins className="w-4 h-4 text-yellow-600" />
                    }
                    <span className={`text-xs font-bold uppercase tracking-wide ${isDone ? 'text-green-700' : 'text-yellow-700'}`}>
                        {isDone ? 'Moeda Pega!' : checking ? 'Coletando...' : 'Check-in'}
                    </span>
                    <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setShowInfo(true); }}
                        className="ml-auto p-0.5 rounded hover:bg-black/10 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Como funciona?"
                    >
                        <Info className="w-3 h-3" />
                    </button>
                </div>

                {/* Calendário progressivo (mini, 7 células) */}
                <div className="flex gap-1">
                    {values.map((coins, idx) => {
                        const dayNum = idx + 1; // 1-based
                        const isPast = isDone ? dayNum <= cyclePos : dayNum < cyclePos;
                        const isToday = isDone ? dayNum === cyclePos : dayNum === cyclePos;
                        const isFuture = dayNum > cyclePos;
                        const isLastDay = idx === values.length - 1;

                        return (
                            <div
                                key={idx}
                                className={`flex flex-col items-center rounded-md px-1 py-0.5 min-w-[18px]
                                ${isToday
                                        ? isDone
                                            ? 'bg-green-400 text-white'
                                            : 'bg-yellow-500 text-white scale-105 shadow'
                                        : isPast
                                            ? 'bg-slate-200 text-slate-400'
                                            : isLastDay
                                                ? 'bg-amber-100 text-amber-700 border border-amber-300'
                                                : 'bg-slate-100 text-slate-400'
                                    }
                            `}
                            >
                                {/* Ícone moeda ou check */}
                                <span className="text-[8px] leading-none">
                                    {isPast && !isToday ? '✓' : isLastDay ? '🎁' : '🪙'}
                                </span>
                                {/* Quantidade */}
                                <span className="text-[8px] font-bold leading-tight">{coins}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Streak e moedas de hoje */}
                <div className="flex items-center gap-1.5 mt-2">
                    {(status?.streak ?? 0) > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-orange-500 font-semibold">
                            <Flame className="w-3 h-3" />{status?.streak}d
                        </span>
                    )}
                    {!isDone && (
                        <span className="text-[10px] text-yellow-700 font-bold">
                            +{todayCoins} hoje
                        </span>
                    )}
                </div>
            </button>

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

// ============================================================
// CATEGORY NAV
// ============================================================
export const CategoryNav: React.FC<CategoryNavProps> = ({
    activeCategory,
    onCategoryChange,
    categories
}) => {
    const safeCategories = Array.isArray(categories) ? categories : [];
    const allCategories: Category[] = [
        {
            id: null,
            name: 'TODOS',
            icon: CATEGORY_ICONS['TODOS'],
            count: safeCategories.reduce((sum, cat) => sum + cat.count, 0)
        },
        ...safeCategories.map(cat => ({
            id: cat.id || cat.name,
            name: cat.name.toUpperCase(),
            icon: CATEGORY_ICONS[cat.name.toUpperCase()] || CATEGORY_ICONS['OUTROS'],
            count: cat.count
        }))
    ];

    return (
        <div className="bg-white border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="overflow-x-auto scrollbar-hide">
                    <div className="flex gap-3 min-w-max sm:min-w-0 sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                        {allCategories.map((category) => {
                            const isActive = activeCategory === category.id;
                            return (
                                <button
                                    key={category.id || 'all'}
                                    onClick={() => onCategoryChange(category.id)}
                                    className={`
                                        flex flex-col items-center justify-center
                                        p-4 rounded-xl border-2 transition-all duration-200
                                        min-w-[120px] sm:min-w-0
                                        ${isActive
                                            ? 'bg-red-600 border-red-600 text-white shadow-lg scale-105'
                                            : 'bg-white border-slate-200 text-slate-700 hover:border-red-400 hover:shadow-md'
                                        }
                                    `}
                                >
                                    <div className={`mb-2 ${isActive ? 'text-white' : 'text-slate-600'}`}>
                                        {category.icon}
                                    </div>
                                    <span className={`text-xs font-bold uppercase tracking-wide ${isActive ? 'text-white' : 'text-slate-700'}`}>
                                        {category.name}
                                    </span>
                                </button>
                            );
                        })}

                        {/* Card de Check-in — sempre no final */}
                        <CheckinCard />
                    </div>
                </div>
            </div>
        </div>
    );
};
