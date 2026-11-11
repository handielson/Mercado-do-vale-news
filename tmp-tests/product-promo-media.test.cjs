// promo-media-v1: imagem, vídeo e banner da promoção por versão (Página do Produto).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const media = require('../services/productPromoMediaServer.cjs');

function fakePool(existingIds) {
  const table = new Map();
  const log = [];
  const run = async (sql, params = []) => {
    log.push(sql.replace(/\s+/g, ' ').trim());
    if (/^CREATE TABLE IF NOT EXISTS product_promo_media/.test(sql.trim())) return [[]];
    if (/SELECT id FROM products/.test(sql)) return [params.filter((id) => existingIds.includes(id)).map((id) => ({ id }))];
    if (/SELECT product_id,image_url/.test(sql)) return [params.filter((id) => table.has(id)).map((id) => ({ product_id: id, ...table.get(id) }))];
    if (/^INSERT INTO product_promo_media/.test(sql.trim())) { const [id, image_url, video_url, banner_id] = params; table.set(id, { image_url, video_url, banner_id }); return [{}]; }
    if (/^DELETE FROM product_promo_media/.test(sql.trim())) { table.delete(params[0]); return [{}]; }
    if (/BEGIN|COMMIT|ROLLBACK/i.test(sql)) return [[]];
    throw new Error(`SQL inesperado: ${sql}`);
  };
  const connection = { query: run, beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {} };
  return { query: run, getConnection: async () => connection, table, log };
}

test('valida URLs HTTPS, ids e banner', () => {
  assert.deepEqual(media.normalizePromoMediaInput({ product_ids: ['a', 'a', 'b'], image_url: 'https://x/i.png', video_url: '', banner_id: null }),
    { product_ids: ['a', 'b'], image_url: 'https://x/i.png', video_url: null, banner_id: null });
  assert.throws(() => media.normalizePromoMediaInput({ product_ids: ['a'], image_url: 'http://x/i.png' }), /HTTPS/);
  assert.throws(() => media.normalizePromoMediaInput({ product_ids: [] }), /produtos da versão/);
  assert.throws(() => media.normalizePromoMediaInput({ product_ids: ['a;drop'] }), /Produto inválido/);
  assert.throws(() => media.normalizePromoMediaInput({ product_ids: ['a'], banner_id: 'x y' }), /Banner inválido/);
});

test('grava a mesma mídia em todas as cores e lê de volta; vazio apaga', async () => {
  const pool = fakePool(['p1', 'p2']);
  const saved = await media.savePromoMedia(pool, { product_ids: ['p1', 'p2'], image_url: 'https://cdn/i.png', video_url: 'https://cdn/v.mp4', banner_id: 'b1' });
  assert.deepEqual([...saved.keys()].sort(), ['p1', 'p2']);
  assert.equal(saved.get('p2').video_url, 'https://cdn/v.mp4');
  assert.equal(saved.get('p1').banner_id, 'b1');
  await media.savePromoMedia(pool, { product_ids: ['p1', 'p2'] });
  assert.equal(pool.table.size, 0, 'sem mídia nenhuma, a linha sai da tabela');
});

test('produto inexistente não grava nada (409)', async () => {
  const pool = fakePool(['p1']);
  await assert.rejects(media.savePromoMedia(pool, { product_ids: ['p1', 'p9'], image_url: 'https://cdn/i.png' }), (error) => error.statusCode === 409);
  assert.equal(pool.table.size, 0);
});

test('tabela própria: não altera products nem o PUT de produto', () => {
  const source = fs.readFileSync('services/productPromoMediaServer.cjs', 'utf8');
  assert.match(source, /CREATE TABLE IF NOT EXISTS product_promo_media/);
  assert.doesNotMatch(source, /ALTER TABLE|UPDATE products/);
});

test('campanha do Marketing recebe a imagem/vídeo da promoção de cada produto', () => {
  const campaign = fs.readFileSync('services/promoCampaignServer.cjs', 'utf8');
  assert.match(campaign, /loadPromoMediaByProductIds\(pool, selected\.map/);
  assert.match(campaign, /promoImageUrl:.*promoVideoUrl:/s);
  assert.match(campaign, /registerProductPromoMediaRoutes\(fastify, \{ pool: dependencies\.pool, guard \}\)/, 'rotas atrás do mesmo guard admin/sync');
  const deploy = fs.readFileSync('deploy-vps-server-only.cjs', 'utf8');
  assert.match(deploy, /'services\/productPromoMediaServer\.cjs'/, 'deploy da API envia o módulo novo');
});

test('banner da home é um banner normal, vinculado à versão e às datas da promoção', () => {
  const service = fs.readFileSync('services/productPromo.ts', 'utf8');
  assert.match(service, /bannerService\.createBanner\(/);
  assert.match(service, /link_type: 'product' as const,\s*link_target: input\.productUrl/);
  assert.match(service, /start_date: \(input\.start/);
  assert.match(service, /end_date: \(input\.end/);
  const ui = fs.readFileSync('components/products/ModelVersionFinancials.tsx', 'utf8');
  assert.match(ui, /syncPromoBanner\(media\?\.banner_id \|\| null, value\)/, 'banner acompanha as datas ao editar/remover a promoção');
  assert.match(ui, /savePromoMedia\(row\.productIds, \{ image_url: draft\.image_url, video_url: draft\.video_url, banner_id: bannerId \}\)/);
});

test('cada mídia mostra o tamanho recomendado', () => {
  // promo-media-prompt-v1: os tamanhos ficam numa fonte só (utils/promoMediaPrompt.js), usada pelos campos e pelo prompt da IA.
  const ui = fs.readFileSync('components/products/ModelVersionFinancials.tsx', 'utf8');
  const specs = fs.readFileSync('utils/promoMediaPrompt.js', 'utf8');
  assert.match(ui, /size: promoMediaSizeLabel\('image'\)/);
  assert.match(ui, /size: promoMediaSizeLabel\('video'\)/);
  assert.match(ui, /size: promoMediaSizeLabel\('banner'\)/);
  assert.match(specs, /image: \{ width: 1080, height: 1350, ratio: '4:5'/);
  assert.match(specs, /video: \{ width: 1080, height: 1920, ratio: '9:16, Stories'/);
  assert.match(specs, /banner: \{ width: 1920, height: 823, ratio: '21:9'/, 'banner no formato do carrossel da home (21:9)');
  assert.match(fs.readFileSync('components/catalog/BannerCarousel.tsx', 'utf8'), /aspect-\[21\/9\]/);
  assert.match(ui, /📐 \{slot\.size\}/);
});

test('banner da promoção gera as versões do carrossel e o carrossel não quebra sem elas', () => {
  // promo-banner-derivatives-v1 / banner-picture-fallback-v1
  const promo = fs.readFileSync('services/productPromo.ts', 'utf8');
  assert.match(promo, /uploadPromoBannerFile = \(file: File\) => uploadService\.uploadBannerImage\(file\)/);
  const ui = fs.readFileSync('components/products/ModelVersionFinancials.tsx', 'utf8');
  assert.match(ui, /if \(key === 'banner'\) \{\s*const url = await uploadPromoBannerFile\(file\);/);
  const carousel = fs.readFileSync('components/catalog/BannerCarousel.tsx', 'utf8');
  assert.match(carousel, /plainBannerIds\.has\(banner\.id\) \? null : buildResponsiveImageSources\(banner\.image_url, \{ kind: 'banner' \}\)/);
  assert.match(carousel, /onError=\{\(\) => \{\s*if \(responsiveImageSources\) setPlainBannerIds/);
});
