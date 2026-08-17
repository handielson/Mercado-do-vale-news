import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync('vps_server.js', 'utf8');
const orderService = readFileSync('services/orderService.ts', 'utf8');

assert.ok(server.includes("/^\\/orders\\/[^/]+\\/payments\\/mercado-pago\\/card$/u"), 'o proxy deve permitir somente o endpoint específico do cartão para o dono do pedido');
assert.match(server, /fastify\.post\('\/orders\/:orderId\/payments\/mercado-pago\/card'[\s\S]*?requireSyncKeyOrCustomer/, 'a cobrança deve exigir cliente autenticado ou serviço interno');
assert.match(server, /String\(order\.customer_id \|\| ''\) !== String\(access\.customerId \|\| ''\)/, 'a API deve bloquear cobrança de pedido de outro cliente');
assert.match(server, /Authorization: `Bearer \$\{accessToken\}`/, 'somente a API pode usar o access token do Mercado Pago');
assert.match(server, /processOrderReservation\(order\.id, 'consume'/, 'pagamento aprovado deve consumir a reserva de estoque');
assert.match(server, /processOrderReservation\(order\.id, 'release'/, 'pagamento recusado deve liberar a reserva de estoque');
assert.match(orderService, /vpsClient\.post<[\s\S]*?\/orders\/\$\{encodeURIComponent\(order\.id\)\}\/payments\/mercado-pago\/card/, 'o checkout deve enviar o token para a API segura');
assert.doesNotMatch(orderService, /createCardPayment\(input, cardFormData, credentials\.access_token\)/, 'o checkout não pode receber o access token para cobrar o cartão');
assert.match(orderService, /if \(cardFormData\?\.token\) \{[\s\S]*?throw new Error\(mpError\.message/, 'a página não deve tentar atualizar o pedido administrativo após falha do cartão');

console.log('checkout-card-payment-server-static.test.mjs: ok');
