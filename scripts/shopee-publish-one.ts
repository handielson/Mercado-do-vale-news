#!/usr/bin/env node

import crypto from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import {
  alignShopeeAttributeDefaultsToOptions,
  analyzeShopeeTitleSafety,
  applyShopeeTemplateToProduct,
  mergeShopeeAttributeDefaults,
  resolveBestShopeeTemplate,
  resolveUniversalShopeeAttributeDefaults,
} from '../services/shopeeTemplateEngine.ts';
import { mapShopeeTemplateFromRow } from '../services/shopeeTemplateRowMapper.ts';
import { normalizeShopeeDescription } from '../services/shopeeDescription.js';
import { collectMarketplaceProductImages } from '../services/marketplaceParentGallery.js';
import { buildShopeeTemplateAttributeValues, resolveShopeeFieldTemplate } from '../pages/admin/settings/shopeeFieldTemplates.js';
import {
  applyShopeeStockFields,
  buildShopeeAddItemStockVariants,
  buildShopeeUpdateStockPayload,
  extractShopeeLocationIds,
  isShopeeSellerStockConstraintError,
} from '../pages/admin/settings/shopeeStockPayloads.js';
import {
  detectShopeeVariationDimensions,
  validateShopeeVariationGroup,
} from '../services/shopeeVariationEngine.ts';
import {
  getMissingShopeeVariationSkus,
  matchShopeeModelsBySku,
} from '../services/shopeeVariationLinking.ts';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
for (const name of ['.env.local', '.env']) {
  loadEnv({ path: path.join(REPO_ROOT, name), override: false, quiet: true });
}

const PRIMARY_CONNECTION_ID = 'primary';
const DEFAULT_API_BASE = 'https://api.xiaomipetrolina.com.br';
const BRAZIL_ORIGIN_ATTRIBUTE = {
  attribute_id: 100037,
  original_attribute_name: 'Region of Origin',
  attribute_value_list: [{ value_id: 6737, original_value_name: 'Brasil', value_unit: '' }],
  is_mandatory: false,
};

type CliOptions = {
  productId: string;
  sku: string;
  connectionId: string;
  execute: boolean;
  confirmSku: string;
  help: boolean;
};

type ApiContext = {
  apiBase: string;
  syncKey: string;
  connectionId: string;
};

function usage(): string {
  return `
Uso seguro (pre-visualizacao, nao publica):
  npm run shopee:publish-one -- --sku SKU-EXATO
  npm run shopee:publish-one -- --product-id UUID

Envio real para a conta G:
  npm run shopee:publish-one -- --sku SKU-EXATO --execute --confirm-sku SKU-EXATO

Opcoes:
  --connection-id ID   Define explicitamente a conexao adicional.
  --execute            Autoriza a publicacao real de exatamente um item.
  --confirm-sku SKU    Confirmacao obrigatoria; deve ser identica ao SKU carregado.
  --help               Mostra esta ajuda.

Por seguranca, o modo padrao e somente leitura. O script aceita um item simples
ou uma familia pai com variacoes, mas rejeita combo, estoque zerado e produto
ja vinculado na mesma loja. Videos existentes no anuncio M sao reenviados a G.
`.trim();
}

export function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    productId: '', sku: '', connectionId: '', execute: false, confirmSku: '', help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--execute') options.execute = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--product-id') options.productId = String(argv[++index] || '').trim();
    else if (arg === '--sku') options.sku = String(argv[++index] || '').trim();
    else if (arg === '--connection-id') options.connectionId = String(argv[++index] || '').trim();
    else if (arg === '--confirm-sku') options.confirmSku = String(argv[++index] || '').trim();
    else throw new Error(`Opcao desconhecida: ${arg}`);
  }
  if (!options.help && Boolean(options.productId) === Boolean(options.sku)) {
    throw new Error('Informe exatamente um seletor: --product-id ou --sku.');
  }
  return options;
}

function normalizeText(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function parseObject(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function apiRequest<T>(ctx: ApiContext, route: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${ctx.apiBase}${route}`, {
    ...init,
    headers: {
      ...(ctx.syncKey ? { 'x-sync-key': ctx.syncKey } : {}),
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  const raw = await response.text();
  let data: any = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  if (!response.ok) {
    throw new Error(`API ${response.status} em ${route}: ${data?.message || data?.error || raw.slice(0, 180) || response.statusText}`);
  }
  if (data?.error) throw new Error(`${route}: ${data.message || data.error}`);
  return data as T;
}

function withConnection(route: string, connectionId: string): string {
  if (!connectionId || connectionId === PRIMARY_CONNECTION_ID) return route;
  const separator = route.includes('?') ? '&' : '?';
  return `${route}${separator}connection_id=${encodeURIComponent(connectionId)}`;
}

async function loadAllTableRows(ctx: ApiContext, table: string): Promise<any[]> {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 200) {
    const data = await apiRequest<{ rows?: any[] }>(ctx, `/table-data/${table}?limit=200&offset=${offset}`);
    const page = Array.isArray(data.rows) ? data.rows : [];
    rows.push(...page);
    if (page.length < 200) return rows;
  }
}

async function resolveConnection(ctx: ApiContext, requestedId: string): Promise<any> {
  const data = await apiRequest<{ connections?: any[] }>(ctx, '/shopee-connections');
  const connections = Array.isArray(data.connections) ? data.connections : [];
  const eligible = connections.filter((entry) =>
    String(entry.id) !== PRIMARY_CONNECTION_ID &&
    Boolean(entry.active) &&
    String(entry.authorization_status) === 'connected'
  );
  const connection = requestedId
    ? connections.find((entry) => String(entry.id) === requestedId)
    : eligible.length === 1 ? eligible[0] : null;
  if (!connection) {
    throw new Error(requestedId
      ? `Conexao Shopee nao encontrada: ${requestedId}`
      : `Esperava exatamente uma conta adicional conectada, mas encontrei ${eligible.length}. Use --connection-id.`);
  }
  if (String(connection.id) === PRIMARY_CONNECTION_ID) throw new Error('Este script de teste nao publica na conta principal M.');
  if (!connection.active || String(connection.authorization_status) !== 'connected') {
    throw new Error('A conexao escolhida nao esta ativa e conectada.');
  }
  return connection;
}

async function loadProduct(ctx: ApiContext, options: CliOptions): Promise<any> {
  if (options.productId) return apiRequest<any>(ctx, `/products/${encodeURIComponent(options.productId)}`);
  const rows = await apiRequest<any[]>(ctx, `/products?sku=${encodeURIComponent(options.sku)}&status=all&include_parents=true&limit=10`);
  const exact = (Array.isArray(rows) ? rows : []).filter((row) => String(row.sku || '').trim() === options.sku);
  if (exact.length !== 1) throw new Error(`SKU ${options.sku}: esperava 1 produto exato, encontrei ${exact.length}.`);
  return exact[0];
}

function normalizeAttributes(data: any): any[] {
  const raw = data?.response?.attribute_list
    || data?.response?.attribute_tree
    || (Array.isArray(data?.response?.list)
      ? data.response.list.flatMap((entry: any) => Array.isArray(entry?.attribute_tree) ? entry.attribute_tree : [])
      : []);
  return (Array.isArray(raw) ? raw : []).map((attr) => {
    const rawInputType = attr?.attribute_info?.input_type ?? attr?.input_type ?? attr?.attribute_type ?? '';
    const options = (Array.isArray(attr?.attribute_value_list) ? attr.attribute_value_list : []).map((option: any) => ({
      value_id: Number(option?.value_id) || 0,
      label: String(option?.display_attribute_value || option?.display_value_name || option?.name || option?.original_value_name || option?.value_id || '').trim(),
      raw_name: String(option?.name || option?.display_attribute_value || option?.original_value_name || '').trim(),
      original_value_name: String(option?.original_value_name || option?.name || option?.display_attribute_value || '').trim(),
    })).filter((option: any) => option.label);
    return {
      attribute_id: Number(attr?.attribute_id) || 0,
      label: String(attr?.display_attribute_name || attr?.multi_lang?.find((entry: any) => entry?.language === 'pt-BR')?.value || attr?.name || attr?.original_attribute_name || `Atributo ${attr?.attribute_id}`).trim(),
      mandatory: Boolean(attr?.mandatory ?? attr?.is_mandatory),
      support_search_value: Boolean(attr?.attribute_info?.support_search_value),
      raw_input_type: rawInputType,
      attribute_unit_list: Array.isArray(attr?.attribute_info?.attribute_unit_list) ? attr.attribute_info.attribute_unit_list : [],
      attribute_value_list: options,
    };
  }).filter((attr) => attr.attribute_id > 0);
}

async function resolveSearchableValue(ctx: ApiContext, attr: any, value: string): Promise<any> {
  if (!attr.support_search_value) return null;
  const route = withConnection(`/api/shopee-catalog?action=search_attribute_values&attribute_id=${attr.attribute_id}&limit=100&value_name=${encodeURIComponent(value)}`, ctx.connectionId);
  const data = await apiRequest<any>(ctx, route);
  const list = Array.isArray(data?.response?.value_list) ? data.response.value_list : [];
  const match = list.find((entry: any) => normalizeText(entry?.value_name || entry?.display_value_name || entry?.original_value_name || entry?.name) === normalizeText(value));
  if (!match) return null;
  const name = String(match.value_name || match.display_value_name || match.original_value_name || match.name || value).trim();
  return { value_id: Number(match.value_id) || 0, original_value_name: name };
}

async function buildAttributePayload(ctx: ApiContext, attributes: any[], defaults: Record<string, any>, strictIds?: any[]): Promise<{ payload: any[]; missing: string[] }> {
  const strict = Array.isArray(strictIds) ? new Set(strictIds.map(Number)) : null;
  const payload: any[] = [];
  const missing: string[] = [];
  for (const attr of attributes) {
    if (strict && !strict.has(attr.attribute_id)) continue;
    let rawValue: any = defaults[attr.attribute_id] ?? defaults[String(attr.attribute_id)];
    if ((rawValue == null || String(rawValue).trim() === '') && attr.attribute_id === 100413) rawValue = 'Novo';
    const values = (Array.isArray(rawValue) ? rawValue : [rawValue]).map((value) => String(value ?? '').trim()).filter(Boolean);
    if (values.length === 0) {
      if (attr.mandatory) missing.push(attr.label);
      continue;
    }
    const valuePayloads: any[] = [];
    for (const value of values) {
      const searched = await resolveSearchableValue(ctx, attr, value);
      if (attr.support_search_value) {
        if (searched) valuePayloads.push(searched);
        else if (attr.mandatory) missing.push(`${attr.label} (valor nao localizado: ${value})`);
        continue;
      }
      const option = attr.attribute_value_list.find((candidate: any) => [candidate.label, candidate.raw_name, candidate.original_value_name, candidate.value_id]
        .some((candidateValue) => normalizeText(candidateValue) === normalizeText(value)));
      if (option) {
        valuePayloads.push({ value_id: option.value_id || 0, original_value_name: option.original_value_name || option.raw_name || option.label });
        continue;
      }
      if (attr.attribute_id === 100413 && ['novo', 'new'].includes(normalizeText(value))) {
        valuePayloads.push({ value_id: 0, original_value_name: 'New' });
        continue;
      }
      const units = attr.attribute_unit_list.map((unit: any) => String(unit || '').trim()).filter(Boolean);
      valuePayloads.push({ value_id: 0, original_value_name: value, ...(units.length ? { value_unit: units[0] } : {}) });
    }
    if (valuePayloads.length) payload.push({ attribute_id: attr.attribute_id, attribute_value_list: valuePayloads });
  }
  return { payload, missing: [...new Set(missing)] };
}

function packageMetrics(product: any, applied: any): { weight: number; dimension: any } {
  const dimensions = parseObject(product.dimensions);
  const specs = parseObject(product.specs);
  const positive = (...values: unknown[]) => values.map(Number).find((value) => Number.isFinite(value) && value > 0) || 0;
  const weight = positive(applied.weightKg, product.weight_kg, Number(product.shipping_weight) / 1000, 0.3);
  return {
    weight: Number(weight.toFixed(3)),
    dimension: {
      package_length: Math.max(1, Math.round(positive(applied.packageLength, product.shipping_length, dimensions.depth_cm, dimensions.depth, dimensions.length, specs.depth_cm, 20))),
      package_width: Math.max(1, Math.round(positive(applied.packageWidth, product.shipping_width, dimensions.width_cm, dimensions.width, specs.width_cm, 15))),
      package_height: Math.max(1, Math.round(positive(applied.packageHeight, product.shipping_height, dimensions.height_cm, dimensions.height, specs.height_cm, 10))),
    },
  };
}

function inferBrand(product: any): string {
  const explicit = String(product.brand || '').trim();
  if (explicit && !['generica', 'generico', 'generic', 'sem marca', 'no brand', 'nobrand'].includes(normalizeText(explicit))) return explicit;
  const source = normalizeText(`${product.name || ''} ${product.sku || ''}`);
  const rules = [
    ['Xiaomi', ['xiaomi', 'redmi', 'poco']], ['Apple', ['apple', 'iphone', 'ipad']],
    ['Samsung', ['samsung', 'galaxy']], ['Motorola', ['motorola', 'moto g', 'moto e']],
    ['Realme', ['realme']], ['Oppo', ['oppo']], ['Huawei', ['huawei', 'honor']],
  ];
  return String(rules.find(([, terms]) => (terms as string[]).some((term) => source.includes(term)))?.[0] || 'NoBrand');
}

async function resolveBrand(ctx: ApiContext, categoryId: number, product: any): Promise<any> {
  const desired = inferBrand(product);
  const data = await apiRequest<any>(ctx, withConnection(`/api/shopee-catalog?action=brand_list&category_id=${categoryId}&page_size=100`, ctx.connectionId));
  const list = data?.response?.brand_list || data?.response?.list || [];
  const match = (Array.isArray(list) ? list : []).find((brand: any) =>
    [brand.display_brand_name, brand.brand_name, brand.name, brand.original_brand_name].some((value) => normalizeText(value) === normalizeText(desired))
  );
  return match
    ? { brand_id: Number(match.brand_id) || 0, original_brand_name: String(match.original_brand_name || match.brand_name || match.name || desired) }
    : { brand_id: 0, original_brand_name: desired || 'NoBrand' };
}

async function resolveLogistics(ctx: ApiContext): Promise<any[]> {
  const data = await apiRequest<any>(ctx, withConnection('/api/shopee-catalog?action=logistics_channel_list', ctx.connectionId));
  const list = data?.response?.logistics_channel_list || data?.response?.logistic_channel_list || data?.response?.channel_list || [];
  return (Array.isArray(list) ? list : []).filter((channel: any) => channel?.enabled === true || channel?.enabled === 1 || channel?.enabled === 'true')
    .map((channel: any) => Number(channel.logistic_id ?? channel.logistics_channel_id ?? channel.logistic_channel_id ?? channel.channel_id))
    .filter((id: number) => Number.isFinite(id) && id > 0)
    .map((logistic_id: number) => ({ logistic_id, enabled: true }));
}

async function resolveLocationIds(ctx: ApiContext): Promise<string[]> {
  const ids = new Set<string>();
  for (const action of ['warehouse_detail', 'warehouse_list']) {
    try {
      const data = await apiRequest<any>(ctx, withConnection(`/api/shopee-catalog?action=${action}`, ctx.connectionId));
      extractShopeeLocationIds(data).forEach((id: string) => ids.add(id));
    } catch { /* estoque possui fallbacks compativeis */ }
  }
  return [...ids];
}

async function findRemoteDuplicate(ctx: ApiContext, sku: string, name: string): Promise<any | null> {
  for (const status of ['NORMAL', 'UNLIST']) {
    const data = await apiRequest<any>(ctx, withConnection(`/api/shopee-catalog?action=get_full_catalog&item_status=${status}&page_size=100`, ctx.connectionId));
    const list = Array.isArray(data?.response?.item_list) ? data.response.item_list : [];
    const match = list.find((item: any) =>
      (sku && normalizeText(item.item_sku) === normalizeText(sku)) || normalizeText(item.item_name) === normalizeText(name)
    );
    if (match) return match;
  }
  return null;
}

function savedVideoList(item: any): any[] {
  const info = item?.video_info;
  if (Array.isArray(info)) return info;
  if (Array.isArray(info?.video_list)) return info.video_list;
  if (info?.video_url || info?.video_id) return [info];
  return [];
}

function originalPriceFromModel(model: any): number {
  const price = Number(model?.price_info?.[0]?.original_price ?? model?.price_info?.[0]?.current_price ?? 0);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

function localPriceInReais(product: any): number {
  const cents = Number(product?.price_retail ?? 0);
  return Number.isFinite(cents) && cents > 0 ? Number((cents / 100).toFixed(2)) : 0;
}

async function publicUrlExists(url: string): Promise<boolean> {
  try {
    let response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (response.status === 405) response = await fetch(url, { headers: { range: 'bytes=0-0' }, redirect: 'follow' });
    return response.ok && String(response.headers.get('content-type') || '').toLowerCase().includes('video');
  } catch {
    return false;
  }
}

async function resolveVideoCandidates(ctx: ApiContext, familyProducts: any[], sourceItem: any): Promise<any[]> {
  const explicit = familyProducts
    .map((entry) => String(entry?.video_url || '').trim())
    .filter(Boolean);
  let generated: string[] = [];
  try {
    const settings = await loadAllTableRows(ctx, 'company_settings');
    const row = settings[0] || {};
    const baseUrl = String(row.synology_video_base_url || row.synologyVideoBaseUrl || '').replace(/\/+$/, '');
    const rawExtension = String(row.synology_video_extension || row.synologyVideoExtension || '.mp4').trim() || '.mp4';
    const extension = rawExtension.startsWith('.') ? rawExtension : `.${rawExtension}`;
    if (baseUrl) {
      for (const entry of familyProducts) {
        const candidate = `${baseUrl}/${encodeURIComponent(String(entry?.sku || '').trim())}${extension}`;
        if (entry?.sku && await publicUrlExists(candidate)) generated.push(candidate);
      }
    }
  } catch {
    generated = [];
  }
  const source = savedVideoList(sourceItem).map((video) => String(video?.video_url || '').trim()).filter(Boolean);
  return Array.from(new Set([...explicit, ...generated, ...source]))
    .slice(0, 1)
    .map((video_url) => ({ video_url, file_name: video_url.split('/').pop() || 'video.mp4' }));
}

async function loadVariationChildren(ctx: ApiContext, parent: any): Promise<any[]> {
  const rows = await apiRequest<any[]>(ctx, `/products?search=${encodeURIComponent(String(parent.sku || parent.name || ''))}&status=all&include_parents=true&limit=100`);
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => String(row.parent_id || '') === String(parent.id || ''))
    .filter((row) => String(row.status || '') === 'active');
}

async function prepare(ctx: ApiContext, options: CliOptions): Promise<any> {
  const connection = await resolveConnection(ctx, options.connectionId);
  ctx.connectionId = String(connection.id);
  const product = await loadProduct(ctx, options);
  const productId = String(product.id || '').trim();
  const sku = String(product.sku || '').trim();
  const blockers: string[] = [];
  if (!productId) blockers.push('Produto sem ID.');
  if (!sku) blockers.push('Produto sem SKU.');
  if (Number(product.is_combo) === 1) blockers.push('Combo nao e aceito neste primeiro script.');
  if (product.parent_id) blockers.push('Informe o SKU pai da familia, nao o SKU de uma variacao filha.');
  if (String(product.status || '') !== 'active') blockers.push(`Produto nao esta ativo (status: ${product.status || 'vazio'}).`);

  const isVariation = Number(product.is_parent) === 1;
  const children = isVariation ? await loadVariationChildren(ctx, product) : [];
  const familyProducts = isVariation ? [product, ...children] : [product];
  if (isVariation && children.length < 2) blockers.push(`Familia de variacoes precisa ter ao menos 2 filhos ativos; encontrados: ${children.length}.`);

  const links = await loadAllTableRows(ctx, 'shopee_products');
  const familyIds = new Set(familyProducts.map((entry) => String(entry.id)));
  const existingLinks = links.filter((row) => familyIds.has(String(row.product_id)) && String(row.connection_id || PRIMARY_CONNECTION_ID) === ctx.connectionId && Number(row.shopee_item_id) > 0);
  existingLinks.forEach((link) => blockers.push(`Produto ${familyProducts.find((entry) => String(entry.id) === String(link.product_id))?.sku || link.product_id} ja vinculado nesta conta ao item ${link.shopee_item_id}.`));
  const primaryLink = links.find((row) =>
    String(row.product_id) === productId &&
    String(row.connection_id || PRIMARY_CONNECTION_ID) === PRIMARY_CONNECTION_ID &&
    Number(row.shopee_item_id) > 0
  );
  let sourceItem: any = null;
  let sourceModelData: any = null;
  let sourceModels: any[] = [];
  let sourceTierVariation: any[] = [];
  if (primaryLink?.shopee_item_id) {
    const sourceData = await apiRequest<any>(ctx, withConnection(
      `/api/shopee-catalog?action=get_item_base_info&item_id_list=${Number(primaryLink.shopee_item_id)}`,
      PRIMARY_CONNECTION_ID,
    ));
    sourceItem = sourceData?.response?.item_list?.[0] || null;
    if (!sourceItem) blockers.push(`O vinculo M aponta para o item ${primaryLink.shopee_item_id}, mas a Shopee nao retornou os dados.`);
    if (isVariation && sourceItem && sourceItem?.has_model !== true) blockers.push('O produto local e uma familia, mas o anuncio M nao possui variacoes.');
    if (!isVariation && sourceItem?.has_model === true) blockers.push('O anuncio M possui variacoes; informe o SKU pai da familia.');
    if (isVariation && sourceItem?.has_model === true) {
      sourceModelData = await apiRequest<any>(ctx, withConnection(
        `/api/shopee-catalog?action=get_model_list&item_id=${Number(primaryLink.shopee_item_id)}`,
        PRIMARY_CONNECTION_ID,
      ));
      sourceModels = sourceModelData?.response?.model || sourceModelData?.response?.model_list || [];
      sourceTierVariation = sourceModelData?.response?.tier_variation || [];
      const sourceSkus = new Set(sourceModels.map((model: any) => normalizeText(model?.model_sku)).filter(Boolean));
      children.forEach((child) => {
        if (!sourceSkus.has(normalizeText(child.sku))) blockers.push(`A variacao ${child.sku} nao foi localizada no anuncio M.`);
      });
      if (!sourceTierVariation.length) blockers.push('O anuncio M nao retornou a estrutura das variacoes.');
    }
  }

  const templateRows = await loadAllTableRows(ctx, 'shopee_templates');
  const templates = templateRows.map(mapShopeeTemplateFromRow);
  const template = resolveBestShopeeTemplate(product, templates);
  const applied = template ? applyShopeeTemplateToProduct(product, template) : null;
  if (!sourceItem && !template) blockers.push('Produto sem anuncio na M e sem template automatico compativel.');
  const categoryId = Number(sourceItem?.category_id || applied?.categoryId || 0);
  if (!categoryId) blockers.push('Anuncio M/template sem categoria Shopee.');
  const categoryName = primaryLink?.shopee_category_name || template?.shopeeCategoryName || null;
  const title = String(sourceItem?.item_name || applied?.title || product.name || '').trim().slice(0, 120);
  const safety = analyzeShopeeTitleSafety(title, template?.dangerousTerms || []);
  if (safety.hasBlocks) blockers.push('Titulo contem termo bloqueado pelo template.');

  const sourceImageUrls = Array.isArray(sourceItem?.image?.image_url_list)
    ? sourceItem.image.image_url_list.map((value: unknown) => String(value || '').trim()).filter(Boolean)
    : [];
  const images = (sourceImageUrls.length ? sourceImageUrls : collectMarketplaceProductImages(product)).slice(0, 9);
  if (!images.length) blockers.push('Produto sem imagem.');
  const fallbackPrice = localPriceInReais(product);
  const fallbackStock = Number(product.stock_quantity ?? product.stock ?? 0);
  const sourcePrice = Number(sourceItem?.price_info?.[0]?.original_price || 0);
  const variationPrices = sourceModels.map(originalPriceFromModel).filter((value) => value > 0);
  const childLocalPrices = children.map(localPriceInReais).filter((value) => value > 0);
  const price = Number(sourcePrice || variationPrices[0] || applied?.price || childLocalPrices[0] || fallbackPrice);
  const stock = isVariation
    ? children.reduce((total, child) => total + Math.max(0, Math.trunc(Number(child.stock_quantity ?? child.stock ?? 0) || 0)), 0)
    : Math.max(0, Math.trunc(Number(applied?.stock ?? fallbackStock)));
  if (!(price > 0)) blockers.push('Preco invalido.');
  if (product.track_inventory !== false && stock <= 0) blockers.push('Estoque precisa ser maior que zero.');

  let variationGroup: any = null;
  let variationDimensions: any[] = [];
  let variationValidation: any = null;
  if (isVariation) {
    variationGroup = { id: productId, parent: product, children };
    variationDimensions = detectShopeeVariationDimensions(variationGroup);
    variationValidation = validateShopeeVariationGroup(variationGroup, variationDimensions);
    variationValidation.blockers.forEach((issue: any) => blockers.push(issue.message));
  }

  let attributes: any[] = [];
  let attributeList: any[] = Array.isArray(sourceItem?.attribute_list) ? sourceItem.attribute_list : [];
  let logistics: any[] = [];
  let brand = sourceItem?.brand || { brand_id: 0, original_brand_name: inferBrand(product) };
  let supportsBrazilOrigin = false;
  if (categoryId) {
    const attributeData = await apiRequest<any>(ctx, withConnection(`/api/shopee-catalog?action=attributes&category_id=${categoryId}`, ctx.connectionId));
    attributes = normalizeAttributes(attributeData);
    const validAttributeIds = new Set(attributes.map((attribute) => Number(attribute.attribute_id)));
    supportsBrazilOrigin = validAttributeIds.has(BRAZIL_ORIGIN_ATTRIBUTE.attribute_id);
    if (sourceItem && validAttributeIds.size > 0) {
      attributeList = attributeList.filter((attribute) => validAttributeIds.has(Number(attribute?.attribute_id)));
    }
    if (!sourceItem) {
      const fieldTemplate = resolveShopeeFieldTemplate(product);
      const modelValues = parseObject(product.model_template_values || product.template_values);
      const modelDefaults = parseObject(modelValues.shopee_attribute_defaults || modelValues.shopeeAttributeDefaults);
      const defaults = alignShopeeAttributeDefaultsToOptions(attributes, mergeShopeeAttributeDefaults({
        universalDefaults: resolveUniversalShopeeAttributeDefaults(templates),
        fieldTemplateDefaults: buildShopeeTemplateAttributeValues(attributes, product, fieldTemplate),
        selectedTemplateDefaults: applied?.attributeValues || {},
        modelDefaults,
        product,
      }));
      const built = await buildAttributePayload(ctx, attributes, defaults, fieldTemplate?.strict_attribute_ids);
      attributeList = built.payload;
      built.missing.forEach((label) => blockers.push(`Atributo obrigatorio ausente: ${label}.`));
    }
    logistics = await resolveLogistics(ctx);
    if (!logistics.length) blockers.push('Nenhum canal logistico habilitado na conta G.');
    if (!sourceItem) brand = await resolveBrand(ctx, categoryId, product);
  }
  attributeList = [
    ...attributeList.filter((attribute) => Number(attribute?.attribute_id) !== BRAZIL_ORIGIN_ATTRIBUTE.attribute_id),
    ...(supportsBrazilOrigin ? [BRAZIL_ORIGIN_ATTRIBUTE] : []),
  ];

  const gtin = String(product.ean || parseArray(product.alternative_eans)[0] || '').trim();
  const gtinMode = applied?.gtinMode || 'product';
  const gtinValue = gtinMode === 'no_gtin' ? 'SEM GTIN' : gtin;
  const metrics = sourceItem?.weight && sourceItem?.dimension
    ? { weight: Number(sourceItem.weight), dimension: sourceItem.dimension }
    : packageMetrics(product, applied || {});
  const sourceTaxInfo = sourceItem?.tax_info && typeof sourceItem.tax_info === 'object'
    ? sourceItem.tax_info
    : null;
  const payload = {
    original_price: Number(price.toFixed(2)),
    description: (normalizeShopeeDescription(sourceItem?.description || applied?.description || product.description) || title).slice(0, 3000),
    item_name: title,
    item_sku: sku.slice(0, 100),
    category_id: categoryId,
    attribute_list: attributeList,
    logistic_info: logistics,
    image: { image_id_list: [] as string[] },
    weight: metrics.weight,
    dimension: metrics.dimension,
    brand,
    ...(sourceTaxInfo ? { tax_info: sourceTaxInfo } : gtinValue ? { tax_info: { gtin: gtinValue }, gtin_code: gtinValue } : {}),
    item_status: 'NORMAL',
    condition: sourceItem?.condition || 'NEW',
  };
  const videos = await resolveVideoCandidates(ctx, familyProducts, sourceItem);
  const remoteDuplicate = await findRemoteDuplicate(ctx, sku, title);
  if (remoteDuplicate?.item_id) blockers.push(`A conta G ja possui o item ${remoteDuplicate.item_id} com o mesmo SKU ou titulo.`);

  return {
    connection, product, productId, sku, template, categoryId, categoryName, title, images, videos,
    price, stock, attributes, payload, sourceItem, sourceModels, sourceTierVariation, primaryLink,
    isVariation, children, familyProducts, variationGroup, variationDimensions, variationValidation, supportsBrazilOrigin,
    blockers: [...new Set(blockers)],
  };
}

function printPreview(prepared: any, execute: boolean): void {
  console.log(JSON.stringify({
    mode: execute ? 'EXECUCAO AUTORIZADA' : 'PRE-VISUALIZACAO (nenhuma gravacao)',
    store: { code: 'G', connection_id: prepared.connection.id, name: prepared.connection.display_name, shop_id: prepared.connection.shopee_shop_id },
    product: { id: prepared.productId, sku: prepared.sku, name: prepared.product.name, stock: prepared.stock, price: prepared.price },
    variations: prepared.isVariation ? prepared.children.map((child: any) => ({
      sku: child.sku,
      option: child?.specs?.color || child?.specs?.model || child?.specs?.size || null,
      stock: Math.max(0, Math.trunc(Number(child.stock_quantity ?? child.stock ?? 0) || 0)),
      price: localPriceInReais(child),
      ean: child.ean || parseArray(child.alternative_eans)[0] || null,
    })) : [],
    publication: {
      title: prepared.title,
      source: prepared.sourceItem ? `conta M / item ${prepared.sourceItem.item_id}` : `template ${prepared.template?.name || 'ausente'}`,
      category_id: prepared.categoryId,
      country_origin: prepared.supportsBrazilOrigin ? 'Brasil' : 'campo indisponivel nesta categoria',
      images: prepared.images.length,
      video: prepared.videos[0]?.video_url || null,
      attributes: prepared.payload.attribute_list.length,
      logistics: prepared.payload.logistic_info.length,
    },
    blockers: prepared.blockers,
  }, null, 2));
}

async function uploadImages(ctx: ApiContext, images: string[], sku: string): Promise<string[]> {
  const ids: string[] = [];
  for (let index = 0; index < images.length; index += 1) {
    const source = images[index];
    const body = source.startsWith('data:image/')
      ? { image_data_url: source, file_name: `${sku}-${index + 1}.jpg` }
      : { image_url: source, file_name: `${sku}-${index + 1}.jpg` };
    const data = await apiRequest<any>(ctx, withConnection('/api/shopee-catalog?action=upload_image', ctx.connectionId), { method: 'POST', body: JSON.stringify(body) });
    const id = data?.response?.image_info?.image_id || data?.response?.image_id;
    if (!id) throw new Error(`Upload da imagem ${index + 1} nao retornou image_id.`);
    ids.push(String(id));
  }
  return ids;
}

function isVideoStillProcessing(error: unknown): boolean {
  const message = normalizeText((error as Error)?.message || error);
  return message.includes('video_upload_timeout') || message.includes('ainda em processamento') || message.includes('still processing');
}

async function uploadVideo(ctx: ApiContext, video: any): Promise<string> {
  let lastError: unknown = null;
  const delays = [0, 6000, 10000, 15000];
  for (const delay of delays) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      const data = await apiRequest<any>(ctx, withConnection('/api/shopee-catalog?action=upload_video', ctx.connectionId), {
        method: 'POST',
        body: JSON.stringify({ video_url: video.video_url, file_name: video.file_name || 'video.mp4' }),
      });
      const id = data?.response?.video_upload_id || data?.response?.video_id;
      if (!id) throw new Error(data?.message || data?.error || 'Upload de video nao retornou video_upload_id.');
      return String(id);
    } catch (error) {
      lastError = error;
      if (!isVideoStillProcessing(error)) throw error;
    }
  }
  throw lastError || new Error('O video nao terminou de processar na Shopee.');
}

async function persistLink(ctx: ApiContext, prepared: any, product: any, itemId: number, model?: any): Promise<void> {
  await apiRequest(ctx, '/table-data/shopee_products', {
    method: 'POST',
    body: JSON.stringify({
      id: crypto.randomUUID(),
      product_id: product.id,
      connection_id: ctx.connectionId,
      shopee_item_id: itemId,
      shopee_model_id: model?.model_id ?? null,
      shopee_model_sku: model?.model_sku ?? null,
      shopee_model_name: model?.model_name ?? null,
      shopee_tier_index: Array.isArray(model?.tier_index) ? model.tier_index : null,
      shopee_category_id: prepared.categoryId,
      shopee_category_name: prepared.categoryName || null,
      shopee_price: Math.round((product === prepared.product ? prepared.price : localPriceInReais(product)) * 100),
      status: 'active',
      last_synced_at: new Date().toISOString(),
    }),
  });
}

function modelAvailableStock(model: any): number {
  const summary = Number(model?.stock_info_v2?.summary_info?.total_available_stock);
  if (Number.isFinite(summary)) return summary;
  const seller = Array.isArray(model?.stock_info_v2?.seller_stock) ? model.stock_info_v2.seller_stock : [];
  return seller.reduce((total: number, row: any) => total + Math.max(0, Number(row?.stock || 0)), 0);
}

async function waitForSavedVideo(ctx: ApiContext, itemId: number): Promise<boolean> {
  for (const delay of [0, 4000, 8000, 12000]) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    const data = await apiRequest<any>(ctx, withConnection(`/api/shopee-catalog?action=get_item_base_info&item_id_list=${itemId}`, ctx.connectionId));
    if (savedVideoList(data?.response?.item_list?.[0]).length > 0) return true;
  }
  return false;
}

async function waitForModelList(ctx: ApiContext, itemId: number): Promise<any[]> {
  for (const delay of [0, 3000, 6000, 10000]) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    const data = await apiRequest<any>(ctx, withConnection(`/api/shopee-catalog?action=get_model_list&item_id=${itemId}`, ctx.connectionId));
    const models = data?.response?.model || data?.response?.model_list || [];
    if (Array.isArray(models) && models.length > 0) return models;
  }
  return [];
}

async function buildVariationParts(ctx: ApiContext, prepared: any): Promise<{ tier_variation: any[]; model_list: any[] }> {
  const optionImageIds = new Map<string, string>();
  for (const tier of prepared.sourceTierVariation) {
    for (const option of Array.isArray(tier?.option_list) ? tier.option_list : []) {
      const url = String(option?.image?.image_url || '').trim();
      if (!url) continue;
      const [id] = await uploadImages(ctx, [url], `${prepared.sku}-${String(option.option || 'opcao')}`);
      if (id) optionImageIds.set(`${normalizeText(tier.name)}|${normalizeText(option.option)}`, id);
    }
  }
  const tier_variation = prepared.sourceTierVariation.map((tier: any) => ({
    name: tier.name,
    option_list: (Array.isArray(tier.option_list) ? tier.option_list : []).map((option: any) => {
      const imageId = optionImageIds.get(`${normalizeText(tier.name)}|${normalizeText(option.option)}`);
      return { option: option.option, ...(imageId ? { image: { image_id: imageId } } : {}) };
    }),
  }));
  const childBySku = new Map(prepared.children.map((child: any) => [normalizeText(child.sku), child]));
  const model_list = prepared.sourceModels.map((sourceModel: any) => {
    const child: any = childBySku.get(normalizeText(sourceModel.model_sku));
    const gtin = String(child?.ean || parseArray(child?.alternative_eans)[0] || 'SEM GTIN').trim();
    return {
      tier_index: sourceModel.tier_index,
      model_sku: child.sku,
      original_price: localPriceInReais(child) || originalPriceFromModel(sourceModel),
      seller_stock: [{ stock: Math.max(0, Math.trunc(Number(child.stock_quantity ?? child.stock ?? 0) || 0)) }],
      gtin_code: gtin,
      tax_info: { gtin },
    };
  });
  return { tier_variation, model_list };
}

async function publish(ctx: ApiContext, prepared: any): Promise<number> {
  const duplicate = await findRemoteDuplicate(ctx, prepared.sku, prepared.title);
  if (duplicate?.item_id) throw new Error(`Seguranca contra duplicidade: a conta G ja possui o item ${duplicate.item_id} com o mesmo SKU ou titulo.`);
  const imageIds = await uploadImages(ctx, prepared.images, prepared.sku);
  const videoUploadIds = prepared.videos.length ? [await uploadVideo(ctx, prepared.videos[0])] : [];
  if (!videoUploadIds.length && savedVideoList(prepared.sourceItem).length) {
    throw new Error('O anuncio M possui video, mas nenhum video ficou pronto para envio a G.');
  }
  const basePayload = {
    ...prepared.payload,
    image: { image_id_list: imageIds },
    ...(videoUploadIds.length ? { video_upload_id: videoUploadIds } : {}),
  };
  const locationIds = await resolveLocationIds(ctx);
  let created: any = null;
  let createdWithDirectVariation = false;
  let lastError: unknown = null;
  let variationParts: { tier_variation: any[]; model_list: any[] } | null = null;
  if (prepared.isVariation) {
    variationParts = await buildVariationParts(ctx, prepared);
    try {
      created = await apiRequest<any>(ctx, withConnection('/api/shopee-catalog?action=add_item', ctx.connectionId), {
        method: 'POST',
        body: JSON.stringify({ ...basePayload, item_sku: undefined, ...variationParts }),
      });
      createdWithDirectVariation = true;
    } catch (error) {
      lastError = error;
      if (!isShopeeSellerStockConstraintError((error as Error)?.message)) throw error;
    }
  }
  if (!created) {
    for (const variant of buildShopeeAddItemStockVariants({ stock: prepared.stock, locationIds })) {
      try {
        created = await apiRequest<any>(ctx, withConnection('/api/shopee-catalog?action=add_item', ctx.connectionId), {
          method: 'POST', body: JSON.stringify(applyShopeeStockFields(basePayload, variant.stockFields)),
        });
        break;
      } catch (error) {
        lastError = error;
        if (!isShopeeSellerStockConstraintError((error as Error)?.message)) throw error;
      }
    }
  }
  if (!created) throw lastError || new Error('A Shopee nao aceitou nenhuma variante de estoque.');
  const itemId = Number(created?.response?.item_id);
  if (!(itemId > 0)) throw new Error('A Shopee respondeu ao add_item sem um item_id valido. Nao execute novamente sem conferir a conta.');

  try {
    await persistLink(ctx, prepared, prepared.product, itemId);
  } catch (error) {
    throw new Error(`Item ${itemId} foi publicado, mas o vinculo local falhou: ${(error as Error).message}. NAO execute novamente.`);
  }

  if (prepared.isVariation && variationParts) {
    let publishedModels = createdWithDirectVariation ? await waitForModelList(ctx, itemId) : [];
    if (!createdWithDirectVariation) {
      await apiRequest(ctx, withConnection('/api/shopee-catalog?action=init_tier_variation', ctx.connectionId), {
        method: 'POST', body: JSON.stringify({ item_id: itemId, tier_variation: variationParts.tier_variation, model: variationParts.model_list }),
      });
      publishedModels = await waitForModelList(ctx, itemId);
    }
    const modelBySku = new Map(publishedModels.map((model: any) => [normalizeText(model.model_sku), model]));
    const modelForUpdate = variationParts.model_list.map((model: any) => ({ ...model, model_id: Number(modelBySku.get(normalizeText(model.model_sku))?.model_id) || undefined }));
    if (modelForUpdate.some((model: any) => !model.model_id)) {
      const missing = modelForUpdate.filter((model: any) => !model.model_id).map((model: any) => model.model_sku);
      throw new Error(`Item ${itemId} foi criado, mas faltaram IDs das variacoes ${missing.join(', ')}. NAO execute novamente.`);
    }
    await apiRequest(ctx, withConnection('/api/shopee-catalog?action=update_model', ctx.connectionId), {
      method: 'POST', body: JSON.stringify({ item_id: itemId, tier_variation: variationParts.tier_variation, model: modelForUpdate }),
    });
    publishedModels = await waitForModelList(ctx, itemId);
    const missingSkus = getMissingShopeeVariationSkus(prepared.children, publishedModels);
    if (missingSkus.length) throw new Error(`Item ${itemId} foi criado, mas faltaram variacoes: ${missingSkus.join(', ')}. NAO execute novamente.`);
    const matches = matchShopeeModelsBySku(prepared.children, publishedModels);
    for (const child of prepared.children) {
      const match = matches.get(child.id);
      const remoteModel = publishedModels.find((model: any) => normalizeText(model.model_sku) === normalizeText(child.sku));
      const expectedStock = Math.max(0, Math.trunc(Number(child.stock_quantity ?? child.stock ?? 0) || 0));
      const expectedPrice = localPriceInReais(child);
      if (!match || modelAvailableStock(remoteModel) !== expectedStock || Math.abs(originalPriceFromModel(remoteModel) - expectedPrice) > 0.001) {
        throw new Error(`Item ${itemId} foi criado, mas a conferencia de preco/estoque da variacao ${child.sku} falhou. NAO execute novamente.`);
      }
      await persistLink(ctx, prepared, child, itemId, remoteModel);
    }
  } else {
    await apiRequest(ctx, withConnection('/api/shopee-catalog?action=update_stock', ctx.connectionId), {
      method: 'POST', body: JSON.stringify(buildShopeeUpdateStockPayload({ itemId, stock: prepared.stock })),
    });
  }

  const verification = await apiRequest<any>(ctx, withConnection(`/api/shopee-catalog?action=get_item_base_info&item_id_list=${itemId}`, ctx.connectionId));
  if (!verification?.response?.item_list?.[0]) throw new Error(`Item ${itemId} foi criado, mas a verificacao falhou. NAO execute novamente.`);
  if (videoUploadIds.length && !await waitForSavedVideo(ctx, itemId)) {
    await apiRequest(ctx, withConnection('/api/shopee-catalog?action=update_item', ctx.connectionId), {
      method: 'POST', body: JSON.stringify({ item_id: itemId, video_upload_id: videoUploadIds }),
    });
    if (!await waitForSavedVideo(ctx, itemId)) {
      throw new Error(`Item ${itemId} foi criado e vinculado, mas a Shopee nao confirmou o video. NAO execute novamente.`);
    }
  }
  return itemId;
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const options = parseCliArgs(argv);
  if (options.help) { console.log(usage()); return; }
  const syncKey = String(process.env.VITE_VPS_SYNC_KEY || process.env.VPS_SYNC_KEY || process.env.SYNC_SECRET || '').trim();
  if (!syncKey) throw new Error('Configure VITE_VPS_SYNC_KEY, VPS_SYNC_KEY ou SYNC_SECRET.');
  const ctx: ApiContext = {
    apiBase: String(process.env.VITE_VPS_BASE_URL || process.env.VITE_VPS_URL || DEFAULT_API_BASE).replace(/\/+$/, ''),
    syncKey,
    connectionId: '',
  };
  const prepared = await prepare(ctx, options);
  printPreview(prepared, options.execute);
  if (prepared.blockers.length) throw new Error(`Publicacao bloqueada por ${prepared.blockers.length} validacao(oes).`);
  if (!options.execute) {
    console.log('\nPre-visualizacao concluida. Nenhum dado foi alterado.');
    return;
  }
  if (!options.confirmSku || options.confirmSku !== prepared.sku) {
    throw new Error(`Para publicar, repita exatamente: --confirm-sku ${prepared.sku}`);
  }
  const itemId = await publish(ctx, prepared);
  console.log(`\nSUCESSO: SKU ${prepared.sku} publicado somente na conta G. Item Shopee: ${itemId}.`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`\nERRO: ${error?.message || error}`);
    process.exitCode = 1;
  });
}
