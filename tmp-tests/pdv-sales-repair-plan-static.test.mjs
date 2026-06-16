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

assert.match(productSearch, /availableSerializedLines/, 'PDV product search must keep available serialized unit labels separate from legacy specs');
assert.match(productSearch, /unitService\.listByProduct\(product\.id\)/, 'PDV product search must read units by product before rendering serialized identifiers');
assert.match(productSearch, /unit\.status === UnitStatus\.AVAILABLE/, 'PDV product search must display only available serialized units');
assert.doesNotMatch(productSearch, /\(product as any\)\.specs\?\.imei1[\s\S]*IMEI 1:/, 'PDV result row must not render legacy specs IMEI directly');

assert.match(saleService, /export const updateSaleCostsAndProfit/, 'saleService must expose a sale-wide cost/profit recalculation action');
assert.match(saleService, /unitCostById[\s\S]*productCostById[\s\S]*currentCost/, 'recalculation must prefer unit cost, then product cost, then existing sale item cost');
assert.match(saleService, /patchSale\(sale\.id,\s*\{[\s\S]*cost_total: totals\.total_cost[\s\S]*profit: totals\.profit/, 'recalculation must patch only financial totals on the sale');
assert.match(saleService, /subtotal = moneyToCents\(item\.subtotal \|\| item\.total \|\| unitPrice \* quantity \|\| 0\)/, 'sale item serialization must not persist zero subtotal when price and quantity exist');
assert.match(saleService, /rawSubtotal > 0 \? rawSubtotal : total/, 'sale item normalization must repair legacy zero subtotals on read');

assert.match(saleDetails, /updateSaleCostsAndProfit/, 'sale modal must call sale-wide cost/profit recalculation');
assert.match(saleDetails, /Atualizar Custos\/Lucro/, 'sale modal must expose the recalculation action to admins');

assert.match(salesPage, /getSaleCollectedTotal/, 'sales dashboard must use collected total helper globally');
assert.match(salesPage, /getSaleRealProfit/, 'sales dashboard must use real profit helper globally');
assert.doesNotMatch(salesPage, /sum, sale\) => sum \+ sale\.profit/, 'sales dashboard must not sum stale saved sale.profit');

assert.match(cartShare, /fetchSiblingBudgetVariantGroups/, 'budget sharing must build grouped sibling variant rows');
assert.match(cartShare, /Opcoes disponiveis/, 'budget sharing must list grouped variant options');
assert.match(cartShare, /getSpecValue\(specs, \['storage', 'armazenamento', 'capacidade', 'memoria', 'memoria_interna', 'memory'\]\)/, 'budget sharing must support legacy storage aliases');

console.log('pdv-sales repair plan static checks passed');
