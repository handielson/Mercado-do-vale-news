import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const servers = ['vps_server.js', 'vps_server.cjs'].map((file) => ({
  file,
  source: readFileSync(file, 'utf8'),
}));
const receipt = readFileSync('utils/printSaleReceipt.ts', 'utf8');

assert.match(
  receipt,
  /sale\.id\.slice\(0, 8\)\.toUpperCase\(\)/,
  'o comprovante deve exibir os oito primeiros caracteres do ID em maiusculas',
);

for (const { file, source } of servers) {
  assert.match(
    source,
    /const receiptOrderNumber = String\(sale\.id \|\| ''\)\.trim\(\)\.slice\(0, 8\)\.toUpperCase\(\);/,
    `${file} deve calcular o mesmo numero exibido no comprovante`,
  );
  assert.match(
    source,
    /pedido: receiptOrderNumber,/,
    `${file} deve enviar o numero do comprovante no template de venda`,
  );
  assert.doesNotMatch(
    source,
    /pedido: sale\.order_number \|\| sale\.id,/,
    `${file} nao deve enviar o UUID completo da venda`,
  );
}

const sampleSaleId = '1221cc93-f015-4dc1-ab9e-7eb501e6e130';
assert.equal(sampleSaleId.slice(0, 8).toUpperCase(), '1221CC93');

console.log('WhatsApp sale order number matches receipt');
