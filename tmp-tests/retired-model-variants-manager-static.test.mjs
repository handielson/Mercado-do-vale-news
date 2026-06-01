import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const retiredFiles = [
  'services/model-variants.ts',
  'components/settings/VariantManager.tsx',
  'components/settings/VariantImageGallery.tsx',
  'types/model-architecture.ts',
];

const activeRoots = ['services', 'pages', 'components', 'hooks', 'contexts', 'utils', 'types'];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const absolutePath = path.join(dir, entry);
    const relativePath = absolutePath.replace(/\\/g, '/');
    if (relativePath.includes('/node_modules/') || relativePath.startsWith('dist/')) continue;

    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      walk(absolutePath, files);
      continue;
    }

    if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry)) {
      files.push(relativePath);
    }
  }
  return files;
}

for (const file of retiredFiles) {
  assert.equal(existsSync(file), false, `${file} must be retired with the unused model variants manager`);
}

for (const file of activeRoots.flatMap((root) => walk(root)).filter((file) => !retiredFiles.includes(file))) {
  const source = readFileSync(file, 'utf8');
  assert.doesNotMatch(
    source,
    /model-variants|VariantManager|VariantImageGallery|model-architecture|model_variant_images|model_variants/,
    `${file} must not depend on the retired model variants manager`,
  );
}

console.log('retired model variants manager static checks passed');
