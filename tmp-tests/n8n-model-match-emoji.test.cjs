// model-match-emoji-v1: "Redmi pad 2 256 tablet" acha o modelo; "✨" logo depois não derruba a resposta nem gera outra.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow, MARK, NODE_CONTEXT, NODE_APPLY } = require('../scripts/n8n-model-match-emoji.cjs');
const fixture = JSON.parse(fs.readFileSync('tmp-tests/fixtures/tablet-model-request.json', 'utf8'));
const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;

const runContext = (code) => {
  const $ = (name) => ({ first: () => ({ json: name === 'Vendas - Preparar Busca' ? fixture.base : fixture.switc }), all: () => fixture.products.map((json) => ({ json })) });
  return new Function('$', '$input', '$getWorkflowStaticData', code)($, { all: () => fixture.fees.map((json) => ({ json })) }, () => ({}))[0].json;
};
const row = (id, text, at, direction = 'inbound') => ({ direction, message_text: text, wa_message_id: direction === 'inbound' ? id : null, created_at: '2026-11-16T10:' + at + '.000Z' });
const runApply = (code, ownId, rows) => {
  const originals = [{ json: { message: 'resposta', inboundWaMessageId: ownId } }];
  return new Function('$input', '$', code)({ all: () => [{ json: { rows } }] }, () => ({ all: () => originals })).length;
};

test('modelo com "tablet" no pedido e emoji solto em seguida', { skip: !snapshot && 'sem snapshot do n8n' }, () => {
  const workflow = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  const patched = patchWorkflow(workflow);
  assert.deepEqual(patchWorkflow(patched), patched, 'idempotente');
  const code = (wf, name) => wf.nodes.find((node) => node.name === name).parameters.jsCode;

  const fixed = runContext(code(patched, NODE_CONTEXT));
  assert.equal(fixed.salesAvailabilityStatus, 'confirmed_products_available');
  assert.doesNotMatch(fixed.deterministicCatalogOutput, /Nao encontrei esse modelo/);
  assert.match(fixed.deterministicCatalogOutput, /Redmi Pad 2\[\[BR\]\] {3}📱 8GB\/256GB/);
  if (!code(workflow, NODE_CONTEXT).includes(MARK))
    assert.match(runContext(code(workflow, NODE_CONTEXT)).deterministicCatalogOutput, /^Nao encontrei esse modelo/, 'fixture reproduz o bug');

  const apply = code(patched, NODE_APPLY);
  const question = row('Q', 'Vou tem o Redmi pad 2 256 tablet?', '24:17'), sparkle = row('E', '✨', '24:24');
  assert.equal(runApply(apply, 'Q', [question, sparkle]), 1, 'resposta da pergunta sai mesmo com o ✨ depois');
  assert.equal(runApply(apply, 'E', [question, sparkle]), 0, '✨ logo depois não ganha resposta própria');
  assert.equal(runApply(apply, 'E', [row('Q', 'oi', '10:00'), row('E', '👍', '24:24')]), 1, 'emoji isolado (muito depois) ainda é respondido');
  assert.equal(runApply(apply, 'Q', [question, row('N', 'Na verdade quero o Pad 6', '24:30')]), 0, 'texto novo continua substituindo');
  if (!code(workflow, NODE_APPLY).includes(MARK))
    assert.equal(runApply(code(workflow, NODE_APPLY), 'Q', [question, sparkle]), 0, 'fluxo antigo derrubava a resposta');
});
