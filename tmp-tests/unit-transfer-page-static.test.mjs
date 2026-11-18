// Parte 2: telas de transferência por IMEI e conferência de saldo sem IMEI.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = f => readFileSync(f, 'utf8');
const routes = read('routes/index.tsx');
const page = read('pages/admin/inventory/UnitTransferPage.tsx');
const history = read('pages/admin/inventory/UnitHistoryPage.tsx');
const service = read('services/unitLocationService.ts');
const timelineTypes = read('services/unitTimelineService.ts');

const transferAt = routes.indexOf('path: "/admin/aparelhos/transferir"');
const identifierAt = routes.indexOf('path: "/admin/aparelhos/:identifier"');
assert.ok(transferAt > 0 && transferAt < identifierAt, 'rota de transferir vem antes da :identifier');
assert.match(routes, /UnitTransferPage/);
assert.match(page, /Transferir aparelhos/);
assert.match(page, /Bipe ou digite o IMEI ou serial/);
assert.match(page, /já está na lista/);
assert.match(page, /stockLocationService\.listDeposits\(\)/);
assert.match(page, /Transferir \$\{[^}]+\} aparelho/);
assert.match(service, /\/admin\/units\/transfers/);
assert.match(service, /\/admin\/units\/stock-mismatches/);
assert.match(history, /Produtos com saldo sem IMEI/);
assert.match(history, /to="\/admin\/aparelhos\/transferir"/);
for (const type of ['transfer', 'location_set', 'returned_to_incoming']) assert.match(timelineTypes, new RegExp(`'${type}'`));
console.log('unit-transfer-page static checks passed');
