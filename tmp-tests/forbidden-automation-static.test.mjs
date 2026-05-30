import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FORBIDDEN = ['n', '8', 'n'].join('');
const SKIP_DIRS = new Set(['.cursor', '.git', '.vercel', '.worktrees', 'dist', 'node_modules']);
const TEXT_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.sql',
  '.ts',
  '.tsx',
  '.txt',
]);

function walk(dir = '.') {
  const entries = [];
  for (const item of readdirSync(path.join(ROOT, dir))) {
    if (SKIP_DIRS.has(item)) continue;
    const relative = dir === '.' ? item : path.join(dir, item);
    const absolute = path.join(ROOT, relative);
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      entries.push(...walk(relative));
      continue;
    }
    if (stat.isFile() && TEXT_EXTENSIONS.has(path.extname(item))) entries.push(relative);
  }
  return entries;
}

const matches = [];
for (const file of walk()) {
  const source = readFileSync(path.join(ROOT, file), 'utf8');
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (line.toLowerCase().includes(FORBIDDEN)) {
      matches.push(`${file}:${index + 1}`);
    }
  });
}

assert.deepEqual(matches, [], `Forbidden automation references remain:\n${matches.join('\n')}`);

console.log('forbidden automation static checks ok');
