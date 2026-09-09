import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(
    source,
    /function getCustomerDeliveryReceiptOrderNumber\(job\)[\s\S]*saleId\.slice\(0, 8\)\.toUpperCase\(\)/,
    `${file} deve usar na entrega o mesmo numero exibido no comprovante`,
  );
  assert.match(
    source,
    /pedido: getCustomerDeliveryReceiptOrderNumber\(job\),/,
    `${file} deve aplicar o numero do comprovante nas mensagens da entrega`,
  );
  assert.doesNotMatch(
    source,
    /pedido: job\?*\.order_number \|\| job\?*\.sale_id \|\| '',/,
    `${file} nao deve expor o UUID completo como numero do pedido da entrega`,
  );
}

const saleId = 'a02457ec-f978-4145-83c9-2be8a21184a0';
assert.equal(saleId.slice(0, 8).toUpperCase(), 'A02457EC');

console.log('Delivery WhatsApp order number matches receipt');
