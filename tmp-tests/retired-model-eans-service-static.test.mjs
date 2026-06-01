import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const retiredService = 'services/model-eans.ts';
const activeRoots = ['services', 'pages', 'components', 'hooks', 'contexts', 'utils', 'types'];
const ignoredFiles = new Set([
  retiredService,
  'types/model-architecture.ts',
]);

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

assert.equal(
  existsSync(retiredService),
  false,
  'model-eans Supabase service must be retired after models-new was removed',
);

for (const file of activeRoots.flatMap((root) => walk(root)).filter((file) => !ignoredFiles.has(file))) {
  const source = readFileSync(file, 'utf8');
  assert.doesNotMatch(
    source,
    /model-eans|modelEANsService/,
    `${file} must not depend on the retired model-eans Supabase service`,
  );
}

console.log('retired model-eans Supabase service static checks passed');
