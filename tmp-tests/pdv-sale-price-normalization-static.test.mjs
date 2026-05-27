import fs from 'node:fs';
import assert from 'node:assert/strict';

const pdvPage = fs.readFileSync('pages/pdv/PDVPage.tsx', 'utf8');
const promoPrice = fs.readFileSync('utils/promoPrice.ts', 'utf8');

assert.match(
  promoPrice,
  /export function normalizeCentValue\(value: unknown\): number \{/,
  'promoPrice must expose a cent-value normalizer for VPS decimal strings.'
);

assert.match(
  promoPrice,
  /return Math\.round\(numeric\);/,
  'cent-value normalization must return integer cents for Supabase integer columns.'
);

assert.match(
  pdvPage,
  /const unitPrice = getEffectiveRetailPrice\(product\);\s*const unitCost = normalizeCentValue\(product\.price_cost\);/s,
  'PDV cart items must normalize VPS price strings before sale creation.'
);

assert.match(
  pdvPage,
  /unit_price: unitPrice,\s*unit_cost: unitCost,/s,
  'PDV sale items must persist normalized integer price fields.'
);

console.log('ok - PDV sale price fields are normalized to integer cents');
