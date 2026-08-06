import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../pages/admin/settings/MarketingPage.tsx', import.meta.url), 'utf8');
const card = await readFile(new URL('../pages/admin/settings/marketing/ProductMarketingCard.tsx', import.meta.url), 'utf8');
const resolver = await readFile(new URL('../pages/admin/settings/marketing/productMarketingArtwork.ts', import.meta.url), 'utf8');

assert.match(page, /<ProductMarketingCard/);
assert.match(page, /useState<MarketingAssetFormat>\('status'\)/);
assert.match(page, /Gerador de Artes/);
assert.match(page, /META SEM PREÇO/);
assert.match(page, /Foto\/variante principal da arte/);
assert.match(page, /marketing_primary_variants/);
assert.match(page, /paymentFeesService\.list\(\)/);

assert.match(card, /CONSULTE CORES DISPONÍVEIS/);
assert.match(card, /Total a prazo:/);
assert.match(card, /Consulte condições e disponibilidade/);
assert.doesNotMatch(card, /CELULARES E ACESSÓRIOS/i);

assert.match(resolver, /calculateInstallmentFromFees\(price, paymentFees, 12\)/);
assert.match(resolver, /cam_principal_mpx/);
assert.match(resolver, /battery_mah/);
assert.match(resolver, /identity\.includes\('poco'\)/);
assert.match(resolver, /identity\.includes\('redmi'\)/);
assert.match(resolver, /normalizeBrazilianWhatsapp/);

console.log('product-marketing-artwork-static.test.mjs: ok');
