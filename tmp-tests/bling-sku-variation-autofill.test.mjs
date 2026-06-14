import assert from 'node:assert/strict';
import { getBlingSkuSpecAutofill } from '../components/products/blingSkuSpecAutofill.js';

const colors = [
  { id: 'color-preto', name: 'Preto' },
  { id: 'color-azul-titanio', name: 'Azul Titanio' },
  { id: 'color-branco', name: 'Branco' },
];

assert.deepEqual(
  getBlingSkuSpecAutofill({
    product: {
      variacao: { nome: 'Cor: Preto; Memoria: 8GB; Armazenamento: 512GB' },
      nome: 'Poco X8 Pro 5G 512GB 8GB',
    },
    colors,
  }),
  { color: 'Preto', ram: '8GB', storage: '512GB' },
  'deve preencher specs.color pela variacao.nome do Bling'
);

assert.deepEqual(
  getBlingSkuSpecAutofill({
    product: {
      variacao: { nome: 'Cor: Preto; Memoria: 8GB; Armazenamento: 512GB' },
      nome: 'Poco X8 Pro 5G',
    },
    colors,
  }),
  { color: 'Preto', ram: '8GB', storage: '512GB' },
  'deve preencher specs.ram e specs.storage pela variacao.nome do Bling'
);

assert.deepEqual(
  getBlingSkuSpecAutofill({
    product: {
      variacao: null,
      nome: 'Poco X8 Pro 5G 512GB 8GB Preto',
    },
    colors,
  }),
  { color: 'Preto', ram: '8GB', storage: '512GB' },
  'deve preencher specs.ram e specs.storage pelo nome quando vierem sem rotulo'
);

assert.deepEqual(
  getBlingSkuSpecAutofill({
    product: {
      variacao: null,
      nome: 'iPhone 15 Pro Max 256GB Azul Titanio',
    },
    colors,
  }),
  { color: 'Azul Titanio' },
  'deve preencher specs.color pelo nome do produto quando a variacao nao traz cor'
);

assert.deepEqual(
  getBlingSkuSpecAutofill({
    product: {
      variacao: { nome: 'Memoria: 8GB; Armazenamento: 512GB' },
      nome: 'Poco X8 Pro 5G 512GB 8GB',
      nomePai: 'Poco X8 Pro 5G Branco',
    },
    colors,
  }),
  { color: 'Branco', ram: '8GB', storage: '512GB' },
  'deve usar nomePai como fallback depois de variacao.nome e nome'
);

assert.deepEqual(
  getBlingSkuSpecAutofill({
    product: {
      variacao: { nome: 'Cor: Verde Limao' },
      nome: 'Produto sem cor cadastrada Verde Limao',
    },
    colors,
  }),
  {},
  'nao deve preencher uma cor que nao existe no cadastro do sistema'
);

console.log('bling-sku-variation-autofill ok');
