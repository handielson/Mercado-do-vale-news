// Diagnóstico: testa a listagem de vídeos no Synology e o check-video endpoint
require('dotenv').config();
const https = require('https');

const SYNO_URL = process.env.SYNOLOGY_URL || 'https://192-168-1-2.handielson.direct.quickconnect.to:5001';
const SYNO_USER = process.env.SYNOLOGY_USER;
const SYNO_PASS = process.env.SYNOLOGY_PASS;
const VIDEOS_FOLDER = '/web/videos';

function synoGet(urlObj, path) {
  return new Promise((resolve, reject) => {
    const req = https.get({ hostname: urlObj.hostname, port: parseInt(urlObj.port) || 5001, path, rejectUnauthorized: false }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(new Error('JSON parse failed: ' + d.slice(0,200))); } });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
  });
}

async function main() {
  console.log('SYNO_USER:', SYNO_USER ? '✅ set' : '❌ NOT SET');
  console.log('SYNO_PASS:', SYNO_PASS ? '✅ set' : '❌ NOT SET');
  console.log('SYNO_URL:', SYNO_URL);

  if (!SYNO_USER || !SYNO_PASS) {
    console.log('\n❌ Credenciais do Synology não configuradas no .env!');
    console.log('A VPS usa variáveis de ambiente. Verificar no .env da VPS.');
    return;
  }

  const urlObj = new URL(SYNO_URL);

  // 1. Login
  console.log('\n[1] Fazendo login no Synology...');
  const qs = `api=SYNO.API.Auth&version=7&method=login&account=${encodeURIComponent(SYNO_USER)}&passwd=${encodeURIComponent(SYNO_PASS)}&session=FileStation&format=sid`;
  const auth = await synoGet(urlObj, `/webapi/auth.cgi?${qs}`);
  if (!auth.success) { console.log('❌ Login falhou:', auth); return; }
  const sid = auth.data.sid;
  console.log('✅ Login OK, SID:', sid.slice(0, 10) + '...');

  // 2. Listar pasta de vídeos (sem limit, padrão)
  console.log('\n[2] Listando /web/videos (padrão, sem limit)...');
  const listDefault = await synoGet(urlObj, `/webapi/entry.cgi?api=SYNO.FileStation.List&version=2&method=list&folder_path=${encodeURIComponent(VIDEOS_FOLDER)}&_sid=${sid}`);
  console.log('success:', listDefault.success);
  if (listDefault.success) {
    console.log('Total de arquivos retornados:', listDefault.data?.files?.length);
    console.log('total (se disponível):', listDefault.data?.total);
    console.log('Primeiros 5:', listDefault.data?.files?.slice(0,5).map(f => f.name));
  } else {
    console.log('Erro:', JSON.stringify(listDefault.error));
  }

  // 3. Listar com limit=1000
  console.log('\n[3] Listando /web/videos com limit=1000...');
  const listLarge = await synoGet(urlObj, `/webapi/entry.cgi?api=SYNO.FileStation.List&version=2&method=list&folder_path=${encodeURIComponent(VIDEOS_FOLDER)}&limit=1000&_sid=${sid}`);
  console.log('success:', listLarge.success);
  if (listLarge.success) {
    const files = listLarge.data?.files || [];
    console.log('Total de arquivos retornados:', files.length);
    console.log('Todos os arquivos:', files.map(f => f.name).join(', '));
  } else {
    console.log('Erro:', JSON.stringify(listLarge.error));
  }

  // 4. Testar check-video na VPS
  console.log('\n[4] Testando /public/check-video para PMCS e INEXISTENTE...');
  const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args)).catch(() => {
    // fallback sem node-fetch
    return new Promise((resolve) => {
      const https2 = require('https');
      const url = new URL(args[0]);
      https2.get(url.href, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve({ json: () => JSON.parse(d) }));
      }).on('error', e => resolve({ json: () => ({ error: e.message }) }));
    });
  });

  const r1 = await fetch('https://api.xiaomipetrolina.com.br/public/check-video?sku=PMCS');
  console.log('PMCS:', await r1.json());

  const r2 = await fetch('https://api.xiaomipetrolina.com.br/public/check-video?sku=PRODUTO_INEXISTENTE_XYZ');
  console.log('INEXISTENTE:', await r2.json());
}

main().catch(console.error);
