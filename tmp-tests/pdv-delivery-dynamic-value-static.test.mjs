import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const deliverySection = readFileSync('components/pdv/DeliverySection.tsx', 'utf8');
const pdvPage = readFileSync('pages/pdv/PDVPage.tsx', 'utf8');
const saleService = readFileSync('services/saleService.ts', 'utf8');

assert.doesNotMatch(
  deliverySection,
  /selectedType === 'store_delivery'[\s\S]{0,220}onDeliveryChange\(selectedType, selectedPerson, DELIVERY_COST_DEFAULT, 0\)/,
  'Entrega pela Loja must not send the fixed default value after the user edits the delivery amount.',
);

assert.match(
  deliverySection,
  /selectedType === 'store_delivery'[\s\S]{0,220}onDeliveryChange\(selectedType, selectedPerson, costStore, 0\)/,
  'Entrega pela Loja must send the current typed store cost to the PDV page.',
);

assert.match(
  deliverySection,
  /selectedType === 'hybrid_delivery'[\s\S]{0,220}onDeliveryChange\(selectedType, selectedPerson, costStore, costCustomer\)/,
  'Entrega Hibrida must send both dynamic cost fields to the PDV page.',
);

assert.match(
  pdvPage,
  /const deliveryTotal = deliveryCostStore \+ deliveryCostCustomer;[\s\S]*delivery_total: deliveryTotal/,
  'PDV finalization must send the sum of store and customer delivery costs.',
);

assert.match(
  saleService,
  /amount: saleInput\.delivery_total/,
  'Legacy delivery credits must use the sale delivery total as the amount paid to the delivery person.',
);

console.log('ok - PDV delivery typed values flow into delivery total and delivery credit');
