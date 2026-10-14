// Default is read-only. --restart --session=<exact configured session> is a separate authorized action.
const { Client } = require('ssh2');
const { createWhatsAppStatusHealth } = require('../services/whatsappStatusHealth.cjs');

function recoveryScript(args) {
  if (args.some(arg => arg !== '--restart' && !arg.startsWith('--session='))) throw Error('Unknown argument');
  const restart = args.includes('--restart');
  const expectedSession = args.find(arg => arg.startsWith('--session='))?.slice('--session='.length) || '';
  if (restart && !expectedSession) throw Error('Explicit --session is required for restart');
  return `require('dotenv').config({path:'/var/www/mdv-api/.env',quiet:true});
const createWhatsAppStatusHealth = ${createWhatsAppStatusHealth.toString()};
(async()=>{
 const expected=${JSON.stringify(expectedSession)}, restart=${restart};
 const session=String(process.env.WAHA_STATUS_SESSION||'').trim();
 if(expected && session!==expected) throw Error('Configured session differs; action blocked');
 const getHealth=createWhatsAppStatusHealth({cacheMs:0});
 const before=await getHealth();console.log(JSON.stringify({stage:'before',health:before}));
 if(!restart)return;
 if(!before.configured)throw Error('Session not configured');
 if(before.connected)throw Error('Session responds; restart not justified');
 const base=String(process.env.WAHA_STATUS_SERVER_URL||'http://127.0.0.1:18082').replace(/\\/+$/,'');
 const target=new URL(base);
 if(!['127.0.0.1','localhost'].includes(target.hostname))throw Error('Nonlocal WAHA target; action blocked');
 const r=await fetch(base+'/api/sessions/'+encodeURIComponent(session)+'/restart',{
  method:'POST',headers:{'X-Api-Key':process.env.WAHA_STATUS_API_KEY,'Content-Type':'application/json'},
  body:'{}',signal:AbortSignal.timeout(30000)
 });
 await r.body?.cancel();console.log(JSON.stringify({stage:'restart',http:r.status}));
 if(!r.ok)throw Error('Session restart not confirmed');
 for(let attempt=0;attempt<6;attempt++){
  await new Promise(resolve=>setTimeout(resolve,5000));
  const health=await getHealth();console.log(JSON.stringify({stage:'after',attempt:attempt+1,health}));
  if(health.connected)return;
  if(health.state==='SCAN_QR_CODE')throw Error('QR pairing required; no further action');
 }
 throw Error('Session still unavailable; no further action');
})().catch(e=>{console.error(e.name);process.exitCode=1});`;
}

function main(args) {
  const script = recoveryScript(args);
  const client = new Client();
  client.on('error', () => { console.error('SSH connection failed'); process.exitCode = 1; });
  client.on('ready', () => client.exec('cd /var/www/mdv-api && node', (error, stream) => {
    if (error) { client.end(); process.exitCode = 1; return; }
    stream.on('data', data => process.stdout.write(data));
    stream.stderr.on('data', data => process.stderr.write(data));
    stream.on('close', code => { client.end(); process.exitCode = code; });
    stream.end(script);
  })).connect(require('../tmp-tests/vps-ssh-config.cjs').getVpsSshConfig());
}
if (require.main === module) main(process.argv.slice(2));
module.exports = { recoveryScript };
