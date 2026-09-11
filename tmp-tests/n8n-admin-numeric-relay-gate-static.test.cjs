const assert = require('node:assert/strict');
const { OLD_RELAY_GATE, NEW_RELAY_GATE, patchCode } = require('./n8n-enable-admin-numeric-relay.cjs');

const source = `const source = {};\n${OLD_RELAY_GATE}\nreturn [];`;
const patched = patchCode(source);
assert.ok(patched.includes(NEW_RELAY_GATE));
const pattern = /^(?:[12][.)]?\s+[a-z0-9]{4,8}(?:\s+[\s\S]+)?|responder\s+[a-z0-9]{4,8}\s+[\s\S]+|liberar\s+[a-z0-9]{4,8}|encerrar\s+[a-z0-9]{4,8})$/i;
for (const valid of ['1 D5AF2A Nlz', '1. A7K2 Tudo certo', '2 A7K2 Encerrado', 'RESPONDER A7K2 Oi', 'LIBERAR A7K2', 'ENCERRAR A7K2']) assert.match(valid, pattern);
for (const invalid of ['1. blz', '1 ABC resposta', 'RESPONDER A7K2']) assert.doesNotMatch(invalid, pattern);
console.log('n8n admin numeric relay gate checks ok');
