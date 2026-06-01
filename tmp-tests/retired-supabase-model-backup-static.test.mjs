import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const retiredFile = 'services/models-new-backup.ts';
const scanDirs = ['components', 'pages', 'services', 'hooks', 'contexts', 'utils'];
const extensions = new Set(['.ts', '.tsx', '.js', '.mjs']);

function walk(dir, files = []) {
  for (const entry of readdirSync(path.join(root, dir))) {
    const absolutePath = path.join(root, dir, entry);
    const relativePath = path.relative(root, absolutePath).replace(/\\/g, '/');
    const stat = statSync(absolutePath);

    if (stat.isDirectory()) {
      walk(relativePath, files);
      continue;
    }

    if (stat.isFile() && extensions.has(path.extname(entry))) {
      files.push(relativePath);
    }
  }
  return files;
}

assert.equal(
  existsSync(path.join(root, retiredFile)),
  false,
  'unused Supabase model backup service should be removed from runtime scan paths',
);

const staleReferences = scanDirs.flatMap((dir) => walk(dir)).filter((file) => {
  const source = readFileSync(path.join(root, file), 'utf8');
  return source.includes('models-new-backup');
});

assert.deepEqual(
  staleReferences,
  [],
  'runtime code must not reference the retired Supabase model backup service',
);

console.log('retired Supabase model backup static checks passed');
