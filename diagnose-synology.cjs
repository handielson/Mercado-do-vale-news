/**
 * diagnose-synology.cjs
 *
 * Testa em sequência as 4 camadas da integração Synology:
 *   1. CDN público (videos.mercadodovale.com.br)
 *   2. Túnel DSM-API (dsm-api.xiaomipetrolina.com.br responde SYNO.API.Info)
 *   3. Login DSM via túnel (SYNO.API.Auth retorna sid)
 *   4. Endpoint VPS /synology/files?folder=videos (deve retornar > 0 itens)
 *
 * Uso:
 *   node diagnose-synology.cjs
 *
 * Variáveis lidas de .env:
 *   SYNOLOGY_URL, SYNOLOGY_USER, SYNOLOGY_PASS, SYNC_SECRET
 */
require('dotenv').config();
const https = require('https');

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', gray: '\x1b[90m', reset: '\x1b[0m', bold: '\x1b[1m' };
const ok = (m) => console.log(`${C.green}✓${C.reset} ${m}`);
const bad = (m) => console.log(`${C.red}✗${C.reset} ${m}`);
const warn = (m) => console.log(`${C.yellow}!${C.reset} ${m}`);
const info = (m) => console.log(`${C.cyan}•${C.reset} ${m}`);
const head = (n, t) => console.log(`\n${C.bold}[${n}] ${t}${C.reset}`);

const SYNOLOGY_URL = process.env.SYNOLOGY_URL || 'https://dsm-api.xiaomipetrolina.com.br';
const SYNOLOGY_USER = process.env.SYNOLOGY_USER;
const SYNOLOGY_PASS = process.env.SYNOLOGY_PASS;
const SYNC_SECRET = process.env.SYNC_SECRET;
const VPS_API = 'https://api.xiaomipetrolina.com.br';
const CDN_VIDEOS = 'https://videos.mercadodovale.com.br';

function fetchUrl(url, { headers = {}, timeoutMs = 8000 } = {}) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c.toString(); });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', (e) => resolve({ error: e.message }));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ error: `timeout ${timeoutMs}ms` }); });
  });
}

(async () => {
  console.log(`${C.bold}Diagnóstico Synology — ${new Date().toLocaleString('pt-BR')}${C.reset}`);
  console.log(`${C.gray}SYNOLOGY_URL = ${SYNOLOGY_URL}${C.reset}`);

  let failures = 0;

  // 1. CDN público
  head(1, 'CDN público (videos.mercadodovale.com.br)');
  const cdn = await fetchUrl(CDN_VIDEOS + '/', { timeoutMs: 6000 });
  if (cdn.error) { bad(`erro: ${cdn.error}`); failures++; }
  else if (cdn.status >= 200 && cdn.status < 500) ok(`HTTP ${cdn.status} — CDN respondendo`);
  else { bad(`HTTP ${cdn.status}`); failures++; }

  // 2. DSM-API Info
  head(2, 'Túnel DSM-API (SYNO.API.Info)');
  const infoUrl = `${SYNOLOGY_URL}/webapi/query.cgi?api=SYNO.API.Info&version=1&method=query&query=SYNO.API.Auth,SYNO.FileStation.List`;
  const dsm = await fetchUrl(infoUrl, { timeoutMs: 8000 });
  if (dsm.error) { bad(`erro: ${dsm.error}`); failures++; }
  else if (dsm.status === 200 && dsm.body.includes('"success":true')) ok('DSM responde via tunnel (success=true)');
  else { bad(`HTTP ${dsm.status} — body: ${dsm.body.slice(0,120)}`); failures++; }

  // 3. Login DSM
  head(3, 'Login DSM (SYNO.API.Auth → sid)');
  if (!SYNOLOGY_USER || !SYNOLOGY_PASS) {
    warn('SYNOLOGY_USER / SYNOLOGY_PASS ausentes no .env — pulando etapa');
  } else {
    const loginUrl = `${SYNOLOGY_URL}/webapi/auth.cgi?api=SYNO.API.Auth&version=6&method=login&account=${encodeURIComponent(SYNOLOGY_USER)}&passwd=${encodeURIComponent(SYNOLOGY_PASS)}&session=FileStation&format=sid`;
    const log = await fetchUrl(loginUrl, { timeoutMs: 10000 });
    if (log.error) { bad(`erro: ${log.error}`); failures++; }
    else {
      try {
        const json = JSON.parse(log.body);
        if (json.success && json.data && json.data.sid) ok(`login OK — sid=${String(json.data.sid).slice(0,10)}...`);
        else { bad(`login falhou — ${log.body.slice(0,200)}`); failures++; }
      } catch { bad(`resposta não-JSON: ${log.body.slice(0,120)}`); failures++; }
    }
  }

  // 4. VPS /synology/files?folder=videos
  head(4, 'Endpoint VPS /synology/files?folder=videos');
  if (!SYNC_SECRET) {
    warn('SYNC_SECRET ausente no .env — pulando etapa');
  } else {
    const vpsUrl = `${VPS_API}/synology/files?folder=videos&limit=5`;
    const vps = await fetchUrl(vpsUrl, { headers: { 'x-sync-key': SYNC_SECRET }, timeoutMs: 15000 });
    if (vps.error) { bad(`erro: ${vps.error}`); failures++; }
    else if (vps.status !== 200) { bad(`HTTP ${vps.status} — ${vps.body.slice(0,200)}`); failures++; }
    else {
      const total = vps.headers['x-total-count'] || '?';
      try {
        const arr = JSON.parse(vps.body);
        if (Array.isArray(arr) && arr.length > 0) ok(`listou ${arr.length} itens (total ${total}) — primeiro: ${arr[0].name || arr[0].filename || JSON.stringify(arr[0]).slice(0,80)}`);
        else { bad(`lista vazia — tunnel provavelmente OFFLINE ou SYNOLOGY_URL da VPS errada (total ${total})`); failures++; }
      } catch { bad(`resposta não-JSON: ${vps.body.slice(0,120)}`); failures++; }
    }
  }

  console.log('');
  if (failures === 0) console.log(`${C.green}${C.bold}✓ Todas as camadas OK${C.reset}`);
  else console.log(`${C.red}${C.bold}✗ ${failures} falha(s) — veja RUNBOOK em /admin/settings/synology-config${C.reset}`);
  process.exit(failures === 0 ? 0 : 1);
})();
