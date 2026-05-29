import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pageSource = readFileSync('pages/admin/AutoResponderPage.tsx', 'utf8');
const typesSource = readFileSync('types/autoResponder.ts', 'utf8');
const serverFiles = ['vps_server.cjs', 'vps_server.js'];

assert.ok(pageSource.includes("id: 'fluxos'"), 'AutoResponder admin must expose a Fluxos tab');
assert.ok(pageSource.includes('Fluxos de conversa'), 'Fluxos tab must have a clear title');
assert.ok(pageSource.includes('Preview da conversa'), 'Fluxos tab must show a conversation preview');
assert.ok(pageSource.includes('conversation_flow_keywords'), 'Fluxos tab must edit persisted flow keywords');
assert.ok(pageSource.includes('conversation_flow_messages'), 'Fluxos tab must edit persisted flow messages');
assert.ok(pageSource.includes('Saudacao inicial'), 'Fluxos tab must include the initial greeting step');
assert.ok(pageSource.includes('Atendimento pelo WhatsApp'), 'Fluxos tab must present the full WhatsApp conversation flow');
assert.ok(pageSource.includes('settingsForm.conversation_flow_keywords.phone_list_opt_in'), 'phone list opt-in keywords must be edited in context');
assert.ok(pageSource.includes('IA na linha de frente'), 'Fluxos tab must make the AI-first mode visible');
assert.ok(pageSource.includes('Cliente pode responder'), 'Fluxos layout must present expected customer replies like chat context');

assert.ok(
  typesSource.includes('conversation_flow_keywords'),
  'AutoResponderSettings must type conversation flow keywords'
);
assert.ok(
  typesSource.includes('conversation_flow_messages'),
  'AutoResponderSettings must type conversation flow messages'
);

for (const fileName of serverFiles) {
  const source = readFileSync(fileName, 'utf8');

  assert.ok(
    source.includes('conversation_flow_keywords: (v) => jsonStr(normalizeAutoresponderConversationFlowKeywords(v))'),
    `${fileName} must persist normalized conversation flow keywords`
  );
  assert.ok(
    source.includes('conversation_flow_messages: (v) => jsonStr(normalizeAutoresponderConversationFlowMessages(v))'),
    `${fileName} must persist normalized conversation flow messages`
  );

  assert.ok(
    source.includes('function getAutoresponderConversationFlowKeywords(settings, flowKey)'),
    `${fileName} must read flow-specific keywords from settings`
  );

  assert.ok(
    source.includes("getAutoresponderConversationFlowKeywords(settings, 'phone_list_opt_in')"),
    `${fileName} must use phone-list flow keywords for the greeting follow-up`
  );

  assert.ok(
    source.includes('async function classifyAutoresponderNeedsPromptReplyWithAi({'),
    `${fileName} must use AI as a fallback classifier for ambiguous replies`
  );

  assert.ok(
    source.includes("classification === 'phone_list_opt_in'"),
    `${fileName} must route AI-confirmed list intent to the phone catalog`
  );

  assert.ok(
    source.includes("await addColumnIfMissing('autoresponder_settings', 'conversation_flow_keywords'"),
    `${fileName} must migrate the conversation_flow_keywords settings column`
  );
  assert.ok(
    source.includes("await addColumnIfMissing('autoresponder_settings', 'conversation_flow_messages'"),
    `${fileName} must migrate the conversation_flow_messages settings column`
  );
}

console.log('autoresponder conversation flows static checks passed');
