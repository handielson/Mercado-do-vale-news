import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { patchSplitCode } = require('./n8n-fix-idle-stop-name-invitation.cjs');

const fixture = `const text = $json.output || $json.text || $json.response || '';
let source = {}; let contact = {}; let prepared = {};
try { source = $('switc Mensagens').first().json || {}; } catch (_) {}
try { contact = $('Contato - Resolver').first().json || {}; } catch (_) {}
try { prepared = $('Contato - Preparar').first().json || {}; } catch (_) {}
const remoteJid = $json.remoteJid || source.remoteJid || contact.remoteJid;
const instancia = $json.Instancia || $json.instancia || source.Instancia || contact.Instancia;
const inboundWaMessageId = '';
const staticData = $getWorkflowStaticData('global');
staticData.optionalCustomerName = staticData.optionalCustomerName || {};
const savedName = String($json.clienteNome || source.clienteNome || contact.clienteNome || '').trim();
if (remoteJid && prepared.possibleName) delete staticData.optionalCustomerName[remoteJid];
const recentHistory = String($json.conversationHistory || source.conversationHistory || contact.conversationHistory || '');
const alreadyInvitedInHistory = /como (voce|você) prefere ser chamado/i.test(recentHistory);
const shouldInviteName = !alreadyInvitedInHistory && Boolean(remoteJid) && !savedName && !prepared.possibleName && !staticData.optionalCustomerName[remoteJid];
const nameInvitation = 'CONVITE_NOME';
if (shouldInviteName) staticData.optionalCustomerName[remoteJid] = { invitedAt: new Date().toISOString(), expiresAt: Date.now() + 86400000 };
const suffix = shouldInviteName ? [nameInvitation] : [];
const toItem = (message, index, all) => ({ json: { message, messageIndex: index + 1, totalMessages: all.length, remoteJid, instancia, inboundWaMessageId } });
const parts = String(text).split('[[MSG]]').filter(Boolean);
return [...parts, ...suffix].map(toItem);`;

const patched = patchSplitCode(fixture);
assert.match(patched, /customerEndsConversation/, 'splitter must classify conversation-ending messages');
assert.match(patched, /!customerEndsConversation && !alreadyInvitedInHistory/, 'name invitation must be blocked for conversation endings');

function execute(conversation) {
  const staticData = {};
  const source = { conversation, remoteJid: '559999999999@s.whatsapp.net', Instancia: 'botmercadodovale' };
  return vm.runInNewContext(`(function(){${patched}})()`, {
    $json: { output: 'RESPOSTA', ...source },
    $: (name) => ({ first: () => ({ json: name === 'switc Mensagens' ? source : {} }) }),
    $getWorkflowStaticData: () => staticData,
    Date,
  });
}

assert.deepEqual(Array.from(execute('Nãoooo').map((item) => item.json.message)), ['RESPOSTA'], 'long no must not receive a name invitation');
assert.deepEqual(Array.from(execute('Por enquanto não mais obg').map((item) => item.json.message)), ['RESPOSTA'], 'explicit closing must not receive a name invitation');
assert.deepEqual(Array.from(execute('Quero um Samsung').map((item) => item.json.message)), ['RESPOSTA', 'CONVITE_NOME'], 'a real new sales request may keep the optional invitation');
assert.deepEqual(Array.from(execute('Não tem Redmi 15?').map((item) => item.json.message)), ['RESPOSTA', 'CONVITE_NOME'], 'a product question must not be mistaken for conversation ending');

console.log('n8n idle stop name invitation guards: ok');
