import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const panelPath = 'components/whatsapp/WhatsAppChatGptPanel.tsx';
const whatsappPage = readFileSync('pages/admin/settings/WhatsAppPage.tsx', 'utf8');

assert.ok(existsSync(panelPath), 'WhatsApp center must have a ChatGPT panel component');

const panel = readFileSync(panelPath, 'utf8');

[
  'WhatsAppChatGptPanel',
  'Atendente inteligente com limites',
  'Ativar ChatGPT nas respostas guiadas',
  'ai_enabled',
  'ai_model',
  'ai_daily_limit',
  'ai_monthly_limit',
  'ai_credit_balance_usd',
  'ai_credit_alert_usd',
  'ai_input_cost_per_1m_usd',
  'ai_output_cost_per_1m_usd',
  'openai_api_key',
  'openai_admin_api_key',
  'openai_api_key_masked',
  'openai_admin_api_key_masked',
  'getSettings',
  'getStats',
  'updateSettings',
  "getStats({ source: 'mysql' })",
  'settingsLoaded',
  'Carregue as configuracoes atuais antes de salvar o ChatGPT.',
  'disabled={loading || saving || !settingsLoaded}',
  'Fallback seguro',
  'Ver uso na OpenAI',
  'ChatGPT salvo na VPS',
].forEach((needle) => {
  assert.ok(panel.includes(needle), `ChatGPT panel must include ${needle}`);
});

assert.ok(
  whatsappPage.includes('WhatsAppChatGptPanel') && whatsappPage.includes('<WhatsAppChatGptPanel />'),
  'WhatsApp settings page must render the ChatGPT panel',
);

assert.doesNotMatch(panel, /from ['"][^'"]*supabase['"]|supabase\.from|createClient/);

console.log('whatsapp ChatGPT panel static checks passed');
