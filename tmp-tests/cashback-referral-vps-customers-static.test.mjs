import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/cashbackService.ts', 'utf8');
const validateReferralBlock = source.slice(
  source.indexOf('export async function validateReferralCode'),
  source.indexOf('// ============================================================\n// HELPERS'),
);

assert.ok(
  validateReferralBlock.includes('export async function validateReferralCode'),
  'cashbackService should expose validateReferralCode',
);

assert.doesNotMatch(
  validateReferralBlock,
  /supabase\s*\.\s*from\(['"]customers['"]\)/,
  'validateReferralCode must not read customers through Supabase',
);

assert.match(
  validateReferralBlock,
  /loadTableRows<CustomerSummary>\('customers'\)/,
  'validateReferralCode should read customers through VPS table-data helper',
);

assert.match(
  validateReferralBlock,
  /referral_code/,
  'validateReferralCode should still compare referral_code values',
);

console.log('cashback referral VPS customers static checks passed');
