import { vpsClient } from './vpsClient';
import type { CheckinResult, CashbackSettings } from '../types/cashback';

export function getDailyValues(
    settings: CashbackSettings & { checkin_daily_values?: number[] },
): number[] {
    return settings.checkin_daily_values ?? [settings.checkin_base_coins];
}

export async function performCheckin(customerId: string): Promise<CheckinResult> {
    // O cliente autenticado e o dono dos dados sao definidos pela API.
    void customerId;
    return vpsClient.post<CheckinResult>('/customer/checkin', {});
}

export async function getStreakStatus(customerId: string): Promise<{
    streak: number;
    lastCheckin: string | null;
    checkedInToday: boolean;
    todayCoins: number;
    nextCoins: number;
    dailyValues: number[];
    cyclePosition: number;
}> {
    // Nao envia customer_id: a API deriva a conta do bearer token.
    void customerId;
    return vpsClient.get('/customer/checkin');
}
