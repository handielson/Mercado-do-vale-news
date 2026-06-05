import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readBotWhatsappDoc } from '../tools/autoresponder-bot-doc.cjs';

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /addColumnIfMissing\('autoresponder_settings', 'ai_credit_balance_usd'/, `${file} must migrate manual AI credit balance`);
  assert.match(source, /addColumnIfMissing\('autoresponder_settings', 'ai_credit_alert_usd'/, `${file} must migrate AI credit alert threshold`);
  assert.match(source, /addColumnIfMissing\('autoresponder_settings', 'ai_input_cost_per_1m_usd'/, `${file} must migrate input token price`);
  assert.match(source, /addColumnIfMissing\('autoresponder_settings', 'ai_output_cost_per_1m_usd'/, `${file} must migrate output token price`);
  assert.match(source, /addColumnIfMissing\('autoresponder_settings', 'openai_admin_api_key'/, `${file} must migrate OpenAI admin key`);
  assert.match(source, /addColumnIfMissing\('autoresponder_logs', 'ai_estimated_cost_usd'/, `${file} must migrate estimated AI cost on logs`);
  assert.match(source, /calculateAutoresponderAiEstimatedCostUsd/, `${file} must calculate estimated AI cost from token usage`);
  assert.match(source, /fetchOpenAiOfficialCostsUsd/, `${file} must fetch official OpenAI costs`);
  assert.match(source, /https:\/\/api\.openai\.com\/v1\/organization\/costs/, `${file} must call the official OpenAI costs endpoint`);
  assert.match(source, /OPENAI_ADMIN_KEY/, `${file} must allow an OpenAI admin key from the VPS environment`);
  assert.match(source, /ai_estimated_cost_usd/, `${file} must persist and expose estimated AI cost`);
  assert.match(source, /SUM\(ai_estimated_cost_usd\)[\s\S]*AS month_estimated_cost_usd/, `${file} must include monthly estimated AI spend`);
  assert.match(source, /openai_official_month_cost_usd/, `${file} must expose official monthly OpenAI spend`);
  assert.match(source, /openai_official_remaining_credit_usd/, `${file} must expose official remaining credit estimate`);
  assert.match(source, /remaining_credit_usd/, `${file} must expose estimated remaining AI credit`);
}

const types = readFileSync('types/autoResponder.ts', 'utf8');
assert.match(types, /ai_credit_balance_usd\?: number;/, 'settings type must include manual credit balance');
assert.match(types, /ai_credit_alert_usd\?: number;/, 'settings type must include alert threshold');
assert.match(types, /ai_input_cost_per_1m_usd\?: number;/, 'settings type must include input price');
assert.match(types, /ai_output_cost_per_1m_usd\?: number;/, 'settings type must include output price');
assert.match(types, /openai_admin_api_key\?: string;/, 'settings type must include OpenAI admin key input');
assert.match(types, /has_openai_admin_api_key\?: boolean \| number;/, 'settings type must expose OpenAI admin key status');
assert.match(types, /openai_admin_api_key_masked\?: string;/, 'settings type must expose masked OpenAI admin key');
assert.match(types, /ai_finance\?:/, 'stats type must include AI finance summary');
assert.match(types, /openai_official_month_cost_usd\?: number;/, 'stats type must include official OpenAI monthly cost');
assert.match(types, /openai_official_remaining_credit_usd\?: number;/, 'stats type must include official OpenAI remaining credit');

const page = readFileSync('pages/admin/AutoResponderPage.tsx', 'utf8');
assert.match(page, /Controle financeiro da IA/, 'admin page must show an AI finance section');
assert.match(page, /Resumo financeiro da IA/, 'admin page must show a visible AI finance summary near the top');
assert.match(page, /Saldo oficial estimado/, 'admin page must show official remaining credit');
assert.match(page, /Gasto oficial OpenAI/, 'admin page must show official OpenAI spend');
assert.match(page, /href="\?aba=configuracoes#controle-financeiro-ia"/, 'admin page must offer a direct shortcut to detailed AI finance settings');
assert.match(page, /Intl\.NumberFormat\('pt-BR'[\s\S]*?currency: 'USD'/, 'admin page must format USD values in a readable currency format');
assert.match(page, /settingsForm\.ai_credit_balance_usd/, 'admin page must bind credit balance');
assert.match(page, /settingsForm\.ai_credit_alert_usd/, 'admin page must bind alert threshold');
assert.match(page, /settingsForm\.openai_admin_api_key/, 'admin page must bind OpenAI admin key');
assert.match(page, /Chave Admin OpenAI/, 'admin page must label the OpenAI admin key separately');
assert.match(page, /stats\?\.summary\?\.ai_finance/, 'admin page must read AI finance summary from stats');

const checklist = readBotWhatsappDoc();
assert.match(checklist, /- \[x\] Criar controle financeiro estimado de tokens\/créditos da IA/, 'checklist must mark AI finance control as completed');

console.log('autoresponder AI finance static checks passed');
