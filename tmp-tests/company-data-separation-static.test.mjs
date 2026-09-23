import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync(new URL('../pages/admin/settings/CompanyDataPage.tsx', import.meta.url), 'utf8');
const panel = fs.readFileSync(new URL('../components/company/CompanyFiscalPanel.tsx', import.meta.url), 'utf8');
const layout = fs.readFileSync(new URL('../layouts/AdminLayout.tsx', import.meta.url), 'utf8');

test('dados gerais e fiscais ficam em áreas exclusivas da mesma página', () => {
  assert.match(page, /Dados gerais e operacionais/);
  assert.match(page, /Fiscal e certificado/);
  assert.match(page, /activeArea === 'general'.*company-general-panel/s);
  assert.match(page, /activeArea === 'fiscal'.*company-fiscal-panel/s);
  assert.match(page, /activeArea === 'general' && <button[\s\S]*Salvar Alterações/);
});

test('interface identifica a fonte canônica e alerta abre diretamente a área fiscal', () => {
  assert.match(panel, /Fonte: Dados gerais e operacionais/);
  assert.match(panel, /o salvamento fiscal não substitui esses valores/);
  assert.match(layout, /\/admin\/settings\/company#fiscal/);
});
