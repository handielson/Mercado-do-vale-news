import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const service = readFileSync('services/benefitService.ts', 'utf8');

assert.doesNotMatch(
  service,
  /\.from\('customer_benefits'\)|supabase\.from\('customer_benefits'\)/,
  'customer_benefits must not be queried through Supabase',
);

assert.match(
  service,
  /vpsClient/,
  'benefit service must use the VPS client for customer benefits',
);

assert.match(
  service,
  /loadTableRows<CustomerBenefit>\('customer_benefits', pageSize\)/,
  'customer benefits must be listed through the paged VPS table-data helper',
);

assert.match(
  service,
  /vpsClient\.post<CustomerBenefit>\('\/table-data\/customer_benefits'/,
  'new customer benefits must be created through VPS table-data',
);

assert.doesNotMatch(
  service,
  /\.from\('benefit_redemptions'\)/,
  'benefit redemptions must not be queried through Supabase after the redemption workflow migration',
);

assert.match(
  service,
  /loadTableRows<BenefitRedemption>\('benefit_redemptions', pageSize\)/,
  'benefit redemptions must be listed through the paged VPS table-data helper',
);

assert.match(
  service,
  /vpsClient\.post<BenefitRedemption>\('\/table-data\/benefit_redemptions'/,
  'benefit redemptions must be created through VPS table-data',
);

console.log('customer benefits VPS static checks passed');
