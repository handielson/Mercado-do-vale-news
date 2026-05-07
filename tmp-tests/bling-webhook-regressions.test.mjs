import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webhookPath = path.resolve(__dirname, '../api/bling-webhook.ts');
const webhookSource = readFileSync(webhookPath, 'utf8');

assert.match(
  webhookSource,
  /const\s+VPS_SYNC_KEY\s*=\s*process\.env\.VPS_SYNC_KEY\s*\|\|\s*process\.env\.VITE_VPS_SYNC_KEY\s*\|\|\s*'';/,
  'bling webhook must remain compatible with the deployed VITE_VPS_SYNC_KEY env name so VPS stock/name sync does not fail silently',
);

assert.match(
  webhookSource,
  /if\s*\(\s*tokenRes\.status\s*===\s*400\s*\|\|\s*tokenRes\.status\s*===\s*401\s*\)\s*\{[\s\S]*?bling_access_token:\s*null[\s\S]*?\}\)\.eq\('id',\s*settings\.id\);/m,
  'when the Bling refresh token is invalid, the webhook must clear bling_access_token to surface the disconnect in the admin panel',
);

assert.match(
  webhookSource,
  /accessToken\s*=\s*null;/,
  'after a rejected refresh the webhook must stop using the stale Bling access token',
);

assert.match(
  webhookSource,
  /req\.headers\['x-bling-signature-256'\][\s\S]*req\.headers\['x-bling-signature'\]/m,
  'the webhook must accept the current Bling signature header name and keep compatibility with the legacy one',
);

assert.match(
  webhookSource,
  /replace\(\s*\/\^sha256=\/i,\s*''\s*\)/,
  'the webhook must strip the sha256= prefix from Bling signatures before comparing the HMAC',
);

assert.match(
  webhookSource,
  /const\s+preco\s*:\s*number\s*\|\s*undefined\s*=\s*productData\?\.preco;/,
  'product.updated webhooks must read the Bling preco field from payloads',
);

assert.match(
  webhookSource,
  /updates\.price_retail\s*=\s*Math\.round\(Number\(preco\)\s*\*\s*100\);/,
  'product.updated webhooks must convert Bling preco in reais to local price_retail cents',
);

assert.match(
  webhookSource,
  /patchVps\('\/products\/prices-stock',\s*\{\s*sku:\s*resolvedSku,\s*\.\.\.updates\s*\}\)/,
  'product.updated price changes must sync to the VPS commercial fields endpoint',
);

console.log('bling-webhook regression guard ok');
