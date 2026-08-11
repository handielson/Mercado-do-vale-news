import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { OLD_BLOCK, NEW_BLOCK, patchPostListCode } = require('./n8n-fix-post-list-build-continue-order.cjs');

const broken = `const source = { conversation: 'Quero receber a lista' };
const aiAction = 'nova_busca';
if (aiAction === 'nova_busca') return buildContinueItem();
${OLD_BLOCK}`;

assert.throws(() => new Function(broken)(), /before initialization/);
const patched = patchPostListCode(broken);
assert.ok(patched.includes(NEW_BLOCK));
assert.ok(patched.indexOf('function buildContinueItem()') > patched.indexOf('return buildContinueItem();'), 'a declaração pode permanecer abaixo porque function é içada');
assert.deepEqual(new Function(patched)(), [{ json: { conversation: 'Quero receber a lista', salesPostListHandled: false } }]);
assert.equal(patchPostListCode(patched), patched, 'patch deve ser idempotente');

console.log('n8n post-list buildContinueItem order static test passed');
