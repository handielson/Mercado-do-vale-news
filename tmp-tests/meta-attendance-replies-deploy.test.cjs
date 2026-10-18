'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {patchEnvironment}=require('../scripts/deploy-meta-attendance-replies.cjs');
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
