import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { patchWorkflow, summarize } = require('./n8n-fix-central-greeting-time.cjs');

const oldProductGreeting = `const greetingLine = (() => {
  if (base.saudacaoDetectada !== true) return '';
  const text = normalize(base.conversation || base.productSearchOriginalText || '');
  if (text.includes('bom dia')) return 'Bom dia! 😊';
  if (text.includes('boa tarde')) return 'Boa tarde! 😊';
  if (text.includes('boa noite')) return 'Boa noite! 😊';
  const hour = Number(new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }));
  if (hour >= 5 && hour < 12) return 'Bom dia! 😊';
  if (hour >= 12 && hour < 18) return 'Boa tarde! 😊';
  return 'Boa noite! 😊';
})();`;
const oldPostListGreeting = `const periodGreeting = () => {
  if (source.saudacaoDetectada !== true) return '';
  if (normalized.includes('bom dia')) return 'Bom dia! 😊';
  if (normalized.includes('boa tarde')) return 'Boa tarde! 😊';
  if (normalized.includes('boa noite')) return 'Boa noite! 😊';
  const hour = Number(new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }));
  if (hour >= 5 && hour < 12) return 'Bom dia! 😊';
  if (hour >= 12 && hour < 18) return 'Boa tarde! 😊';
  return 'Boa noite! 😊';
};`;
const oldToItem = "const toItem = (message, index, all) => ({ json: { message: message.text || message.caption || message, caption: message.caption || message.text || message, messageType: message.type === 'image' ? 'image' : 'text', mediaUrl: message.mediaUrl || '', mimetype: message.mimetype || (message.type === 'image' ? 'image/jpeg' : ''), fileName: message.fileName || 'produto.jpg', delayMs: Number(message.delayMs || 0), messageIndex: index + 1, totalMessages: all.length, remoteJid, instancia, inboundWaMessageId } });";
const nodes = [
  {
    name: 'Agente Geral - Atendimento', type: '@n8n/n8n-nodes-langchain.agent',
    parameters: { options: { systemMessage: `Ao iniciar uma conversa:
- Entre 05:00 e 11:59, responda com uma saudação de bom dia.
- Entre 12:00 e 17:59, responda com uma saudação de boa tarde.
- Entre 18:00 e 04:59, responda com uma saudação de boa noite.

A primeira mensagem deve ser obrigatoriamente a saudação do período. Nunca coloque a apresentação antes da saudação.
Na saudacao inicial, crie as duas mensagens de forma natural a partir do contexto. Nao use texto-modelo fixo.` } },
  },
  {
    name: 'Dividir mensagens', type: 'n8n-nodes-base.code',
    parameters: { jsCode: `const text = $json.output || $json.text || $json.response || '';
const remoteJid = '558799999999@s.whatsapp.net';
const instancia = 'botmercadodovale';
const inboundWaMessageId = 'test';
${oldToItem}
const parts = String(text).replace(/\\[\\[MSG\\]\\]/g, '|||').split('|||').filter(Boolean);
return parts.map(toItem);` },
  },
  { name: 'Vendas - Contexto Produtos', type: 'n8n-nodes-base.code', parameters: { jsCode: `${oldProductGreeting}\nreturn [];` } },
  { name: 'Vendas - Verificar Pos Lista', type: 'n8n-nodes-base.code', parameters: { jsCode: `${oldPostListGreeting}\nreturn [];` } },
  { name: 'Loja - Horario Atendimento', type: 'n8n-nodes-base.code', parameters: { jsCode: "const zone = 'America/Sao_Paulo'; return [];" } },
];

patchWorkflow(nodes);
const summary = summarize(nodes);
assert.equal(summary.legacyTimezoneRemoved, true);
assert.equal(summary.aiTimeRangesRemoved, true);
assert.equal(summary.aiUsesGreetingPlaceholder, true);
assert.equal(summary.centralNormalizer, true);
assert.equal(summary.centralNormalizerUsesRecife, true);
assert.equal(summary.productIgnoresCustomerPeriod, true);
assert.equal(summary.postListIgnoresCustomerPeriod, true);

const splitCode = nodes.find((node) => node.name === 'Dividir mensagens').parameters.jsCode;
function executeAt(output, iso) {
  class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [iso])); } static now() { return new Date(iso).getTime(); } }
  return vm.runInNewContext(`(function(){${splitCode}})()`, { $json: { output }, Date: FixedDate, Intl });
}

assert.equal(executeAt('Boa tarde, Luluzinha![[MSG]]Tudo bem?', '2026-07-22T11:48:00.000Z')[0].json.message, 'Bom dia, Luluzinha!');
assert.equal(executeAt('[[SAUDACAO]], Ana!', '2026-07-22T15:00:00.000Z')[0].json.message, 'Boa tarde, Ana!');
assert.equal(executeAt('👋 Bom dia, Carlos!', '2026-07-22T22:00:00.000Z')[0].json.message, '👋 Boa noite, Carlos!');
assert.equal(executeAt('Boa noite!', '2026-07-22T07:59:00.000Z')[0].json.message, 'Boa noite!');
assert.equal(executeAt('Fique a vontade para escolher.', '2026-07-22T11:48:00.000Z')[0].json.message, 'Fique a vontade para escolher.');

console.log('n8n central greeting time static checks passed');
