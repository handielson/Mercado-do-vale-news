import { supabase } from './supabase';
import type { CheckinLog, CheckinResult, CashbackSettings } from '../types/cashback';
import { getCashbackSettings } from './cashbackService';

// ============================================================
// HELPERS DE PROGRESSÃO
// ============================================================

/**
 * Retorna as moedas para um determinado dia do ciclo.
 * settings.checkin_daily_values é um array, ex: [5, 10, 15, 20, 25, 30, 50]
 * O ciclo é o tamanho do array. Dia 1 → índice 0, Dia 7 → índice 6, Dia 8 → índice 0 (reinicia).
 */
function getCoinsForStreakDay(settings: CashbackSettings & { checkin_daily_values?: number[] }, streakDay: number): number {
    const values: number[] = settings.checkin_daily_values ?? [settings.checkin_base_coins];
    if (values.length === 0) return settings.checkin_base_coins;
    const idx = (streakDay - 1) % values.length;
    return values[idx];
}

/** Retorna o array de progressão completo (7 valores padrão se não configurado) */
export function getDailyValues(settings: CashbackSettings & { checkin_daily_values?: number[] }): number[] {
    return settings.checkin_daily_values ?? [settings.checkin_base_coins];
}

// ============================================================
// CALCULAR STREAK
// ============================================================

async function getYesterdayStreak(customerId: string): Promise<number> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const { data } = await supabase
        .from('checkin_logs')
        .select('streak_day, checkin_date')
        .eq('customer_id', customerId)
        .eq('checkin_date', yesterdayStr)
        .maybeSingle();

    return data ? data.streak_day : 0; // 0 = não fez ontem → streak reinicia
}

// ============================================================
// CHECK-IN DIÁRIO
// ============================================================

export async function performCheckin(customerId: string): Promise<CheckinResult> {
    const today = new Date().toISOString().split('T')[0];

    // Verificar se já fez check-in hoje
    const { data: existing } = await supabase
        .from('checkin_logs')
        .select('id, coins_earned, streak_day')
        .eq('customer_id', customerId)
        .eq('checkin_date', today)
        .maybeSingle();

    if (existing) {
        return {
            success: false,
            alreadyCheckedIn: true,
            coins_earned: existing.coins_earned,
            streak_day: existing.streak_day,
        };
    }

    const settings = await getCashbackSettings() as CashbackSettings & { checkin_daily_values?: number[] };

    if (!settings.active) {
        return { success: false, alreadyCheckedIn: false, coins_earned: 0, streak_day: 0, error: 'Sistema de moedas inativo' };
    }

    // Calcular streak atual
    const previousStreak = await getYesterdayStreak(customerId);
    const newStreakDay = previousStreak + 1;

    // ⭐ Moedas progressivas baseadas no dia do ciclo
    const totalCoins = getCoinsForStreakDay(settings, newStreakDay);
    const cycleLen = getDailyValues(settings).length;
    const isLastCycleDay = newStreakDay % cycleLen === 0;

    // Registrar check-in
    const { error: checkinError } = await supabase
        .from('checkin_logs')
        .insert({
            customer_id: customerId,
            checkin_date: today,
            coins_earned: totalCoins,
            streak_day: newStreakDay,
        });

    if (checkinError) {
        // Conflito = check-in duplicado (race condition)
        if (checkinError.code === '23505') {
            return { success: false, alreadyCheckedIn: true, coins_earned: 0, streak_day: newStreakDay };
        }
        throw new Error(`Erro no check-in: ${checkinError.message}`);
    }

    // Creditar moedas (tudo em uma só transação)
    const type = isLastCycleDay ? 'earn_streak' : 'earn_checkin';
    const desc = isLastCycleDay
        ? `🎉 Check-in dia ${newStreakDay} — Bônus de ciclo!`
        : `Check-in dia ${newStreakDay} (dia ${((newStreakDay - 1) % cycleLen) + 1} do ciclo)`;

    const { error: coinsError } = await supabase.rpc('add_coins', {
        p_customer_id: customerId,
        p_amount: totalCoins,
        p_type: type,
        p_description: desc,
        p_reference_type: 'checkin',
    });
    if (coinsError) throw new Error(`Erro ao creditar moedas do check-in: ${coinsError.message}`);

    return {
        success: true,
        alreadyCheckedIn: false,
        coins_earned: totalCoins,
        streak_day: newStreakDay,
        is_cycle_complete: isLastCycleDay,
    };
}

// ============================================================
// HISTÓRICO DE CHECK-INS
// ============================================================

export async function getCheckinHistory(
    customerId: string,
    days = 30
): Promise<CheckinLog[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('checkin_logs')
        .select('*')
        .eq('customer_id', customerId)
        .gte('checkin_date', sinceStr)
        .order('checkin_date', { ascending: false });

    if (error) throw new Error(`Erro ao buscar histórico: ${error.message}`);
    return (data ?? []) as CheckinLog[];
}

// ============================================================
// STATUS DO STREAK ATUAL
// ============================================================

export async function getStreakStatus(customerId: string): Promise<{
    streak: number;
    lastCheckin: string | null;
    checkedInToday: boolean;
    todayCoins: number;
    nextCoins: number;
    dailyValues: number[];
    cyclePosition: number; // 1-based position in current cycle
}> {
    const today = new Date().toISOString().split('T')[0];
    const settings = await getCashbackSettings() as CashbackSettings & { checkin_daily_values?: number[] };
    const dailyValues = getDailyValues(settings);

    const { data } = await supabase
        .from('checkin_logs')
        .select('checkin_date, streak_day')
        .eq('customer_id', customerId)
        .order('checkin_date', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!data) {
        return {
            streak: 0,
            lastCheckin: null,
            checkedInToday: false,
            todayCoins: dailyValues[0] ?? settings.checkin_base_coins,
            nextCoins: dailyValues[1] ?? dailyValues[0] ?? settings.checkin_base_coins,
            dailyValues,
            cyclePosition: 1,
        };
    }

    const checkedInToday = data.checkin_date === today;
    const currentStreak = data.streak_day;
    const cyclePosition = checkedInToday
        ? ((currentStreak - 1) % dailyValues.length) + 1
        : (currentStreak % dailyValues.length) + 1; // próximo dia

    const todayCoins = checkedInToday
        ? getCoinsForStreakDay(settings, currentStreak)
        : getCoinsForStreakDay(settings, currentStreak + 1);
    const nextCoins = getCoinsForStreakDay(settings, currentStreak + (checkedInToday ? 1 : 2));

    return {
        streak: currentStreak,
        lastCheckin: data.checkin_date,
        checkedInToday,
        todayCoins,
        nextCoins,
        dailyValues,
        cyclePosition,
    };
}
