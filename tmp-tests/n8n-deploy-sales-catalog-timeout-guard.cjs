'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {Client}=require('ssh2');
const {getVpsSshConfig}=require('./vps-ssh-config.cjs');
const {patchWorkflow,validate,MARKER}=require('./n8n-sales-catalog-timeout-guard.cjs');
const {runGate,fingerprint}=require('../scripts/n8n-sales-regression-gate.cjs');
const ID='SkrkB4vyKVDnQ68t';
const quote=x=>`'${String(x).replace(/'/g,"''")}'`;
const dollar=(x,label)=>{const marker=`$${label}$`;assert.ok(!String(x).includes(marker));return `${marker}${x}${marker}`};
const arg=name=>{const i=process.argv.indexOf(name);return i<0?'':process.argv[i+1]};
const baselinePath=arg('--baseline'),candidatePath=arg('--candidate');
const apply=process.argv.includes('--apply');
if(!baselinePath||!candidatePath)throw Error('Use --baseline arquivo --candidate arquivo [--apply]');
const before=JSON.parse(fs.readFileSync(baselinePath,'utf8'));
const candidate=JSON.parse(fs.readFileSync(candidatePath,'utf8'));
validate(candidate);
const expected=structuredClone(before);patchWorkflow(expected);
const beforeNames=new Set(before.nodes.map(n=>n.name));
assert.deepEqual(candidate.nodes.filter(n=>beforeNames.has(n.name)),before.nodes,'Existing nodes changed');
assert.deepEqual(candidate.connections['Vendas - Contexto Produtos'],expected.connections['Vendas - Contexto Produtos']);
for(const [name,connections] of Object.entries(before.connections))if(name!=='Vendas - Contexto Produtos')assert.deepEqual(candidate.connections[name],connections,`${name} graph changed`);
assert.equal(candidate.nodes.length,before.nodes.length+2);
assert.equal(candidate.activeVersionId,before.activeVersionId);

async function main(){
  const gate=runGate(path.resolve(candidatePath));
  const digest=fingerprint(candidate);assert.equal(gate.sha256,digest);
  const c=new Client();await new Promise((res,rej)=>c.once('ready',res).once('error',rej).connect(getVpsSshConfig()));
  let stopped=false,db='',current;
  const remote=(cmd,input)=>new Promise((res,rej)=>c.exec(cmd,(e,s)=>{if(e)return rej(e);let out='',err='';s.on('data',b=>out+=b);s.stderr.on('data',b=>err+=b);s.on('close',code=>code?rej(Error(`Remote ${code}: ${err.slice(0,300)}`)):res(out));s.end(input)}));
  const psql=sql=>remote(`docker exec -i ${db} psql -U postgres -d n8n -X -q -t -A -v ON_ERROR_STOP=1`,sql);
  const wait=async(name,n)=>{for(let i=0;i<48;i++){const v=(await remote(`docker service ls --filter name=${quote(name)} --format '{{.Replicas}}' | head -n 1`)).trim();if(v===`${n}/${n}`)return;await new Promise(r=>setTimeout(r,2500))}throw Error(`${name} replicas not ${n}/${n}`)};
  const read=async()=>{const hex=(await psql(`COPY (SELECT encode(convert_to(json_build_object('id',we.id,'versionId',we."versionId",'activeVersionId',we."activeVersionId",'active',we.active,'nodes',we.nodes,'connections',we.connections,'historyAligned',we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb)::text,'UTF8'),'hex') FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${quote(ID)}) TO STDOUT;`)).trim();return JSON.parse(Buffer.from(hex,'hex').toString('utf8'))};
  try{
    db=(await remote("docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();assert.match(db,/^n8n_n8n-db[.\w-]*$/);
    current=await read();
    assert.equal(current.active,true);assert.equal(current.historyAligned,true);assert.equal(current.versionId,current.activeVersionId);
    assert.equal(current.activeVersionId,before.activeVersionId);
    assert.equal(fingerprint(current),fingerprint(before),'Workflow changed since candidate was tested');
    if(!apply){console.log(JSON.stringify({dryRun:true,workflowId:ID,candidateSha256:digest,tests:gate.testFiles,changedNodes:['Vendas - Catalogo pronto?','Vendas - Catalogo sem IA'],activeVersionId:current.activeVersionId}));return}
    const active=Number((await psql(`COPY (SELECT count(*) FROM execution_entity WHERE "workflowId"=${quote(ID)} AND status IN ('new','running')) TO STDOUT;`)).trim());
    assert.equal(active,0,'Active customer executions; retry later');
    const backup=`.local/n8n-${ID}-before-${MARKER}-${Date.now()}.json`;
    fs.writeFileSync(backup,JSON.stringify(current),{flag:'wx',mode:0o600});
    await remote('docker service scale n8n_n8n-runner=0 >/dev/null');stopped=true;await wait('n8n_n8n-runner',0);
    await remote('docker service scale n8n_n8n=0 >/dev/null');await wait('n8n_n8n',0);
    const stoppedState=await read();assert.equal(fingerprint(stoppedState),fingerprint(before),'Workflow changed before write');
    const nodes=dollar(JSON.stringify(candidate.nodes),'catalogguardnodes'),graph=dollar(JSON.stringify(candidate.connections),'catalogguardgraph');
    await psql(`BEGIN; UPDATE workflow_entity SET nodes=${nodes}::json,connections=${graph}::json,"versionId"="activeVersionId","updatedAt"=NOW() WHERE id=${quote(ID)} AND "activeVersionId"=${quote(current.activeVersionId)}; UPDATE workflow_history SET nodes=${nodes}::json,connections=${graph}::json,"updatedAt"=NOW() WHERE "workflowId"=${quote(ID)} AND "versionId"=${quote(current.activeVersionId)}; COMMIT;`);
    const verified=await read();assert.equal(verified.historyAligned,true);assert.equal(fingerprint(verified),digest);validate(verified);
    await remote('docker service scale n8n_n8n=1 >/dev/null');await wait('n8n_n8n',1);
    await remote('docker service scale n8n_n8n-runner=1 >/dev/null');await wait('n8n_n8n-runner',1);stopped=false;
    const health=await fetch('https://n8n.mercadodovale.com.br/healthz',{signal:AbortSignal.timeout(15000)});
    assert.equal(health.status,200);
    const readback=await read();assert.equal(readback.historyAligned,true);assert.equal(fingerprint(readback),digest);
    console.log(JSON.stringify({published:true,workflowId:ID,sha256:digest,activeVersionId:readback.activeVersionId,historyAligned:true,nodes:readback.nodes.length,backup,health:health.status,tests:gate.testFiles}));
  }finally{if(stopped){await remote('docker service scale n8n_n8n=1 >/dev/null').catch(()=>{});await wait('n8n_n8n',1).catch(()=>{});await remote('docker service scale n8n_n8n-runner=1 >/dev/null').catch(()=>{});await wait('n8n_n8n-runner',1).catch(()=>{})}c.end()}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
