import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const scanDirs = ['components', 'pages', 'services', 'hooks', 'contexts', 'utils', 'routes', 'config'];
const extensions = new Set(['.ts', '.tsx', '.js', '.mjs']);

function walk(dir, files = []) {
  const absoluteDir = path.join(root, dir);
  if (!statSync(absoluteDir, { throwIfNoEntry: false })) return files;

  for (const entry of readdirSync(absoluteDir)) {
    const absolutePath = path.join(absoluteDir, entry);
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

const matches = scanDirs.flatMap((dir) => walk(dir)).filter((file) => {
  const source = readFileSync(path.join(root, file), 'utf8').toLowerCase();
  return source.includes('vercel');
});

assert.deepEqual(
  matches,
  [],
  'runtime code must not contain Vercel literals after VPS cutover',
);

console.log('no Vercel runtime literals static checks passed');
