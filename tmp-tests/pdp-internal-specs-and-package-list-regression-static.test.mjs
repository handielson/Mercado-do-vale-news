import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/store/PublicProductPage.tsx', 'utf8');

assert.match(
  source,
  /HIDDEN_KEYS\.has\(normalizePdpSpecText\(key\)\)/,
  'PDP must hide internal spec keys even when they arrive with spaces/casing, such as "bling name sync"',
);

assert.match(
  source,
  /HIDDEN_KEYS\.has\(normalizePdpSpecText\(label\)\)/,
  'PDP must hide internal spec labels when a category custom-field label exposes internal metadata',
);

assert.doesNotMatch(
  source,
  /<span className="mt-0\.5 inline-flex h-5 min-w-5[\s\S]*?>\s*1\s*<\/span>/,
  'PDP package/gift list must not render quantity 1 as a separate badge that can break onto its own line',
);

assert.match(
  source,
  /<li key=\{line\} className="[^"]*whitespace-nowrap[^"]*">\s*1 \{line\}\s*<\/li>/,
  'PDP package/gift list rows must render as one single-line row like "1 item"',
);

console.log('PDP internal specs and package list regression static checks passed');