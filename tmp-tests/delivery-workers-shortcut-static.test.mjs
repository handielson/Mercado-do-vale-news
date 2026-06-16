import fs from 'node:fs';
import assert from 'node:assert/strict';

const dashboard = fs.readFileSync('components/admin/dashboard/AdminQuickAccessGrid.tsx', 'utf8');
const customerList = fs.readFileSync('pages/customers/CustomerListPage.tsx', 'utf8');

assert.match(dashboard, /label:\s*'Entregadores'/, 'dashboard should expose an Entregadores quick access card');
assert.match(dashboard, /path:\s*'\/admin\/customers\?delivery=1'/, 'Entregadores shortcut should open customers filtered by delivery workers');

assert.match(customerList, /useLocation/, 'customer list should read the current URL');
assert.match(customerList, /new URLSearchParams\(location\.search\)/, 'customer list should parse query parameters');
assert.match(customerList, /deliveryFromQuery === '1'/, 'customer list should recognize delivery=1');
assert.match(customerList, /is_delivery_worker:\s*true/, 'customer list should apply the delivery worker filter');
assert.match(customerList, /Mostrando apenas entregadores/, 'customer list should show the active delivery filter');
assert.match(customerList, /<option value="delivery">Entregadores<\/option>/, 'customer list should expose delivery workers in the type filter');
