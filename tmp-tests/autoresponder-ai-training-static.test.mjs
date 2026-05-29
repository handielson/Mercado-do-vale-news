import fs from 'node:fs';
import assert from 'node:assert/strict';

const serverFiles = ['vps_server.cjs', 'vps_server.js'];
const types = fs.readFileSync('types/autoResponder.ts', 'utf8');
const service = fs.readFileSync('services/autoResponderService.ts', 'utf8');
const page = fs.readFileSync('pages/admin/AutoResponderPage.tsx', 'utf8');

for (const file of serverFiles) {
  const source = fs.readFileSync(file, 'utf8');

  assert.match(source, /CREATE TABLE IF NOT EXISTS autoresponder_ai_training/, `${file} must create the VPS training table`);
  assert.match(source, /fastify\.get\('\/autoresponder\/ai-training'/, `${file} must expose GET /autoresponder/ai-training`);
  assert.match(source, /fastify\.post\('\/autoresponder\/ai-training'/, `${file} must expose POST /autoresponder/ai-training`);
  assert.match(source, /fastify\.patch\('\/autoresponder\/ai-training\/:id'/, `${file} must expose PATCH /autoresponder/ai-training/:id`);
  assert.match(source, /fastify\.delete\('\/autoresponder\/ai-training\/:id'/, `${file} must expose DELETE /autoresponder/ai-training/:id`);
  assert.match(source, /loadActiveAutoresponderAiTraining/, `${file} must load active training entries`);
  assert.match(source, /buildAutoresponderAiTrainingContext/, `${file} must format training context for OpenAI`);
  assert.match(source, /AUTORESPONDER_AI_SYSTEM_PROMPT[\s\S]+buildAutoresponderAiTrainingContext/, `${file} must keep server safety prompt separate from training context`);
  assert.doesNotMatch(source, /supabase[\s\S]{0,120}autoresponder_ai_training/i, `${file} must not store IA training in Supabase`);
}

assert.match(types, /export interface AutoResponderAiTraining/, 'types must define AutoResponderAiTraining');
assert.match(types, /export interface AutoResponderAiTrainingInput/, 'types must define AutoResponderAiTrainingInput');
assert.match(types, /export type AutoResponderAiTrainingUpdate/, 'types must define AutoResponderAiTrainingUpdate');

assert.match(service, /listAiTraining/, 'service must list IA training entries');
assert.match(service, /createAiTraining/, 'service must create IA training entries');
assert.match(service, /updateAiTraining/, 'service must update IA training entries');
assert.match(service, /deleteAiTraining/, 'service must delete IA training entries');
assert.doesNotMatch(service, /supabase\.from\(['"]autoresponder_ai_training['"]\)/, 'service must use vpsClient, not Supabase');

assert.match(page, /Treinamento IA/, 'admin page must include the Treinamento IA tab');
assert.match(page, /aiTrainingEntries/, 'admin page must keep IA training entries in state');
assert.match(page, /handleSaveAiTraining/, 'admin page must save IA training entries');
assert.match(page, /handleDeleteAiTraining/, 'admin page must delete IA training entries');
assert.match(page, /Tipo de treinamento/, 'admin page must expose the training type field');
assert.match(page, /Testar resposta/, 'admin page must let admin test responses after training changes');

console.log('autoresponder IA training static checks passed');
