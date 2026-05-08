import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = readFileSync(resolve('components/customer/profile/TypeUpgradeTab.tsx'), 'utf8');

const requiredSnippets = [
  'const accountPlans',
  'const currentPlan',
  'Central de conta',
  'Conta atual',
  'Planos disponiveis',
  'Analise em andamento',
  'Como funciona',
  'Solicitar Atacado',
  'Solicitar Revenda',
  '48 horas',
];

for (const snippet of requiredSnippets) {
  if (!file.includes(snippet)) {
    throw new Error(`Missing type upgrade redesign snippet: ${snippet}`);
  }
}

if (file.includes('max-w-2xl')) {
  throw new Error('Type upgrade tab should use the full profile content width instead of max-w-2xl.');
}

if (file.includes('rounded-3xl')) {
  throw new Error('Type upgrade tab should avoid oversized rounded cards.');
}

console.log('customer type upgrade redesign static checks passed');
