const remoteScript = String.raw`
const fs = require('fs');
const path = require('path');

const root = '/var/www/mdv-api/uploads';
const exts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const optimizableExts = new Set(['.jpg', '.jpeg', '.png']);
const minBytes = 100 * 1024;
const assets = [];

function normalize(value) {
  return value.replace(/\\/g, '/');
}

function classify(file, size) {
  const normalized = normalize(file);
  const lower = normalized.toLowerCase();
  const ext = path.extname(lower);
  const kind = lower.includes('/banners/')
    ? 'banner'
    : lower.includes('/products/')
      ? 'product'
      : 'other';

  return {
    path: normalized.replace(root + '/', ''),
    sizeBytes: size,
    extension: ext,
    kind,
    shouldOptimize: kind !== 'other' && optimizableExts.has(ext) && size >= minBytes,
  };
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!exts.has(ext)) continue;
    assets.push(classify(full, fs.statSync(full).size));
  }
}

walk(root);

const summary = {
  root,
  exists: fs.existsSync(root),
  totalImages: assets.length,
  totalBytes: assets.reduce((sum, item) => sum + item.sizeBytes, 0),
  optimizableImages: assets.filter((item) => item.shouldOptimize).length,
  optimizableBytes: assets.filter((item) => item.shouldOptimize).reduce((sum, item) => sum + item.sizeBytes, 0),
  byKind: {},
  byExtension: {},
  largestOptimizable: assets
    .filter((item) => item.shouldOptimize)
    .sort((left, right) => right.sizeBytes - left.sizeBytes)
    .slice(0, 30),
};

for (const asset of assets) {
  summary.byKind[asset.kind] ??= { count: 0, bytes: 0, optimizableCount: 0, optimizableBytes: 0 };
  summary.byKind[asset.kind].count += 1;
  summary.byKind[asset.kind].bytes += asset.sizeBytes;
  if (asset.shouldOptimize) {
    summary.byKind[asset.kind].optimizableCount += 1;
    summary.byKind[asset.kind].optimizableBytes += asset.sizeBytes;
  }

  summary.byExtension[asset.extension] ??= { count: 0, bytes: 0, optimizableCount: 0, optimizableBytes: 0 };
  summary.byExtension[asset.extension].count += 1;
  summary.byExtension[asset.extension].bytes += asset.sizeBytes;
  if (asset.shouldOptimize) {
    summary.byExtension[asset.extension].optimizableCount += 1;
    summary.byExtension[asset.extension].optimizableBytes += asset.sizeBytes;
  }
}

console.log(JSON.stringify(summary, null, 2));
`;

const encoded = Buffer.from(remoteScript, 'utf8').toString('base64');
console.log(`cd /var/www/mdv-api && printf %s ${encoded} | base64 -d | node`);
