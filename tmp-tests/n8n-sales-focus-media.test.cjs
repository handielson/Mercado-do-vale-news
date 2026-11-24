// sales-focus-product-v2: indicação no formato do dono + fotos das cores em estoque e vídeo.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow, MARK, CONTEXTO, DIVIDIR, MEDIA_NODE } = require('../scripts/n8n-sales-focus-media.cjs');
const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;
const skip = !snapshot && 'sem snapshot do n8n';
const jid = 'fixture@s.whatsapp.net';
const IMG = 'https://api.xiaomipetrolina.com.br/images/';
const product = (id, model, ram, storage, color, price, extra = {}) => ({ id, model_id: model, model_name: model, name: model + ' ' + color, brand: 'Xiaomi', status: 'active',
  stock_quantity: 1, price_retail: price, specs: { ram, storage, color, display: 6.9, battery_mah: 7000, cam_principal_mpx: '50MP', tipo_de_display: 'LCD', carregamento: '33W', nfc: true }, slug: id, images: [IMG + id + '.jpg'], ...extra });
const ctx = { channel: 'presencial', installments: 12, applied_fee_pct: 11.9 };
function runContexto(code, rows, baseExtra = {}) {
  const base = { conversation: 'Quais celulares disponíveis?', productCategoryId: 'smartphones', productSearchKind: 'categoria', remoteJid: jid, ...baseExtra };
  const sources = { 'Vendas - Preparar Busca': [base], 'Vendas - Buscar Produtos': rows, 'switc Mensagens': [base] };
  const lookup = (name) => ({ first: () => ({ json: sources[name][0] }), all: () => sources[name].map((json) => ({ json })) });
  return new Function('$json', '$input', '$getWorkflowStaticData', '$', code)({}, { all: () => [{ json: ctx }] }, () => ({}), lookup)[0].json;
}
function runDividir(code, json) {
  const lookup = () => ({ first: () => ({ json: { remoteJid: jid, Instancia: 'x' } }), all: () => [] });
  return new Function('$json', '$input', '$getWorkflowStaticData', '$', code)({ remoteJid: jid, Instancia: 'x', ...json }, { all: () => [{ json }] }, () => ({}), lookup).map((i) => i.json);
}
const codeOf = (w, name) => w.nodes.find((n) => n.name === name).parameters.jsCode;
const rowsFocus = () => [product('a128', 'Redmi 15', '6GB', '128GB', 'Preto', 99900),
  product('a256p', 'Redmi 15', '8GB', '256GB', 'Preto', 134900, { bot_focus: true, video_url: 'https://api.xiaomipetrolina.com.br/videos/redmi15.mp4' }),
  product('a256v', 'Redmi 15', '8GB', '256GB', 'Verde', 134900),
  product('a256c', 'Redmi 15', '8GB', '256GB', 'Cinza', 134900, { stock_quantity: 0 }),
  product('p1', 'Poco C71', '4GB', '128GB', 'Azul', 90100)];

test('indicação no formato novo, com características e sem pergunta', { skip }, () => {
  const w = patchWorkflow(JSON.parse(fs.readFileSync(snapshot, 'utf8')));
  const out = runContexto(codeOf(w, CONTEXTO), rowsFocus());
  const last = String(out.deterministicCatalogOutput).split('[[MSG]]').pop().split('[[BR]]');
  console.log(last.join('\n'));
  assert.equal(last[0], '⭐ *Nossa indicação:*');
  assert.equal(last[1], '');
  assert.match(last[2], /^\d+\. Redmi 15[^\n]*8GB\/256GB$/);
  assert.match(last[3], /R\$\s?1\.349,00 à vista no PIX/);
  assert.match(last[4], /^💳 Cartão: 12x de /);
  assert.ok(last.some((l) => /^🎨 Cores: /.test(l)));
  assert.match(last.at(-1), /^✨ Tela LCD de 6,9”, bateria de 7.000 mAh/);
  assert.ok(!last.some((l) => /\?/.test(l)), 'sem pergunta');
  assert.ok(!/Cinza/.test(last.find((l) => l.startsWith('🎨')) || ''), 'cor sem estoque fora');
  const media = out.salesFocusMediaV2;
  assert.deepEqual(media.filter((m) => m.type === 'image').map((m) => m.mediaUrl).sort(), [IMG + 'a256p.jpg', IMG + 'a256v.jpg']);
  assert.equal(media.filter((m) => m.type === 'video').length, 1);
  assert.equal(media.at(-1).type, 'video');
  assert.ok(codeOf(w, CONTEXTO).includes(MARK));
});

test('Dividir manda o texto e depois as fotos e o vídeo (mediaKind)', { skip }, () => {
  const w = patchWorkflow(JSON.parse(fs.readFileSync(snapshot, 'utf8')));
  const ctxOut = runContexto(codeOf(w, CONTEXTO), rowsFocus());
  const output = 'Segue a lista atualizada de celulares disponíveis. 📱[[BR]][[BR]]' + ctxOut.deterministicCatalogOutput;
  const items = runDividir(codeOf(w, DIVIDIR), { output, salesFocusMediaV2: ctxOut.salesFocusMediaV2 });
  const firstMedia = items.findIndex((i) => i.messageType === 'image');
  assert.ok(firstMedia > 0);
  assert.ok(items.slice(0, firstMedia).some((i) => String(i.message).includes('⭐ *Nossa indicação:*')));
  const media = items.slice(firstMedia);
  assert.deepEqual(media.map((i) => i.mediaKind), ['image', 'image', 'video']);
  assert.equal(media[2].mimetype, 'video/mp4');
  const params = w.nodes.find((n) => n.name === MEDIA_NODE).parameters.bodyParameters.parameters;
  assert.match(params.find((p) => p.name === 'mediatype').value, /mediaKind === 'video'/);
});

test('sem foco: texto e itens idênticos aos atuais', { skip }, () => {
  const before = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  const w = patchWorkflow(before);
  const rows = [product('a128', 'Redmi 15', '6GB', '128GB', 'Preto', 99900), product('p1', 'Poco C71', '4GB', '128GB', 'Azul', 90100)];
  const a = runContexto(codeOf(w, CONTEXTO), rows); const b = runContexto(codeOf(before, CONTEXTO), rows);
  assert.equal(a.deterministicCatalogOutput, b.deterministicCatalogOutput);
  assert.deepEqual(a.salesFocusMediaV2, []);
  const strip = (items) => items.map(({ mediaKind, ...rest }) => rest);
  assert.deepEqual(strip(runDividir(codeOf(w, DIVIDIR), { output: 'Oi[[MSG]]Teste' })), strip(runDividir(codeOf(before, DIVIDIR), { output: 'Oi[[MSG]]Teste' })));
});
