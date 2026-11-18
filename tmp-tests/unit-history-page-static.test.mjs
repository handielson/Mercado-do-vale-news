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
assert.match(page, /unit\.deleted && [\s\S]{0,200}cadastro deste aparelho foi apagado/);
assert.match(service, /deleted\?: boolean/);
assert.doesNotMatch(page, /product_stock_locations|stock_location_movements/);

// Atalhos: lista de unidades e itens da venda abrem a página do aparelho.
const units = read('pages/admin/inventory/SerializedUnitsPage.tsx');
const saleModal = read('components/admin/sales/SaleDetailsModal.tsx');
assert.match(units, /\/admin\/aparelhos\/\$\{[^}]*unit\.id/);
assert.match(units, /aria-label="Abrir histórico do aparelho"/);
assert.match(saleModal, /\/admin\/aparelhos\//);
assert.match(saleModal, /title="Abrir histórico do aparelho"/);

// O deploy da API sobe os módulos novos (senão o servidor não sobe numa máquina limpa).
const deploy = read('deploy-vps-server-only.cjs');
for (const mod of ['services/unitTimeline.cjs', 'services/unitTimelineServer.cjs', 'services/customerSaleVisibility.cjs']) {
  assert.match(deploy, new RegExp(`'${mod.replace(/[.\/]/g, m => '\\' + m)}'`), mod);
}

assert.match(page, /\^\\\[VPS\\\] 404\\b/);
assert.match(page, /\^\\\[VPS\\\] 40\[13\]\\b/);
console.log('unit-history-page static checks passed');
const page2 = read('pages/admin/inventory/UnitHistoryPage.tsx');
assert.match(page2, /Sua sessão expirou\. Entre de novo\./);
assert.match(page2, /STATUS_LABEL\[m\.status\]/);
console.log('ajustes parte 1 ok');
