const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const {patch}=require('../scripts/deploy-openai-finance.cjs');
test('selective finance patch equals the authorized server diff and is idempotent',()=>{
 const baseline=execFileSync('git',['show','HEAD:vps_server.cjs'],{encoding:'utf8',maxBuffer:16*1024*1024});
 const expected=fs.readFileSync('vps_server.cjs','utf8').replace(/\r\n/g,'\n');
 assert.equal(patch(baseline),expected);assert.equal(patch(expected),expected);
 const customized=baseline+'\n// unrelated production integration\n';assert.equal(patch(customized),expected+'\n// unrelated production integration\n');
});
test('missing auth or balance anchors abort instead of replacing the server',()=>{
 assert.throws(()=>patch('unrelated server'),/anchor drift/);
 const baseline=execFileSync('git',['show','HEAD:vps_server.cjs'],{encoding:'utf8',maxBuffer:16*1024*1024});
 assert.throws(()=>patch(baseline.replace('openai_official_remaining_credit_usd:','unexpected_balance_field:')),/Balance anchor drift/);
 assert.match(fs.readFileSync('deploy-vps-server-only.cjs','utf8'),/--openai-finance-only/);
});

