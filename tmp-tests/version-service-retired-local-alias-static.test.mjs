import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const scanDirs = ['components', 'pages', 'services'];
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

const runtimeFiles = scanDirs.flatMap((dir) => walk(dir));
const staleAliasImports = runtimeFiles.filter((file) => {
  if (file === 'services/versions-vps.ts') return false;
  const source = readFileSync(path.join(root, file), 'utf8');
  return /from ['"][^'"]*services\/versions['"]|from ['"][^'"]*\/versions['"]|from ['"]\.\/versions['"]/.test(source);
});

assert.deepEqual(
  staleAliasImports,
  [],
  'runtime code must import versions-vps directly, not the retired local versions alias',
);

assert.equal(
  existsSync(path.join(root, 'services/versions.ts')),
  false,
  'retired local versions re-export should be removed after callers use versions-vps',
);

console.log('version service retired local alias static checks passed');
