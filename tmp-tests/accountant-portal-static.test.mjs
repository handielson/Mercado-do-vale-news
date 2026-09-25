import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('portal possui rota restrita e não usa layout administrativo', () => {
  const routes = read('routes/index.tsx');
  const page = read('pages/accountant/AccountantPortalPage.tsx');
  assert.match(routes, /path: "\/contador"/);
  assert.match(routes, /AccountantProtectedRoute/);
  assert.doesNotMatch(page, /AdminLayout/);
});

test('API exige permissão por empresa e separa permissões', () => {
  const server = read('services/accountantPortalServer.cjs');
  assert.match(server, /customer_id=\? AND is_active=1/);
  assert.match(server, /can_edit_tax_validation/);
  assert.match(server, /can_view_revenue/);
  assert.match(server, /A validação foi alterada em outra sessão/);
  const proxy = read('vps_server.js');
  assert.match(proxy, /pathname === '\/accountant\/companies'/);
  assert.match(proxy, /accountant\\\/companies/);
});

test('relatório nunca chama ausência de vínculo de venda sem nota', () => {
  const core = read('services/accountantPortalCore.cjs');
  const page = read('pages/accountant/AccountantPortalPage.tsx');
  assert.match(core, /reconciliation_pending/);
  assert.match(core, /no_invoice_confirmed/);
  assert.match(page, /não confirma venda sem nota/);
});

test('portal identifica data e limite do status capturado do marketplace', () => {
  const server = read('services/accountantPortalServer.cjs');
  const page = read('pages/accountant/AccountantPortalPage.tsx');
  assert.match(server, /created_at AS status_captured_at/);
  assert.match(page, /Status capturado em/);
  assert.match(page, /conferir situação atual do pedido/);
});

test('fila distingue pedido fora do período dos totais operacionais', () => {
  const server = read('services/accountantPortalServer.cjs');
  const page = read('pages/accountant/AccountantPortalPage.tsx');
  assert.match(server, /reviewSales: \[\.\.\.report\.reviewSales, \.\.\.crossPeriodSales\]/);
  assert.match(page, /não entram nos totais operacionais do período/);
  assert.match(page, /Pedido criado fora do período selecionado/);
  assert.match(page, /const reportDate = .*timeZone: 'UTC'/);
  assert.match(page, /Pedido criado em \{reportDate\(sale\.occurredAt\)\}/);
  assert.match(page, /\{reportDate\(document\.issuedAt\)\}/);
});

test('consulta da situação de NF-e na SEFAZ passa pela concessão do contador e mantém a resposta somente para leitura', () => {
  const server = read('services/accountantPortalServer.cjs');
  const page = read('pages/accountant/AccountantPortalPage.tsx');
  assert.match(server, /fiscal-documents\/:documentId\/sefaz-status/);
  assert.match(server, /preHandler: requireCompanyAccess\('revenue'\)/);
  assert.match(page, /Consultar situação da NF-e na SEFAZ-PE/);
  assert.match(page, /A resposta não altera a nota importada/);
});

test('revisão do contador fica por documento, com auditoria e sem efeito fiscal automático', () => {
  const route = read('services/accountantPortalServer.cjs');
  const component = read('components/company/FiscalDocumentReviewPanel.tsx');
  const migration = read('migrations/024_fiscal_document_review.sql');
  const deploy = read('deploy-vps-server-only.cjs');
  assert.match(route, /fiscal-documents\/:documentId\/review/);
  assert.match(route, /preHandler: requireCompanyAccess\('edit'\)/);
  assert.match(route, /document_review_save/);
  assert.match(component, /A revisão não cancela, devolve ou corrige a nota/);
  assert.match(migration, /UNIQUE KEY uniq_company_document_review \(profile_id, document_id\)/);
  assert.match(deploy, /024_fiscal_document_review\.sql/);
  assert.match(deploy, /services\/fiscalDocumentReviewCore\.cjs/);
});

test('migração cria concessão, documentos e conciliação isolados por perfil', () => {
  const migration = read('migrations/022_accountant_portal.sql');
  assert.match(migration, /company_accountant_access/);
  assert.match(migration, /company_fiscal_documents/);
  assert.match(migration, /company_fiscal_sale_reconciliations/);
  assert.match(migration, /UNIQUE KEY uniq_company_accountant_profile_customer \(profile_id, customer_id\)/);
  assert.match(migration, /uniq_company_fiscal_source_document/);
});

test('login encaminha contador autorizado e a loja oferece acesso ao portal', () => {
  const service = read('services/accountantPortalService.ts');
  const login = read('pages/auth/ClienteLoginPage.tsx');
  const callback = read('pages/auth/AuthCallbackPage.tsx');
  const header = read('components/PublicHeader.tsx');
  const authContext = read('contexts/VpsAuthContext.tsx');
  assert.match(service, /requestedPath !== '\/' \|\| customerType === 'ADMIN'/);
  assert.match(service, /result\.companies\.length > 0 \? '\/contador'/);
  assert.match(login, /signInWithEmail\(email, password\)[\s\S]*resolveAccountantLandingPath\(nextPath, customer\.customer_type\)/);
  assert.match(login, /signInWithCpf\(cpf, password\)[\s\S]*resolveAccountantLandingPath\(nextPath, customer\.customer_type\)/);
  assert.match(callback, /resolveAccountantLandingPath\(safeNext, session\.customer\.customer_type\)/);
  assert.match(header, /hasAccountantAccess[\s\S]*to="\/contador"/);
  assert.match(header, /to="\/cliente\/login\?next=\/contador"/);
  assert.match(authContext, /return session\.customer/);
});

test('migration alinha collation do contador com customers e deploy valida o schema', () => {
  const migration = read('migrations/023_accountant_customer_collation.sql');
  const deploy = read('deploy-vps-server-only.cjs');
  assert.match(migration, /MODIFY customer_id VARCHAR\(80\)/);
  assert.match(migration, /COLLATE utf8mb4_unicode_ci/);
  assert.match(deploy, /023_accountant_customer_collation\.sql/);
  assert.match(deploy, /Accountant customer ID collation mismatch/);
});

test('importação fiscal do Bling ocorre no servidor e o painel não apresenta cobertura parcial como total', () => {
  const server = read('vps_server.js');
  const routes = read('services/accountantPortalServer.cjs');
  const page = read('pages/accountant/AccountantPortalPage.tsx');
  const layout = read('layouts/AdminLayout.tsx');
  assert.match(server, /fetchBlingFiscalDocumentsForMigrationVps/);
  assert.match(server, /importBlingDocuments: fetchBlingFiscalDocumentsForMigrationVps/);
  assert.match(server, /dataEmissaoInicial: emissionPeriod\.initial/);
  assert.match(server, /dataEmissaoFinal: emissionPeriod\.final/);
  assert.match(routes, /documents\/import-bling/);
  assert.match(page, /documentTotals\.authorizedDocumentCount/);
  assert.match(page, /Esse número não representa todas as notas emitidas no Bling/);
  assert.match(page, /Notas fiscais cadastradas neste sistema/);
  assert.match(page, /Canal não identificado/);
  assert.match(page, /aria-modal="true"/);
  assert.match(page, /event\.key === 'Escape'/);
  assert.match(page, /matchingSales\.slice\(0, visibleSaleCount\)/);
  assert.match(layout, /import \{[^}]*AlertTriangle[^}]*\} from 'lucide-react'/);
});

test('prévia fiscal começa em um dia e orienta divisão quando passa de 120 notas', () => {
  const panel = read('components/company/CompanyAccountantAccessPanel.tsx');
  const core = read('services/blingFiscalImportCore.cjs');
  assert.match(panel, /\[importFrom, setImportFrom\] = useState\(localToday\)/);
  assert.match(panel, /\[importTo, setImportTo\] = useState\(localToday\)/);
  assert.match(panel, /detail\.includes\('Período com notas demais'\)/);
  assert.match(panel, /setImportTo\(importFrom\)/);
  assert.match(panel, /Ir para o próximo dia/);
  assert.match(panel, /setPreview\(null\)/);
  assert.match(core, /maxDocuments = 120/);
});
