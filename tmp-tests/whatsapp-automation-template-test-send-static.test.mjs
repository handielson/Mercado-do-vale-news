import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/whatsappAutomationTemplateService.ts', 'utf8');
const panel = readFileSync('components/whatsapp/WhatsAppAutomationTemplatesPanel.tsx', 'utf8');
const server = readFileSync('vps_server.cjs', 'utf8');
const deployedServer = readFileSync('vps_server.js', 'utf8');

for (const source of [server, deployedServer]) {
  assert.ok(source.includes("fastify.post('/whatsapp/automation/test-send'"), 'VPS must expose test send endpoint');
  assert.ok(source.includes('loadWhatsAppAutomationTestPhoneVps'), 'VPS must resolve dynamic store phone for tests');
  assert.match(source, /SELECT\s+phone\s+FROM\s+company_settings/i, 'VPS must read the test phone from company_settings');
  assert.ok(source.includes('87988032612'), 'VPS must keep the requested fallback store phone');
  assert.ok(source.includes('whatsapp_automation_test_sent'), 'VPS must log test sends distinctly');
}

assert.ok(service.includes('sendWhatsAppAutomationTemplateTest'), 'template service must expose test send function');
assert.ok(service.includes("/whatsapp/automation/test-send"), 'template service must call the VPS test endpoint');
assert.match(panel, /sendWhatsAppAutomationTemplateTest,\s*\n\s*type WhatsAppAutomationTemplate/, 'panel must import the test send service');
assert.ok(panel.includes('sendWhatsAppAutomationTemplateTest(draft)'), 'panel must call the test send service');
assert.ok(panel.includes('toast.error(message)'), 'panel must surface the browser/API error message when test send throws');
assert.ok(panel.includes('Enviar teste'), 'panel must expose a send test button');
assert.ok(panel.includes('87988032612'), 'panel must show the fallback store test phone');

console.log('whatsapp automation template test-send static checks passed');
