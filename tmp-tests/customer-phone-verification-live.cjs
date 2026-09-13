const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('ssh2');
require('dotenv').config({ path: path.join(__dirname, '../.env.vps.local'), quiet: true });
const args = process.argv.slice(2);
const phone = args[args.indexOf('--send-to') + 1];
if (!args.includes('--send-to') || !/^\d{10,13}$/.test(phone || '')) throw new Error('Informe --send-to com o número autorizado.');
const moduleSource = fs.readFileSync(path.join(__dirname, '../services/customerPhoneVerificationServer.cjs'), 'utf8');
const remote = [
    "const fs = require('fs'); const vm = require('vm');",
    "require('dotenv').config({path:'/var/www/mdv-api/.env', quiet:true});",
    "const mysql = require('mysql2/promise');",
    "(async () => {",
    "const conn = await mysql.createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASS,database:process.env.DB_NAME});",
    "try {",
    "const source = fs.readFileSync('/var/www/mdv-api/vps_server.js','utf8');",
    "const context = {process, fetch, AbortSignal, URL, pool:{query:(...args)=>conn.query(...args)}};",
    "for(const name of ['EVOLUTION_BASE_URL','EVOLUTION_GLOBAL_API_KEY','N8N_BOT_EVOLUTION_INSTANCE_NAME']) { const line=source.match(new RegExp('^const '+name+' = .*;$','m')); if(!line) throw new Error('Missing canonical config'); vm.runInNewContext(line[0]+'; this.'+name+'='+name,context); }",
    "const settingsStart=source.indexOf('async function getN8nBotEvolutionSettings()');",
    "const settingsEnd=source.indexOf('function getN8nBotEvolutionInstanceName()',settingsStart);",
    "vm.runInNewContext(source.slice(settingsStart,settingsEnd),context);",
    "const sendStart=source.indexOf('async function sendDeliveryWhatsappText(');",
    "const sendEnd=source.indexOf('async function sendDeliveryWhatsappDocument(',sendStart);",
    "context.normalizeDeliveryWhatsAppNumber = value => String(value).replace(/\\D/g,'');",
    "vm.runInNewContext(source.slice(sendStart,sendEnd),context);",
    "const mod={exports:{}};",
    "new Function('require','module','exports', " + JSON.stringify(moduleSource) + ")(require,mod,mod.exports);",
    "const query=(sql,values)=>conn.query(sql.replace('CREATE TABLE IF NOT EXISTS','CREATE TEMPORARY TABLE IF NOT EXISTS'),values);",
    "const sessionPool={query,getConnection:async()=>({query,beginTransaction:()=>conn.beginTransaction(),commit:()=>conn.commit(),rollback:()=>conn.rollback(),release(){}})};",
    "let capturedCode; let sends=0;",
    "const service=mod.exports.createCustomerPhoneVerification({pool:sessionPool,secret:require('crypto').randomBytes(32).toString('hex'),getAuth:async()=>({}),send:async(number,text)=>{if(++sends!==1) throw new Error('Single-send limit');capturedCode=text.match(/\\b\\d{6}\\b/)[0];return context.sendDeliveryWhatsappText(number,text);}});",
    "const body={purpose:'registration',phone:" + JSON.stringify(phone) + "};",
    "const challenge=await service.requestCode({body,ip:'192.0.2.1',headers:{}});",
    "const proof=await service.verifyCode({body:{purpose:'registration',challenge_id:challenge.challenge_id,code:capturedCode}});",
    "await conn.beginTransaction(); await service.consume(sessionPool,proof.phone_verification_token,body.phone,'registration'); await conn.commit();",
    "let replayRejected=false; try {await service.consume(sessionPool,proof.phone_verification_token,body.phone,'registration');} catch {replayRejected=true;}",
    "console.log(JSON.stringify({sent:sends===1,provider_accepted:true,mysql_temporary_tables:true,verification_passed:true,replay_rejected:replayRejected}));",
    "} finally {await conn.end();}",
    "})().catch(()=>{console.error('Teste de WhatsApp/MySQL falhou; detalhes sensíveis omitidos. Não reenviar automaticamente.');process.exitCode=1;});",
].join('\n');
const conn = new Client();
conn.on('ready', () => {
    conn.exec('cd /var/www/mdv-api && node', (error, stream) => {
        if (error) { conn.end(); throw error; }
        stream.on('data', chunk => process.stdout.write(chunk));
        stream.stderr.on('data', chunk => process.stderr.write(chunk));
        stream.on('close', code => { conn.end(); process.exitCode = code; });
        stream.end(remote);
    });
}).on('error', () => { console.error('Falha de conexão SSH'); process.exitCode = 1; }).connect({
    host: process.env.VPS_SITE_HOST || process.env.VPS_HOST,
    username: process.env.VPS_SITE_USER || process.env.VPS_USER,
    password: process.env.VPS_SITE_PASSWORD || process.env.VPS_ROOT_PASSWORD || process.env.VPS_PASSWORD,
    ...(process.env.VPS_SITE_PRIVATE_KEY ? {privateKey: fs.readFileSync(process.env.VPS_SITE_PRIVATE_KEY)} : {}),
    readyTimeout: 20000,
});
