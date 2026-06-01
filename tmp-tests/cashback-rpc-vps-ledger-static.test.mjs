import { readFileSync } from 'node:fs';

const cashback = readFileSync('services/cashbackService.ts', 'utf8');

for (const rpc of [
  'add_coins',
  'add_pending_coins',
  'confirm_pending_coins',
  'cancel_pending_coins',
  'spend_coins',
  'refund_coins',
  'refund_referral_coins',
  'process_referral_reward',
]) {
  if (cashback.includes(`supabase.rpc('${rpc}'`) || cashback.includes(`supabase.rpc("${rpc}"`)) {
    throw new Error(`cashbackService still calls Supabase RPC ${rpc}.`);
  }
}

if (!cashback.includes("vpsClient.post<CoinTransaction>('/table-data/coin_transactions'")) {
  throw new Error('cashbackService must write coin transactions through VPS table-data.');
}

if (!cashback.includes('vpsClient.patch<CoinBalance>')) {
  throw new Error('cashbackService must update coin balances through VPS table-data.');
}

for (const service of ['services/orderService.ts', 'services/saleService.ts']) {
  const serviceSource = readFileSync(service, 'utf8');
  if (!serviceSource.includes('processReferralReward(')) {
    throw new Error(`${service} should call the VPS referral reward helper.`);
  }
  if (serviceSource.includes('process_referral_reward')) {
    throw new Error(`${service} must not call the Supabase referral RPC.`);
  }
}

console.log('cashback RPC VPS ledger guard passed');
