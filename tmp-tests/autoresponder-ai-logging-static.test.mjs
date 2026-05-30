import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /addColumnIfMissing\('autoresponder_logs', 'ai_assisted'/, `${file} must migrate ai_assisted on autoresponder_logs`);
  assert.match(source, /addColumnIfMissing\('autoresponder_logs', 'ai_model'/, `${file} must migrate ai_model on autoresponder_logs`);
  assert.match(source, /addColumnIfMissing\('autoresponder_logs', 'ai_input_tokens'/, `${file} must migrate ai_input_tokens on autoresponder_logs`);
  assert.match(source, /addColumnIfMissing\('autoresponder_logs', 'ai_output_tokens'/, `${file} must migrate ai_output_tokens on autoresponder_logs`);
  assert.match(source, /normalizeAutoresponderOpenAiUsage/, `${file} must normalize OpenAI usage before logging`);
  assert.match(source, /ai_assisted, ai_model, ai_input_tokens, ai_output_tokens/, `${file} must insert AI metadata into autoresponder_logs`);
  assert.match(source, /aiMeta: needsPrompt\.aiMeta/, `${file} must carry AI metadata from the needs prompt reply`);
  assert.match(source, /aiMeta: greetingNeedsPrompt\.aiMeta/, `${file} must log greeting AI metadata in the webhook flow`);
}

const checklist = readFileSync('Bot_Whatsapp.md', 'utf8');
assert.match(checklist, /- \[x\] Criar log específico quando a resposta usar IA/, 'checklist must mark AI logging as completed');
assert.match(checklist, /- \[x\] Registrar consumo aproximado de tokens por resposta quando a OpenAI devolver uso/, 'checklist must mark AI token logging as completed');

console.log('autoresponder AI logging static checks passed');
