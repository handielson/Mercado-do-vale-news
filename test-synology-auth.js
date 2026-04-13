#!/usr/bin/env node
/**
 * Test Synology authentication
 */
require('dotenv').config();
const https = require('https');
const url = require('url');

const SYNO_URL = process.env.SYNOLOGY_URL || 'https://handielson.direct.quickconnect.to:5001';
const SYNO_USER = process.env.SYNOLOGY_USER || '';
const SYNO_PASS = process.env.SYNOLOGY_PASS || '';

console.log('='.repeat(70));
console.log('Synology Authentication Test');
console.log('='.repeat(70));
console.log('URL:', SYNO_URL);
console.log('User:', SYNO_USER);
console.log('Pass:', SYNO_PASS ? '✅ SET (' + SYNO_PASS.length + ' chars)' : '❌ NOT SET');
console.log('');

if (!SYNO_USER || !SYNO_PASS) {
  console.error('❌ Missing credentials!');
  process.exit(1);
}

async function test() {
  try {
    const urlObj = new URL(SYNO_URL);
    
    // Build auth query string
    const account = encodeURIComponent(SYNO_USER);
    const passwd = encodeURIComponent(SYNO_PASS);
    const qs = `api=SYNO.API.Auth&version=7&method=login&account=${account}&passwd=${passwd}&session=FileStation&format=sid`;
    
    console.log('[1] Attempting login...');
    console.log('    Query string (first 100 chars):', qs.substring(0, 100) + '...');
    console.log('');

    const response = await new Promise((resolve, reject) => {
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 5001,
        path: `/webapi/auth.cgi?${qs}`,
        method: 'GET',
        rejectUnauthorized: false,
        timeout: 10000,
      };

      console.log('[2] HTTPS Request:');
      console.log('    hostname:', options.hostname);
      console.log('    port:', options.port);
      console.log('    timeout: 10000ms');
      console.log('');

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          console.log('[3] Response received:');
          console.log('    Status:', res.statusCode);
          console.log('    Headers:', res.headers);
          console.log('    Body (first 500 chars):', data.substring(0, 500));
          console.log('');
          
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (e) {
            console.error('[4] ❌ Failed to parse JSON:', e.message);
            console.error('    Raw response:', data);
            reject(e);
          }
        });
      });

      req.on('error', (err) => {
        console.error('[3] ❌ Request failed:', err.message);
        reject(err);
      });

      req.on('timeout', () => {
        console.error('[3] ❌ Request timeout!');
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });

    console.log('[4] Parsed response:');
    console.log(JSON.stringify(response, null, 2));
    
    if (response.success) {
      console.log('');
      console.log('✅ SUCCESS! SID:', response.data.sid.substring(0, 20) + '...');
    } else {
      console.log('');
      console.log('❌ Login failed!');
      console.log('   Error code:', response.error?.code);
      console.log('   Error:', response.error);
    }

  } catch (err) {
    console.error('');
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

test().then(() => {
  console.log('');
  console.log('='.repeat(70));
}).catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const https = require('https');

const SYNO_URL = process.env.SYNOLOGY_URL || 'https://192-168-1-2.handielson.direct.quickconnect.to:5001';
const SYNO_USER = process.env.SYNOLOGY_USER;
const SYNO_PASS = process.env.SYNOLOGY_PASS;

console.log('🔍 Testando conexão com Synology...\n');
console.log('URL:', SYNO_URL);
console.log('USER:', SYNO_USER ? '✅ ' + SYNO_USER : '❌ NÃO CONFIGURADO');
console.log('PASS:', SYNO_PASS ? '✅ ' + SYNO_PASS.substring(0, 3) + '***' : '❌ NÃO CONFIGURADO');

if (!SYNO_USER || !SYNO_PASS) {
  console.error('\n❌ Credenciais não configuradas!');
  process.exit(1);
}

function makeRequest(urlObj, path, description) {
  return new Promise((resolve) => {
    console.log(`\n[${description}] Enviando requisição...`);
    console.log(`Path: ${path}`);

    const request = https.get(
      { 
        hostname: urlObj.hostname, 
        port: urlObj.port || 5001,
        path: path,
        rejectUnauthorized: false 
      }, 
      (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          console.log(`Status: ${res.statusCode}`);
          console.log(`Response: ${data.substring(0, 500)}`);
          try {
            const json = JSON.parse(data);
            resolve({ success: true, data: json, status: res.statusCode });
          } catch (e) {
            console.log(`⚠️ JSON Parse Error: ${e.message}`);
            resolve({ success: false, error: e.message, raw: data.substring(0, 500), status: res.statusCode });
          }
        });
      }
    );

    request.on('error', (err) => {
      console.error(`❌ Erro de conexão: ${err.message}`);
      resolve({ success: false, error: err.message, status: null });
    });

    request.setTimeout(10000, () => {
      request.destroy();
      console.error('❌ Timeout (10s)');
      resolve({ success: false, error: 'Timeout', status: null });
    });
  });
}

async function test() {
  const urlObj = new URL(SYNO_URL);

  // 1. Teste de conexão básica (ping)
  console.log('\n' + '='.repeat(60));
  console.log('TESTE 1: Ping ao servidor Synology');
  console.log('='.repeat(60));
  const pingRes = await makeRequest(urlObj, '/webapi/', 'Ping');

  // 2. Teste de login
  console.log('\n' + '='.repeat(60));
  console.log('TESTE 2: Autenticação (Login)');
  console.log('='.repeat(60));
  const qs = `api=SYNO.API.Auth&version=7&method=login&account=${encodeURIComponent(SYNO_USER)}&passwd=${encodeURIComponent(SYNO_PASS)}&session=FileStation&format=sid`;
  const loginRes = await makeRequest(urlObj, `/webapi/auth.cgi?${qs}`, 'Login');

  if (loginRes.success && loginRes.data.success) {
    console.log(`\n✅ Login bem-sucedido!`);
    console.log(`SID: ${loginRes.data.data.sid.substring(0, 20)}...`);

    // 3. Teste de listagem
    console.log('\n' + '='.repeat(60));
    console.log('TESTE 3: Listagem de arquivos em /web/imagens');
    console.log('='.repeat(60));
    const sid = loginRes.data.data.sid;
    const listPath = `/webapi/entry.cgi?api=SYNO.FileStation.List&version=2&method=list&folder_path=%2Fweb%2Fimagens&additional=%5B%22size%22%2C%22time%22%5D&_sid=${sid}`;
    const listRes = await makeRequest(urlObj, listPath, 'List');
  } else {
    console.error('\n❌ Erro de autenticação!');
    if (loginRes.data) {
      console.error('Resposta:', JSON.stringify(loginRes.data, null, 2));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Teste concluído');
  console.log('='.repeat(60));
}

test().catch(console.error);
