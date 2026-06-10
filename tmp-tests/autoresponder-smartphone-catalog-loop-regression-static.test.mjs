import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = [
  'vps_server.js',
  'vps_server.cjs',
];

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const normalized = source.replace(/\s+/g, ' ');
  [
    "AUTORESPONDER_COMPLETE_PRODUCT_RESPONSE_LIMIT = 20",
    "findAutoresponderCatalogCategoryForMessage('smartphones', categories)",
    "messageId: String(key.id || data.messageId || data.id || '').trim()",
    'consumeAutoresponderEvolutionWebhookEvent',
    'releaseAutoresponderEvolutionWebhookEvent',
    "duplicate: true",
    'normalizedMessage = normalizeAutoresponderText(message).trim()',
    'lista|catalogo|opcoes|modelos',
    'findAutoresponderAvailableCategories(100)',
    'genericPhoneSearchTokens',
    'productSearchTokens.every((token) => genericPhoneSearchTokens.has(token))',
  ].forEach((needle) => {
    assert.ok(normalized.includes(needle.replace(/\s+/g, ' ')), `${file} must include ${needle}`);
  });
}

console.log('autoresponder smartphone catalog loop regression static checks passed');
