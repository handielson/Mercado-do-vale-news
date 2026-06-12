import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/saleService.ts', 'utf8');
const presentation = readFileSync('utils/salePresentation.ts', 'utf8');

assert.ok(
  service.includes('(payment as any).fee_cents'),
  'sale service must preserve old fee_cents payment detail aliases',
);

assert.match(
  service,
  /operator_fee_amount[\s\S]*operator_fee_cents/,
  'sale service must preserve old operator_fee_cents payment detail aliases',
);

assert.match(
  service,
  /total_with_fee[\s\S]*total_with_fee_cents/,
  'sale service must preserve old total_with_fee_cents payment detail aliases',
);

assert.match(
  presentation,
  /fee_amount[\s\S]*fee_cents/,
  'sale payment presentation must render fee_cents aliases',
);

assert.match(
  presentation,
  /operator_fee_amount[\s\S]*operator_fee_cents/,
  'sale payment presentation must render operator_fee_cents aliases',
);

assert.match(
  presentation,
  /Parcelas: 1x/,
  'sale payment presentation must show one-installment credit payments explicitly',
);

assert.match(
  presentation,
  /Percentual cobrado: 0,00%/,
  'sale payment presentation must show zero card fee percentage when no fee was charged',
);

assert.match(
  presentation,
  /Percentual da maquina: 0,00%/,
  'sale payment presentation must show zero operator fee percentage when no operator fee was recorded',
);

console.log('sale payment detail alias static checks passed');
