// Página "Aparelhos": rota, menu, service e textos que a loja usa.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = f => readFileSync(f, 'utf8');
const routes = read('routes/index.tsx');
const layout = read('layouts/AdminLayout.tsx');
const service = read('services/unitTimelineService.ts');
const page = read('pages/admin/inventory/UnitHistoryPage.tsx');

assert.match(routes, /path: "\/admin\/aparelhos"/);
assert.match(routes, /path: "\/admin\/aparelhos\/:identifier"/);
assert.match(routes, /UnitHistoryPage/);
assert.match(routes, /path: "\/admin\/aparelhos[^"]*",\s*element: \(\s*<ProtectedRoute requireAdmin=\{true\}>/);
assert.match(layout, /to: '\/admin\/aparelhos', icon: <Smartphone size=\{18\} \/>, label: 'Aparelhos'/);
assert.match(service, /\/admin\/units\/timeline\?identifier=/);
assert.match(service, /\/admin\/units\/\$\{encodeURIComponent\(clean\)\}\/timeline/);
assert.match(page, /Local não registrado/);
assert.match(page, /Nenhum aparelho com esse IMEI ou serial\./);
assert.match(page, /Ver dados técnicos/);
assert.match(page, /UnitJournalModal/);
assert.match(page, /\/admin\/sales\?sale=/);
assert.match(page, /IMEI 1, IMEI 2 ou serial/);
assert.doesNotMatch(page, /product_stock_locations|stock_location_movements/);

console.log('unit-history-page static checks passed');
