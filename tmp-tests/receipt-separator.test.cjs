// receipt-separator-v1: todo comprovante térmico termina com o separador "----------------------------".
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

test('separador tem 28 traços', () => {
  assert.match(read('utils/receiptSeparator.ts'), /RECEIPT_SEPARATOR_TEXT = '-{28}'/);
});

for (const f of ['utils/printSaleReceipt.ts', 'utils/printMarketplaceSaleReceipt.ts', 'utils/printContaReceipt.ts', 'utils/printStandalonePixReceipt.ts']) {
  test(`${f} imprime o separador no fim`, () => {
    const s = read(f);
    assert.match(s, /import \{ RECEIPT_SEPARATOR_HTML \} from '\.\/receiptSeparator'/);
    assert.match(s, /\$\{RECEIPT_SEPARATOR_HTML\}<\/body>/);
  });
}
