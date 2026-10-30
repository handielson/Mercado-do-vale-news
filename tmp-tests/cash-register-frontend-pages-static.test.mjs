import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const routes = read('routes/index.tsx');
const menu = read('layouts/AdminLayout.tsx');
const register = read('pages/admin/financial/CashRegisterPage.tsx');
const audit = read('pages/admin/financial/CashAuditPage.tsx');
const wizard = read('components/pdv/CashClosingWizard.tsx');
const denominations = read('types/cashRegister.ts');
const api = read('vps_server.cjs');

assert.match(routes, /path: "\/admin\/caixa"/, 'rota principal do caixa deve existir');
assert.match(routes, /path: "\/admin\/caixa\/auditoria"/, 'rota de auditoria deve existir');
assert.match(menu, /label: 'Caixa'/, 'menu deve expor o caixa');
assert.match(menu, /label: 'Auditoria de Caixa'/, 'menu deve expor a auditoria');
assert.match(register, /createMovement/, 'pagina de caixa deve registrar movimentos');
assert.match(register, /Registrar sangria/, 'sangria deve ter acesso direto na tela do caixa');
assert.match(register, /Destino da sangria/, 'sangria deve registrar o destino do dinheiro');
assert.match(register, /type: movementType, amount_cents: amount, description/, 'sangria deve ser enviada à API com o destino na descrição');
assert.match(audit, /Registrar sangria no caixa/, 'auditoria deve orientar onde fazer a sangria');
assert.match(api, /sangria: 'out'/, 'sangria deve reduzir o dinheiro esperado');
assert.match(api, /expectedCashCents = cashFromMethods \+ movementsInCents \+ missingOpeningFloatCents - movementsOutCents/, 'saídas devem ser abatidas do caixa');
assert.match(register, /CashClosingWizard/, 'pagina de caixa deve permitir fechamento');
assert.match(audit, /reopenSession/, 'auditoria deve permitir reabertura registrada');
assert.match(audit, /rectifySession/, 'auditoria deve permitir retificacao append-only');
assert.match(audit, /registerReprint/, 'auditoria deve registrar reimpressao');
assert.match(wizard, /CashDenominationCounter/, 'abertura e fechamento devem compartilhar o contador');
assert.match(denominations, /\[10000, 5000, 2000, 1000, 500, 200, 100, 50, 25, 10, 5\]/, 'denominacoes brasileiras devem permanecer completas');

console.log('cash register frontend pages static checks passed');
