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
  assert.match(page, /não significa venda sem nota/);
});

test('portal identifica data e limite do status capturado do marketplace', () => {
  const server = read('services/accountantPortalServer.cjs');
  const page = read('pages/accountant/AccountantPortalPage.tsx');
  assert.match(server, /created_at AS status_captured_at/);
  assert.match(page, /Status capturado em/);
  assert.match(page, /conferir situação atual do pedido/);
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

test('importação fiscal do Bling ocorre no servidor e o painel usa total documental', () => {
  const server = read('vps_server.js');
  const routes = read('services/accountantPortalServer.cjs');
  const page = read('pages/accountant/AccountantPortalPage.tsx');
  assert.match(server, /fetchBlingFiscalDocumentsForMigrationVps/);
  assert.match(server, /importBlingDocuments: fetchBlingFiscalDocumentsForMigrationVps/);
  assert.match(server, /dataEmissaoInicial: emissionPeriod\.initial/);
  assert.match(server, /dataEmissaoFinal: emissionPeriod\.final/);
  assert.match(routes, /documents\/import-bling/);
  assert.match(page, /documentTotals\.authorizedDocumentCents/);
  assert.match(page, /Notas fiscais por canal de venda/);
  assert.match(page, /Canal não identificado/);
});
