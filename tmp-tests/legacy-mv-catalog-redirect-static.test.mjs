import { readFileSync } from 'node:fs';

const source = readFileSync('index.tsx', 'utf8');

const required = [
  'MV_LEGACY_HOST',
  'CANONICAL_MERCADO_ORIGIN',
  'MV_CATALOG_REDIRECT_URL',
  'https://www.mercadodovale.com.br/?categoria=Smartphones',
  'mv.mercadodovale.com.br',
  "location.hash === '#/catalog'",
  '`${CANONICAL_MERCADO_ORIGIN}${location.pathname}${location.search}${location.hash}`',
  'window.location.replace(redirectUrl)',
  'if (!isRedirectingMvHost)',
];

for (const needle of required) {
  if (!source.includes(needle)) {
    throw new Error(`Missing legacy mv catalog redirect guard: ${needle}`);
  }
}

console.log('legacy mv catalog redirect static guard ok');
