import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const servicePath = 'services/whatsappAutomationTemplateService.ts';
const panelPath = 'components/whatsapp/WhatsAppAutomationTemplatesPanel.tsx';
const pagePath = 'pages/admin/settings/WhatsAppPage.tsx';
const serverPath = 'vps_server.cjs';
const deployedServerPath = 'vps_server.js';

assert.ok(existsSync(servicePath), 'WhatsApp automation template service must exist');
assert.ok(existsSync(panelPath), 'WhatsApp automation template panel must exist');

const service = readFileSync(servicePath, 'utf8');
const panel = readFileSync(panelPath, 'utf8');
const page = readFileSync(pagePath, 'utf8');
const server = readFileSync(serverPath, 'utf8');
const deployedServer = readFileSync(deployedServerPath, 'utf8');

[
  'WHATSAPP_AUTOMATION_TEMPLATE_DEFAULTS',
  'customer_registered_site',
  'customer_registered_admin',
  'sale_completed',
  'birthday_greeting',
  'delivery_out_for_delivery',
  'promotional_campaign',
  'informational_notice',
  'post_sale_followup',
  'warranty_reminder',
  'transactional',
  'promotional',
  'informational',
  'future',
  '/table-data/whatsapp_automation_templates',
  'enabled',
  'variables',
  'previewWhatsAppAutomationTemplate',
  'resetWhatsAppAutomationTemplate',
].forEach((needle) => {
  assert.ok(service.includes(needle), `template service must include ${needle}`);
});

assert.doesNotMatch(service, /from ['"][^'"]*supabase['"]|supabase\.from|createClient/, 'template service must not import or use Supabase directly');

[
  'WhatsAppAutomationTemplatesPanel',
  'Templates automaticos',
  'Transacionais',
  'Promocionais',
  'Informativos',
  'Futuros',
  'Pausar envio deste template',
  'Variaveis disponiveis',
  'Previa da mensagem',
  'Salvar template',
  'Restaurar padrao',
].forEach((needle) => {
  assert.ok(panel.includes(needle), `template panel must include ${needle}`);
});

assert.ok(
  page.includes('WhatsAppAutomationTemplatesPanel') && page.includes('<WhatsAppAutomationTemplatesPanel />'),
  'WhatsApp center must render automation templates panel',
);

[
  'CREATE TABLE IF NOT EXISTS whatsapp_automation_templates',
  "addColumnIfMissing('whatsapp_automation_templates', 'category'",
  "addColumnIfMissing('whatsapp_automation_templates', 'enabled'",
  "addColumnIfMissing('whatsapp_automation_templates', 'variables_json'",
].forEach((needle) => {
  assert.ok(server.includes(needle), `VPS server must include ${needle}`);
  assert.ok(deployedServer.includes(needle), `deployed VPS server must include ${needle}`);
});

console.log('whatsapp automation templates static checks passed');
