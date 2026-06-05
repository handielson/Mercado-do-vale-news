import fs from 'node:fs';
import assert from 'node:assert/strict';

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const source = fs.readFileSync(file, 'utf8');

  assert.match(source, /async function buildAutoresponderAiFirstReply/, `${file} must include the ChatGPT-first reply helper`);
  assert.match(source, /function shouldAutoresponderTryAiFirst/, `${file} must guard when ChatGPT answers first`);
  assert.match(source, /Se a mensagem tiver mais de uma pergunta, responda todas as perguntas/, `${file} must tell ChatGPT to answer multiple questions`);
  assert.match(source, /handleAutoresponderEngineDeliveryFlowV2/, `${file} must route delivery questions through the engine`);
  assert.match(source, /conversation_state: deliveryReply\.nextState/, `${file} must persist delivery conversation_state`);
  assert.doesNotMatch(source, /status: 'awaiting_standalone_delivery_cep'/, `${file} must not save legacy standalone CEP state`);

  const webhookIndex = source.indexOf("url: '/autoresponder-webhook'");
  const deliveryEngineIndex = source.indexOf('const engineDeliveryReply = await handleAutoresponderEngineDeliveryFlowV2', webhookIndex);
  const aiFirstIndex = source.indexOf('shouldAutoresponderTryAiFirst({ message, detectedIntent, purchaseFlow })', deliveryEngineIndex);
  const ruleIndex = source.indexOf('const matchedRule = await findAutoresponderRuleMatch(message);', aiFirstIndex);

  assert(
    webhookIndex >= 0 &&
      deliveryEngineIndex > webhookIndex &&
      aiFirstIndex > deliveryEngineIndex &&
      ruleIndex > aiFirstIndex,
    `${file} must handle delivery engine before ChatGPT-first and fixed rules`
  );
}

console.log('autoresponder AI-first delivery CEP static checks passed');
