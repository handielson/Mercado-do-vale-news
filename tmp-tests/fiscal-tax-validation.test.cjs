const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { defaultRules, defaultGeneralDecisions, blingReference, normalizeTaxValidation, taxValidationView } = require('../services/fiscalTaxValidationCore.cjs');

test('cria os dez cenários e identifica valores do Bling apenas como referência', () => {
  const rules = defaultRules();
  assert.equal(rules.length, 10);
  assert.equal(rules.find(rule => rule.id === 'OP01').cfop, '5102');
  assert.equal(rules.find(rule => rule.id === 'OP04').cfop, '6108');
  assert.equal(rules.find(rule => rule.id === 'OP01').source, 'bling_reference');
  assert.deepEqual(blingReference().natures.map(item => item.name), ['COMPRA','Devolução de produto','Simples remessa','VENDA']);
});

test('salva rascunho incompleto, mas recusa aprovação sem responsável e vigência', () => {
  const draft = normalizeTaxValidation({ status: 'draft', rules: defaultRules() });
  assert.equal(draft.status, 'draft');
  assert.throws(() => normalizeTaxValidation({ status: 'approved', rules: defaultRules() }), /campos pendentes/);
});

test('aprova somente matriz completa e preserva campos do contador', () => {
  const rules = defaultRules().map(rule => ({ ...rule, effectiveFrom: '2026-09-23', notes: rule.notes || 'Procedimento confirmado.' }));
  for (const rule of rules.filter(rule => ['OP07','OP08'].includes(rule.id))) Object.assign(rule, { cfop: 'Confirmado', icmsCode: 'Confirmado', icmsTreatment: 'Confirmado', pisCofins: 'Confirmado', ipi: 'Confirmado' });
  const generalDecisions = { ...defaultGeneralDecisions(), effectiveFrom:'2026-09-23', simplesBasis:'cash', freightTreatment:'Rateio proporcional confirmado.', productExceptions:'none', productExceptionsNotes:'O contador confirmou que não há exceções adicionais.' };
  const approved = normalizeTaxValidation({ status: 'approved', reviewerName: 'Contador responsável', reviewerRegistration: 'CRC-TESTE', reviewedAt: '2026-09-23', generalDecisions, rules });
  assert.equal(approved.status, 'approved');
  assert.equal(approved.reviewerName, 'Contador responsável');
  const view = taxValidationView({ status: 'approved', reviewer_name: approved.reviewerName, reviewer_registration: approved.reviewerRegistration, reviewed_at: approved.reviewedAt, notes: '', rules_json: JSON.stringify(approved.rules), bling_reference_json: JSON.stringify(blingReference()), version: 2, updated_at: '2026-09-23T12:00:00Z' });
  assert.equal(view.version, 2);
  assert.equal(view.rules.length, 10);
  assert.equal(view.generalDecisions.productExceptions,'pending');
});

test('exige regras detalhadas quando o contador declarar exceções por produto', () => {
  const rules = defaultRules().map(rule => ({ ...rule, effectiveFrom:'2026-09-23', notes:rule.notes || 'Confirmado', ...( ['OP07','OP08'].includes(rule.id) ? {cfop:'Confirmado',icmsCode:'Confirmado',icmsTreatment:'Confirmado',pisCofins:'Confirmado',ipi:'Confirmado'} : {} ) }));
  const generalDecisions = { ...defaultGeneralDecisions(), effectiveFrom:'2026-09-23', simplesBasis:'cash', freightTreatment:'Confirmado', productExceptions:'listed', productExceptionsNotes:'Há exceções.' };
  assert.throws(()=>normalizeTaxValidation({status:'approved',reviewerName:'Contador',reviewedAt:'2026-09-23',generalDecisions,rules,productRules:[]}),/ao menos uma regra/);
});

test('painel, rotas, migration e deploy permanecem conectados', () => {
  const root = path.resolve(__dirname, '..');
  const page = fs.readFileSync(path.join(root, 'pages/admin/settings/CompanyDataPage.tsx'), 'utf8');
  const component = fs.readFileSync(path.join(root, 'components/company/CompanyTaxValidationPanel.tsx'), 'utf8');
  const server = fs.readFileSync(path.join(root, 'services/companyFiscalServer.cjs'), 'utf8');
  const deploy = fs.readFileSync(path.join(root, 'deploy-vps-server-only.cjs'), 'utf8');
  assert.match(page, /<CompanyTaxValidationPanel\s*\/>/);
  assert.match(component, /Aprovar para implementação/);
  assert.match(server, /\/tax-validation/);
  assert.match(deploy, /021_company_fiscal_tax_validation\.sql/);
  assert.match(deploy, /companyFiscalServicePaths[\s\S]*services\/fiscalTaxValidationCore\.cjs/);
  assert.match(deploy, /node --check \$\{appDir\}\/services\/fiscalTaxValidationCore\.cjs/);
  assert.ok((deploy.match(/applyCompanyFiscalMigration\(\{ appDir, apiProc \}\)/g) || []).length >= 4, 'o deploy completo também deve aplicar a migration fiscal');
});
