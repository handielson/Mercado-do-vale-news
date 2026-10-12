const test=require('node:test'),assert=require('node:assert/strict'),{inspect}=require('../scripts/assert-no-n8n-secrets.cjs');
test('private MCP config is rejected even without a token',()=>assert.deepEqual(inspect('.cursor/mcp.json','{}'),['private_mcp_config_tracked']));
test('literal JWT under n8n key is rejected without reporting its value',()=>{
 const synthetic=['eyJmb28iOiJiYXIifQ','eyJhdWQiOiJmaXh0dXJlIn0','synthetic_signature'].join('.');
 const results=inspect('config.json',JSON.stringify({N8N_API_KEY:synthetic}));assert.deepEqual(results,['literal_n8n_token']);assert(!JSON.stringify(results).includes(synthetic));
 assert.deepEqual(inspect('config.toml',`N8N_MCP_ACCESS_TOKEN = "${synthetic}"`),['literal_n8n_token']);
});
test('example and environment lookups remain allowed',()=>{
 assert.deepEqual(inspect('.cursor/mcp.example.json',JSON.stringify({N8N_API_KEY:'CONFIGURE_LOCALMENTE_NAO_COMMITAR'})),[]);
 assert.deepEqual(inspect('server.cjs','const key = process.env.N8N_API_KEY;'),[]);
});
