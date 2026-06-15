import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/admin/sales/SalesPage.tsx', 'utf8');
const detailsModal = readFileSync('components/admin/sales/SaleDetailsModal.tsx', 'utf8');

assert.doesNotMatch(source, /setDeliveryPersonName\(/, 'Sales page must not call an undeclared delivery person setter');
assert.doesNotMatch(source, /setSummary\(/, 'Sales page must not call undeclared setSummary after local summaryStats refactor');
assert.match(source, /summaryStats/, 'Sales page should use local summaryStats computed from loaded sales');
assert.match(detailsModal, /import\s+\{\s*vpsClient\s*\}\s+from ['"]\.\.\/\.\.\/\.\.\/services\/vpsClient['"]/, 'Sale details modal must import vpsClient before using it');
assert.match(detailsModal, /import\s+\{\s*teamService\s*\}\s+from ['"]\.\.\/\.\.\/\.\.\/services\/team['"]/, 'Sale details modal must import teamService before using it');
assert.match(detailsModal, /setDeliveryPersonName\(/, 'Sale details modal should load the delivery person name for receipts and delivery summaries');
assert.match(
    detailsModal,
    /const\s+\[\s*deliveryPersonName\s*,\s*setDeliveryPersonName\s*\]\s*=\s*useState\(['"`]['"`]\)/,
    'Sale details modal must declare deliveryPersonName state before using its setter'
);
