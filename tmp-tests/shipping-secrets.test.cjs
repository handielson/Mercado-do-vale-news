// shipping-secrets-v1: tokens de frete fora da leitura pública; cálculo usa o token do banco; etiqueta só admin.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const s = require('../services/shippingSecrets.cjs');
const { patch, MARK } = require('../scripts/deploy-shipping-secrets.cjs');
const pool = { query: async () => [[{ melhor_envio_token: 'ME-SECRETO', melhor_envio_sandbox: 0, frenet_token: 'FR-SECRETO' }]] };

test('leitura pública troca os tokens por marcador e diz se está configurado', () => {
  const out = s.publicShippingSettings({ origin_cep: '56310150', melhor_envio_token: 'ME-SECRETO', frenet_token: '' });
  assert.equal(out.melhor_envio_token, s.TOKEN_PLACEHOLDER);
  assert.equal(out.frenet_token, '');
  assert.equal(out.melhor_envio_configured, true);
  assert.equal(out.frenet_configured, false);
  assert.ok(!JSON.stringify(out).includes('SECRETO'));
});

test('cálculo usa o token do banco, mesmo se o navegador mandar outro ou o marcador', async () => {
  assert.equal((await s.withStoredShippingToken(pool, { provider: 'melhor-envio' }, { token: s.TOKEN_PLACEHOLDER, to_cep: '1' })).token, 'ME-SECRETO');
  assert.equal((await s.withStoredShippingToken(pool, { provider: 'frenet' }, { token: 'outro' })).token, 'FR-SECRETO');
  const vazio = { query: async () => [[{}]] };
  assert.equal((await s.withStoredShippingToken(vazio, { provider: 'frenet' }, { token: s.TOKEN_PLACEHOLDER })).token, undefined);
});

test('servidor: GET sem tokens, PATCH ignora vazio/marcador, /api/shipping com token do banco e etiqueta só admin', () => {
  for (const f of ['vps_server.js', 'vps_server.cjs']) {
    const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    assert.ok(src.includes(MARK), f);
    assert.equal(patch(src), src, `${f} idempotente`);
    assert.ok(src.includes("publicShippingSettings(row)"));
    assert.ok(src.includes("melhor_envio_token=COALESCE(NULLIF(NULLIF(?,''),'configurado-no-servidor'),melhor_envio_token)"));
    assert.ok(src.includes("frenet_token=COALESCE(NULLIF(NULLIF(?,''),'configurado-no-servidor'),frenet_token)"));
    assert.match(src, /action \|\| ''\) === 'label' && !\(await isAdminBearerToken\(request\)\)/);
    assert.ok(src.includes('handleShippingApiVps(request.query, shippingBodyV1)'));
  }
});

test('product-shipping-fields-v1: /products devolve weight_kg e dimensions (compacto e completo)', () => {
  const { FIELDS_MARK } = require('../scripts/deploy-shipping-secrets.cjs');
  for (const f of ['vps_server.js', 'vps_server.cjs']) {
    const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    assert.equal(src.split(FIELDS_MARK).length - 1, 2, f);
    assert.equal(patch(src), src);
  }
});
