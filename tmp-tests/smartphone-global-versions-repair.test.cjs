const { test } = require('node:test');
const assert = require('node:assert/strict');
const { planVersions } = require('../scripts/repair-smartphone-global-versions.cjs');
test('fills only missing smartphone versions, preserves all other specs and does not touch prices', () => {
  const base = { id:'phone', category_name:'Smartphones', specs:{ram:'8GB',storage:'256GB',color:'Preto'}, price_retail:143000, price_cost:95000 };
  const before = structuredClone(base);
  const plan = planVersions([base], []);
  assert.deepEqual(plan, [{id:'phone',specs:{...base.specs,version:'Global'}}]);
  assert.deepEqual(base, before);
  for (const extra of [{specs:{version:'India'}},{specs:{version:'Global'}},{is_parent:1},{is_print3d:1},{is_combo:1},{offer_type:'combo'},{category_name:'Acessórios'}]) assert.deepEqual(planVersions([{...base,...extra}],[]),[]);
  assert.equal(planVersions([{...base,specs:{versao:'known'}}],[{id:'known',name:'Global'}]).length,1);
  assert.deepEqual(planVersions([{...base,specs:{versao:'unknown'}}],[]),[]);
  assert.throws(()=>planVersions([{...base,specs:'broken json'}],[]));
});
