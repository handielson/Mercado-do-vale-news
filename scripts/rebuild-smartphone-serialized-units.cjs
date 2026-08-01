#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const API_BASE = (process.env.VPS_API_BASE_URL || process.env.VITE_API_URL || 'https://api.xiaomipetrolina.com.br').replace(/\/$/, '');
const SYNC_KEY = process.env.VITE_VPS_SYNC_KEY || process.env.VPS_SYNC_KEY || process.env.SYNC_KEY || '';
const APPLY = process.argv.includes('--apply');
const SUMMARY = process.argv.includes('--summary');
const CLEANUP_LEGACY_PRODUCTS = process.argv.includes('--cleanup-legacy-products');

function argValue(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : '';
}

const MODEL_ID_FILTER = argValue('model-id');
const SEARCH_FILTER = normalizeKey(argValue('search'));

function clean(value) {
  return String(value || '').trim();
}

function normalizeKey(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function isSmartphoneProduct(product) {
  const specs = product.specs || {};
  const name = normalizeKey(product.name);
  const hasPhoneSpecs = Boolean(clean(specs.imei1 || specs.imei_1) || clean(specs.imei2 || specs.imei_2));
  if (!hasPhoneSpecs) return false;
  if (/capa|pelicula|pelicula|carregador|cabo|fonte|fone|relogio|smartwatch/.test(name)) return false;
  return true;
}

function matchesFilters(product) {
  if (MODEL_ID_FILTER && clean(product.model_id) !== MODEL_ID_FILTER) return false;
  if (!SEARCH_FILTER) return true;

  const haystack = normalizeKey([
    product.name,
    product.sku,
    product.model,
    product.brand,
    product.specs?.color,
    product.specs?.ram,
    product.specs?.storage,
  ].filter(Boolean).join(' '));

  return haystack.includes(SEARCH_FILTER);
}

function signature(product) {
  const specs = product.specs || {};
  const modelId = clean(product.model_id);
  const ram = normalizeKey(specs.ram);
  const storage = normalizeKey(specs.storage);
  const color = normalizeKey(specs.color);
  if (modelId && ram && storage && color) {
    return ['model', modelId, ram, storage, color].join('|');
  }
  return `sku|${normalizeKey(product.sku) || product.id}`;
}

function identifiers(product) {
  const specs = product.specs || {};
  return {
    imei_1: clean(specs.imei1 || specs.imei_1),
    imei_2: clean(specs.imei2 || specs.imei_2),
    serial: clean(specs.serial || specs.serial_number),
  };
}

function identifierKey(unit) {
  const ids = [unit.imei_1, unit.imei_2, unit.serial].map(normalizeKey).filter(Boolean);
  return ids[0] || '';
}

function chooseCanonicalProduct(group, unitsByProduct) {
  const withUnits = group
    .filter((product) => (unitsByProduct.get(product.id) || []).length > 0)
    .sort((left, right) => (unitsByProduct.get(right.id) || []).length - (unitsByProduct.get(left.id) || []).length);
  if (withUnits[0]) return withUnits[0];

  const nonXi = group.filter((product) => !normalizeKey(product.sku).startsWith('xi-'));
  const candidates = nonXi.length ? nonXi : group;
  return [...candidates].sort((left, right) => clean(left.sku).length - clean(right.sku).length)[0];
}

function summarizePlan(groups, planned, skippedDuplicates) {
  const byGroup = new Map();

  for (const item of planned) {
    const bucket = byGroup.get(item.group_key) || {
      group_key: item.group_key,
      target_product_id: item.target_product_id,
      target_sku: item.target_sku,
      planned_units: 0,
      source_skus: new Set(),
      source_product_ids: new Set(),
      identifiers: [],
    };
    bucket.planned_units += 1;
    bucket.source_skus.add(item.source_sku || '-');
    bucket.source_product_ids.add(item.source_product_id);
    bucket.identifiers.push(item.imei_1 || item.imei_2 || item.serial || '-');
    byGroup.set(item.group_key, bucket);
  }

  const duplicateCountByGroup = new Map();
  for (const duplicate of skippedDuplicates) {
    duplicateCountByGroup.set(duplicate.group_key, (duplicateCountByGroup.get(duplicate.group_key) || 0) + 1);
  }

  return [...byGroup.values()].map((bucket) => {
    const group = groups.get(bucket.group_key) || [];
    return {
      group_key: bucket.group_key,
      target_product_id: bucket.target_product_id,
      target_sku: bucket.target_sku,
      planned_units: bucket.planned_units,
      skipped_duplicates: duplicateCountByGroup.get(bucket.group_key) || 0,
      source_skus: [...bucket.source_skus].sort(),
      source_product_ids: [...bucket.source_product_ids].sort(),
      group_products: group.map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        color: product.specs?.color || '',
        ram: product.specs?.ram || '',
        storage: product.specs?.storage || '',
      })),
      identifiers: bucket.identifiers.sort(),
    };
  }).sort((left, right) => left.group_key.localeCompare(right.group_key));
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(SYNC_KEY ? { 'X-Sync-Key': SYNC_KEY } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${path}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

async function fetchAllProducts() {
  const all = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const page = await api(`/products?limit=${pageSize}&offset=${offset}`);
    if (!Array.isArray(page) || page.length === 0) break;
    all.push(...page);
    if (page.length < pageSize) break;
  }
  return all;
}

async function main() {
  const products = await fetchAllProducts();
  const smartphones = products.filter((product) => isSmartphoneProduct(product) && matchesFilters(product));
  const groups = new Map();

  for (const product of smartphones) {
    const key = signature(product);
    const list = groups.get(key) || [];
    list.push(product);
    groups.set(key, list);
  }

  const unitsByProduct = new Map();
  for (const product of smartphones) {
    const units = await api(`/units?product_id=${encodeURIComponent(product.id)}`).catch(() => []);
    unitsByProduct.set(product.id, Array.isArray(units) ? units : []);
  }

  const planned = [];
  const skippedDuplicates = [];
  const cleanupCandidates = [];

  for (const [groupKey, group] of groups) {
    const canonical = chooseCanonicalProduct(group, unitsByProduct);
    const seen = new Set();
    const unitByIdentifier = new Map();
    for (const product of group) {
      for (const unit of unitsByProduct.get(product.id) || []) {
        const existingIdentifierKey = identifierKey({ imei_1: unit.imei_1, imei_2: unit.imei_2, serial: unit.serial });
        if (existingIdentifierKey) {
          seen.add(existingIdentifierKey);
          if (!unitByIdentifier.has(existingIdentifierKey)) unitByIdentifier.set(existingIdentifierKey, unit);
        }
      }
    }

    for (const product of group) {
      const ids = identifiers(product);
      const currentIdentifierKey = identifierKey(ids);
      if (!currentIdentifierKey) continue;
      const sourceUnits = unitsByProduct.get(product.id) || [];
      const existingUnit = unitByIdentifier.get(currentIdentifierKey);
      const canCleanMigratedSource = product.id !== canonical.id
        && sourceUnits.length === 0
        && existingUnit
        && existingUnit.product_id === canonical.id;
      if (canCleanMigratedSource) {
        cleanupCandidates.push({
          group_key: groupKey,
          source_product_id: product.id,
          source_sku: product.sku,
          target_product_id: canonical.id,
          target_sku: canonical.sku,
          identifier: currentIdentifierKey,
          unit_id: existingUnit.id,
          unit_status: existingUnit.status,
        });
      }
      if (seen.has(currentIdentifierKey)) {
        skippedDuplicates.push({
          group_key: groupKey,
          source_product_id: product.id,
          source_sku: product.sku,
          identifier: currentIdentifierKey,
          reason: 'identifier already exists in group units or duplicate specs',
        });
        continue;
      }
      seen.add(currentIdentifierKey);
      planned.push({
        group_key: groupKey,
        source_product_id: product.id,
        source_sku: product.sku,
        target_product_id: canonical.id,
        target_sku: canonical.sku,
        imei_1: ids.imei_1 || undefined,
        imei_2: ids.imei_2 || undefined,
        serial: ids.serial || undefined,
        status: 'available',
        condition: 'new',
        cost_price: product.price_cost ?? undefined,
        internal_notes: `Migrado de product.specs pelo rebuild de smartphones em ${new Date().toISOString()}. Produto origem ${product.id} (${product.sku || '-'})`,
      });
      if (product.id !== canonical.id && sourceUnits.length === 0) {
        cleanupCandidates.push({
          group_key: groupKey,
          source_product_id: product.id,
          source_sku: product.sku,
          target_product_id: canonical.id,
          target_sku: canonical.sku,
          identifier: currentIdentifierKey,
          unit_id: null,
          unit_status: 'pending_creation',
        });
      }
    }
  }

  const result = {
    ok: true,
    dry_run: !APPLY,
    products_scanned: products.length,
    smartphones_with_legacy_identifiers: smartphones.length,
    groups: groups.size,
    planned_units: planned.length,
    skipped_duplicates: skippedDuplicates.length,
    cleanup_requested: CLEANUP_LEGACY_PRODUCTS,
    cleanup_candidates: cleanupCandidates,
    cleanup_candidates_count: cleanupCandidates.length,
    planned,
    skippedDuplicates,
    inserted: 0,
    errors: [],
    cleaned_legacy_products: 0,
    cleanup_errors: [],
  };

  if (SUMMARY) {
    result.summary = summarizePlan(groups, planned, skippedDuplicates);
    delete result.planned;
    delete result.skippedDuplicates;
  }

  if (APPLY && planned.length > 0) {
    if (!SYNC_KEY) throw new Error('Missing VITE_VPS_SYNC_KEY/VPS_SYNC_KEY');
    const created = await api('/units/batch', {
      method: 'POST',
      body: JSON.stringify(planned.map(({ group_key, source_product_id, source_sku, target_product_id, target_sku, ...unit }) => ({
        ...unit,
        product_id: target_product_id,
      }))),
    });
    result.inserted = created.inserted || 0;
    result.errors = created.errors || [];
  }

  if (APPLY && CLEANUP_LEGACY_PRODUCTS && cleanupCandidates.length > 0) {
    if (!SYNC_KEY) throw new Error('Missing VITE_VPS_SYNC_KEY/VPS_SYNC_KEY');
    for (const candidate of cleanupCandidates) {
      try {
        const [matchingUnits, sourceUnits] = await Promise.all([
          api(`/units/by-identifier/${encodeURIComponent(candidate.identifier)}`),
          api(`/units?product_id=${encodeURIComponent(candidate.source_product_id)}`),
        ]);
        const migratedUnit = (Array.isArray(matchingUnits) ? matchingUnits : [])
          .find((unit) => unit.product_id === candidate.target_product_id);
        if (!migratedUnit) throw new Error('matching unit was not found on the canonical product');
        if (Array.isArray(sourceUnits) && sourceUnits.length > 0) {
          throw new Error('source product owns units and cannot be archived automatically');
        }

        await api(`/table-data/products/${encodeURIComponent(candidate.source_product_id)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'inactive',
            stock_quantity: 0,
            hide_from_catalog: 1,
          }),
        });
        result.cleaned_legacy_products += 1;
      } catch (error) {
        result.cleanup_errors.push({
          source_product_id: candidate.source_product_id,
          target_product_id: candidate.target_product_id,
          identifier: candidate.identifier,
          error: error.message,
        });
      }
    }
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    dry_run: !APPLY,
    error: error.message,
    status: error.status || null,
    body: error.body || null,
  }, null, 2));
  process.exitCode = 1;
});
