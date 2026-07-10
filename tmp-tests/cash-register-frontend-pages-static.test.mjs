import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const routes = read('routes/index.tsx');
const menu = read('layouts/AdminLayout.tsx');
const register = read('pages/admin/financial/CashRegisterPage.tsx');
const audit = read('pages/admin/financial/CashAuditPage.tsx');
const wizard = read('components/pdv/CashClosingWizard.tsx');
const denominations = read('types/cashRegister.ts');

assert.match(routes, /path: "\/admin\/caixa"/, 'rota principal do caixa deve existir');
assert.match(routes, /path: "\/admin\/caixa\/auditoria"/, 'rota de auditoria deve existir');
assert.match(menu, /label: 'Caixa'/, 'menu deve expor o caixa');
assert.match(menu, /label: 'Auditoria de Caixa'/, 'menu deve expor a auditoria');
assert.match(register, /createMovement/, 'pagina de caixa deve registrar movimentos');
assert.match(register, /CashClosingWizard/, 'pagina de caixa deve permitir fechamento');
assert.match(audit, /reopenSession/, 'auditoria deve permitir reabertura registrada');
assert.match(audit, /rectifySession/, 'auditoria deve permitir retificacao append-only');
assert.match(audit, /registerReprint/, 'auditoria deve registrar reimpressao');
assert.match(wizard, /CashDenominationCounter/, 'abertura e fechamento devem compartilhar o contador');
assert.match(denominations, /\[10000, 5000, 2000, 1000, 500, 200, 100, 50, 25, 10, 5\]/, 'denominacoes brasileiras devem permanecer completas');

console.log('cash register frontend pages static checks passed');
