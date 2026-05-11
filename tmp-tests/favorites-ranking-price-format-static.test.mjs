import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = readFileSync(resolve('pages/admin/reports/FavoritesRankingReport.tsx'), 'utf8');

if (!file.includes("import { formatCurrency } from '../../../utils/saleCalculations';")) {
  throw new Error('Favorites ranking must import the shared centavos currency formatter.');
}

if (!file.includes('formatCurrency(item.price_retail || 0)')) {
  throw new Error('Favorites ranking must format price_retail as centavos.');
}

if (file.includes(".format(item.price_retail || 0)")) {
  throw new Error('Favorites ranking must not pass price_retail directly to Intl.NumberFormat.');
}

console.log('favorites ranking price format static checks passed');
