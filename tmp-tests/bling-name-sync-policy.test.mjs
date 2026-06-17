import assert from 'node:assert/strict';

import {
  BLING_NAME_SYNC,
  markBlingNameManaged,
  markLocalNameManaged,
  shouldApplyBlingNameUpdate,
  stripBlingNameFieldsWhenLocalManaged,
} from '../services/blingNameSyncPolicy.js';

const localSpecs = markLocalNameManaged({ tags_venda: ['Xiaomi'] });
assert.equal(localSpecs._bling_name_sync, BLING_NAME_SYNC.LOCAL);
assert.deepEqual(localSpecs.tags_venda, ['Xiaomi']);

const blingSpecs = markBlingNameManaged({ color: 'Preto' });
assert.equal(blingSpecs._bling_name_sync, BLING_NAME_SYNC.BLING);
assert.equal(blingSpecs.color, 'Preto');

assert.equal(
  shouldApplyBlingNameUpdate({ specs: localSpecs }),
  false,
  'local-managed products must reject Bling name updates',
);

assert.equal(
  shouldApplyBlingNameUpdate({ specs: blingSpecs }),
  true,
  'Bling-imported products must keep dynamic Bling names',
);

assert.equal(
  shouldApplyBlingNameUpdate({ specs: {} }),
  true,
  'legacy products without a sync marker keep the current Bling-dynamic behavior',
);

assert.deepEqual(
  stripBlingNameFieldsWhenLocalManaged(
    { specs: localSpecs },
    { name: 'Nome do Bling', slug: 'nome-do-bling', price_retail: 1000 },
  ),
  { price_retail: 1000 },
  'local-managed products must preserve local name and slug while accepting other Bling fields',
);

assert.deepEqual(
  stripBlingNameFieldsWhenLocalManaged(
    { specs: blingSpecs },
    { name: 'Nome do Bling', slug: 'nome-do-bling', price_retail: 1000 },
  ),
  { name: 'Nome do Bling', slug: 'nome-do-bling', price_retail: 1000 },
  'Bling-managed products must accept Bling name fields',
);

console.log('bling-name-sync-policy tests passed');
