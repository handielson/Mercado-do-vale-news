'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const tests=['tmp-tests/n8n-sales-end-to-end.test.cjs','tmp-tests/n8n-sales-variant-contract.test.cjs',
  'tmp-tests/n8n-sales-conversation-contract.test.cjs','tmp-tests/n8n-sales-order-contract.test.cjs',
  'tmp-tests/n8n-conversation-state-api-static.test.mjs','tmp-tests/n8n-admin-handoff-relay-static.test.mjs',
  'tmp-tests/n8n-payjoy-contextual-intent.test.cjs','tmp-tests/n8n-payjoy-knowledge.test.cjs'];
function fingerprint(workflow){return crypto.createHash('sha256').update(JSON.stringify({nodes:workflow.nodes,connections:workflow.connections})).digest('hex');}
function runGate(snapshot,{stdio='inherit'}={}){
  if(!snapshot)throw new Error('Informe --snapshot com o candidato exato. A suite nao altera automaticamente o workflow nem ignora testes.');
  const absolute=path.resolve(root,snapshot);
  const workflow=JSON.parse(fs.readFileSync(absolute,'utf8'));
  if(!Array.isArray(workflow.nodes)||!workflow.connections)throw new Error('Snapshot de workflow invalido');
  const digest=fingerprint(workflow);
  const continuity=workflow.nodes.some(n=>JSON.stringify(n).includes('payjoy-link-continuity-v1'));
  const configuration=workflow.nodes.some(n=>JSON.stringify(n).includes('sales-model-configuration-v1'));
  const candidateTests=[...tests,...(continuity?['tmp-tests/n8n-payjoy-link-continuity.test.cjs']:[]),...(configuration?['tmp-tests/n8n-sales-model-configuration.test.cjs']:[])];
  const result=spawnSync(process.execPath,['--test',...candidateTests],{cwd:root,stdio,
    env:{...process.env,MDV_MODEL_CONFIGURATION_EXACT:'1',MDV_PAYJOY_CONTINUITY_EXACT:'1',MDV_N8N_SALES_SNAPSHOT:absolute,MDV_SALES_VARIANT_SNAPSHOT:absolute,MDV_PAYJOY_WORKFLOW_SNAPSHOT:absolute}});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error('Regressao detectada no candidato '+digest+'; publicacao bloqueada.');
  if(fingerprint(JSON.parse(fs.readFileSync(absolute,'utf8')))!==digest)throw new Error('Candidato mudou durante os testes; execute a suite novamente.');
  return {validated:true,sha256:digest,testFiles:candidateTests.length};
}
module.exports={runGate,fingerprint,tests};
if(require.main===module){try{
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--snapshot')throw new Error('Uso: npm run test:n8n-sales -- --snapshot caminho-do-candidato.json');
  console.log(JSON.stringify(runGate(args[1]),null,2));
}catch(error){console.error(error.message);process.exitCode=1;}}
