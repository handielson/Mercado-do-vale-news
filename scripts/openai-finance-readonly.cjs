// Read-only local preview: credentials stay on the VPS; only aggregates return.
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('../tmp-tests/vps-ssh-config.cjs');
const { financeRange } = require('../services/openAiFinanceServer.cjs');
async function readFinance(days) {
  financeRange(days);
  const source = fs.readFileSync(path.join(__dirname, '../services/openAiFinanceServer.cjs'), 'utf8');
  const script = `const finance=(()=>{const module={exports:{}};${source}\nreturn module.exports;})();
  require('dotenv').config({quiet:true});
  (async()=>{const db=await require('mysql2/promise').createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASS,database:process.env.DB_NAME});
  try {const [rows]=await db.query('SELECT openai_admin_api_key FROM autoresponder_settings WHERE id = 1 LIMIT 1');
  const apiKey=String(rows[0]?.openai_admin_api_key||process.env.OPENAI_ADMIN_KEY||process.env.OPENAI_ADMIN_API_KEY||'').trim();
  console.log(JSON.stringify(await finance.fetchOpenAiFinance({apiKey,days:${Number(days)}})));}finally{await db.end();}})().catch(()=>{console.error('Consulta de custos indisponível.');process.exitCode=1;});`;
  const client = new Client();
  try {
    await new Promise((resolve, reject) => client.on('ready', resolve).on('error', reject).connect({ ...getVpsSshConfig(), readyTimeout: 15000 }));
    const result = await new Promise((resolve, reject) => {
      client.exec('cd /var/www/mdv-api && node', (err, stream) => {
        if (err) return reject(err);
        let output = '';
        stream.on('data', chunk => { output += chunk; });
        stream.on('close', code => code ? reject(new Error('Consulta de custos indisponível.')) : resolve(output));
        stream.end(script);
      });
    });
    return JSON.parse(String(result).trim());
  } finally { client.end(); }
}
async function main() {
  if (!process.argv.includes('--serve')) {
    console.log(JSON.stringify(await readFinance(Number(process.argv[2] || 30)), null, 2));
    return;
  }
  const fastify = require('fastify')();
  const env = require('dotenv').parse(fs.readFileSync(path.join(__dirname, '../.env.local')));
  const syncKey = env.VITE_VPS_SYNC_KEY;
  if (!syncKey) throw new Error('Chave do preview local não configurada.');
  const cache = new Map();
  fastify.get('/finance', async (req, reply) => {
    if (req.headers['x-sync-key'] !== syncKey) return reply.code(401).send({ error: 'Unauthorized' });
    const authorization = String(req.headers.authorization || '');
    if (!authorization.startsWith('Bearer ')) return reply.code(401).send({ error: 'Admin bearer token required' });
    try {
      const auth = await fetch('https://api.xiaomipetrolina.com.br/auth/me', { headers: { Authorization: authorization }, signal: AbortSignal.timeout(8000) });
      if (!auth.ok || String((await auth.json()).customer?.customer_type || '').toUpperCase() !== 'ADMIN') return reply.code(401).send({ error: 'Admin bearer token required' });
    } catch { return reply.code(503).send({ error: 'Validação de acesso indisponível.' }); }
    const days = Number(req.query.days || 30);
    try { financeRange(days); } catch (err) { return reply.code(400).send({ error: err.message }); }
    let entry = cache.get(days);
    if (!entry || Date.now() - entry.time >= 60000) {
      const promise = readFinance(days).catch(err => { cache.delete(days); throw err; });
      cache.set(days, entry = { time: Date.now(), promise });
    }
    try { return await entry.promise; } catch { return reply.code(502).send({ error: 'Falha ao consultar custos na OpenAI.' }); }
  });
  await fastify.listen({ port: 3102, host: '127.0.0.1' });
  console.log('Preview financeiro somente leitura em 127.0.0.1:3102');
}
if (require.main === module) main().catch(err => { console.error(err.message); process.exitCode = 1; });
module.exports = { readFinance };
