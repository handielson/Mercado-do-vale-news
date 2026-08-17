import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync('vps_server.js', 'utf8');
const paymentService = readFileSync('services/paymentIntegrationService.ts', 'utf8');
const checkout = readFileSync('pages/store/CheckoutPage.tsx', 'utf8');

assert.match(server, /pathname === '\/public\/payment-integrations'/, 'a rota pública deve atravessar o proxy sem sessão administrativa');
assert.match(server, /fastify\.get\('\/public\/payment-integrations'[\s\S]*?SELECT gateway_name, is_active, public_key, environment[\s\S]*?WHERE company_id = \? AND is_active = 1/, 'o checkout público deve receber apenas integrações ativas da empresa');
assert.doesNotMatch(
  server.match(/fastify\.get\('\/public\/payment-integrations'[\s\S]*?\n\}\);/)?.[0] || '',
  /access_token|client_secret/,
  'a rota pública nunca pode expor credenciais do gateway'
);
assert.match(paymentService, /getPublicCheckoutIntegrations[\s\S]*?'\/public\/payment-integrations'/, 'o checkout deve usar a rota pública sanitizada');
assert.match(checkout, /paymentIntegrationService\.getPublicCheckoutIntegrations\(\)/, 'a página de checkout não pode consultar a tabela administrativa de integrações');
assert.doesNotMatch(checkout, /value: 'credit_card', label: '💳 Cartão de Crédito', desc: 'Até 12x \(Máquina\)'/, 'o fallback de cartão manual não pode criar pedidos sem cobrança');
assert.match(checkout, /disabled=\{submitting \|\| gatewayLoadState !== 'ready' \|\| activeGateways\.length === 0\}/, 'não deve permitir confirmar antes de carregar uma forma online');

console.log('checkout-public-payment-integrations-static.test.mjs: ok');
