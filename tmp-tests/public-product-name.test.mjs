import assert from 'node:assert/strict';
import { getPublicProductName } from '../pages/store/publicProductName.js';

assert.equal(
  getPublicProductName({
    name: 'Redmi A7 Pró 4/128 Cor:Preto',
    model: 'Redmi A7 Pró',
    specs: { color: 'Preto', storage: '128GB', ram: '4GB' },
  }),
  'Redmi A7 Pró',
);

assert.equal(
  getPublicProductName({
    name: 'Redmi A7 Pró Azul - 128GB - RAM 4GB',
    specs: { color: 'Azul', storage: '128GB', ram: '4GB' },
  }),
  'Redmi A7 Pró',
);

assert.equal(
  getPublicProductName({
    name: 'Capa de Silicone para Redmi Note 8T - Transparente',
    specs: { color: 'Transparente' },
  }),
  'Capa de Silicone para Redmi Note 8T',
);

assert.equal(
  getPublicProductName({
    name: 'Carregador Turbo 33W',
    specs: {},
  }),
  'Carregador Turbo 33W',
);

assert.equal(
  getPublicProductName({
    name: 'Redmi Note 15 Pró 5G 8GB/256GB Cor:Preto',
    model: 'Redmi Note 15 Pró 5G',
    specs: { color: 'Preto', storage: '256GB', ram: '8GB' },
  }),
  'Redmi Note 15 Pró 5G',
);

console.log('public-product-name tests passed');
