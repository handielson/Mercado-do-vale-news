import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const search = readFileSync('components/pdv/ProductSearchSection.tsx', 'utf8');

assert.match(
  search,
  /openSerializedConfirmation\(card\.product, card\.unitOptions, selectedUnit\.id, 'product'\)/,
  'generic product search must open confirmation instead of adding a serialized unit directly',
);
assert.match(
  search,
  /if \(cards\.length === 1 && options\.autoAddSingle === true\)[\s\S]{0,320}findPdvUnitOptionByIdentifier\(cards\[0\]\.unitOptions, term\)[\s\S]{0,160}addCardToCart\(cards\[0\], exactUnit\)/,
  'scanner Enter must preserve the exact scanned unit and still pass through serialized confirmation',
);
assert.match(
  search,
  /Confirme o IMEI/,
  'serialized confirmation must clearly ask the cashier to verify the IMEI',
);
assert.match(
  search,
  /Para trocar, selecione outro IMEI disponível/,
  'confirmation must explain how to change the selected IMEI',
);
assert.match(
  search,
  /pendingSerializedConfirmation\.unitOptions\.map/,
  'confirmation must list available serialized units',
);
assert.match(
  search,
  /onAddToCart\(pendingSerializedConfirmation\.product, 1, selectedUnit\.unitData\)/,
  'cart insertion must use only the unit explicitly confirmed in the modal',
);
assert.match(
  search,
  /availableUnits\.length > 1 \|\| productIds\.size > 1/,
  'exact identifier search must block ambiguous duplicate inventory rows',
);
assert.match(
  search,
  /units\.filter\(unit => unit\.status === UnitStatus\.SOLD\)/,
  'IMEI search must detect sold units before looking for an available match',
);
assert.match(
  search,
  /Aparelho já vendido/,
  'sold IMEI result must be clearly visible in the PDV',
);
assert.match(
  search,
  /href=\{`\/admin\/sales\?sale=\$\{encodeURIComponent\(notice\.saleId\)\}`\}/,
  'sold IMEI result must link directly to the matching sale details',
);
assert.match(
  search,
  /Acessar venda #\{formatReferenceNumber\(notice\.saleId\)\}/,
  'sold IMEI result must show the operator-facing sale number instead of the full UUID',
);

for (const serverFile of ['vps_server.cjs', 'vps_server.js']) {
  const server = readFileSync(serverFile, 'utf8');
  assert.match(
    server,
    /u\.status === 'sold'[\s\S]{0,100}u\.order_id \? " AND status IN \('available', 'reserved'\)" : " AND status = 'available'"/,
    `${serverFile} must atomically guard the transition to sold`,
  );
  assert.match(
    server,
    /error: 'serialized_unit_unavailable'/,
    `${serverFile} must reject an unavailable serialized unit instead of overwriting its sale`,
  );
  assert.match(
    server,
    /String\(rows\[0\]\.sale_id \|\| ''\) === String\(u\.sale_id \|\| ''\)/,
    `${serverFile} must keep same-sale retries idempotent`,
  );
}

console.log('PDV IMEI confirmation safety checks passed');
