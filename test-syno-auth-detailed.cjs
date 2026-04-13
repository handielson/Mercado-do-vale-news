#!/usr/bin/env node
/**
 * test-syno-auth-detailed.cjs
 * Testa autenticação com Synology e mostra resposta completa
 */

require('dotenv').config();
const https = require('https');

const SYNO_URL = process.env.SYNOLOGY_URL || 'https://handielson.direct.quickconnect.to:5001';
const SYNO_USER = process.env.SYNOLOGY_USER || 'Handielson';
const SYNO_PASS = process.env.SYNOLOGY_PASS || '@@Jsj2865';

console.log('🔐 Testando Autenticação Synology\n');
console.log('URL:', SYNO_URL);
console.log('User:', SYNO_USER);
console.log('Pass: ' + '*'.repeat(SYNO_PASS.length) + '\n');

const urlObj = new URL(SYNO_URL);
const qs = `api=SYNO.API.Auth&version=7&method=login&account=${encodeURIComponent(SYNO_USER)}&passwd=${encodeURIComponent(SYNO_PASS)}&session=FileStation&format=sid`;

console.log('Query String:', qs.slice(0, 100) + '...\n');

const options = {
  hostname: urlObj.hostname,
  port: urlObj.port ? parseInt(urlObj.port) : 5001,
  path: `/webapi/auth.cgi?${qs}`,
  method: 'GET',
  rejectUnauthorized: false,
  timeout: 8000
};

console.log('Connecting to:', `${options.hostname}:${options.port}${options.path.slice(0, 50)}...\n`);

let timedOut = false;

const req = https.request(options, (res) => {
  console.log('✅ Connected! Status:', res.statusCode);
  console.log('Content-Type:', res.headers['content-type'] || 'unknown\n');
  
  let rawData = '';
  let chunkCount = 0;

  res.on('data', (chunk) => {
    rawData += chunk;
    chunkCount++;
    process.stdout.write(`.`);
  });

  res.on('end', () => {
    if (timedOut) return;
    
    console.log(`\n\n📦 Received ${chunkCount} chunks (${rawData.length} bytes)\n`);
    console.log('━━━ RAW RESPONSE ━━━');
    console.log(rawData);
    console.log('━━━ END ━━━\n');

    try {
      const json = JSON.parse(rawData);
      console.log('✅ Valid JSON:');
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('❌ Invalid JSON:', e.message);
    }

    process.exit(0);
  });
});

req.on('error', (err) => {
  if (timedOut) return;
  console.error('\n❌ Connection Error:', err.message);
  console.error('Code:', err.code);
  process.exit(1);
});

req.on('timeout', () => {
  timedOut = true;
  console.error('\n❌ Request Timeout after 8s');
  req.destroy();
  process.exit(1);
});

console.log('⏳ Waiting for response (timeout 8s)...\n');
req.end();
