import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('pages/customer/CustomerProfilePage.tsx', 'utf8');

[
  "type TabType = 'overview'",
  "tabFromQuery === 'overview'",
  'Painel do Cliente',
  'Visao geral',
  'Continuar comprando',
  'Ver meus pedidos',
  'Completar cadastro',
  'Resumo da conta',
  'Progresso do cadastro',
  'Acoes rapidas',
  'profileCompletion',
  'quickActions',
  'overviewCards',
  'aria-current={isActive ?',
].forEach((token) => {
  assert(source.includes(token), `CustomerProfilePage must include ${token}`);
});

assert(
  source.includes("navigate('/catalogo')") || source.includes("navigate('/')"),
  'CustomerProfilePage must include a quick action to keep shopping'
);

assert(
  source.includes("setActiveTab('history')"),
  'CustomerProfilePage must include a quick action to purchase history'
);

assert(
  !source.includes('blur-3xl'),
  'CustomerProfilePage must not use decorative blur orb backgrounds'
);

console.log('customer profile redesign static checks passed');
