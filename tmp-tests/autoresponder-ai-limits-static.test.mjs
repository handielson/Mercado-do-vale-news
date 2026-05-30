import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /addColumnIfMissing\('autoresponder_settings', 'ai_daily_limit'/, `${file} must migrate ai_daily_limit`);
  assert.match(source, /addColumnIfMissing\('autoresponder_settings', 'ai_monthly_limit'/, `${file} must migrate ai_monthly_limit`);
  assert.match(source, /async function isAutoresponderAiLimitReached/, `${file} must check AI usage limits before calling OpenAI`);
  assert.match(source, /COUNT\(\*\) AS total[\s\S]*autoresponder_logs[\s\S]*ai_assisted = 1/, `${file} must count AI-assisted logs for limits`);
  assert.match(source, /if \(await isAutoresponderAiLimitReached\(settings\)\) return null;/, `${file} must safely skip OpenAI when a limit is reached`);
  assert.match(source, /ai_daily_limit: \(v\) => Math\.max\(0, Number\(v\) \|\| 0\)/, `${file} must allow PATCHing daily AI limit`);
  assert.match(source, /ai_monthly_limit: \(v\) => Math\.max\(0, Number\(v\) \|\| 0\)/, `${file} must allow PATCHing monthly AI limit`);
}

const types = readFileSync('types/autoResponder.ts', 'utf8');
assert.match(types, /ai_daily_limit\?: number;/, 'settings type must include ai_daily_limit');
assert.match(types, /ai_monthly_limit\?: number;/, 'settings type must include ai_monthly_limit');

const page = readFileSync('pages/admin/AutoResponderPage.tsx', 'utf8');
assert.match(page, /settingsForm\.ai_daily_limit/, 'admin page must bind daily AI limit');
assert.match(page, /settingsForm\.ai_monthly_limit/, 'admin page must bind monthly AI limit');

const checklist = readFileSync('Bot_Whatsapp.md', 'utf8');
assert.match(checklist, /- \[x\] Criar limite diário\/mensal opcional para respostas com IA/, 'checklist must mark optional AI limits as completed');

console.log('autoresponder AI limits static checks passed');
