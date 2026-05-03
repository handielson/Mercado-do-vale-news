import assert from 'node:assert/strict';
import {
  buildConversionJobs,
  parseConversionArgs,
} from '../tools/generate-image-derivatives.mjs';

const assets = [
  {
    path: '/var/www/mdv-api/uploads/products/SKU/img-1.png',
    kind: 'product',
    extension: '.png',
    sizeBytes: 817000,
    shouldOptimize: true,
  },
  {
    path: '/var/www/mdv-api/uploads/products/SKU/existing.webp',
    kind: 'product',
    extension: '.webp',
    sizeBytes: 41000,
    shouldOptimize: false,
  },
];

const jobs = buildConversionJobs(assets, {
  uploadsRoot: '/var/www/mdv-api/uploads',
  limit: 1,
});

assert.equal(jobs.length, 6, 'one product source should produce WebP and AVIF at 3 widths each');
assert.deepEqual(
  jobs.map((job) => `${job.format}:${job.width}:${job.relativeOutputPath}`),
  [
    'webp:320:products/SKU/img-1-320.webp',
    'webp:480:products/SKU/img-1-480.webp',
    'webp:800:products/SKU/img-1-800.webp',
    'avif:320:products/SKU/img-1-320.avif',
    'avif:480:products/SKU/img-1-480.avif',
    'avif:800:products/SKU/img-1-800.avif',
  ],
);
assert.equal(jobs[0].inputPath, '/var/www/mdv-api/uploads/products/SKU/img-1.png');
assert.equal(jobs[0].outputPath, '/var/www/mdv-api/uploads/products/SKU/img-1-320.webp');
assert.equal(jobs.every((job) => job.dryRun === true), true);

const parsed = parseConversionArgs([
  '--root',
  '/uploads',
  '--limit',
  '50',
  '--apply',
  '--skip-existing',
]);

assert.deepEqual(parsed, {
  uploadsRoot: '/uploads',
  limit: 50,
  dryRun: false,
  skipExisting: true,
});
