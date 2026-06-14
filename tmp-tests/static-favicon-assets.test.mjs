import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const expectedLinks = [
  '<link rel="icon" href="/mdv-favicon.ico" sizes="any" />',
  '<link rel="icon" type="image/png" href="/mdv-favicon-48x48.png" sizes="48x48" />',
  '<link rel="apple-touch-icon" href="/mdv-apple-touch-icon.png" sizes="180x180" />',
];

for (const link of expectedLinks) {
  assert.ok(indexHtml.includes(link), `index.html must include ${link}`);
}

for (const file of ['mdv-favicon.ico', 'mdv-favicon-48x48.png', 'mdv-apple-touch-icon.png']) {
  const filePath = path.join(ROOT, 'public', file);
  assert.ok(fs.existsSync(filePath), `public/${file} must exist`);
  assert.ok(fs.statSync(filePath).size > 0, `public/${file} must not be empty`);
}
