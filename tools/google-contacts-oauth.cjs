#!/usr/bin/env node
require('dotenv').config();

const crypto = require('crypto');
const http = require('http');

const CLIENT_ID = process.env.GOOGLE_CONTACTS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CONTACTS_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
const PORT = Number(process.env.GOOGLE_CONTACTS_OAUTH_PORT || 8765);
const REDIRECT_URI = `http://127.0.0.1:${PORT}/oauth2callback`;
const SCOPES = [
  'https://www.googleapis.com/auth/contacts',
  'https://www.googleapis.com/auth/contacts.other.readonly',
];
const SCOPE = SCOPES.join(' ');

function fail(message) {
  console.error(`\n[google-contacts-oauth] ${message}`);
  process.exit(1);
}

if (!CLIENT_ID || !CLIENT_SECRET) {
  fail([
    'Configure GOOGLE_CONTACTS_CLIENT_ID and GOOGLE_CONTACTS_CLIENT_SECRET before running.',
    '',
    'Create an OAuth client in Google Cloud:',
    '- Application type: Desktop app',
    '- Enable API: People API',
    '- Account to authorize: handielson@gmail.com',
  ].join('\n'));
}

function makeVerifier() {
  return crypto.randomBytes(48).toString('base64url');
}

function makeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

async function exchangeCodeForTokens(code, codeVerifier) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }
  return JSON.parse(text);
}

async function main() {
  const state = crypto.randomBytes(18).toString('hex');
  const codeVerifier = makeVerifier();
  const codeChallenge = makeChallenge(codeVerifier);

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPE);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', REDIRECT_URI);
      if (url.pathname !== '/oauth2callback') {
        res.writeHead(404).end('Not found');
        return;
      }

      const returnedState = url.searchParams.get('state') || '';
      const code = url.searchParams.get('code') || '';
      const error = url.searchParams.get('error') || '';

      if (error) throw new Error(`OAuth denied: ${error}`);
      if (returnedState !== state) throw new Error('Invalid OAuth state');
      if (!code) throw new Error('Missing authorization code');

      const tokens = await exchangeCodeForTokens(code, codeVerifier);
      const refreshToken = tokens.refresh_token || '';
      if (!refreshToken) {
        throw new Error('Google did not return a refresh_token. Revoke app access and run again with prompt=consent.');
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>Google Contacts conectado</h1><p>Pode fechar esta janela e voltar ao terminal.</p>');

      console.log('\nGoogle Contacts OAuth conectado.\n');
      console.log('Configure estas variaveis na VPS:');
      console.log(`GOOGLE_CONTACTS_CLIENT_ID=${CLIENT_ID}`);
      console.log(`GOOGLE_CONTACTS_CLIENT_SECRET=${CLIENT_SECRET}`);
      console.log(`GOOGLE_CONTACTS_REFRESH_TOKEN=${refreshToken}`);
      console.log('\nGuarde o refresh token como segredo. Nao commitar em arquivo do repo.\n');
      server.close(() => process.exit(0));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Erro: ${err.message}`);
      console.error(err);
      server.close(() => process.exit(1));
    }
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log('\nAbra este link e autorize com handielson@gmail.com:\n');
    console.log(authUrl.toString());
    console.log(`\nAguardando retorno em ${REDIRECT_URI} ...\n`);
  });
}

main().catch((err) => fail(err.message));
