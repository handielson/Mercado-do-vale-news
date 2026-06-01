import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const scanDirs = ['components', 'pages', 'services'];
const extensions = new Set(['.ts', '.tsx', '.js', '.mjs']);

function walk(dir, files = []) {
  const absoluteDir = path.join(root, dir);
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

const files = scanDirs.flatMap((dir) => walk(dir));
const staleImports = files.filter((file) =>
  readFileSync(path.join(root, file), 'utf8').includes('versions-supabase'),
);

assert.deepEqual(
  staleImports,
  [],
  'runtime code must import the VPS version service directly, not the retired Supabase alias',
);

assert.equal(
  existsSync(path.join(root, 'services/versions-supabase.ts')),
  false,
  'retired versions-supabase re-export should be removed after callers use versions-vps',
);

console.log('version service VPS imports static checks passed');
