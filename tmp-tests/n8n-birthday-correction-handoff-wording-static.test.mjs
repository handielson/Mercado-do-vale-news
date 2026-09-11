import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { patchResolver, attendantCode } = require('./n8n-fix-birthday-correction-handoff-wording.cjs');
const fs = require('node:fs');
const deploySource = fs.readFileSync(new URL('./n8n-fix-birthday-correction-handoff-wording.cjs', import.meta.url), 'utf8');

const resolverFixture = `
const source = $('switc Mensagens').first().json || {};
const remoteJid = String($json.remoteJid || source.remoteJid || '').trim();
const text = String($json.conversation || source.conversation || '').trim();
const rawOutput = String($json.output || '').trim();
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\\s]/g, ' ').replace(/\\s+/g, ' ').trim();
const safeJsonParse = (value) => { try { return JSON.parse(value); } catch { return null; } };
const getActivePostList = () => null;
const fallbackDecision = () => ({ acao: 'perguntar_esclarecimento', intencao: 'ambigua' });
const legacyDecision = () => null;
const contextualMediaDecisionV287 = null;
const deterministicMetaSmartphonesIntroV167 = null;
const deterministicPhoneStockListDecisionV165 = null;
const deterministicFiscalDocumentDecisionV164 = null;
const deterministicPhone5gFilterV338 = null;
const deterministicPhoneNfcFilterV228 = null;
const deterministicSmartwatchCatalogV162 = null;
const deterministicPhoneMemoryFilterV155 = null;
const deterministicStoreLocationV129 = null;
const deterministicServiceDecisionV135 = null;
const deterministicDeliveryIntentV337 = null;
const allowedActions = new Set(['responder_direto','chamar_atendente','perguntar_esclarecimento']);
const parsed = safeJsonParse(rawOutput);
const legacy = legacyDecision($json, text);
const decision = contextualMediaDecisionV287 || deterministicMetaSmartphonesIntroV167 || deterministicPhoneStockListDecisionV165 || deterministicFiscalDocumentDecisionV164 || deterministicPhone5gFilterV338 || deterministicPhoneNfcFilterV228 || deterministicSmartwatchCatalogV162 || deterministicPhoneMemoryFilterV155 || deterministicStoreLocationV129 || deterministicServiceDecisionV135 || deterministicDeliveryIntentV337 || (parsed && allowedActions.has(String(parsed.acao || '')) ? parsed : (legacy || fallbackDecision()));
const action = allowedActions.has(String(decision.acao || '')) ? String(decision.acao) : 'perguntar_esclarecimento';
return [{ json: {
  ...source,
  ...$json,
  conversationAction: action,
  conversationIntent: String(decision.intencao || ''),
  conversationDecision: decision,
  remoteJid,
} }];`;

const patched = patchResolver(resolverFixture);
assert.match(patched, /birthday-correction-handoff-wording-v372/);
assert.match(patched, /const decision = birthdayCorrectionV372 \|\|/);
assert.match(patched, /birthdayCorrectionDate/);
assert.doesNotThrow(() => new Function(patched));
assert.match(attendantCode, /Vou encaminhar sua conversa para nossa equipe/);
assert.match(attendantCode, /Desculpe por termos enviado os parabens na data errada/);
assert.doesNotMatch(attendantCode, /Mesmo assim, a qualquer momento/);
assert.doesNotMatch(attendantCode, /Vou chamar um atendente/);
assert.equal(patchResolver(patched), patched, 'patch must be idempotent');
assert.match(deploySource, /COPY \(SELECT json_build_object\(/, 'backup must be generated inside Postgres');
assert.match(deploySource, /ON_ERROR_STOP=1/, 'psql failures must abort the publication');
assert.doesNotMatch(deploySource, /printf '%s'.*nodesHex/, 'workflow JSON must not be embedded in an SSH command');

console.log('n8n birthday correction and handoff wording static checks passed');
