import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/deliveryCreditService.ts', 'utf8');
const saleService = readFileSync('services/saleService.ts', 'utf8');
const teamHistory = readFileSync('components/team/TeamDeliveryHistoryTab.tsx', 'utf8');

assert.doesNotMatch(
  service,
  /from ['"]\.\/supabase['"]|supabase\.from\('delivery_credits'\)/,
  'deliveryCreditService must not use Supabase for delivery_credits',
);

assert.match(
  service,
  /\/table-data\/delivery_credits\?limit=\$\{pageSize\}&offset=\$\{offset\}/,
  'delivery credit reads should use explicit paged VPS table-data',
);

assert.match(
  service,
  /vpsClient\.post<DeliveryCredit>\('\/table-data\/delivery_credits'/,
  'delivery credit creation should use VPS table-data',
);

assert.match(
  service,
  /vpsClient\.patch<DeliveryCredit>\(`\/table-data\/delivery_credits\/\$\{id\}`/,
  'delivery credit updates should use VPS table-data',
);

assert.doesNotMatch(
  saleService,
  /\.from\('delivery_credits'\)/,
  'saleService should delegate delivery_credits writes away from Supabase',
);

assert.doesNotMatch(
  teamHistory,
  /from ['"]\.\.\/\.\.\/services\/supabase['"]|\.from\('delivery_credits'\)/,
  'TeamDeliveryHistoryTab should use deliveryCreditService instead of Supabase delivery_credits',
);

assert.match(
  teamHistory,
  /deliveryCreditService\.listByDeliveryPersonId\(/,
  'TeamDeliveryHistoryTab should load delivery credits through the VPS service',
);

assert.match(
  teamHistory,
  /deliveryCreditService\.markPaid\(/,
  'TeamDeliveryHistoryTab should mark delivery credits paid through the VPS service',
);

console.log('delivery credits VPS static checks passed');
