import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/pdv/PDVPage.tsx', 'utf8');

assert.match(
  source,
  /const\s+\[showSuccessModal,\s*setShowSuccessModal\]\s*=\s*useState\(false\);/,
  'PDVPage must define showSuccessModal state before using it in finalization and modal actions',
);

assert.match(
  source,
  /setShowSuccessModal\(true\);/,
  'PDV sale finalization must open the success modal after a sale is saved',
);

assert.match(
  source,
  /\{showSuccessModal && lastSaleData && \(/,
  'PDV success modal must remain gated by the success modal state and last sale data',
);

console.log('pdv success modal state OK');
