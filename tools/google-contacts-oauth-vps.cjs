#!/usr/bin/env node
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const PORT = Number(process.env.GOOGLE_CONTACTS_OAUTH_PORT || 8765);
const REDIRECT_URI = `http://127.0.0.1:${PORT}/oauth2callback`;
const SCOPE = 'https://www.googleapis.com/auth/contacts';
const ENV_FILE = path.join(process.cwd(), '.env');
const ENV_TEXT = fs.readFileSync(ENV_FILE, 'utf8');

function readEnvValue(key) {
  const line = ENV_TEXT.split(/\r?\n/).find((item) => item.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim().replace(/^['"]|['"]$/g, '') : '';
}

const CLIENT_ID = readEnvValue('GOOGLE_CONTACTS_CLIENT_ID');
const CLIENT_SECRET = readEnvValue('GOOGLE_CONTACTS_CLIENT_SECRET');

if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('Google OAuth client is not configured in the VPS environment');

function upsertEnvSecret(content, key, value) {
  const escaped = `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  const lines = String(content || '').replace(/\r\n/g, '\n').split('\n');
  let replaced = false;
  const next = lines.map((line) => {
    if (!line.startsWith(`${key}=`)) return line;
    replaced = true;
    return `${key}=${escaped}`;
  });
  if (!replaced) next.push(`${key}=${escaped}`);
  return `${next.join('\n').replace(/\n+$/, '')}\n`;
}

async function exchangeCode(code, verifier) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.refresh_token) throw new Error(`Token exchange failed with status ${response.status}`);
  return data.refresh_token;
}

async function main() {
  const state = crypto.randomBytes(18).toString('hex');
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPE);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', REDIRECT_URI);
      if (url.pathname !== '/oauth2callback') return response.writeHead(404).end('Not found');
      if (url.searchParams.get('state') !== state) throw new Error('Invalid OAuth state');
      if (url.searchParams.get('error')) throw new Error('Google authorization was denied');
      const code = url.searchParams.get('code') || '';
      if (!code) throw new Error('Missing authorization code');
      const refreshToken = await exchangeCode(code, verifier);
      const current = fs.readFileSync(ENV_FILE, 'utf8');
      fs.writeFileSync(ENV_FILE, upsertEnvSecret(current, 'GOOGLE_CONTACTS_REFRESH_TOKEN', refreshToken), 'utf8');
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end('<h1>Google Contacts conectado</h1><p>O token foi atualizado com segurança na VPS. Pode fechar esta janela.</p>');
      console.log('OAUTH_UPDATED');
      server.close(() => process.exit(0));
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Falha ao conectar Google Contacts.');
      console.error(error.message);
      server.close(() => process.exit(1));
    }
  });

  server.listen(PORT, '127.0.0.1', () => console.log(`AUTH_URL=${authUrl.toString()}`));
}

main().catch((error) => { console.error(error.message); process.exit(1); });
