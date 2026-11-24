// nfc-emoji-v1
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow, MARK, NODE } = require('../scripts/n8n-nfc-emoji.cjs');
const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;
test('NFC com 📲', { skip: !snapshot && 'sem snapshot do n8n' }, () => {
  const w = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  const code = patchWorkflow(w).nodes.find((n) => n.name === NODE).parameters.jsCode;
  assert.ok(code.includes(MARK));
  const fn = new Function(code.match(/const catalogNfcLineV1 = [^\n]*/)[0] + '; return catalogNfcLineV1;')();
  assert.equal(fn({ catalogNfcV1: 'sim' }), '📲 NFC: Sim');
  assert.equal(fn({ catalogNfcV1: 'nao' }), '📲 NFC: Não');
  assert.equal(fn({}), '');
});
