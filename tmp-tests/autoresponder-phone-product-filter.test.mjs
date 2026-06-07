import assert from 'node:assert/strict';
import { buildProductSearchReply } from '../services/autoresponder/engine/flows/product-search.js';

const phoneReply = buildProductSearchReply(
  [
    { name: 'iPhone 13 128GB', price_text: 'R$ 3.299,00' },
    { name: 'Samsung Galaxy A56', price_text: 'R$ 2.199,00' },
  ],
  'celulares',
  false,
  null
);

assert.match(phoneReply, /Temos acessorios para ele/i);
assert.match(phoneReply, /capinha/i);
assert.match(phoneReply, /pelicula/i);
assert.match(phoneReply, /outros/i);

const typoReply = buildProductSearchReply(
  [{ name: 'Motorola Moto G', price_text: 'R$ 999,00' }],
  'smarthone',
  false,
  null
);

assert.match(typoReply, /Temos acessorios para ele/i);

const regularReply = buildProductSearchReply(
  [{ name: 'Carregador Turbo', price_text: 'R$ 99,00' }],
  'carregador',
  false,
  null
);

assert.doesNotMatch(regularReply, /Temos acessorios para ele/i);

for (const file of ['vps_server.js', 'vps_server.cjs', 'server.js']) {
  const source = await import('node:fs').then(({ readFileSync }) => readFileSync(file, 'utf8'));
  assert.match(source, /function isAutoresponderGenericPhoneProductSearch/);
  assert.match(source, /function buildAutoresponderPhoneSearchSqlFilter/);
  assert.match(source, /function buildAutoresponderCategoryPhoneAccessorySqlFilter/);
  assert.match(source, /function isAutoresponderGenericPhoneKeyword/);
  assert.match(source, /function isAutoresponderPhoneDeviceProduct/);
  assert.match(source, /NOT REGEXP/);
  assert.match(source, /capinha\|capinhas\|pelicula\|peliculas/);
  assert.match(source, /smartwatch\|smartwacth\|watch/);
  assert.match(source, /kit\|chave\|chaves\|lampada/);
  assert.match(source, /repetidor\|sinal/);
  assert.match(source, /smarthone/);
  assert.match(source, /filterAutoresponderAvailableProducts\(safeProducts\)[\s\S]*isAutoresponderPhoneDeviceProduct\(product\)/);
  assert.match(
    source,
    /const productTagMatch = isAutoresponderGenericPhoneKeyword\(message\)[\s\S]*findAutoresponderProductTagKeyword\(message, settings\)/,
    `${file} must skip product tags for generic phone catalog requests`
  );
  assert.match(
    source,
    /if \(genericDeviceCatalogFamily && genericDeviceCatalogFamily !== 'smartphone'\)/,
    `${file} must let generic smartphone catalog requests reach category listing`
  );
  assert.match(
    source,
    /async function findAutoresponderProductsByCategory[\s\S]*buildAutoresponderCategoryPhoneAccessorySqlFilter\(\)[\s\S]*AND \$\{categoryPhoneAccessoryFilter\}/,
    `${file} must filter accessory products when listing phone categories`
  );
  assert.match(
    source,
    /async function countAutoresponderProductsByCategory[\s\S]*buildAutoresponderCategoryPhoneAccessorySqlFilter\(\)[\s\S]*AND \$\{categoryPhoneAccessoryFilter\}/,
    `${file} must count phone categories with the same accessory filter`
  );
}

const deployScript = await import('node:fs').then(({ readFileSync }) => readFileSync('deploy-vps-server-only.cjs', 'utf8'));
assert.match(
  deployScript,
  /services['"], ['"]autoresponder['"], ['"]engine['"], ['"]flows['"], ['"]product-search\.js/,
  'server-only deploy must upload the product search engine module used by the VPS server'
);

console.log('autoresponder phone product filter checks passed');
