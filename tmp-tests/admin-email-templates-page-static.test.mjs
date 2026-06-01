import fs from 'node:fs';
import assert from 'node:assert/strict';

const route = fs.readFileSync('routes/index.tsx', 'utf8');
assert.match(route, /EmailTemplatesPage/, 'router must lazy-load EmailTemplatesPage');
assert.match(route, /\/admin\/settings\/email/, 'router must expose /admin/settings/email');

const layout = fs.readFileSync('layouts/AdminLayout.tsx', 'utf8');
assert.match(layout, /Mail/, 'admin layout must import Mail icon');
assert.match(layout, /label:\s*'E-mail'/, 'admin menu must include E-mail');
assert.match(layout, /\/admin\/settings\/email/, 'admin menu must link to E-mail page');

const page = fs.readFileSync('pages/admin/settings/EmailTemplatesPage.tsx', 'utf8');
const service = fs.readFileSync('services/emailTemplatesService.ts', 'utf8');
for (const label of [
  'Compra realizada com sucesso',
  'Promocoes',
  'Itens novos',
  'Recuperacao de senha',
  'Senha alterada',
  'Confirmacao de cadastro',
]) {
  assert.match(service, new RegExp(label), `default templates must include ${label}`);
}
assert.match(page, /dangerouslySetInnerHTML/, 'page must render an HTML preview');
assert.match(page, /Criar template/, 'page must allow creating new templates');
assert.match(page, /html_body/, 'page must edit HTML body');
assert.match(page, /text_body/, 'page must edit plain-text fallback');

assert.match(service, /email_templates/, 'service must persist templates in email_templates');
assert.match(service, /DEFAULT_EMAIL_TEMPLATES/, 'service must provide default templates');
assert.match(service, /createTemplate/, 'service must expose createTemplate');
assert.match(service, /saveTemplate/, 'service must expose saveTemplate');

for (const file of ['server.js', 'vps_server.cjs', 'vps_server.js']) {
  const source = fs.readFileSync(file, 'utf8');
  assert.match(source, /CREATE TABLE IF NOT EXISTS email_templates/, `${file} must create email_templates table`);
  assert.match(source, /seedDefaultEmailTemplates/, `${file} must seed default email templates`);
}

const checklist = fs.readFileSync('migração_VPS.md', 'utf8');
assert.match(checklist, /Pagina admin de templates de e-mail/i, 'migration checklist must document admin email templates page');

console.log('admin email templates page static checks passed');
