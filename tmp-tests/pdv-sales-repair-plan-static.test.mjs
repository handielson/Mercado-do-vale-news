import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pdvPage = readFileSync('pages/pdv/PDVPage.tsx', 'utf8');
const productSearch = readFileSync('components/pdv/ProductSearchSection.tsx', 'utf8');
const saleService = readFileSync('services/saleService.ts', 'utf8');
const saleDetails = readFileSync('components/admin/sales/SaleDetailsModal.tsx', 'utf8');
const salesPage = readFileSync('pages/admin/sales/SalesPage.tsx', 'utf8');
const cartShare = readFileSync('utils/cartShareUtils.ts', 'utf8');

assert.match(pdvPage, /useRef/, 'PDV must use a synchronous ref lock against duplicate finalization');
assert.match(pdvPage, /isFinalizingRef\.current \|\| isFinalizing/, 'PDV finalize must return when a sale is already being submitted');
assert.match(pdvPage, /isFinalizingRef\.current = true[\s\S]*setIsFinalizing\(true\)/, 'PDV finalize must lock before async sale creation');
assert.match(pdvPage, /finally \{[\s\S]*isFinalizingRef\.current = false[\s\S]*setIsFinalizing\(false\)/, 'PDV finalize lock must be released in finally');

assert.match(productSearch, /fromHydratedPdvSearchPayload/, 'PDV product search must normalize hydrated product/unit payloads before rendering');
assert.match(productSearch, /buildPdvSearchCards/, 'PDV product search must keep a fallback card builder for local product search results');
assert.match(productSearch, /unitService\.listByProduct/, 'PDV fallback product search must read units by product before rendering serialized identifiers');
assert.match(productSearch, /unit\.status !== UnitStatus\.AVAILABLE/, 'PDV IMEI search must reject unavailable serialized units');
assert.doesNotMatch(productSearch, /\(product as any\)\.specs\?\.imei1[\s\S]*IMEI 1:/, 'PDV result row must not render legacy specs IMEI directly');

assert.match(saleService, /export const updateSaleCostsAndProfit/, 'saleService must expose a sale-wide cost/profit recalculation action');
assert.match(saleService, /unit_cost: unitCost > 0 \? unitCost : productCost > 0 \? productCost : currentCost/, 'recalculation must prefer serialized unit cost, then current product cost, then existing sale item cost');
assert.match(saleService, /patchSale\(sale\.id,\s*\{[\s\S]*cost_total: totals\.total_cost[\s\S]*profit: totals\.profit/, 'recalculation must patch only financial totals on the sale');
assert.match(saleService, /subtotal = moneyToCents\(item\.subtotal \|\| item\.total \|\| unitPrice \* quantity \|\| 0\)/, 'sale item serialization must not persist zero subtotal when price and quantity exist');
assert.match(saleService, /rawSubtotal > 0 \? rawSubtotal : total/, 'sale item normalization must repair legacy zero subtotals on read');

assert.match(saleDetails, /updateSaleCostsAndProfit/, 'sale modal must call sale-wide cost/profit recalculation');
assert.match(saleDetails, /Atualizar Custos\/Lucro/, 'sale modal must expose the recalculation action to admins');

assert.match(salesPage, /getSaleCollectedTotal/, 'sales dashboard must use collected total helper globally');
assert.match(salesPage, /getSaleRealProfit/, 'sales dashboard must use real profit helper globally');
assert.doesNotMatch(salesPage, /sum, sale\) => sum \+ sale\.profit/, 'sales dashboard must not sum stale saved sale.profit');

assert.match(cartShare, /fetchSiblingBudgetVariantGroups/, 'budget sharing must build grouped sibling variant rows');
assert.match(cartShare, /Or.amento/, 'budget sharing must use the readable budget header');
assert.match(cartShare, /categoryRows/, 'budget sharing must flatten each available variant as its own numbered catalog row');
assert.match(cartShare, /Cart.o: 12x de/, 'budget sharing must show 12x card terms on each catalog row');
assert.match(cartShare, /Cores:/, 'budget sharing must show available colors on each catalog row');
assert.doesNotMatch(cartShare, /Opcoes disponiveis/, 'budget sharing must not nest variants under a mixed legacy block');
assert.match(cartShare, /getMemorySpecs\(product\)/, 'budget sharing must use the shared memory spec reader');

assert.match(productSearch, /card\.kind === 'serialized-product'/, 'PDV must treat cards with available units as serialized even without legacy specs');
assert.match(productSearch, /availableProducts[\s\S]*buildPdvSearchCards[\s\S]*unitService\.listByProduct/, 'PDV fallback search must inspect product units while preparing card results');
assert.doesNotMatch(productSearch, /Sem unidade disponivel/, 'PDV product result rows must fall back to SKU instead of showing a dead serialized warning');

console.log('pdv-sales repair plan static checks passed');
