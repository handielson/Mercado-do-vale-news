import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('components/customer/profile/PersonalInfoTab.tsx', 'utf8');

[
  "type ProfileSection = 'profile' | 'delivery' | 'security'",
  'const sectionCards',
  'activeSection',
  'Resumo dos dados',
  'Perfil e contato',
  'Entrega principal',
  'Seguranca da conta',
  'Cadastro completo',
  'Dados de contato',
  'Endereco principal',
  'Salvar alteracoes',
  'aria-current={activeSection === section.id ?',
].forEach((token) => {
  assert(source.includes(token), `PersonalInfoTab must include ${token}`);
});

assert(
  source.includes("setActiveSection('delivery')"),
  'PersonalInfoTab must allow jumping to the delivery panel'
);

assert(
  source.includes("setActiveSection('security')"),
  'PersonalInfoTab must allow jumping to the security panel'
);

assert(
  !source.includes('rounded-3xl'),
  'PersonalInfoTab should use tighter profile cards instead of oversized rounded panels'
);

console.log('customer personal info redesign static checks passed');
