'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
test('pedido 3D só mostra cancelamento antes de haver valor confirmado e chama a API isolada', () => {
  const source=fs.readFileSync('pages/store/Print3dOrdersPage.tsx','utf8');
  assert.match(source,/Number\(coverage\?\.confirmed_cents \?\? order\.confirmed_cents\) === 0/);
  assert.match(source,/print3dCheckoutClient\.cancel\(order\.id/);
  assert.match(source,/Cancelar pedido antes do pagamento/);
  assert.match(source,/Qualquer PIX pendente será encerrado/);
});
