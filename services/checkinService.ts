import { vpsClient } from './vpsClient';
import type { CheckinLog, CheckinResult, CashbackSettings } from '../types/cashback';
import { addCoins, getCashbackSettings } from './cashbackService';

// ============================================================
// HELPERS DE PROGRESSÃƒO
// ============================================================

/**
 * Retorna as moedas para um determinado dia do ciclo.
 * settings.checkin_daily_values Ã© um array, ex: [5, 10, 15, 20, 25, 30, 50]
 * O ciclo Ã© o tamanho do array. Dia 1 â†’ Ã­ndice 0, Dia 7 â†’ Ã­ndice 6, Dia 8 â†’ Ã­ndice 0 (reinicia).
 */
function getCoinsForStreakDay(settings: CashbackSettings & { checkin_daily_values?: number[] }, streakDay: number): number {
    const values: number[] = settings.checkin_daily_values ?? [settings.checkin_base_coins];
    if (values.length === 0) return settings.checkin_base_coins;
    const idx = (streakDay - 1) % values.length;
    return values[idx];
}

/** Retorna o array de progressÃ£o completo (7 valores padrÃ£o se nÃ£o configurado) */
export function getDailyValues(settings: CashbackSettings & { checkin_daily_values?: number[] }): number[] {
    return settings.checkin_daily_values ?? [settings.checkin_base_coins];
}

type TableDataResponse<T> = T[] | { data?: T[]; rows?: T[]; items?: T[]; total?: number };

function extractRows<T>(response: TableDataResponse<T>): T[] {
    if (Array.isArray(response)) return response;
    return response.data || response.rows || response.items || [];
}

function sortCheckinsNewestFirst(rows: CheckinLog[]): CheckinLog[] {
    return [...rows].sort((a, b) => String(b.checkin_date).localeCompare(String(a.checkin_date)));
}

async function loadCheckinLogs(): Promise<CheckinLog[]> {
    const pageSize = 200;
    let offset = 0;
    const rows: CheckinLog[] = [];

    while (true) {
        const response = await vpsClient.get<TableDataResponse<CheckinLog>>(
            `/table-data/checkin_logs?limit=${pageSize}&offset=${offset}`
        );
        const batch = extractRows(response);
        rows.push(...batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
    }

    return rows;
}

async function findCustomerCheckin(customerId: string, checkinDate: string): Promise<CheckinLog | null> {
    return (await loadCheckinLogs()).find(
        row => row.customer_id === customerId && row.checkin_date === checkinDate
    ) || null;
}

// ============================================================
// CALCULAR STREAK
// ============================================================

async function getYesterdayStreak(customerId: string): Promise<number> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const data = await findCustomerCheckin(customerId, yesterdayStr);

    return data ? data.streak_day : 0; // 0 = nÃ£o fez ontem â†’ streak reinicia
}

// ============================================================
// CHECK-IN DIÃRIO
// ============================================================

export async function performCheckin(customerId: string): Promise<CheckinResult> {
    const today = new Date().toISOString().split('T')[0];

    // Verificar se jÃ¡ fez check-in hoje
    const existing = await findCustomerCheckin(customerId, today);

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

    // â­ Moedas progressivas baseadas no dia do ciclo
    const totalCoins = getCoinsForStreakDay(settings, newStreakDay);
    const cycleLen = getDailyValues(settings).length;
    const isLastCycleDay = newStreakDay % cycleLen === 0;

    // Registrar check-in
    try {
        await vpsClient.post('/table-data/checkin_logs', {
            customer_id: customerId,
            checkin_date: today,
            coins_earned: totalCoins,
            streak_day: newStreakDay,
        });
    } catch (error: any) {
        const raceCheckin = await findCustomerCheckin(customerId, today);
        if (raceCheckin) {
            return {
                success: false,
                alreadyCheckedIn: true,
                coins_earned: raceCheckin.coins_earned,
                streak_day: raceCheckin.streak_day,
            };
        }
        throw new Error(`Erro no check-in: ${error?.message || String(error)}`);
    }

    // Creditar moedas (tudo em uma sÃ³ transaÃ§Ã£o)
    const type = isLastCycleDay ? 'earn_streak' : 'earn_checkin';
    const desc = isLastCycleDay
        ? `ðŸŽ‰ Check-in dia ${newStreakDay} â€” BÃ´nus de ciclo!`
        : `Check-in dia ${newStreakDay} (dia ${((newStreakDay - 1) % cycleLen) + 1} do ciclo)`;

    await addCoins(
        customerId,
        totalCoins,
        type,
        desc,
        today,
        'checkin'
    );

    return {
        success: true,
        alreadyCheckedIn: false,
        coins_earned: totalCoins,
        streak_day: newStreakDay,
        is_cycle_complete: isLastCycleDay,
    };
}

// ============================================================
// HISTÃ“RICO DE CHECK-INS
// ============================================================

export async function getCheckinHistory(
    customerId: string,
    days = 30
): Promise<CheckinLog[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split('T')[0];

    const data = sortCheckinsNewestFirst(
        (await loadCheckinLogs()).filter(
            row => row.customer_id === customerId && row.checkin_date >= sinceStr
        )
    );
    return data;

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

    const data = sortCheckinsNewestFirst(
        (await loadCheckinLogs()).filter(row => row.customer_id === customerId)
    )[0];

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
        : (currentStreak % dailyValues.length) + 1; // prÃ³ximo dia

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
