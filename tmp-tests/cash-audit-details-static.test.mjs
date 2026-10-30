import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../pages/admin/financial/CashAuditPage.tsx', import.meta.url), 'utf8');
const api = readFileSync(new URL('../vps_server.cjs', import.meta.url), 'utf8');

assert.match(page, /selected\.session\.opening_count_json/, 'auditoria precisa ler as notas e moedas registradas na abertura');
assert.match(page, /closing\.counted_count_json/, 'auditoria precisa ler a contagem de cada fechamento');
assert.match(page, /selected\.summary\.movements\.filter/, 'auditoria precisa exibir retiradas e outros movimentos do caixa');
assert.match(page, /movement\.description/, 'motivo do movimento precisa ser visivel');
assert.match(page, /closing\.report_snapshot\?\.totals\?\.by_method\s*\|\|\s*closing\.expected_by_method_json/, 'detalhes do fechamento devem usar as formas e valores gravados naquele fechamento');
assert.match(page, /CASH_METHOD_LABELS\[method\]/, 'formas de recebimento devem ter nomes legíveis');
assert.match(api, /opening_count_json: parseCashJsonColumn\(row\.opening_count_json\)/, 'API precisa devolver a contagem da abertura');
assert.match(api, /counted_count_json: parseCashJsonColumn\(row\.counted_count_json\)/, 'API precisa devolver a contagem do fechamento');

console.log('cash audit details contract passed');
