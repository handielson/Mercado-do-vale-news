import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const profile = readFileSync('pages/customer/CustomerProfilePage.tsx', 'utf8');
const profileTabs = [
  'components/customer/profile/PurchaseHistoryTab.tsx',
  'components/customer/profile/BenefitsTab.tsx',
  'components/customer/profile/CoinsTab.tsx',
  'components/customer/profile/TypeUpgradeTab.tsx',
  'components/customer/profile/PersonalInfoTab.tsx',
];

assert.doesNotMatch(
  profile,
  /font-black/,
  'customer profile shell must avoid font-black to keep the dashboard visually softer',
);

assert.doesNotMatch(
  profile,
  /text-slate-950/,
  'customer profile shell must avoid near-black text for compact dashboard labels and values',
);

assert.doesNotMatch(
  profile,
  /font-bold/,
  'customer profile shell must reserve heavier weights for nested feature tabs, not the main dashboard chrome',
);

assert.match(
  profile,
  /text-2xl font-semibold tracking-tight text-slate-800 sm:text-3xl/,
  'customer greeting should keep hierarchy with semibold weight and softened text color',
);

assert.match(
  profile,
  /text-2xl font-semibold text-slate-800/,
  'overview card values should remain prominent without black weight',
);

for (const file of profileTabs) {
  const source = readFileSync(file, 'utf8');
  assert.doesNotMatch(
    source,
    /font-black/,
    `${file} must avoid font-black inside customer profile tabs`,
  );
  assert.doesNotMatch(
    source,
    /text-slate-950/,
    `${file} must avoid near-black text inside customer profile tabs`,
  );
}

console.log('customer profile visual pressure static checks passed');
