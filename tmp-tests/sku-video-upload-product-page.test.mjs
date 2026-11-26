// sku-video-upload-v1: vídeo de cada variação enviado pela Página do Produto, sempre salvo como <SKU>.mp4.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const serviceSource = fs.readFileSync('services/productVideoUpload.ts', 'utf8');
const compiled = ts.transpileModule(serviceSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports, require: () => ({}) });

test('nome do vídeo é sempre o SKU da variação, qualquer que seja o arquivo original', () => {
  assert.equal(exports.productVideoFileName('REAL0001-01'), 'REAL0001-01.mp4');
  assert.equal(exports.productVideoFileName('  REAL0001-01 '), 'REAL0001-01.mp4');
  for (const bad of ['', '../X', 'A B', 'X?y']) assert.throws(() => exports.productVideoFileName(bad), /SKU definitivo/);
});

test('Página do Produto oferece envio de vídeo por SKU usando o envio canônico', () => {
  const page = fs.readFileSync('pages/admin/products/ModelProductAggregatorPage.tsx', 'utf8');
  assert.match(page, /import \{ SkuVideoUpload \} from '..\/..\/..\/components\/products\/SkuVideoUpload'/);
  assert.match(page, /<SkuVideoUpload sku=\{product\.sku\} \/>/);
  const ui = fs.readFileSync('components/products/SkuVideoUpload.tsx', 'utf8');
  assert.match(ui, /uploadProductVideo\(file, code/);
  assert.match(ui, /productVideoFileName\(code\)/);
  // F5 logo após o envio não pode reaproveitar o "não existe" guardado pelo navegador.
  assert.equal((ui.match(/checkVideoBySku\(code, \{ noCache: true \}\)/g) || []).length, 2);
  assert.doesNotMatch(ui, /checkVideoBySku\(code\)/);
  assert.match(ui, /accept="video\/mp4,\.mp4"/);
  assert.match(ui, /foi renomeado para/);
});

// cdn-video-purge-v1: trocar o vídeo precisa limpar a cópia antiga do Cloudflare.
function purgeHelper(fetchImpl, env = {}) {
  const server = fs.readFileSync('vps_server.js', 'utf8');
  const start = server.indexOf("const CLOUDFLARE_PURGE_ZONE_NAME");
  const end = server.indexOf("fastify.post('/synology/upload'");
  assert.ok(start > 0 && end > start, 'helper de purge do Cloudflare sumiu do vps_server.js');
  const ctx = { process: { env }, fetch: fetchImpl, URL, AbortSignal, JSON, String };
  vm.runInNewContext(`${server.slice(start, end)}; this.purge = purgeCloudflareCdnUrls;`, ctx);
  return ctx.purge;
}

test('upload de vídeo limpa o cache do Cloudflare do <SKU>.mp4', async () => {
  const calls = [];
  const purge = purgeHelper(async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({ success: true }) }; }, { CLOUDFLARE_API_TOKEN: 't', CLOUDFLARE_ZONE_ID: 'z1' });
  const result = await purge(['https://videos.mercadodovale.com.br/REAL0001-01.mp4']);
  assert.equal(result.status, 'ok');
  assert.equal(calls[0].url, 'https://api.cloudflare.com/client/v4/zones/z1/purge_cache');
  assert.deepEqual(JSON.parse(calls[0].init.body), { files: ['https://videos.mercadodovale.com.br/REAL0001-01.mp4'] });
  const server = fs.readFileSync('vps_server.js', 'utf8');
  assert.match(server, /folder === 'videos' \? await purgeCloudflareCdnUrls\(\[cdnUrl\]\)/);
  assert.match(server, /cdnPurge: job\.cdnPurge \|\| null/);
});

test('sem token ou fora da zona, a limpeza é pulada sem quebrar o upload', async () => {
  const purge = purgeHelper(async () => { throw new Error('não deveria chamar'); });
  assert.equal((await purge(['https://videos.mercadodovale.com.br/X.mp4'])).status, 'skipped');
  assert.equal((await purge(['https://imagens.xiaomipetrolina.com.br/X.jpg'])).status, 'skipped');
  const failing = purgeHelper(async () => { throw new Error('timeout'); }, { CLOUDFLARE_API_TOKEN: 't', CLOUDFLARE_ZONE_ID: 'z' });
  assert.equal((await failing(['https://videos.mercadodovale.com.br/X.mp4'])).status, 'error');
});

// product-video-url-link-v1: o robô só manda vídeo quando o produto tem video_url.
function linkHelper(pool) {
  const server = fs.readFileSync('vps_server.js', 'utf8');
  const start = server.indexOf('async function linkUploadedVideoToProductSku');
  const end = server.indexOf('// cdn-video-purge-v1: o Cloudflare guarda');
  assert.ok(start > 0 && end > start, 'ligação do vídeo ao produto sumiu do vps_server.js');
  const ctx = { pool, path: { parse: (f) => ({ name: String(f).replace(/\.[^.]+$/, '') }) }, String, Number };
  vm.runInNewContext(`${server.slice(start, end)}; this.link = linkUploadedVideoToProductSku;`, ctx);
  return ctx.link;
}

test('vídeo enviado preenche o video_url do produto do SKU sem apagar vídeo externo', async () => {
  const queries = [];
  const link = linkHelper({ query: async (sql, params) => { queries.push({ sql, params }); return [{ affectedRows: 1 }]; } });
  const url = 'https://videos.mercadodovale.com.br/REAL0001-01.mp4';
  assert.deepEqual({ ...(await link('REAL0001-01.mp4', url)) }, { status: 'ok', updated: 1 });
  assert.match(queries[0].sql, /UPDATE products SET video_url = \?/);
  assert.match(queries[0].sql, /video_url IS NULL OR TRIM\(video_url\) = '' OR video_url LIKE 'https:\/\/videos\.mercadodovale\.com\.br\/%'/);
  assert.deepEqual([...queries[0].params], [url, 'REAL0001-01', url]);
  assert.equal((await link('X.mp4', 'https://outro.host/X.mp4')).status, 'skipped');
  const failing = linkHelper({ query: async () => { throw new Error('db off'); } });
  assert.equal((await failing('A.mp4', 'https://videos.mercadodovale.com.br/A.mp4')).status, 'error');
  const server = fs.readFileSync('vps_server.js', 'utf8');
  assert.match(server, /folder === 'videos' \? await linkUploadedVideoToProductSku\(fileName, cdnUrl\)/);
});

// video-sku-case-v1: SKU com minúsculas (Mo-689-Z) tem o arquivo Mo-689-Z.mp4; procurar só em MAIÚSCULAS dava "sem vídeo".
test('checagem de vídeo acha o arquivo com o SKU exato antes de cair para MAIÚSCULAS', async () => {
  const server = fs.readFileSync('vps_server.js', 'utf8');
  const start = server.indexOf('async function findExactCaseSkuVideoUrl');
  const end = server.indexOf('// GET /public/check-video?sku=SKU');
  assert.ok(start > 0 && end > start, 'findExactCaseSkuVideoUrl sumiu');
  const heads = [];
  const ctx = { fetch: async (url) => { heads.push(url); return { ok: url.endsWith('/Mo-689-Z.mp4') }; }, AbortSignal, String, encodeURIComponent };
  vm.runInNewContext(`${server.slice(start, end)}; this.find = findExactCaseSkuVideoUrl;`, ctx);
  assert.equal(await ctx.find('Mo-689-Z', '.mp4'), 'https://videos.mercadodovale.com.br/Mo-689-Z.mp4');
  assert.equal(await ctx.find('REAL0001-01', '.mp4'), null, 'SKU já em maiúsculas segue o caminho antigo');
  assert.equal(heads.length, 1);
  assert.equal((server.match(/await findExactCaseSkuVideoUrl\(sku, ext\); \/\/ video-sku-case-v1/g) || []).length, 2, '/check-video e /public/check-video');
});
