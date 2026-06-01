import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const retiredServices = [
  'services/batteryHealths-supabase.ts',
  'services/rams-supabase.ts',
  'services/storages-supabase.ts',
];
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

for (const retiredService of retiredServices) {
  assert.equal(
    existsSync(path.join(root, retiredService)),
    false,
    `${retiredService} should be removed after taxonomy data moved to VPS services`,
  );
}

const runtimeFiles = scanDirs.flatMap((dir) => walk(dir));
const staleReferences = runtimeFiles.filter((file) => {
  const source = readFileSync(path.join(root, file), 'utf8');
  return retiredServices.some((service) =>
    source.includes(path.basename(service, '.ts')),
  );
});

assert.deepEqual(
  staleReferences,
  [],
  'runtime code must not reference retired Supabase taxonomy services',
);

console.log('retired Supabase taxonomy services static checks passed');
