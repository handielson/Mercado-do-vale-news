import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildDerivativePlan,
  collectImageAssets,
  summarizeAssets,
} from './audit-image-assets.mjs';

const normalizePath = (value) => value.replace(/\\/g, '/');
const isStableAbsolutePath = (value) => value.startsWith('/') || /^[A-Za-z]:\//.test(value);
const resolveStablePath = (value) => {
  const normalized = normalizePath(value);
  return isStableAbsolutePath(normalized) ? normalized : normalizePath(path.resolve(normalized));
};
const relativeStablePath = (from, to) => {
  const normalizedFrom = normalizePath(from);
  const normalizedTo = normalizePath(to);

  if (normalizedFrom.startsWith('/') && normalizedTo.startsWith('/')) {
    return path.posix.relative(normalizedFrom, normalizedTo);
  }

  return normalizePath(path.relative(normalizedFrom, normalizedTo));
};

export function parseConversionArgs(argv) {
  const rootIndex = argv.indexOf('--root');
  const limitIndex = argv.indexOf('--limit');

  return {
    uploadsRoot: rootIndex >= 0 ? argv[rootIndex + 1] : 'uploads',
    limit: limitIndex >= 0 ? Number.parseInt(argv[limitIndex + 1], 10) : 0,
    dryRun: !argv.includes('--apply'),
    skipExisting: argv.includes('--skip-existing'),
  };
}

export function buildConversionJobs(assets, options = {}) {
  const uploadsRoot = resolveStablePath(options.uploadsRoot || 'uploads');
  const limit = Number.isFinite(options.limit) ? Math.max(0, options.limit) : 0;
  const dryRun = options.dryRun ?? true;
  const selectedAssets = assets
    .filter((asset) => asset.shouldOptimize)
    .sort((left, right) => right.sizeBytes - left.sizeBytes)
    .slice(0, limit > 0 ? limit : undefined);

  return selectedAssets.flatMap((asset) => (
    buildDerivativePlan(asset).map((derivative) => {
      const outputPath = resolveStablePath(derivative.outputPath);
      const inputPath = resolveStablePath(asset.path);

      return {
        inputPath,
        inputBytes: asset.sizeBytes,
        outputPath,
        relativeInputPath: relativeStablePath(uploadsRoot, inputPath),
        relativeOutputPath: relativeStablePath(uploadsRoot, outputPath),
        width: derivative.width,
        format: derivative.format,
        dryRun,
      };
    })
  ));
}

async function loadSharp() {
  try {
    return (await import('sharp')).default;
  } catch (error) {
    throw new Error(
      'Dependencia sharp nao encontrada. Instale no ambiente que vai converter com: npm install sharp',
      { cause: error },
    );
  }
}

async function runJob(sharp, job, options) {
  if (options.skipExisting && fs.existsSync(job.outputPath)) {
    return { ...job, status: 'skipped-existing' };
  }

  fs.mkdirSync(path.dirname(job.outputPath), { recursive: true });

  let pipeline = sharp(job.inputPath)
    .rotate()
    .resize({
      width: job.width,
      withoutEnlargement: true,
      fit: 'inside',
    });

  if (job.format === 'avif') {
    pipeline = pipeline.avif({ quality: 50, effort: 4 });
  } else {
    pipeline = pipeline.webp({ quality: 78, effort: 4 });
  }

  await pipeline.toFile(job.outputPath);
  const outputBytes = fs.statSync(job.outputPath).size;

  return {
    ...job,
    outputBytes,
    status: 'created',
  };
}

async function main() {
  const options = parseConversionArgs(process.argv.slice(2));
  const uploadsRoot = path.resolve(process.cwd(), options.uploadsRoot);
  const assets = collectImageAssets(uploadsRoot);
  const jobs = buildConversionJobs(assets, {
    uploadsRoot,
    limit: options.limit,
    dryRun: options.dryRun,
  });

  if (options.dryRun) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      uploadsRoot: normalizePath(uploadsRoot),
      summary: summarizeAssets(assets),
      jobs: jobs.slice(0, 80),
      totalJobs: jobs.length,
    }, null, 2));
    return;
  }

  const sharp = await loadSharp();
  const results = [];

  for (const job of jobs) {
    results.push(await runJob(sharp, job, options));
  }

  console.log(JSON.stringify({
    mode: 'apply',
    uploadsRoot: normalizePath(uploadsRoot),
    totalJobs: jobs.length,
    created: results.filter((result) => result.status === 'created').length,
    skippedExisting: results.filter((result) => result.status === 'skipped-existing').length,
    results,
  }, null, 2));
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCli) main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
