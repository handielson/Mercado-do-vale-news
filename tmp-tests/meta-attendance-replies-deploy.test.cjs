'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {patchEnvironment}=require('../scripts/deploy-meta-attendance-replies.cjs');
const {validateProof,FILES}=require('../scripts/deploy-meta-attendance-replies.cjs');
test('activation requires recent two-turn continuity and human-pause proof for both channels and exact modules',()=>{
 const now=Date.now(),modules=Object.fromEntries(FILES.map(f=>[f,'synthetic module '+f]));
 const hash=s=>require('node:crypto').createHash('sha256').update(s).digest('hex');
 const proof={ok:true,metaSends:0,at:new Date(now).toISOString(),moduleHashes:Object.fromEntries(FILES.map(f=>[f,hash(modules[f])])),
  turns:['instagram','messenger'].flatMap(channel=>[{channel,turn:1,statePersisted:true},{channel,turn:2,statePersisted:true},{channel,turn:3,humanPauseRespected:true}])};
 assert.equal(validateProof(proof,modules,now),true);
 assert.equal(validateProof({...proof,turns:proof.turns.slice(0,5)},modules,now),false);
 assert.equal(validateProof(proof,{...modules,[FILES[0]]:'modified'},now),false);
 assert.equal(validateProof({...proof,at:new Date(now-3600001).toISOString()},modules,now),false);
 assert.equal(validateProof({...proof,at:new Date(now+1000).toISOString()},modules,now),false);
 assert.equal(validateProof({...proof,metaSends:1},modules,now),false);
});
test('replies environment patch preserves unrelated settings and rejects injected values',()=>{
 const token='b'.repeat(64),input='KEEP=original\nMETA_ATTENDANCE_REPLIES_ENABLED=false\n';
 const values={META_ATTENDANCE_REPLIES_ENABLED:'false',META_ATTENDANCE_N8N_KEY:token};
 const updated=patchEnvironment(input,values);
 assert.ok(updated.startsWith(input));assert.equal(patchEnvironment(updated,values),updated);
 assert.throws(()=>patchEnvironment(input,{OTHER:'x'}));
 assert.throws(()=>patchEnvironment(input,{META_ATTENDANCE_N8N_KEY:'bad\nINJECT=x'}));
 assert.throws(()=>patchEnvironment(input+input,values));
});
test('planner includes both selective API and n8n deployment without generic server replacement',()=>{
 const files=['scripts/deploy-meta-attendance-replies.cjs','scripts/deploy-n8n-meta-attendance.cjs','scripts/build-n8n-meta-attendance.cjs','services/metaAttendanceServer.cjs','public/VERSION.json'];
 const result=JSON.parse(execFileSync(process.execPath,['scripts/publish-vps-plan.cjs','--mock-files',files.join(','),'--json'],{encoding:'utf8'}));
 assert.equal(result.needs.n8n,true);assert.equal(result.deployCommands[0],'node scripts/deploy-meta-attendance-replies.cjs --apply');
 assert.ok(result.deployCommands.includes('node scripts/deploy-n8n-meta-attendance.cjs --apply'));
 assert.equal(result.deployCommands.includes('node deploy-vps-server-only.cjs'),false);
});
