import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(currentFile), '..');
const defaultInput = path.join(root, 'tmp-tests', 'vps-bling-reconcile-dry-run-details-output.json');
const defaultMarkdownOutput = path.join(root, 'reports', 'bling-reconcile-review.md');
const defaultJsonOutput = path.join(root, 'reports', 'bling-reconcile-review.json');

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function readPlan(inputPath) {
  const raw = readFileSync(inputPath);
  return {
    raw,
    json: JSON.parse(raw.toString('utf8')),
    sha256: createHash('sha256').update(raw).digest('hex'),
  };
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeSku(value) {
  const sku = String(value || '').trim();
  return sku || null;
}

function getStockChanges(plan) {
  return Array.isArray(plan.details?.stockChanges) ? plan.details.stockChanges : [];
}

function getNameChanges(plan) {
  return Array.isArray(plan.details?.nameChanges) ? plan.details.nameChanges : [];
}

function isColorOrVariantExpansion(change) {
  const previousName = String(change.previousName || '').trim().toLocaleLowerCase('pt-BR');
  const nextName = String(change.nextName || '').trim().toLocaleLowerCase('pt-BR');
  if (!previousName || !nextName || !nextName.startsWith(previousName)) return false;

  const suffix = nextName.slice(previousName.length).trim();
  if (!suffix) return true;
  return /(?:^|[,:\s])(cor|global|gb|ram|nfc|azul|amarelo|preto|verde|branco|cinza|rosa|roxo|dourado|grafite|kits?)\b/i.test(suffix);
}

function buildReview(plan, sourcePath, sourceHash) {
  const stockChanges = getStockChanges(plan);
  const nameChanges = getNameChanges(plan);
  const stockDeltas = stockChanges.map((change) => ({
    sku: normalizeSku(change.sku),
    previousStock: toNumber(change.previousStock),
    nextStock: toNumber(change.nextStock),
    delta: toNumber(change.nextStock) - toNumber(change.previousStock),
  }));
  const stockZeroing = stockDeltas
    .filter((change) => change.previousStock > 0 && change.nextStock === 0 && change.sku)
    .map((change) => change.sku);
  const unsafeRenames = nameChanges
    .filter((change) => !isColorOrVariantExpansion(change))
    .map((change) => normalizeSku(change.sku) || '(sem sku)');

  const riskFlags = [];
  if (stockZeroing.length > 0) riskFlags.push('stock_zeroing_present');
  if (unsafeRenames.length > 0) riskFlags.push('name_changes_not_limited_to_color_suffix');

  const summary = {
    stockChanges: stockChanges.length,
    stockIncreases: stockDeltas.filter((change) => change.delta > 0).length,
    stockDecreases: stockDeltas.filter((change) => change.delta < 0).length,
    stockSame: stockDeltas.filter((change) => change.delta === 0).length,
    stockZeroing: stockZeroing.length,
    stockTotalDelta: stockDeltas.reduce((sum, change) => sum + change.delta, 0),
    stockMaxAbsDelta: stockDeltas.reduce((max, change) => Math.max(max, Math.abs(change.delta)), 0),
    nameChanges: nameChanges.length,
    safeNameChanges: nameChanges.length - unsafeRenames.length,
    unsafeNameChanges: unsafeRenames.length,
  };

  return {
    generatedAt: new Date().toISOString(),
    source: {
      path: path.relative(root, sourcePath).replace(/\\/g, '/'),
      sha256: sourceHash,
    },
    planned: plan.planned || {
      stockChanges: stockChanges.length,
      nameChanges: nameChanges.length,
    },
    summary,
    riskFlags,
    samples: {
      stockZeroing,
      unsafeRenames,
      stockChanges: stockDeltas.slice(0, 10),
      nameChanges: nameChanges.slice(0, 10).map((change) => ({
        sku: normalizeSku(change.sku) || '(sem sku)',
        previousName: change.previousName || '',
        nextName: change.nextName || '',
        safeVariantExpansion: isColorOrVariantExpansion(change),
      })),
    },
  };
}

function renderMarkdown(review) {
  const lines = [
    '# Bling reconcile review',
    '',
    `Generated at: ${review.generatedAt}`,
    `Source: ${review.source.path}`,
    `Source SHA-256: ${review.source.sha256}`,
    '',
    '## Summary',
    '',
    `- Stock changes: ${review.summary.stockChanges}`,
    `- Stock increases: ${review.summary.stockIncreases}`,
    `- Stock decreases: ${review.summary.stockDecreases}`,
    `- Stock zeroing: ${review.summary.stockZeroing}`,
    `- Stock total delta: ${review.summary.stockTotalDelta}`,
    `- Stock max absolute delta: ${review.summary.stockMaxAbsDelta}`,
    `- Name changes: ${review.summary.nameChanges}`,
    `- Safe name changes: ${review.summary.safeNameChanges}`,
    `- Unsafe name changes: ${review.summary.unsafeNameChanges}`,
    '',
    '## Risk flags',
    '',
    ...(review.riskFlags.length ? review.riskFlags.map((flag) => `- ${flag}`) : ['- none']),
    '',
    '## Required apply confirmations',
    '',
    `- CONFIRM_BLING_RECONCILE_SOURCE_SHA256=${review.source.sha256}`,
  ];

  if (review.riskFlags.includes('stock_zeroing_present')) {
    lines.push('- CONFIRM_BLING_RECONCILE_ZEROING=I_REVIEWED_STOCK_ZEROING');
    lines.push(`- CONFIRM_BLING_RECONCILE_ZEROING_SKUS=${review.samples.stockZeroing.slice().sort().join(',')}`);
  }
  if (review.riskFlags.includes('name_changes_not_limited_to_color_suffix')) {
    lines.push('- CONFIRM_BLING_RECONCILE_UNSAFE_RENAMES=I_REVIEWED_UNSAFE_RENAMES');
    lines.push(`- CONFIRM_BLING_RECONCILE_UNSAFE_RENAME_SKUS=${review.samples.unsafeRenames.slice().sort().join(',')}`);
  }

  return `${lines.join('\n')}\n`;
}

function writeReview(review, markdownOutput, jsonOutput) {
  mkdirSync(path.dirname(markdownOutput), { recursive: true });
  mkdirSync(path.dirname(jsonOutput), { recursive: true });
  writeFileSync(markdownOutput, renderMarkdown(review));
  writeFileSync(jsonOutput, `${JSON.stringify(review, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  const inputPath = path.resolve(argValue('--input', defaultInput));
  const markdownOutput = path.resolve(argValue('--markdown-output', defaultMarkdownOutput));
  const jsonOutput = path.resolve(argValue('--json-output', defaultJsonOutput));
  const { json, sha256 } = readPlan(inputPath);
  const review = buildReview(json, inputPath, sha256);
  writeReview(review, markdownOutput, jsonOutput);

  console.log(JSON.stringify({
    ok: true,
    input: path.relative(root, inputPath).replace(/\\/g, '/'),
    markdownOutput: path.relative(root, markdownOutput).replace(/\\/g, '/'),
    jsonOutput: path.relative(root, jsonOutput).replace(/\\/g, '/'),
    sha256: review.source.sha256,
    summary: review.summary,
    riskFlags: review.riskFlags,
  }, null, 2));
}

export { buildReview, renderMarkdown };
