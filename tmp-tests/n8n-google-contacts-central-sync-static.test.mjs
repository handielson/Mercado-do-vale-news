import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/n8n-fix-google-contacts-central-sync.cjs', 'utf8');
assert.match(source, /google-contacts\/search/, 'n8n patch must use the central search endpoint');
assert.match(source, /google-contacts\/sync/, 'n8n patch must use the central sync endpoint');
assert.match(source, /x-sync-key[\s\S]*\$env\.SYNC_SECRET/, 'n8n patch must authenticate central API calls');
assert.match(source, /sync\.ok === true/, 'n8n saved reply must require an actual successful sync');
assert.match(source, /não consegui salvar na agenda agora/, 'n8n must be honest when Google sync fails');
assert.match(source, /Contato - Sincronizar nome WhatsApp/, 'n8n must auto-sync a valid WhatsApp display name');
assert.match(source, /Contato - Continuar apos sincronizacao[\s\S]*Vendas - Preparar Contexto IA/, 'automatic sync must continue the original conversation');
assert.match(source, /UPDATE workflow_history/, 'n8n patch must keep active history aligned');

console.log('n8n central Google Contacts sync static checks passed');
