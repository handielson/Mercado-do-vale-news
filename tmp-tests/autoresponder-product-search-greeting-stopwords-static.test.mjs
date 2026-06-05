import fs from 'node:fs';
import assert from 'node:assert/strict';

for (const file of ['vps_server.cjs', 'vps_server.js', 'server.js']) {
  const source = fs.readFileSync(file, 'utf8');
  const stopwordsBody = source.match(/const AUTORESPONDER_PRODUCT_SEARCH_STOPWORDS = new Set\(\[[\s\S]*?\]\);/)?.[0] || '';

  for (const word of ['bom', 'boa', 'dia', 'tarde', 'noite', 'oi', 'ola']) {
    assert.match(stopwordsBody, new RegExp(`'${word}'`), `${file} must ignore greeting word "${word}" in product searches`);
  }

  assert.match(
    source,
    /const productSearchTokens = extractAutoresponderProductSearchTokens\(message\);[\s\S]*findAutoresponderProductsByTokens\(productSearchTokens/,
    `${file} must keep product search based on normalized tokens`
  );
}

console.log('autoresponder product search greeting stopwords static checks passed');
