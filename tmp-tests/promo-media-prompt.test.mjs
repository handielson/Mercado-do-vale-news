// promo-media-prompt-v1: o prompt da mídia da promoção acompanha a promoção atual e traz os tamanhos certos.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { buildPromoMediaPrompt, promoMemoryLabel, promoMediaSizeLabel, PROMO_MEDIA_SPECS } from '../utils/promoMediaPrompt.js';

const base = {
  modelName: 'Redmi A5',
  versionLabel: '4GB · 128GB · global · 4g lte (compatibilidade com multiplas bandas regionais)',
  colors: ['Dourado', 'Preto', 'Verde'],
  retailCents: 96000,
  // 11/11 08:00 e 12/11 10:00 no horário da loja (UTC−3).
  promo: { priceCents: 89900, discountPct: 6, start: '2026-11-11T11:00:00.000Z', end: '2026-11-12T13:00:00.000Z' },
};

test('prompt traz preço, desconto, validade, cores e os três tamanhos', () => {
  const text = buildPromoMediaPrompt(base);
  assert.match(text, /Redmi A5 4GB\/128GB/);
  assert.match(text, /De R\$ 960,00 por R\$ 899,00 \(6% OFF\)/);
  assert.match(text, /"Por R\$ 899,00"/);
  assert.match(text, /Válida de 11\/11 às 08:00 até 12\/11 às 10:00/);
  assert.match(text, /Dourado, Preto, Verde/);
  assert.match(text, /1080 × 1350 px \(4:5\)/);
  assert.match(text, /1920 × 823 px \(21:9\)/);
  assert.match(text, /VÍDEO NO FORMATO STORIES \(Instagram e WhatsApp\) — 1080 × 1920 px \(9:16, Stories, tela cheia vertical\)/);
  assert.match(text, /FOTO DO PRODUTO/);
  assert.doesNotMatch(text, / /, 'sem espaço invisível no texto copiado');
  assert.doesNotMatch(text, /\n\n\n/);
});

test('prompt é dinâmico: muda junto com a promoção', () => {
  const changed = buildPromoMediaPrompt({ ...base, retailCents: 99900, promo: { priceCents: 84900, discountPct: 15, start: null, end: '2026-11-20T02:59:00.000Z' } });
  assert.match(changed, /De R\$ 999,00 por R\$ 849,00 \(15% OFF\)/);
  assert.match(changed, /Válida até 19\/11 às 23:59/);
  assert.doesNotMatch(changed, /899,00|11\/11/);
  const noDates = buildPromoMediaPrompt({ ...base, promo: { priceCents: 89900, discountPct: 6, start: null, end: null } });
  assert.match(noDates, /Por tempo limitado/);
  assert.equal(buildPromoMediaPrompt({ ...base, promo: null }), '');
});

test('tamanhos vêm de uma fonte só (campos de upload e prompt)', () => {
  assert.equal(promoMediaSizeLabel('image'), '1080 × 1350 px (4:5) · PNG, JPG ou WEBP · até 15 MB');
  assert.equal(promoMediaSizeLabel('video'), '1080 × 1920 px (9:16, Stories) · MP4 (H.264) · até 60 s · até 500 MB');
  assert.equal(promoMediaSizeLabel('banner'), '1920 × 823 px (21:9) · PNG, JPG ou WEBP · até 5 MB');
  assert.equal(PROMO_MEDIA_SPECS.banner.width, 1920);
  assert.equal(promoMemoryLabel('8GB · 256GB · global'), '8GB/256GB');
  const ui = fs.readFileSync(new URL('../components/products/ModelVersionFinancials.tsx', import.meta.url), 'utf8');
  assert.match(ui, /promoMediaSizeLabel\('image'\)/);
  assert.match(ui, /buildPromoMediaPrompt\(/);
  assert.match(ui, /Copiar prompt/);
  assert.doesNotMatch(ui, /size: '1080 × 1350/, 'tamanho não fica duplicado no componente');
});
