'use strict';
const assert=require('node:assert/strict');
const policy=require('./n8n-attendance-policy-fixes.cjs');
const sales=require('./n8n-attendance-sales-fixes.cjs');
const recovery=require('./n8n-attendance-recovery-fixes.cjs');
const SCOPED_NODES=[...new Set([...policy.SCOPED_NODES,...sales.SCOPED_NODES,...recovery.SCOPED_NODES])];
function patchWorkflow(input){
 const result=[policy,sales,recovery].reduce((w,transform)=>transform.patchWorkflow(w),input);
 for(const before of input.nodes){const after=result.nodes.find(n=>n.name===before.name);assert.ok(after,before.name);
  assert.deepEqual(after.credentials,before.credentials,'Credential drift: '+before.name);
  if(!SCOPED_NODES.includes(before.name))assert.deepEqual(after,before,'Unscoped attendance change: '+before.name);
 }
 for(const name of new Set([...Object.keys(input.connections),...Object.keys(result.connections)])){
  if(!['Parse Classificacao','Classificacao - Falhou?'].includes(name))assert.deepEqual(result.connections[name],input.connections[name],'Unscoped graph change: '+name);
 }
 const names=new Set(result.nodes.map(n=>n.name));assert.equal(names.size,result.nodes.length);
 for(const [name,outputs]of Object.entries(result.connections)){assert.ok(names.has(name));for(const groups of Object.values(outputs))for(const group of groups)for(const edge of group)assert.ok(names.has(edge.node),edge.node);}
 for(const n of result.nodes)if(n.parameters?.jsCode)new Function('$json','$input','$','$getWorkflowStaticData','$execution','$runIndex',n.parameters.jsCode);
 return result;
}
module.exports={SCOPED_NODES,patchWorkflow};
