import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/admin/sales/SalesPage.tsx', 'utf8');

assert.doesNotMatch(source, /setDeliveryPersonName\(/, 'Sales page must not call an undeclared delivery person setter');
assert.doesNotMatch(source, /setSummary\(/, 'Sales page must not call undeclared setSummary after local summaryStats refactor');
assert.match(source, /summaryStats/, 'Sales page should use local summaryStats computed from loaded sales');
