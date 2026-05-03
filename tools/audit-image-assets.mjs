import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const OPTIMIZABLE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);
const PRODUCT_WIDTHS = [320, 480, 800];
const BANNER_WIDTHS = [768, 1280];
const DERIVATIVE_FORMATS = ['webp', 'avif'];
const MIN_OPTIMIZABLE_BYTES = 100 * 1024;

const normalizePath = (value) => value.replace(/\\/g, '/');

export function classifyImageAsset(filePath, sizeBytes = 0) {
  const normalizedPath = normalizePath(filePath);
  const extension = path.extname(normalizedPath).toLowerCase();
  const lowerPath = normalizedPath.toLowerCase();
  const kind = lowerPath.includes('/banners/')
    ? 'banner'
    : lowerPath.includes('/products/')
      ? 'product'
      : 'other';

  return {
    path: normalizedPath,
    extension,
    kind,
    sizeBytes,
    shouldOptimize:
      kind !== 'other'
      && OPTIMIZABLE_EXTENSIONS.has(extension)
      && sizeBytes >= MIN_OPTIMIZABLE_BYTES,
  };
}

export function buildDerivativePlan(asset) {
  if (!asset?.shouldOptimize) return [];

  const widths = asset.kind === 'banner' ? BANNER_WIDTHS : PRODUCT_WIDTHS;
  const extension = asset.extension || path.extname(asset.path);
  const basePath = asset.path.slice(0, -extension.length);

  return DERIVATIVE_FORMATS.flatMap((format) => (
    widths.map((width) => ({
      width,
      format,
      outputPath: `${basePath}-${width}.${format}`,
    }))
  ));
}

export function summarizeAssets(assets) {
  const byKind = {};

  for (const asset of assets) {
    byKind[asset.kind] ??= {
      count: 0,
      bytes: 0,
      optimizableCount: 0,
      optimizableBytes: 0,
    };

    byKind[asset.kind].count += 1;
    byKind[asset.kind].bytes += asset.sizeBytes;

    if (asset.shouldOptimize) {
      byKind[asset.kind].optimizableCount += 1;
      byKind[asset.kind].optimizableBytes += asset.sizeBytes;
    }
  }

  const optimizable = assets.filter((asset) => asset.shouldOptimize);

  return {
    totalImages: assets.length,
    totalBytes: assets.reduce((sum, asset) => sum + asset.sizeBytes, 0),
    optimizableImages: optimizable.length,
    optimizableBytes: optimizable.reduce((sum, asset) => sum + asset.sizeBytes, 0),
    plannedDerivatives: optimizable.reduce(
      (sum, asset) => sum + buildDerivativePlan(asset).length,
      0,
    ),
    byKind,
  };
}

export function collectImageAssets(rootDir) {
  if (!fs.existsSync(rootDir)) return [];

  const assets = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }

      if (!entry.isFile()) continue;

      const extension = path.extname(entry.name).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(extension)) continue;

      const stat = fs.statSync(entryPath);
      assets.push(classifyImageAsset(entryPath, stat.size));
    }
  }

  return assets;
}

function parseArgs(argv) {
  const rootIndex = argv.indexOf('--root');
  return {
    root: rootIndex >= 0 ? argv[rootIndex + 1] : 'uploads',
  };
}

function main() {
  const { root } = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(process.cwd(), root);
  const assets = collectImageAssets(rootDir);
  const optimizable = assets.filter((asset) => asset.shouldOptimize);
  const plan = optimizable.flatMap((asset) => (
    buildDerivativePlan(asset).map((derivative) => ({
      inputPath: asset.path,
      inputBytes: asset.sizeBytes,
      ...derivative,
    }))
  ));

  const output = {
    root: normalizePath(rootDir),
    exists: fs.existsSync(rootDir),
    summary: summarizeAssets(assets),
    largestOptimizable: optimizable
      .sort((left, right) => right.sizeBytes - left.sizeBytes)
      .slice(0, 20),
    planPreview: plan.slice(0, 40),
  };

  console.log(JSON.stringify(output, null, 2));
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCli) main();
