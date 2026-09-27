const test=require('node:test'),assert=require('node:assert/strict');
const {auditPrint3dSku}=require('../scripts/audit-print3d-sku.cjs');
test('SKU audit does not treat prefix, composite or nonunique indexes as global uniqueness',async()=>{
 const base={INDEX_NAME:'sku_idx',COLUMN_NAME:'sku',NON_UNIQUE:0,SEQ_IN_INDEX:1,SUB_PART:null};
 for(const [indexes,expected] of [[[base],true],[[{...base,SUB_PART:12}],false],[[{...base,NON_UNIQUE:1}],false],[[base,{...base,COLUMN_NAME:'company_id',SEQ_IN_INDEX:2}],false]]){
  const replies=[[{COLUMN_NAME:'sku'},{COLUMN_NAME:'is_print3d'}],indexes,[{total:0}],[{total:0}]];
  const report=await auditPrint3dSku({query:async sql=>{assert.match(sql,/^SELECT/);return [replies.shift()];}});
  assert.equal(report.ready,expected);assert.equal(report.global_unique_sku,expected);
 }
});
test('missing 3D schema stops the audit before querying products',async()=>{
 let calls=0;const report=await auditPrint3dSku({query:async()=>{calls++;return [[{COLUMN_NAME:'sku'}]];}});
 assert.equal(calls,1);assert.equal(report.ready,false);assert.deepEqual(report.reasons,['missing_product_columns']);
});
