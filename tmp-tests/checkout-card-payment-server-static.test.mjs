import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const servers = [
  ['vps_server.js', readFileSync('vps_server.js', 'utf8')],
  ['vps_server.cjs', readFileSync('vps_server.cjs', 'utf8')],
];
const orderService = readFileSync('services/orderService.ts', 'utf8');
const provider = readFileSync('services/providers/mercadoPagoProvider.ts', 'utf8');
const cardBrick = readFileSync('components/payment/MercadoPagoCardBrick.tsx', 'utf8');
const orderTypes = readFileSync('types/order.ts', 'utf8');

for (const [fileName, server] of servers) {
  assert.ok(server.includes("/^\\/orders\\/[^/]+\\/payments\\/mercado-pago\\/card$/u"), `${fileName}: o proxy deve permitir somente o endpoint específico do cartão para o dono do pedido`);
  assert.match(server, /fastify\.post\('\/orders\/:orderId\/payments\/mercado-pago\/card'[\s\S]*?requireSyncKeyOrCustomer/, `${fileName}: a cobrança deve exigir cliente autenticado ou serviço interno`);
  assert.match(server, /String\(order\.customer_id \|\| ''\) !== String\(access\.customerId \|\| ''\)/, `${fileName}: a API deve bloquear cobrança de pedido de outro cliente`);
  assert.match(server, /const paymentMethodId = String\(input\.payment_method_id \|\| ''\)\.trim\(\)/, `${fileName}: a API deve normalizar payment_method_id antes de chamar o Mercado Pago`);
  assert.match(server, /if \(!paymentMethodId\) return reply\.code\(400\)/, `${fileName}: a API deve rejeitar payload sem payment_method_id antes da cobrança`);
  assert.match(server, /gateway_name = 'mercado_pago' AND is_active = 1 AND company_id = \? LIMIT 1[\s\S]*?\[order\.company_id\]/, `${fileName}: a API deve usar a credencial Mercado Pago da empresa do pedido`);
  assert.match(server, /Authorization: `Bearer \$\{accessToken\}`/, `${fileName}: somente a API pode usar o access token do Mercado Pago`);
  assert.match(server, /processOrderReservation\(order\.id, 'consume'/, `${fileName}: pagamento aprovado deve consumir a reserva de estoque`);
  assert.match(server, /processOrderReservation\(order\.id, 'release'/, `${fileName}: pagamento recusado deve liberar a reserva de estoque`);
}

assert.match(orderTypes, /interface MercadoPagoCardFormData[\s\S]*payment_method_id:\s*string[\s\S]*issuer_id\??:\s*string/, 'o contrato canônico do Brick deve preservar campos snake_case');
assert.match(orderTypes, /interface OrderInput[\s\S]*card_form_data\?: MercadoPagoCardFormData/, 'OrderInput deve tipar os dados do cartão sem any');
assert.doesNotMatch(provider, /paymentMethodId|issuerId/, 'o contrato camelCase incompatível não deve voltar');
assert.match(cardBrick, /import type \{ MercadoPagoCardFormData \} from '@\/types\/order'/, 'o componente deve reutilizar o contrato canônico de pedido');
assert.doesNotMatch(cardBrick, /interface CardFormData|paymentMethodId|issuerId/, 'o componente não deve manter um contrato concorrente do Brick');

assert.match(orderService, /vpsClient\.post<[\s\S]*?\/orders\/\$\{encodeURIComponent\(order\.id\)\}\/payments\/mercado-pago\/card/, 'o checkout deve enviar o token para a API segura');
assert.match(orderService, /payment_method_id:\s*cardFormData\.payment_method_id/, 'o checkout deve encaminhar payment_method_id retornado pelo Brick');
assert.match(orderService, /issuer_id:\s*cardFormData\.issuer_id/, 'o checkout deve encaminhar issuer_id retornado pelo Brick');
assert.doesNotMatch(orderService, /cardFormData\.(?:paymentMethodId|issuerId)/, 'o checkout não deve ler nomes camelCase inexistentes no retorno do Brick');
assert.match(orderService, /const cardFormData = input\.card_form_data/, 'o serviço deve usar o contrato tipado de OrderInput');
assert.doesNotMatch(orderService, /createCardPayment\(input, cardFormData, credentials\.access_token\)/, 'o checkout não pode receber o access token para cobrar o cartão');
assert.match(orderService, /if \(cardFormData\?\.token\) \{[\s\S]*?throw new Error\(mpError\.message/, 'a página não deve tentar atualizar o pedido administrativo após falha do cartão');

console.log('checkout-card-payment-server-static.test.mjs: ok');
