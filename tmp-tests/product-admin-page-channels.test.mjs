// Página do Produto (/admin/products/models/:id): canais de venda, onde está no estoque,
// lucro por canal e edição do preço de venda (channel-profit-v1 / model-channels-v1).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { aggregateModelProducts, getModelIdentifierSections } from '../services/modelProductAggregator.js';
import { productImageList, resolveProductFamilyImages } from '../services/productFamilyImages.js';
import * as channelProfit from '../utils/channelProfit.js';
import * as productConditionModule from '../utils/productCondition.js';
import * as entryShortcuts from '../services/entryShortcuts.js';

const require = createRequire(import.meta.url);
const plain = (value) => JSON.parse(JSON.stringify(value));

function load(file, stubs, extraGlobals = {}) {
  const source = fs.readFileSync(file, 'utf8');
  const exports = {};
  const out = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  vm.runInNewContext(out, {
    exports, console, structuredClone, URLSearchParams, React, ...extraGlobals,
    require(id) {
      if (Object.prototype.hasOwnProperty.call(stubs, id)) return stubs[id];
      for (const [suffix, value] of Object.entries(stubs)) if (/^[./]/.test(suffix) && id.endsWith(suffix)) return value;
      if (['react', 'lucide-react', 'sonner'].includes(id)) return require(id);
      return {};
    },
  }, { filename: file });
  return exports;
}

test('Página do Produto renderiza título, canais, estoque, taxas e lucro por SKU', () => {
  const fixture = aggregateModelProducts({
    model: { id: 'm1', name: 'Kit Sacos' },
    products: [{ id: 'p1', model_id: 'm1', name: 'Kit', sku: 'SVF10UBAU', price_cost: 9000, price_retail: 17900, images: [], stock_quantity: 1, specs: {} }],
    units: [], sales: [], saleItems: [], customers: [],
  });
  const calls = { summary: null, badges: [], pricing: [] };
  let first = true;
  const react = { ...React, useState(initial) { if (first) { first = false; return React.useState(fixture); } return React.useState(initial); } };
  const page = load('pages/admin/products/ModelProductAggregatorPage.tsx', {
    react,
    'react-router-dom': { useNavigate: () => () => {}, useParams: () => ({ modelId: 'm1' }) },
    '/modelProductAggregator.js': { aggregateModelProducts, getModelIdentifierSections },
    '/productFamilyImages.js': { productImageList, resolveProductFamilyImages },
    '/entryShortcuts.js': entryShortcuts,
    '/localCatalogPreview': { isLocalCatalogPreviewRuntime: () => false },
    '/LazyLabelPrintModal': { LazyLabelPrintModal: () => null },
    '/ModelPublicationChannels': {
      useModelPublicationChannels: (ids) => { calls.ids = ids; return { loading: false, failed: false, byProductId: {}, reload() {} }; },
      mergeChannels: () => ({ shopee: [], ml: [], tiktok: null, tiktokInherited: false }),
      ModelChannelsSummary: (props) => { calls.summary = props; return React.createElement('section', null, 'Canais de venda conectados'); },
      SkuChannelBadges: (props) => { calls.badges.push(props); return null; },
    },
    '/ChannelPricingPanel': {
      ChannelFeesButton: () => React.createElement('button', null, 'Taxas por canal'),
      SkuChannelPricing: (props) => { calls.pricing.push(props); return null; },
    },
    '/TikTokShopSyncModal': { default: () => null },
    '/productCondition.js': productConditionModule,
    '/ProductConditionBadge': { ProductConditionBadge: () => null, ProductConditionNote: () => null },
    '/ModelVersionFinancials': {
      // Produto que não é celular: o grupo de preço vem desligado e a página mantém a regra anterior.
      useModelVersionGroups: () => ({ state: { status: 'ready', enabled: false, groups: [] }, reload() {} }),
      ModelVersionFinancials: (props) => { calls.versions = props; return React.createElement('section', null, 'Por versão'); },
    },
  });
  const html = renderToStaticMarkup(React.createElement(page.ModelProductAggregatorPage));
  assert.ok(calls.versions, 'bloco por versão fica no Resumo financeiro');
  assert.equal(calls.versions.modelId, 'm1');
  assert.equal(calls.versions.memoryGroups.length, 1);
  assert.doesNotMatch(html, /Página da família/);
  assert.match(html, /Canais de venda conectados/);
  assert.match(html, /Taxas por canal/);
  assert.match(html, /Onde está no estoque/);
  assert.deepEqual(plain(calls.ids), ['p1']);
  assert.equal(calls.summary.skuCount, 1);
  assert.equal(calls.badges.length, 1, 'badges de canal em cada SKU');
  assert.equal(calls.pricing.length, 1, 'custo e preço/lucro de cada SKU no Resumo financeiro');
  assert.equal(calls.pricing[0].productId, 'p1');
  assert.equal(calls.pricing[0].costCents, 9000, 'usa o custo do cadastro');
  assert.equal(calls.pricing[0].registeredCostCents, 9000);
  assert.equal(calls.pricing[0].costLock, null, 'produto sem IMEI edita o custo do cadastro');
  assert.match(html, /Custo, preço e lucro por canal/);
  const financial = html.indexOf('Resumo financeiro do modelo');
  const block = html.indexOf('Custo, preço e lucro por canal');
  const variations = html.lastIndexOf('Variações do modelo');
  assert.ok(financial > -1 && block > financial && variations > block, 'bloco de custo/lucro fica dentro do Resumo financeiro, antes das variações');
  assert.doesNotMatch(html, />\s*Adicionar igual\s*</, 'sem Adicionar igual (cadastro duplicado)');
});

test('badges abrem o anúncio da Shopee/ML e mostram herança do TikTok do pai', () => {
  const mod = load('components/products/ModelPublicationChannels.tsx', { './productCardShopee.js': { buildShopeeProductUrl: () => null } });
  const html = renderToStaticMarkup(React.createElement(mod.SkuChannelBadges, {
    loading: false, mlManageUrl: '/admin/settings/mercado-livre', onTikTok() {},
    channels: { shopee: [{ code: 'M', itemId: 1, url: 'https://shopee.com.br/product/9/1' }, { code: 'G', itemId: 2, url: null }], ml: [{ itemId: 'MLB123', hasError: true }], tiktok: { tiktok_product_id: '77', status: 'ACTIVATE' }, tiktokInherited: true },
  }));
  assert.match(html, /href="https:\/\/shopee.com.br\/product\/9\/1"[^>]*>Shopee M</);
  assert.match(html, />Shopee G</);
  assert.match(html, /href="https:\/\/produto.mercadolivre.com.br\/MLB-123"[^>]*>Mercado Livre ⚠</);
  assert.match(html, /TikTok: (<!-- -->)?Publicado \(pai\)/);
  const none = renderToStaticMarkup(React.createElement(mod.SkuChannelBadges, { loading: false, mlManageUrl: '', onTikTok() {}, channels: { shopee: [], ml: [], tiktok: null, tiktokInherited: false } }));
  assert.match(none, /Sem marketplace vinculado/);
});

function loadPricing(fetchLog, vpsLog, tiktokLog) {
  return load('services/channelPricing.ts', {
    './vpsClient': { vpsClient: { patch: async (path, body) => { vpsLog.push({ path, body }); return { price_retail: body.price_retail === 77700 ? 70000 : body.price_retail }; }, get: async () => ({ settings: [] }), put: async () => ({}) } },
    './shopeeProducts': { shopeeProductService: {}, getShopeeStoreCode: (id) => (id === 'primary' ? 'M' : 'G') },
    './shopeeConnections': { normalizeShopeeConnectionId: (v) => String(v || '') || 'primary', withShopeeConnection: (url, c) => (c === 'primary' ? url : `${url}${url.includes('?') ? '&' : '?'}connection_id=${c}`) },
    './mercadoLivreService': { mercadoLivreService: {} },
    './tiktokShopService': { tiktokShopService: { updatePrice: async (input) => { tiktokLog.push(input); } } },
    './vpsApiService': { vpsApiService: {} },
    '../utils/channelProfit.js': channelProfit,
  }, { fetch: async (url, init) => { fetchLog.push({ url, init }); return { ok: true, status: 200, json: async () => ({ error: '' }) }; } });
}

test('Shopee com variações: novo preço só na opção do SKU, demais mantêm o preço atual', async () => {
  const fetchLog = []; const svc = loadPricing(fetchLog, [], []);
  await svc.updateListingPrice({ channel: 'shopee_g', meta: { connectionId: 'c2', itemId: 55, modelId: 2, models: [{ modelId: 1, priceCents: 10000 }, { modelId: 2, priceCents: 12000 }] } }, 12990);
  assert.equal(fetchLog.length, 1);
  assert.match(fetchLog[0].url, /action=update_price&connection_id=c2$/);
  assert.deepEqual(JSON.parse(fetchLog[0].init.body), { item_id: 55, price_list: [{ model_id: 1, original_price: 100 }, { model_id: 2, original_price: 129.9 }] });
});

test('Shopee sem variação, site e TikTok gravam no lugar certo; preço inválido é recusado', async () => {
  const fetchLog = []; const vpsLog = []; const tiktokLog = [];
  const svc = loadPricing(fetchLog, vpsLog, tiktokLog);
  await svc.updateListingPrice({ channel: 'shopee_m', meta: { connectionId: 'primary', itemId: 9, modelId: null } }, 17900);
  assert.equal(fetchLog[0].url, '/api/shopee-catalog?action=update_price');
  assert.deepEqual(plain(JSON.parse(fetchLog[0].init.body).price_list), [{ model_id: 0, original_price: 179 }]);
  await svc.updateListingPrice({ channel: 'site', meta: { productId: 'p1' } }, 18900);
  assert.deepEqual(plain(vpsLog[0]), { path: '/table-data/products/p1', body: { price_retail: 18900 } });
  await svc.updateListingPrice({ channel: 'tiktok', meta: { tiktokProductId: '77', skuId: '88', currency: 'BRL' } }, 19900);
  assert.deepEqual(plain(tiktokLog[0]), { product_id: '77', sku_id: '88', amount_cents: 19900, currency: 'BRL' });
  await assert.rejects(svc.updateListingPrice({ channel: 'site', meta: { productId: 'p1' } }, 0));
  await assert.rejects(svc.updateListingPrice({ channel: 'site', meta: { productId: 'p1' } }, 77700), /grupo de preço/, 'avisa quando o grupo de preço do celular segura o valor');
  await assert.rejects(svc.updateListingPrice({ channel: 'mercado_livre', meta: {} }, 1000), /Editar no Mercado Livre/);
});

test('API: tabela de taxas por canal e preço atual do TikTok', () => {
  for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const server = fs.readFileSync(file, 'utf8');
  assert.match(server, /CREATE TABLE IF NOT EXISTS channel_fee_settings/);
  assert.match(server, /fastify\.get\('\/channel-fee-settings', \{ preHandler: requireSyncKeyOrAdmin \}/);
  assert.match(server, /fastify\.put\('\/channel-fee-settings\/:channel', \{ preHandler: requireSyncKeyOrAdmin \}/);
  assert.match(server, /CHANNEL_FEE_CHANNELS = new Set\(\['site', 'shopee_m', 'shopee_g', 'mercado_livre', 'tiktok'\]\)/);
  assert.match(server, /price_cents: Number\.isFinite\(remotePrice\)/, `${file}: status do TikTok devolve o preço atual do SKU`);
  }
});

test('custo: usa o ajuste manual existente (fonte única) e respeita bloqueios', () => {
  const panel = fs.readFileSync('components/products/ChannelPricingPanel.tsx', 'utf8');
  assert.match(panel, /updateProductManualCost\(productId, \{ cost_cents: value, expected_cost_cents: registeredCostCents/);
  assert.doesNotMatch(panel, /price_cost\s*:/, 'não grava price_cost por outro caminho');
  const page = fs.readFileSync('pages/admin/products/ModelProductAggregatorPage.tsx', 'utf8');
  assert.match(page, /Aparelho com IMEI: o custo vem da compra de cada unidade/);
  assert.match(page, /herda o custo do produto pai/);
});

test('Shopee M: link do anúncio usa o ID da loja principal dos dados da empresa', () => {
  const src = fs.readFileSync('components/products/ModelPublicationChannels.tsx', 'utf8');
  assert.match(src, /getCompanyData\(\)/, 'carrega os dados da empresa');
  assert.match(src, /shopIdByConnection\.set\(PRIMARY_SHOPEE_CONNECTION_ID, String\(primaryShopId\)\)/, 'loja principal (M) recebe o shopee_shop_id da empresa');
});
