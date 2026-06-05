import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['server.js', 'vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /async function buildAutoresponderAiFallbackReply\(\{ message, contactFirstName = '', settings = null \} = \{\}\)/, `${file} must build final fallback replies with AI`);
  assert.match(source, /Nenhuma resposta pronta ou produto correspondente foi encontrado/, `${file} must tell AI why it is answering`);
  assert.match(source, /Nao envie uma resposta generica pedindo modelo ou tipo de produto/, `${file} must avoid the old generic fallback style`);
  assert.match(source, /const aiFallback = await buildAutoresponderAiFallbackReply\(\{ message, contactFirstName, settings \}\);[\s\S]*?intent: 'ai_fallback'/, `${file} test reply must prefer AI fallback`);
  assert.match(source, /intent: 'ai_fallback'[\s\S]*?aiMeta: aiFallback\.aiMeta[\s\S]*?upsertAutoresponderSuccessConversation\(senderKey\)/, `${file} live webhook must log AI usage and reset fallback state`);
  assert.match(source, /const aiFallback = await buildAutoresponderAiFallbackReply[\s\S]*?const fallbackState = await getAutoresponderFallbackState/, `${file} fixed fallback must remain only as contingency after AI`);
}

console.log('autoresponder AI final fallback static checks passed');
