import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const modal = readFileSync('components/admin/sales/SaleDetailsModal.tsx', 'utf8');
const saleService = readFileSync('services/saleService.ts', 'utf8');

assert.doesNotMatch(
  modal,
  /vpsClient\.get<any>\(`\/sales\/\$\{sale\.id\}\/profit`\)/,
  'sale modal must not depend on the missing dedicated profit endpoint',
);

assert.match(
  modal,
  /useEffect\(\(\) => \{[\s\S]*if \(!isOpen \|\| !sale\?\.id\) return;[\s\S]*updateSaleCostsAndProfit\(sale\.id\)/,
  'sale modal must refresh current costs automatically when opening a sale',
);

assert.match(
  modal,
  /Os custos salvos desta venda serao substituidos pelos custos atuais/,
  'sale modal must warn that current catalog costs replace saved sale costs',
);

assert.match(
  saleService,
  /unitCost > 0 \? unitCost : productCost > 0 \? productCost : currentCost/,
  'serialized unit cost must take priority over product cost and saved item cost',
);

assert.match(
  saleService,
  /const saleWithCurrentItemCosts = \{[\s\S]*\.\.\.sale,[\s\S]*cost_total: 0,[\s\S]*profit: 0,[\s\S]*\} as SaleWithItems;[\s\S]*getSaleCostTotal\(saleWithCurrentItemCosts\)/,
  'sale-wide recalculation must ignore the stale saved totals and sum current item costs',
);
assert.match(
  modal,
  /Custos recalculados com os valores atuais dos produtos/,
  'manual refresh must explain that current product costs were applied',
);

console.log('sale current cost refresh static checks passed');