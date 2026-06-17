import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/pdv/ProductSearchSection.tsx', 'utf8');
const customerSection = readFileSync('components/pdv/CustomerSection.tsx', 'utf8');
const receiptPreview = readFileSync('components/pdv/ReceiptPreview.tsx', 'utf8');
const salesSummary = readFileSync('components/pdv/SalesSummarySection.tsx', 'utf8');

assert.match(
  source,
  /buildPdvSearchCards|fromHydratedPdvSearchPayload/,
  'ProductSearchSection must render grouped PDV cards from pdvSerializedInventory',
);

assert.match(
  source,
  /selectedUnitByCardId/,
  'Serialized product cards must store the selected unit option per product card',
);

assert.match(
  source,
  /card\.unitOptions/,
  'Serialized product cards must render/select available unit options inside the product card',
);

assert.match(
  source,
  /selectedUnit\.unitData/,
  'Adding a serialized product must pass the selected unitData to the cart',
);

assert.doesNotMatch(
  source,
  /overflow-x-auto/,
  'Serialized unit selector must not require horizontal scrolling',
);

assert.doesNotMatch(
  source,
  /whitespace-nowrap/,
  'Serialized unit selector must allow long IMEI/serial values to fit the card',
);

assert.match(
  source,
  /card\.kind === 'serialized-product'[\s\S]*className="mt-3 w-full[\s\S]*option\.label/,
  'Serialized unit selector must render below the product row using the full card width',
);

assert.match(
  customerSection,
  /formatCustomerName\(selectedCustomer\.name\)/,
  'PDV selected customer card must display customer names in title case',
);

assert.match(
  receiptPreview,
  /capitalizeName\(customer\.name\)/,
  'PDV receipt preview must display customer names in title case',
);

assert.match(
  receiptPreview,
  /calculateTotalPaid\(payments\)/,
  'PDV receipt preview must use the shared payment total including credit fees',
);

assert.doesNotMatch(
  receiptPreview,
  /payments\.reduce\(\(sum,\s*p\)\s*=>\s*sum\s*\+\s*p\.amount/,
  'PDV receipt preview must not ignore total_with_fee when checking if the sale is complete',
);

assert.match(
  receiptPreview,
  /serialized_unit\?\.imei1[\s\S]*IMEI 1:/,
  'PDV receipt preview must show IMEI 1 below serialized products',
);

assert.match(
  receiptPreview,
  /serialized_unit\?\.serial[\s\S]*Serial:/,
  'PDV receipt preview must show Serial below serialized products when the selected unit has a serial',
);

assert.match(
  salesSummary,
  /capitalizeName\(customer\.name\)/,
  'PDV sale summary must display customer names in title case',
);

assert.doesNotMatch(
  source,
  /availableSerializedLines/,
  'ProductSearchSection must not keep ad-hoc serialized line maps',
);

assert.doesNotMatch(
  source,
  /join\(' \| '\)/,
  'ProductSearchSection must not join multiple serials into one product text line',
);

assert.doesNotMatch(
  source,
  /specs\.(imei|imei1|imei2|serial|serial_number)/,
  'ProductSearchSection must not render or decide serialized state from legacy specs identifiers',
);

console.log('pdv serialized inventory UI static checks passed');
