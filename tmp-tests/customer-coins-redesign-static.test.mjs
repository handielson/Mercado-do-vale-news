import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = readFileSync(resolve('components/customer/profile/CoinsTab.tsx'), 'utf8');

const requiredSnippets = [
  'const coinsSummary',
  'Central de moedas',
  'Saldo disponivel',
  'Valor em desconto',
  'Ganhos recentes',
  'Usos recentes',
  'Check-in diario',
  'Como ganhar moedas',
  'Extrato de Moedas',
  'Ver Regulamento',
];

for (const snippet of requiredSnippets) {
  if (!file.includes(snippet)) {
    throw new Error(`Missing coins redesign snippet: ${snippet}`);
  }
}

if (file.includes('rounded-3xl')) {
  throw new Error('Coins tab should avoid oversized rounded cards.');
}

console.log('customer coins redesign static checks passed');
