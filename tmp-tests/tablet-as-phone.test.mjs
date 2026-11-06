// tablet-as-phone-v1: tablet segue o padrão do celular em todo o sistema
// (IMEI/serial por aparelho, preço por configuração, ficha técnica no modelo),
// com uma ressalva: IMEI 2 nunca é obrigatório para tablet.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { isSmartphoneModel, isTabletModel, smartphoneCatalogSearchSql } from '../services/smartphoneModelSpecs.mjs';
import { getAdminProductCardStatus } from '../components/products/productCardStatus.js';

const require = createRequire(import.meta.url);
const prices = require('../services/smartphonePriceGroupsCore.cjs');
const entry = require('../services/catalogEntryCore.cjs');

const DEVICES = ['Smartphones', 'Smartphone', 'Celulares', 'Celular', 'Tablet', 'Tablets', 'TABLETS', ' tablet '];
const NOT_DEVICES = ['Capinhas', 'Películas', 'Suporte para Celulares', 'Acessórios para Smartwatch', 'Smartwatchs', 'Receptor', ''];

test('celular e tablet são aparelho com a mesma regra no front e na API', () => {
  for (const name of DEVICES) {
    assert.equal(isSmartphoneModel({ category_name: name }), true, `front: ${name}`);
    assert.equal(prices.isSmartphoneCategory(name), true, `api: ${name}`);
  }
  for (const name of NOT_DEVICES) {
    assert.equal(isSmartphoneModel({ category_name: name }), false, `front: ${name}`);
    assert.equal(prices.isSmartphoneCategory(name), false, `api: ${name}`);
  }
});

test('só tablet é tablet (IMEI 2 opcional não vaza para celular)', () => {
  for (const name of ['Tablet', 'Tablets']) {
    assert.equal(isTabletModel({ category_name: name }), true);
    assert.equal(prices.isTabletCategory(name), true);
  }
  for (const name of ['Smartphones', 'Celulares', 'Capinhas']) {
    assert.equal(isTabletModel({ category_name: name }), false);
    assert.equal(prices.isTabletCategory(name), false);
  }
});

test('busca do catálogo trata tablet como aparelho (SQL)', () => {
  const sql = JSON.stringify(smartphoneCatalogSearchSql('p'));
  assert.match(sql, /celular\(es\)\?\|smartphones\?\|tablets\?/);
});

test('tablet configura grupo de preço por modelo + RAM + armazenamento, igual celular', () => {
  const product = { id: 'p1', model_id: 'pad6', specs: { ram: '6GB', storage: '128GB', version: 'Global' } };
  const config = prices.configuration(product, { template_values: {} });
  assert.equal(config.ram, '6GB');
  assert.equal(config.storage, '128GB');
});

test('entrada de tablet: um aparelho por linha, IMEI 1 ou serial, IMEI 2 nunca obrigatório', () => {
  const tablet = item => prices.isSmartphoneCategory(item.__category);
  const line = ({ quantity = 1, ...identity }, i = 0) => ({ ...entry.normalizeEntryItem({ source: 'manual', model_id: 'pad6', location_id: 'loc1', quantity, identity }, i), __category: 'Tablets' });

  const [onlyImei1] = entry.validateEntryBatch([line({ imei1: '863715061138763' })], { isSmartphone: tablet });
  assert.deepEqual(onlyImei1.errors, []);

  const [onlySerial] = entry.validateEntryBatch([line({ serial: 'TAB123' })], { isSmartphone: tablet });
  assert.deepEqual(onlySerial.errors, []);

  const [nothing] = entry.validateEntryBatch([line({})], { isSmartphone: tablet });
  assert.ok(nothing.errors.includes('Informe IMEI 1 ou serial.'));

  const [many] = entry.validateEntryBatch([line({ serial: 'TAB124', quantity: 2 })], { isSmartphone: tablet });
  assert.ok(many.errors.includes('Celular ou tablet entra um aparelho por linha.'));
});

test('card do admin: tablet sem estoque aparece como Vendido, igual celular', () => {
  for (const category_id of ['fd2b4b01-e8d7-4085-848e-18176aa58a66', '4397aa39-99c3-48a5-aecf-0b04d9d12016', '8b7c4852-c195-4527-8fd7-c3cc2debda42']) {
    assert.equal(getAdminProductCardStatus({ status: 'active', stock_quantity: 0, category_id }).status, 'sold');
  }
  assert.equal(getAdminProductCardStatus({ status: 'active', stock_quantity: 0, category_id: 'capinhas' }).status, 'out_of_stock');
});

test('ficha do produto: tablet usa campos de celular e nunca exige IMEI 2', () => {
  const source = fs.readFileSync(new URL('../components/products/sections/ProductSpecifications.tsx', import.meta.url), 'utf8');
  assert.match(source, /SMARTPHONE_CATEGORY_PATTERNS = \[[^\]]*'tablet'/);
  assert.match(source, /tablet-imei2-optional-v1/);
  assert.match(source, /isTabletCategory && key === 'imei2' && requirement === 'required' \? 'optional'/);
});

test('modelo: tablet bloqueia os mesmos campos que celular', () => {
  const source = fs.readFileSync(new URL('../components/settings/ModelModal.tsx', import.meta.url), 'utf8');
  assert.match(source, /'iphone', 'iphones', 'tablet', 'tablets'\]/);
});
