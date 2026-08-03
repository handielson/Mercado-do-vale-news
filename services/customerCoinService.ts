import type { CashbackSettings, CoinBalance, CoinTransaction } from '../types/cashback';
import { vpsClient } from './vpsClient';

export interface CustomerCoinSnapshot {
  balance: CoinBalance | null;
  transactions: CoinTransaction[];
  settings: Pick<
    CashbackSettings,
    'coins_per_real' | 'min_purchase_for_coins' | 'coins_to_brl_rate' | 'max_redeem_percent' | 'min_coins_to_redeem' | 'active'
  > | null;
}

export async function getCustomerCoinSnapshot(): Promise<CustomerCoinSnapshot> {
  const response = await vpsClient.get<CustomerCoinSnapshot>('/customer/coins');
  return {
    balance: response.balance || null,
    transactions: Array.isArray(response.transactions) ? response.transactions : [],
    settings: response.settings || null,
  };
}
