'use strict';
// well-formed-history-v1: o corte de 500 caracteres do histórico do bot não pode deixar meio emoji (a OpenAI rejeita o JSON).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  test(`${file}: histórico do bot sem caractere partido`, () => {
    const source = fs.readFileSync(file, 'utf8');
    const helper = source.match(/function wellFormedTextSliceV1[\s\S]*?\n}/)?.[0];
    assert.ok(helper, 'helper presente');
    const slice = new Function(`${helper}; return wellFormedTextSliceV1;`)();
    // Caso real (16/11): lista com "💰" começando no caractere 499.
    const cut = slice('x'.repeat(499) + '💰 R$ 1.160,00 à vista no PIX', 500);
    assert.equal(cut, 'x'.repeat(499));
    assert.doesNotThrow(() => JSON.parse(JSON.stringify({ input: cut })));
    assert.equal(cut.isWellFormed(), true);
    assert.equal(slice('x'.repeat(498) + '💰 R$', 500), 'x'.repeat(498) + '💰', 'emoji inteiro fica');
    assert.equal(slice('\udcb0 ok', 500), ' ok');
    assert.doesNotMatch(source, /message_text \|\| ''\)\.replace\(\/\\s\+\/g, ' '\)\.trim\(\)\.slice\(0, 500\)/, 'corte antigo removido');
  });
}
