const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {patch}=require('../scripts/deploy-openai-finance.cjs');
const hook="require('./services/openAiFinanceServer.cjs').registerOpenAiFinanceRoutes(fastify, { pool, requireAdminBearerToken });";
const legacyBalance='    openai_official_remaining_credit_usd: openAiOfficialMonthCostUsd == null\n      ? null\n      : Number((creditBalanceUsd - openAiOfficialMonthCostUsd).toFixed(6)),';
const fixture='async function requireAdminBearerToken(request, reply) {}\n\nasync function requireSyncKeyOrCustomer(request, reply) {}\nconst summary = {\n'+legacyBalance+'\n};\n';
test('selective finance patch changes only the route and unknown balance and is idempotent',()=>{
 const expected=fixture.replace('async function requireSyncKeyOrCustomer',hook+'\n\nasync function requireSyncKeyOrCustomer').replace(legacyBalance,'    openai_official_remaining_credit_usd: null,');
 assert.equal(patch(fixture),expected);assert.equal(patch(expected),expected);
 const unrelated='\n// unrelated production integration\n';assert.equal(patch(fixture+unrelated),expected+unrelated);
});
for(const file of ['vps_server.js','vps_server.cjs']){
 test(file+' registers the real finance module with the admin gate exactly once',()=>{
  const source=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
  assert.equal(source.split(hook).length-1,1);
  let route;const guard=()=>{};
  vm.runInNewContext(hook,{require:()=>require('../services/openAiFinanceServer.cjs'),fastify:{get:(url,options,handler)=>{route={url,options,handler};}},pool:{},requireAdminBearerToken:guard});
  assert.equal(route.url,'/admin/openai/finance');assert.equal(route.options.preHandler,guard);
 });
}
test('missing auth or balance anchors abort instead of replacing the server',()=>{
 assert.throws(()=>patch('unrelated server'),/anchor drift/);
 assert.throws(()=>patch(fixture.replace('openai_official_remaining_credit_usd:','unexpected_balance_field:')),/Balance anchor drift/);
 assert.match(fs.readFileSync('deploy-vps-server-only.cjs','utf8'),/--openai-finance-only/);
});
test('full API deploy uploads and syntax checks the finance module before replacing runtime',()=>{
 const source=fs.readFileSync('deploy-vps-server-only.cjs','utf8');
 const start=source.indexOf('console.log(`Uploading server to ${appDir}`)');
 const runtime=source.indexOf('await upload(localServer, `${appDir}/vps_server.js`);',start);
 assert.ok(start>=0&&runtime>start);
 const setup=source.slice(start,runtime);
 assert.match(setup,/await upload\(path\.join\(__dirname, 'services\/openAiFinanceServer\.cjs'\), remotePathJoin\(appDir, 'services\/openAiFinanceServer\.cjs'\)\)/);
 assert.match(setup,/node --check \$\{appDir\}\/services\/openAiFinanceServer\.cjs/);
});

