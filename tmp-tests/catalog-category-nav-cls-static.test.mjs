import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const catalogPage = readFileSync(resolve(root, 'pages/catalog/index.tsx'), 'utf8');
const app = readFileSync(resolve(root, 'App.tsx'), 'utf8');

assert.match(
  catalogPage,
  /className="hidden sm:block min-h-\[190px\]"/,
  'desktop category navigation wrapper must reserve its final height to prevent CLS when categories load',
);

assert.match(
  app,
  /h-9 shrink-0 rounded-full bg-slate-100 animate-pulse/,
  'catalog route fallback must reserve category chip space during initial route loading',
);

console.log('catalog category nav CLS guard passed');
