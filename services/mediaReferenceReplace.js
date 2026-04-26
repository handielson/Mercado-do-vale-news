import { decodeInlineDataImage } from './mediaMigrationPlanner.js';

export function parseIndexedMediaField(field) {
  const match = /^([a-zA-Z0-9_]+)\[(\d+)\]$/u.exec(String(field || ''));
  if (!match) return null;
  return {
    baseField: match[1],
    index: Number(match[2]),
  };
}

function entityKey(action) {
  return `${action.entityType}:${action.entityId}`;
}

function resultFor(action, status, extra = {}) {
  return {
    status,
    entityType: action.entityType,
    entityId: action.entityId,
    field: action.field,
    sha256: action.sha256,
    ...extra,
  };
}

function getUpload(checkpoint, action) {
  return checkpoint?.uploadsBySha?.[action.sha256] || null;
}

function currentValueMatchesAction(value, action) {
  const decoded = decodeInlineDataImage(value);
  return decoded.ok && decoded.sha256 === action.sha256;
}

export function buildMediaReferenceReplacementPlan(plan, options = {}) {
  const checkpoint = options.checkpoint || {};
  const rowsByEntity = options.rowsByEntity || {};
  const results = [];
  const mutationMap = new Map();

  for (const action of plan.actions || []) {
    if (action.status !== 'planned') {
      results.push(resultFor(action, 'skipped', { reason: action.reason || 'action is not planned' }));
      continue;
    }

    if (action.entityType !== 'product') {
      results.push(resultFor(action, 'unsupported-entity', { reason: 'reference replacement pilot supports products only' }));
      continue;
    }

    const field = parseIndexedMediaField(action.field);
    if (!field || field.baseField !== 'images') {
      results.push(resultFor(action, 'unsupported-field', { reason: 'only product images[index] is supported in this pilot' }));
      continue;
    }

    const upload = getUpload(checkpoint, action);
    if (!upload?.url) {
      results.push(resultFor(action, 'missing-upload', { reason: 'checkpoint does not contain uploaded URL for sha256' }));
      continue;
    }

    const row = rowsByEntity[entityKey(action)];
    if (!row) {
      results.push(resultFor(action, 'missing-row', { reason: 'current entity row was not loaded' }));
      continue;
    }

    const currentImages = Array.isArray(row.images) ? row.images : [];
    const currentValue = currentImages[field.index];
    if (!currentValueMatchesAction(currentValue, action)) {
      results.push(resultFor(action, 'hash-mismatch', { reason: 'current value no longer matches audited inline payload' }));
      continue;
    }

    const key = entityKey(action);
    if (!mutationMap.has(key)) {
      mutationMap.set(key, {
        entityType: action.entityType,
        entityId: action.entityId,
        sku: row.sku,
        field: field.baseField,
        nextValue: [...currentImages],
        replacements: [],
      });
    }

    const mutation = mutationMap.get(key);
    mutation.nextValue[field.index] = upload.url;
    mutation.replacements.push({
      index: field.index,
      sha256: action.sha256,
      from: 'data:REDACTED',
      to: upload.url,
    });
    results.push(resultFor(action, 'ready', {
      index: field.index,
      uploadedUrl: upload.url,
    }));
  }

  const mutations = [...mutationMap.values()];
  return {
    generatedAt: new Date().toISOString(),
    mode: 'replace-references',
    scope: plan.scope,
    summary: {
      total: results.length,
      ready: results.filter((result) => result.status === 'ready').length,
      skipped: results.filter((result) => result.status !== 'ready').length,
      mutations: mutations.length,
    },
    results,
    mutations,
  };
}
