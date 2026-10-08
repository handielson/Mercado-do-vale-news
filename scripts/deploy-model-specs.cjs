'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const BASELINE = 'f3736b42';
const ENTRIES = ['server.js', 'vps_server.js', 'vps_server.cjs'];
const MODULES = [
  'services/smartphoneModelSpecs.mjs',
  'services/smartphoneModelSpecsBoundary.cjs',
  'services/smartphonePhotoIntakeServer.cjs',
  'services/smartphonePhotoIntakeCore.cjs',
  'services/smartphoneModelFamily.cjs',
  'services/modelDisplayFieldMigration.cjs',
  'scripts/migrate-model-display-fields.cjs',
  'services/autoresponderCatalogPreferences.cjs',
  'services/smartphonePriceGroupsServer.cjs',
  'services/smartphonePriceGroupsCore.cjs',
];
const ANCHORS = [
  ['function buildAutoresponderProductSearchScoreSql(', '\n}\n'],
  ['async function countAutoresponderProductsByTokens(', '\n}\n'],
  ...['findAutoresponderProductsByTag', 'findAutoresponderProductsByCategory', 'findAutoresponderProductsByCategoryBudget', 'findAutoresponderProductById', 'findAutoresponderProductVariations', 'findAutoresponderProductsByTokens'].map(name => [`async function ${name}(`, '\n}\n']),
  ['async function attachCatalogModelColorImages(', '\n}\n'],
  ["fastify.get('/products',", '\n});'],
  ["fastify.get('/products/by-ids',", '\n});'],
  ["fastify.get('/products/:id',", '\n});'],
  ["fastify.get('/products/by-slug/:slug',", '\n});'],
  ["fastify.get('/products/by-ean/:ean',", '\n});'],
  ["fastify.post('/products/batch',", '\n});'],
  ["fastify.put('/products/:id',", '\n});'],
  ["fastify.get('/table-data/:name',", '\n});'],
  ["fastify.post('/table-data/:name',", '\n});'],
  ["fastify.post('/table-data/:name/bulk',", '\n});'],
  ["fastify.patch('/table-data/:name/:pkValue',", '\n});'],
];
const normalize = source => source.replace(/\r\n/g, '\n');
const MODEL_HOOK = "require('./services/smartphoneModelSpecsBoundary.cjs').registerSmartphoneModelSpecsBoundary(fastify, { db: pool });\n\n";
const PRIVACY_ANCHOR = "require('./services/productReadPrivacy.cjs').registerProductReadPrivacy(fastify, {";
const BOT_PROJECTION_IMPORT = "  const { applyModelSpecsToProducts } = await import('./services/smartphoneModelSpecs.mjs');\n";
function patchBotSearch(source) {
  let result = source;
  const substitutions = [
    ["COALESCE(CAST(specs AS CHAR), '')", "COALESCE(${searchColumns.specs}, '')"],
    ["COALESCE(CAST(custom_fields AS CHAR), '')", "COALESCE(${searchColumns.customFields}, '')"],
  ];
  if (source.startsWith('function buildAutoresponderProductSearchScoreSql(')) substitutions.push([
    'function buildAutoresponderProductSearchScoreSql(tokens) {',
    "function buildAutoresponderProductSearchScoreSql(tokens, searchColumns = { specs: 'CAST(specs AS CHAR)', customFields: 'CAST(custom_fields AS CHAR)' }) {",
  ]);
  else {
    const empty = source.includes('countAutoresponder') ? '  if (safeTokens.length === 0) return 0;' : '  if (safeTokens.length === 0) return [];';
    substitutions.push([empty, empty + "\n  const { smartphoneCatalogSearchSql } = await import('./services/smartphoneModelSpecs.mjs');\n  const searchColumns = smartphoneCatalogSearchSql();\n  const networkQuery = safeTokens.length === 1 && /^[45]g$/.test(normalizeAutoresponderText(safeTokens[0]).trim())\n    ? normalizeAutoresponderText(safeTokens[0]).trim().toUpperCase() : null;"]);
    substitutions.push(['  const clauses = safeTokens.map(', '  const clauses = networkQuery ? [searchColumns.network(networkQuery)] : safeTokens.map(']);
    substitutions.push(['  for (const token of safeTokens) {', '  for (const token of networkQuery ? [] : safeTokens) {']);
    if (source.startsWith('async function findAutoresponderProductsByTokens(')) substitutions.push([
      '  const score = buildAutoresponderProductSearchScoreSql(safeTokens);',
      '  const score = buildAutoresponderProductSearchScoreSql(safeTokens, searchColumns);',
    ]);
  }
  for (const [old, next] of substitutions) {
    if (result.includes(next)) continue;
    if (result.split(old).length !== 2) throw new Error('Remote bot search anchor drift: ' + old);
    result = result.replace(old, next);
  }
  return result;
}
function patchBotProjection(remote, baseline, current) {
  if (baseline.startsWith('async function findAutoresponderProductsByTokens(')) {
    baseline = patchBotSearch(baseline);
    remote = patchBotSearch(remote);
  }
  const tail = source => {
    const match = source.match(/(?:  const \{ applyModelSpecsToProducts \} = await import\('\.\/services\/smartphoneModelSpecs\.mjs'\);\n)?  return [^\n]+;\n}\n$/);
    if (!match) throw new Error('Unexpected bot return shape');
    return match[0];
  };
  const oldTail = tail(baseline), nextTail = tail(current), foundTail = tail(remote);
  if (!nextTail.startsWith(BOT_PROJECTION_IMPORT) || !nextTail.includes('applyModelSpecsToProducts(pool, ')) throw new Error('Unexpected bot projection delta');
  if (baseline.replace(oldTail, nextTail) !== current) throw new Error('Unexpected local bot changes outside projection return');
  if (remote.split('\n')[0] !== baseline.split('\n')[0]) throw new Error('Remote bot signature drift');
  if (foundTail !== oldTail && foundTail !== nextTail) throw new Error('Remote bot return drift');
  return remote.replace(foundTail, nextTail);
}
function block(source, [anchor, closing]) {
  if (source.split(anchor).length !== 2) throw new Error(`Ambiguous or missing anchor: ${anchor}`);
  const start = source.indexOf(anchor), end = source.indexOf(closing, start);
  if (end < 0) throw new Error(`Missing closing anchor: ${anchor}`);
  return source.slice(start, end + closing.length);
}
function patch(remote, baseline, current) {
  const oldSource = normalize(baseline), newSource = normalize(current);
  let result = normalize(remote), accounted = oldSource;
  for (const spec of ANCHORS) {
    // The compatibility server has a smaller route set than the active CJS API.
    if (!oldSource.includes(spec[0]) && !newSource.includes(spec[0])) continue;
    const old = block(oldSource, spec), next = block(newSource, spec);
    if (old === next) continue;
    const found = block(result, spec);
    if (spec[0].startsWith('async function findAutoresponder')) result = result.replace(found, patchBotProjection(found, old, next));
    else if (spec[0].includes('buildAutoresponderProductSearchScoreSql') || spec[0].includes('countAutoresponderProductsByTokens')) {
      if (patchBotSearch(old) !== next) throw new Error('Unexpected local bot search changes');
      result = result.replace(found, patchBotSearch(found));
    }
    else {
      if (found !== old && found !== next) throw new Error(`Remote entry drift: ${spec[0]}`);
      result = result.replace(found, next);
    }
    accounted = accounted.replace(old, next);
  }
  if (!oldSource.includes(MODEL_HOOK) && newSource.includes(MODEL_HOOK)) {
    if (accounted.split(PRIVACY_ANCHOR).length !== 2 || result.split(PRIVACY_ANCHOR).length !== 2) throw new Error('Ambiguous privacy boundary anchor');
    accounted = accounted.replace(PRIVACY_ANCHOR, MODEL_HOOK + PRIVACY_ANCHOR);
    if (!result.includes(MODEL_HOOK)) {
      if (result.includes('registerSmartphoneModelSpecsBoundary')) throw new Error('Remote model boundary hook drift');
      result = result.replace(PRIVACY_ANCHOR, MODEL_HOOK + PRIVACY_ANCHOR);
    }
  }
  // Never silently omit a local entry change or upload unrelated API code.
  if (accounted !== newSource) throw new Error('Unaccounted entry changes outside the model specs allowlist');
  return remote.includes('\r\n') ? result.replace(/\n/g, '\r\n') : result;
}
function readBaseline(root, file) {
  const exists = execFileSync('git', ['ls-tree', '--name-only', BASELINE, '--', file], { cwd: root, encoding: 'utf8' }).trim();
  return exists ? execFileSync('git', ['show', `${BASELINE}:${file}`], { cwd: root, encoding: 'utf8', maxBuffer: 15e6 }) : '';
}
async function deployModelSpecs(options) {
  const baseline = new Map(), current = new Map();
  for (const file of [...MODULES, ...ENTRIES]) {
    if (!fs.existsSync(path.join(options.root, file))) continue;
    baseline.set(file, readBaseline(options.root, file));
    current.set(file, fs.readFileSync(path.join(options.root, file), 'utf8'));
  }
  const modules = MODULES.filter(file => current.has(file) && normalize(current.get(file)) !== normalize(baseline.get(file)));
  const patchFile = (remote, file) => {
    if (ENTRIES.includes(file)) return patch(remote, baseline.get(file), current.get(file));
    if (normalize(remote) !== normalize(baseline.get(file)) && normalize(remote) !== normalize(current.get(file))) throw new Error(`Remote module drift: ${file}`);
    return current.get(file);
  };
  await require('./deploy-product-read-privacy.cjs').deployProductReadPrivacy({ ...options,
    files: [...modules, ...ENTRIES], patchFile, backupPrefix: 'model-specs' });
}
module.exports = { BASELINE, ENTRIES, MODULES, ANCHORS, block, patch, patchBotProjection, patchBotSearch, deployModelSpecs };
