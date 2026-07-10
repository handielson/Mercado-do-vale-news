import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pdv = readFileSync(new URL('../pages/pdv/PDVPage.tsx', import.meta.url), 'utf8');
const saleTypes = readFileSync(new URL('../types/sale.ts', import.meta.url), 'utf8');
const saleService = readFileSync(new URL('../services/saleService.ts', import.meta.url), 'utf8');

assert.match(pdv, /useCashSession\(\)/, 'PDV deve consultar a sessao de caixa');
assert.match(pdv, /await refreshCashSession\(\)/, 'PDV deve revalidar o caixa imediatamente antes da venda');
assert.match(pdv, /cash_session_id:\s*activeCashSession\.id/, 'venda deve receber a sessao ativa');
assert.match(pdv, /seller_id:\s*user\?\.id/, 'venda deve registrar o operador autenticado');
assert.match(pdv, /CashOpeningModal/, 'PDV deve oferecer abertura quando nao houver caixa');
assert.match(saleTypes, /cash_session_id\?: string \| null/, 'contrato da venda deve aceitar cash_session_id');
assert.match(saleService, /cash_session_id:\s*saleInput\.cash_session_id \|\| null/, 'servico deve persistir cash_session_id');

console.log('cash register PDV gate static checks passed');
