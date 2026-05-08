import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = readFileSync(resolve('components/customer/profile/BenefitsTab.tsx'), 'utf8');

const requiredSnippets = [
  'const benefitsSummary',
  'Central de beneficios',
  'Beneficios ativos',
  'Resgates usados',
  'Disponiveis agora',
  'Como usar',
  'Status deste mes',
  'Extrato de resgates',
  'Solicitar na loja',
  'Programa de protecao',
];

for (const snippet of requiredSnippets) {
  if (!file.includes(snippet)) {
    throw new Error(`Missing benefits redesign snippet: ${snippet}`);
  }
}

if (file.includes('rounded-3xl')) {
  throw new Error('Benefits tab should avoid oversized rounded cards.');
}

console.log('customer benefits redesign static checks passed');
