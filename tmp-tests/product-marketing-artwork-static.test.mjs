import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../pages/admin/settings/MarketingPage.tsx', import.meta.url), 'utf8');
const card = await readFile(new URL('../pages/admin/settings/marketing/ProductMarketingCard.tsx', import.meta.url), 'utf8');
const resolver = await readFile(new URL('../pages/admin/settings/marketing/productMarketingArtwork.ts', import.meta.url), 'utf8');
const carousel = await readFile(new URL('../utils/marketing-carousel.ts', import.meta.url), 'utf8');

assert.match(page, /<ProductMarketingCard/);
assert.match(page, /useState<MarketingAssetFormat>\('status'\)/);
assert.match(page, /Gerador de Artes/);
assert.match(page, /META SEM PREÇO/);
assert.match(page, /Foto\/variante principal da arte/);
assert.match(page, /marketing_primary_variants/);
assert.match(page, /paymentFeesService\.list\(\)/);
assert.match(page, /Confira o preço antes de baixar/);
assert.match(page, /pixDiscountPercentage/);
assert.match(page, /modelColorImagesService\.getByModelIds/);
assert.match(page, /row\.model_id === product\.model_id && row\.color_id === colorId/);
assert.match(page, /Cadastre uma foto para este modelo e esta cor na galeria/);
assert.doesNotMatch(page, /getModelImageWithCache/);
assert.match(page, /saveMarketingArtworkForWhatsappStatus/);
assert.match(page, /\/synology\/upload\?folder=imagens/);
assert.match(page, /\/synology\/upload-status\?id=/);
assert.match(page, /marketing_background_url: versionedUrl/);
assert.match(page, /format === 'status' && showArtworkPrice/);
assert.match(page, /salva automaticamente como foto de marketing do Status/);
assert.doesNotMatch(page, /const productBackground = selectedProduct\?\.marketing_background_url/);

assert.match(card, /CONSULTE CORES DISPONÍVEIS/);
assert.match(card, /Total a prazo:/);
assert.match(card, /useProductCutout/);
assert.match(card, /mercado-do-vale-logo\.png/);
assert.match(card, /Consulte condições e disponibilidade/);
assert.doesNotMatch(card, /CELULARES E ACESSÓRIOS/i);

assert.match(resolver, /calculateInstallmentFromFees\(retailPrice, paymentFees, 12\)/);
assert.match(resolver, /calculatePixPrice\(retailPrice, pixDiscountPercentage\)/);
assert.match(resolver, /cam_principal_mpx/);
assert.match(resolver, /battery_mah/);
assert.match(resolver, /identity\.includes\('poco'\)/);
assert.match(resolver, /identity\.includes\('redmi'\)/);
assert.match(resolver, /normalizeBrazilianWhatsapp/);

assert.match(carousel, /imageUrl:\s*usableImages\[0\]\s*\?\?\s*null/);
assert.match(carousel, /slideNumber:\s*1/);
assert.match(carousel, /totalSlides:\s*1/);
assert.doesNotMatch(carousel, /usableImages\.map\(/);

console.log('product-marketing-artwork-static.test.mjs: ok');
