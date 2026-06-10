import fs from 'node:fs';
import assert from 'node:assert/strict';

const serverFiles = ['vps_server.cjs', 'vps_server.js'];
const types = fs.readFileSync('types/autoResponder.ts', 'utf8');
const memoryPanel = fs.readFileSync('components/whatsapp/WhatsAppAiMemoryPanel.tsx', 'utf8');
const teachingPanel = fs.existsSync('components/whatsapp/WhatsAppAiTeachingPanel.tsx')
  ? fs.readFileSync('components/whatsapp/WhatsAppAiTeachingPanel.tsx', 'utf8')
  : '';

for (const file of serverFiles) {
  const source = fs.readFileSync(file, 'utf8');

  assert.match(source, /keywords\s+TEXT\s+NULL/i, `${file} must persist editable AI training keywords`);
  assert.match(source, /addColumnIfMissing\('autoresponder_ai_training', 'keywords'/, `${file} must migrate AI training keywords`);
  assert.match(source, /sanitizeAutoresponderAiTrainingInput[\s\S]+input\.keywords/, `${file} must sanitize AI training keywords`);
  assert.match(source, /SELECT id, title, training_type, keywords, content, priority/, `${file} must load keywords into AI context`);
  assert.match(source, /entry\.keywords/, `${file} must read keywords from training entries`);
  assert.match(source, /Palavras-chave:/, `${file} must send keywords as IA context, not fixed replies`);
}

assert.match(types, /keywords\?: string \| null/, 'AutoResponderAiTraining must include editable keywords');
assert.match(types, /keywords\?: string \| null/, 'AutoResponderAiTrainingInput must allow editable keywords');

assert.match(memoryPanel, /WhatsAppAiTeachingPanel/, 'Memoria IA page panel must render the IA teaching editor');
assert.match(teachingPanel, /Quando acionar/, 'IA teaching editor must expose keywords in plain language');
assert.match(teachingPanel, /Como a IA deve responder/, 'IA teaching editor must expose IA instruction text in plain language');
assert.match(teachingPanel, /createAiTraining/, 'IA teaching editor must create training entries');
assert.match(teachingPanel, /updateAiTraining/, 'IA teaching editor must update training entries');
assert.match(teachingPanel, /deleteAiTraining/, 'IA teaching editor must delete training entries');
assert.doesNotMatch(teachingPanel, /reply_text|resposta pronta/i, 'IA teaching editor must guide IA, not create fixed bot replies');

console.log('whatsapp IA memory training static checks passed');
