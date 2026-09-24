import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync(new URL('../pages/admin/settings/CompanyDataPage.tsx', import.meta.url), 'utf8');
const panel = fs.readFileSync(new URL('../components/company/CompanyFiscalPanel.tsx', import.meta.url), 'utf8');
const layout = fs.readFileSync(new URL('../layouts/AdminLayout.tsx', import.meta.url), 'utf8');
const identity = fs.readFileSync(new URL('../components/company/CompanyIdentitySection.tsx', import.meta.url), 'utf8');
const fiscalService = fs.readFileSync(new URL('../services/companyFiscalService.ts', import.meta.url), 'utf8');

test('dados gerais e fiscais ficam em áreas exclusivas da mesma página', () => {
  assert.match(page, /Dados gerais e operacionais/);
  assert.match(page, /Fiscal e certificado/);
  assert.match(page, /activeArea === 'general'.*company-general-panel/s);
  assert.match(page, /activeArea === 'fiscal'.*company-fiscal-panel/s);
  assert.match(page, /activeArea === 'general' && <button[\s\S]*Salvar Alterações/);
});

test('Espaço do Contador fica na navegação superior e abre faturamento e notas primeiro', () => {
  const portal = fs.readFileSync(new URL('../pages/accountant/AccountantPortalPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /role="tab" aria-selected=\{activeArea === 'accountant'\}/);
  assert.match(page, /Espaço do Contador/);
  assert.match(page, /company-accountant-panel/);
  assert.match(page, /accountantArea === 'revenue' && <RevenuePanel \/>/);
  assert.match(page, /accountantArea === 'validation' && <CompanyTaxValidationPanel \/>/);
  assert.match(page, /accountantArea === 'access' && <CompanyAccountantAccessPanel \/>/);
  assert.match(page, /#contador/);
  assert.ok(page.indexOf('Faturamento e notas') < page.indexOf('Validação contábil'));
  assert.match(portal, /export function RevenuePanel\(\)/);
  assert.match(portal, /Notas fiscais por canal de venda/);
});

test('interface identifica a fonte canônica e alerta abre diretamente a área fiscal', () => {
  assert.match(panel, /Fonte: Dados gerais e operacionais/);
  assert.match(panel, /o salvamento fiscal não substitui esses valores/);
  assert.match(layout, /\/admin\/settings\/company#fiscal/);
});

test('consulta cadastral distingue Receita Federal, provedor técnico e SEFAZ', () => {
  assert.match(panel, /Base cadastral:.*authority/);
  assert.match(panel, /Consulta direta oficial/);
  assert.match(panel, /Nenhum regime ou CRT é deduzido/);
  assert.doesNotMatch(panel, /Atualizar dados tributários/);
});

test('dados gerais usam a mesma consulta canônica do backend fiscal', () => {
  assert.match(page, /companyFiscalService\.lookupCnpj/);
  assert.doesNotMatch(page, /searchCNPJ/);
  assert.match(fiscalService, /\/admin\/cnpj-lookup\//);
  assert.match(identity, /Base cadastral:.*authority/);
  assert.match(identity, /Consulta direta oficial/);
});
