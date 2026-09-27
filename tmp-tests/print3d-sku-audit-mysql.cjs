'use strict';
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {auditPrint3dSku}=require('../scripts/audit-print3d-sku.cjs');
module.exports=async pool=>{
 // This runs only at the end of the disposable MySQL suite, never against app DB.
 let queries=0;
 const readOnly={query:async sql=>{assert.match(sql.trim(),/^SELECT\b/i);queries++;return pool.query(sql);}};
 const initial=await auditPrint3dSku(readOnly);assert.equal(initial.global_unique_sku,true);
 await pool.query('ALTER TABLE products DROP INDEX test_batch_sku');
 const noIndex=await auditPrint3dSku(readOnly);assert.equal(noIndex.ready,false);
 assert(noIndex.reasons.includes('global_unique_sku_not_proven'));
 const sku='audit-'+randomUUID(),first=randomUUID(),second=randomUUID(),empty=randomUUID();
 await pool.query('INSERT INTO products (id,sku,is_print3d) VALUES (?,?,1),(?,?,0),(?,NULL,1)',[first,sku,second,sku,empty]);
 const report=await auditPrint3dSku(readOnly);
 assert.equal(report.ready,false);assert.equal(report.counts.missing_sku,initial.counts.missing_sku+1);
 assert.equal(report.counts.conflicting_sku_groups,initial.counts.conflicting_sku_groups+1);
 assert(report.reasons.includes('print3d_missing_sku'));assert(report.reasons.includes('print3d_sku_conflicts'));
 assert(!JSON.stringify(report).includes(sku),'report must not disclose product identifiers');
 assert(queries>=12);
 console.log('PASS: read-only SKU audit detects absent uniqueness, blank 3D SKU and conflicts with legacy products in disposable MySQL.');
};
