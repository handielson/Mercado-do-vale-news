import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync('vps_server.js', 'utf8');
const serverCjs = readFileSync('vps_server.cjs', 'utf8');
const page = readFileSync('pages/admin/whatsapp/NovoBotPage.tsx', 'utf8');
const service = readFileSync('services/n8nBotControlService.ts', 'utf8');
const routes = readFileSync('routes/index.tsx', 'utf8');
const layout = readFileSync('layouts/AdminLayout.tsx', 'utf8');
const patch = readFileSync('tmp-tests/n8n-add-admin-client-control.cjs', 'utf8');

for (const source of [server, serverCjs]) {
  assert.match(source, /CREATE TABLE IF NOT EXISTS n8n_bot_client_controls/, 'server must create n8n bot controls table');
  assert.match(source, /fastify\.get\('\/n8n-bot\/client-control'/, 'server must expose lookup endpoint');
  assert.match(source, /fastify\.post\('\/n8n-bot\/client-control\/block'/, 'server must expose block endpoint');
  assert.match(source, /fastify\.post\('\/n8n-bot\/client-control\/reset'/, 'server must expose reset endpoint');
  assert.match(source, /CREATE TABLE IF NOT EXISTS n8n_bot_messages/, 'server must create n8n bot messages table');
  assert.match(source, /fastify\.get\('\/n8n-bot\/conversations'/, 'server must expose n8n bot conversations endpoint');
  assert.match(source, /fastify\.get\('\/n8n-bot\/messages'/, 'server must expose n8n bot messages endpoint');
  assert.match(source, /fastify\.post\('\/n8n-bot\/messages\/log'/, 'server must expose n8n bot message log endpoint');
  assert.match(source, /buildN8nBotMemorySessionKey\(remoteJid, resetCount\)/, 'server must return versioned memory session key');
}

assert.match(service, /\/n8n-bot\/client-control\/block/, 'front service must call block endpoint');
assert.match(service, /\/n8n-bot\/client-control\/reset/, 'front service must call reset endpoint');
assert.match(service, /\/n8n-bot\/conversations/, 'front service must list n8n conversations');
assert.match(service, /\/n8n-bot\/messages/, 'front service must list n8n messages');
assert.match(page, /Bloquear fluxo/, 'new bot page must expose block action');
assert.match(page, /Limpar atendimento/, 'new bot page must expose admin reset action');
assert.match(page, /Ao vivo/, 'new bot page must expose live refresh mode');
assert.match(page, /messageTone/, 'new bot page must render a message timeline');
assert.match(routes, /NovoBotPage/, 'routes must include new bot page');
assert.match(routes, /\/admin\/whatsapp\/novo-bot/, 'routes must expose separated new bot path');
assert.match(layout, /Novo Bot/, 'admin menu must include Novo Bot');

assert.match(patch, /Controle Bot - Verificar Cliente/, 'n8n patch must add client control node');
assert.match(patch, /Controle Bot - Bloqueado\?/, 'n8n patch must add blocked IF node');
assert.match(patch, /memorySessionKey/, 'n8n patch must use versioned memory session key');
assert.match(patch, /SYNC_SECRET/, 'n8n patch must provide sync secret to workflow runtime');
assert.match(patch, /delete staticData\.salesPostList\[remoteJid\]/, 'n8n reset must clear post-list state');
assert.match(patch, /Controle Bot - Registrar Saida/, 'n8n patch must add outbound message logger');
assert.match(patch, /\/n8n-bot\/messages\/log/, 'n8n patch must log messages to VPS');

console.log('n8n admin client control static checks passed');
