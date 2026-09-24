const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { defaultRules, defaultGeneralDecisions, blingReference, normalizeTaxValidation, taxValidationView } = require('../services/fiscalTaxValidationCore.cjs');
const { applyOperationReviews } = require('../services/fiscalTaxValidationCore.cjs');

test('revisão individual usa identidade e horário do servidor, persiste e invalida mudanças', () => {
  const input = { ...taxValidationView(null), reviewerName: 'Contador teste', reviewerRegistration: 'CRC-TESTE' };
  input.rules[1].review = { reviewerName: 'Forjado', reviewedAt: '2000-01-01' };
  const first = applyOperationReviews(normalizeTaxValidation(input), null, 'OP01', 'user-1', new Date('2026-09-24T20:00:00Z'));
  assert.equal(first.rules[0].review.reviewedAt, '2026-09-24T20:00:00.000Z');
  assert.equal(first.rules[0].review.actor, 'user-1');
  assert.equal(first.rules[1].review, null);
  const row = { status: 'draft', reviewer_name: input.reviewerName, rules_json: JSON.stringify(first), version: 1 };
  const loaded = taxValidationView(row);
  assert.equal(loaded.rules[0].review.reviewerName, 'Contador teste');
  const second = applyOperationReviews(normalizeTaxValidation(loaded), row, 'OP02', 'user-2');
  assert.deepEqual(second.rules[0].review, first.rules[0].review);
  assert.equal(second.rules[1].review.actor, 'user-2');
  const changed = structuredClone(loaded);
  changed.rules[0].cfop = '5103';
  const invalidated = applyOperationReviews(normalizeTaxValidation(changed), row, undefined, 'user-2');
  assert.equal(invalidated.rules[0].review.outdated, true);
  assert.equal(invalidated.rules[0].review.reviewedAt, first.rules[0].review.reviewedAt);
  const general = structuredClone(loaded);
  general.generalDecisions.freightTreatment = 'Nova decisão';
  assert.equal(applyOperationReviews(normalizeTaxValidation(general), row, undefined, 'user-2').rules[0].review.outdated, true);
  assert.throws(() => applyOperationReviews(normalizeTaxValidation(input), row, 'OP99', 'user-1'), /Operação inválida/);
  assert.throws(() => applyOperationReviews(normalizeTaxValidation({ ...input, reviewerName: '' }), row, 'OP01', 'user-1'), /responsável/);
});

test('deploy da revisão envia somente seus três módulos sem migrations ou alteração de ambiente', () => {
  const script = fs.readFileSync(path.join(__dirname, '../deploy-vps-server-only.cjs'), 'utf8');
  const start = script.indexOf("if (process.argv.includes('--tax-validation-only'))");
  assert.ok(start > 0);
  const mode = script.slice(start, script.indexOf("if (process.argv.includes('--bling-stock-reconcile-only'))", start));
  assert.match(mode, /fiscalTaxValidationCore\.cjs/);
  assert.match(mode, /companyFiscalServer\.cjs/);
  assert.match(mode, /accountantPortalServer\.cjs/);
  assert.match(mode, /node --check/);
  assert.match(mode, /backups\/tax-validation/);
  assert.match(mode, /pm2 restart mdv-api/);
  assert.doesNotMatch(mode, /applyCompanyFiscalMigration|ensureRemoteAdminEnv|update-env/);
});

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
  assert(draft.approvalIssues.includes('responsável/contador'));
  assert.throws(() => normalizeTaxValidation({ status: 'reviewed', rules: defaultRules() }), /Para marcar como revisado/);
  assert.throws(() => normalizeTaxValidation({ status: 'approved', rules: defaultRules() }), /campos pendentes/);
});

test('preserva códigos NFC-e explícitos e recusa valores malformados', () => {
  const rules=defaultRules();
  rules[0]={...rules[0],source:'accountant',nfce:{unit:'UND',csosn:'400',pisCst:'07',cofinsCst:'07',cestApplicability:'required',gtinDecision:'sem_gtin'}};
  const draft=normalizeTaxValidation({status:'draft',rules});
  assert.equal(draft.rules[0].nfce.csosn,'400');
  assert.equal(draft.rules[0].nfce.gtinDecision,'sem_gtin');
  assert.throws(()=>normalizeTaxValidation({status:'draft',rules:[{...rules[0],nfce:{...rules[0].nfce,csosn:'40x'}}]}),/inválido/);
});

test('permite marcar revisado somente com responsável e data, ainda mantendo pendências fiscais', () => {
  const reviewed = normalizeTaxValidation({ status:'reviewed', reviewerName:'Contador responsável', reviewedAt:'2026-09-23', rules:defaultRules() });
  assert.equal(reviewed.status,'reviewed');
  assert.equal(reviewed.reviewIssues.length,0);
  assert(reviewed.approvalIssues.length > 0);
});

test('aprova somente matriz completa e preserva campos do contador', () => {
  const rules = defaultRules().map(rule => ({ ...rule, effectiveFrom: '2026-09-23', notes: rule.notes || 'Procedimento confirmado.' }));
  rules[0].nfce = { ...rules[0].nfce,icmsRate:'0',pisRate:'0',cofinsRate:'0' };
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
  assert.match(component, /pendência\(s\) para aprovação/);
  assert.match(component, /disabled=\{busy\|\|issues\.review\.length>0\}/);
  assert.match(server, /\/tax-validation/);
  assert.match(deploy, /021_company_fiscal_tax_validation\.sql/);
  assert.match(deploy, /022_accountant_portal\.sql/);
  assert.match(deploy, /company_accountant_access/);
  assert.match(deploy, /services\/accountantPortalServer\.cjs/);
  assert.match(deploy, /services\/blingFiscalImportCore\.cjs/);
  assert.match(deploy, /companyFiscalServicePaths[\s\S]*services\/fiscalTaxValidationCore\.cjs/);
  assert.match(deploy, /node --check \$\{appDir\}\/services\/fiscalTaxValidationCore\.cjs/);
  assert.ok((deploy.match(/applyCompanyFiscalMigration\(\{ appDir, apiProc \}\)/g) || []).length >= 4, 'o deploy completo também deve aplicar a migration fiscal');
});
