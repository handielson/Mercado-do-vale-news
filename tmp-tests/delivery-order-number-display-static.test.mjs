import assert from 'node:assert/strict';
import fs from 'node:fs';

const deliveryTab = fs.readFileSync('components/customer/profile/DeliveryWorkerTab.tsx', 'utf8');
const deliveryPage = fs.readFileSync('pages/delivery/DeliveryOperationPage.tsx', 'utf8');
const vpsServer = fs.readFileSync('vps_server.js', 'utf8');
const vpsServerCjs = fs.readFileSync('vps_server.cjs', 'utf8');

assert.match(
  deliveryTab,
  /function formatDeliveryOrderNumber/,
  'DeliveryWorkerTab deve formatar o numero do pedido antes de renderizar'
);
assert.match(
  deliveryTab,
  /getDeliveryJobOrderNumber\(job\)/,
  'Entregas em aberto devem usar helper de numero do pedido'
);
assert.match(
  deliveryTab,
  /getDeliveryLedgerOrderNumber\(item\)/,
  'Historico de entregas deve usar helper de numero do pedido'
);
assert.match(
  deliveryTab,
  /getDeliveryLedgerDescription\(item\)/,
  'Descricao antiga do historico nao deve mostrar UUID completo quando mencionar pedido'
);
assert.doesNotMatch(
  deliveryTab,
  /Pedido \{job\.order_number \|\| job\.sale_id\}/,
  'Entregas em aberto nao devem renderizar UUID cru como numero do pedido'
);
assert.doesNotMatch(
  deliveryTab,
  /Pedido \{item\.order_number \|\| item\.sale_id\}/,
  'Historico de entregas nao deve renderizar UUID cru como numero do pedido'
);
assert.match(
  deliveryTab,
  /uuidMatch/,
  'Helper deve reconhecer UUID para exibir apenas o prefixo amigavel do pedido'
);

assert.match(
  deliveryPage,
  /function formatDeliveryOrderNumber/,
  'Tela publica da entrega deve compartilhar a formatacao amigavel do pedido'
);
assert.match(
  deliveryPage,
  /Pedido \{getDeliveryJobOrderNumber\(job\)\}/,
  'Tela publica da entrega nao deve exibir UUID completo no titulo'
);
assert.doesNotMatch(
  deliveryPage,
  /Pedido \{job\.order_number \|\| job\.sale_id\}/,
  'Tela publica da entrega nao deve renderizar fallback cru no titulo'
);

for (const [label, source] of [['vps_server.js', vpsServer], ['vps_server.cjs', vpsServerCjs]]) {
  assert.match(
    source,
    /fastify\.patch\('\/admin\/delivery\/jobs\/:jobId\/amount', \{ preHandler: requireSyncKey \}/,
    `${label} deve expor rota administrativa protegida para corrigir valor de entrega`
  );
  assert.match(
    source,
    /UPDATE customer_delivery_jobs\s+SET delivery_amount = \?, payment_amount = \?, updated_at = CURRENT_TIMESTAMP\s+WHERE id = \?/,
    `${label} deve atualizar apenas valor de entrega e pagamento do job escolhido`
  );
}
