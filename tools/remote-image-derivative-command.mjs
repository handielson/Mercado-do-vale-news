import { fileURLToPath } from 'node:url';
import path from 'node:path';

const remoteScript = String.raw`
const fs = require('fs');
const path = require('path');

const root = '/var/www/mdv-api/uploads';
const imageExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const optimizableExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const productWidths = [320, 480, 800];
const bannerWidths = [768, 1280];
const formats = ['webp', 'avif'];

function parseArgs(argv) {
  const limitIndex = argv.indexOf('--limit');
  const minBytesIndex = argv.indexOf('--min-bytes');
  const containsIndex = argv.indexOf('--contains');
  return {
    limit: limitIndex >= 0 ? Number.parseInt(argv[limitIndex + 1], 10) : 1,
    minBytes: minBytesIndex >= 0 ? Number.parseInt(argv[minBytesIndex + 1], 10) : 10 * 1024,
    contains: containsIndex >= 0 ? String(argv[containsIndex + 1] || '').toLowerCase() : '',
    apply: argv.includes('--apply'),
    skipExisting: argv.includes('--skip-existing'),
    summary: argv.includes('--summary'),
  };
}

function normalize(value) {
  return value.replace(/\\/g, '/');
}

function isImmutableImageDerivative(value) {
  return /-(320|480|768|800|1280)\.(webp|avif)$/i.test(value);
}

function classify(file, size, options) {
  const normalized = normalize(file);
  const lower = normalized.toLowerCase();
  const ext = path.extname(lower);
  const kind = lower.includes('/banners/')
    ? 'banner'
    : lower.includes('/products/') || lower.includes('/legacy/external/')
      ? 'product'
      : 'other';

  return {
    path: normalized,
    relativePath: normalized.replace(root + '/', ''),
    sizeBytes: size,
    extension: ext,
    kind,
    shouldOptimize:
      kind !== 'other'
      && optimizableExts.has(ext)
      && !isImmutableImageDerivative(normalized)
      && size >= options.minBytes,
  };
}

function walk(dir, options, assets = []) {
  if (!fs.existsSync(dir)) return assets;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, options, assets);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!imageExts.has(ext)) continue;
    assets.push(classify(full, fs.statSync(full).size, options));
  }
  return assets;
}

function buildDerivativePlan(asset) {
  const widths = asset.kind === 'banner' ? bannerWidths : productWidths;
  const basePath = asset.path.slice(0, -asset.extension.length);

  return formats.flatMap((format) => widths.map((width) => ({
    inputPath: asset.path,
    inputBytes: asset.sizeBytes,
    outputPath: basePath + '-' + width + '.' + format,
    relativeInputPath: asset.relativePath,
    relativeOutputPath: asset.relativePath.slice(0, -asset.extension.length) + '-' + width + '.' + format,
    width,
    format,
  })));
}

function summarizeResults(results) {
  const created = results.filter((item) => item.status === 'created');
  const skippedExisting = results.filter((item) => item.status === 'skipped-existing');
  const createdBytes = created.reduce((sum, item) => sum + (item.outputBytes || 0), 0);
  const createdSources = new Set(created.map((item) => item.relativeInputPath)).size;

  return {
    created: created.length,
    skippedExisting: skippedExisting.length,
    createdBytes,
    createdSources,
    sampleCreated: created.slice(0, 12).map((item) => ({
      output: item.relativeOutputPath,
      bytes: item.outputBytes,
    })),
  };
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const assets = walk(root, options)
    .filter((asset) => asset.shouldOptimize)
    .filter((asset) => !options.contains || asset.relativePath.toLowerCase().includes(options.contains))
    .sort((left, right) => right.sizeBytes - left.sizeBytes)
    .slice(0, Math.max(1, options.limit));
  const jobs = assets.flatMap(buildDerivativePlan);

  if (!options.apply) {
    if (options.summary) {
      console.log(JSON.stringify({
        mode: 'dry-run',
        root,
        selectedSourceCount: assets.length,
        totalJobs: jobs.length,
        sampleSources: assets.slice(0, 12).map((asset) => ({
          path: asset.relativePath,
          bytes: asset.sizeBytes,
          kind: asset.kind,
        })),
      }, null, 2));
      return;
    }

    console.log(JSON.stringify({
      mode: 'dry-run',
      root,
      selectedSources: assets,
      totalJobs: jobs.length,
      jobs,
    }, null, 2));
    return;
  }

  const sharp = require('sharp');
  const results = [];

  for (const job of jobs) {
    if (options.skipExisting && fs.existsSync(job.outputPath)) {
      results.push({ ...job, status: 'skipped-existing' });
      continue;
    }

    fs.mkdirSync(path.dirname(job.outputPath), { recursive: true });
    let pipeline = sharp(job.inputPath)
      .rotate()
      .resize({ width: job.width, withoutEnlargement: true, fit: 'inside' });

    pipeline = job.format === 'avif'
      ? pipeline.avif({ quality: 50, effort: 4 })
      : pipeline.webp({ quality: 78, effort: 4 });

    await pipeline.toFile(job.outputPath);
    results.push({
      ...job,
      outputBytes: fs.statSync(job.outputPath).size,
      status: 'created',
    });
  }

  const summary = summarizeResults(results);
  if (options.summary) {
    console.log(JSON.stringify({
      mode: 'apply',
      root,
      selectedSourceCount: assets.length,
      totalJobs: jobs.length,
      ...summary,
    }, null, 2));
    return;
  }

  console.log(JSON.stringify({
    mode: 'apply',
    root,
    selectedSources: assets,
    totalJobs: jobs.length,
    created: summary.created,
    skippedExisting: summary.skippedExisting,
    results,
  }, null, 2));
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
`;

export function buildRemoteDerivativeCommand({
  limit = 1,
  apply = false,
  skipExisting = false,
  summary = false,
  minBytes = 10 * 1024,
  contains = '',
} = {}) {
  const encoded = Buffer.from(remoteScript, 'utf8').toString('base64');
  const args = [`--limit ${Math.max(1, Number.parseInt(limit, 10) || 1)}`];
  if (apply) args.push('--apply');
  if (skipExisting) args.push('--skip-existing');
  if (summary) args.push('--summary');
  args.push(`--min-bytes ${Math.max(0, Number.parseInt(minBytes, 10) || 0)}`);
  if (contains) args.push(`--contains ${String(contains).replace(/\s+/g, '')}`);

  return `cd /var/www/mdv-api && printf %s ${encoded} | base64 -d | node - ${args.join(' ')}`;
}

function parseLocalArgs(argv) {
  const limitIndex = argv.indexOf('--limit');
  const minBytesIndex = argv.indexOf('--min-bytes');
  const containsIndex = argv.indexOf('--contains');
  return {
    limit: limitIndex >= 0 ? Number.parseInt(argv[limitIndex + 1], 10) : 1,
    minBytes: minBytesIndex >= 0 ? Number.parseInt(argv[minBytesIndex + 1], 10) : 10 * 1024,
    contains: containsIndex >= 0 ? argv[containsIndex + 1] : '',
    apply: argv.includes('--apply'),
    skipExisting: argv.includes('--skip-existing'),
    summary: argv.includes('--summary'),
  };
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCli) {
  console.log(buildRemoteDerivativeCommand(parseLocalArgs(process.argv.slice(2))));
}
