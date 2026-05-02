import { useEffect, useState } from 'react';
import { Coins } from 'lucide-react';
import { getCashbackSettings } from '@/services/cashbackService';
import type { CashbackSettings } from '@/types/cashback';

// Global cache for settings to prevent multiple fetches across cards
let cachedSettings: CashbackSettings | null = null;
let fetchPromise: Promise<CashbackSettings> | null = null;
const STARTUP_CASHBACK_DELAY_MS = 7000;

const scheduleIdle = (callback: () => void) => {
    let idleId: number | null = null;

    const timeoutId = window.setTimeout(() => {
        if ('requestIdleCallback' in window) {
            idleId = window.requestIdleCallback(callback, { timeout: 3000 });
            return;
        }

        callback();
    }, STARTUP_CASHBACK_DELAY_MS);

    return () => {
        window.clearTimeout(timeoutId);
        if (idleId !== null) {
            window.cancelIdleCallback(idleId);
        }
    };
};

interface CashbackBadgeProps {
    paidAmountBrl: number;
    className?: string;
    variant?: 'minimal' | 'full';
}

export function CashbackBadge({ paidAmountBrl, className = '', variant = 'minimal' }: CashbackBadgeProps) {
    const [settings, setSettings] = useState<CashbackSettings | null>(cachedSettings);

    useEffect(() => {
        if (cachedSettings) {
            setSettings(cachedSettings);
            return;
        }

        let mounted = true;

        const loadSettings = () => {
            if (!fetchPromise) {
                fetchPromise = getCashbackSettings().then(s => {
                    cachedSettings = s;
                    return s;
                }).catch(() => {
                    // Return fallback disabled state on error
                    return {
                        active: false,
                        coins_per_real: 0,
                        coins_to_brl_rate: 0,
                        min_purchase_for_coins: 0,
                        min_coins_to_redeem: 0,
                        max_redeem_percent: 0,
                        created_at: '',
                        updated_at: ''
                    } as unknown as CashbackSettings;
                });
            }

            fetchPromise.then((value) => {
                if (mounted) setSettings(value);
            });
        };

        const cancelIdle = scheduleIdle(loadSettings);

        return () => {
            mounted = false;
            cancelIdle();
        };
    }, []);

    if (!settings || !settings.active) return null;
    if (paidAmountBrl < settings.min_purchase_for_coins) return null;

    const coinsEarned = Math.floor(paidAmountBrl * settings.coins_per_real);
    if (coinsEarned <= 0) return null;

    if (variant === 'full') {
        return (
            <div className={`inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-2 py-1 rounded-md text-xs font-semibold uppercase tracking-wide border border-amber-200 shadow-sm ${className}`}>
                <Coins className="w-3.5 h-3.5 fill-amber-500" />
                <span>+ {coinsEarned} Moedas</span>
            </div>
        );
    }

    return (
        <div className={`inline-flex items-center gap-1 text-amber-600 bg-amber-50/80 px-1.5 py-0.5 rounded text-xs font-bold border border-amber-200/50 ${className}`}>
            <Coins className="w-3 h-3" />
            <span>+{coinsEarned}M</span>
        </div>
    );
}
