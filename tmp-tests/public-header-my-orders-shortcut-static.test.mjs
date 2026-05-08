import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const header = readFileSync('components/PublicHeader.tsx', 'utf8');
const profile = readFileSync('pages/customer/CustomerProfilePage.tsx', 'utf8');

assert(
  header.includes('Meus Pedidos'),
  'PublicHeader user dropdown must include a Meus Pedidos shortcut'
);
assert(
  header.includes('to="/perfil?tab=history"'),
  'Meus Pedidos shortcut must deep-link to the purchase history profile tab'
);
assert(
  profile.includes('URLSearchParams(location.search)'),
  'CustomerProfilePage must read tab from the URL query string'
);
assert(
  profile.includes("tabFromQuery === 'history'"),
  'CustomerProfilePage must accept the history tab from ?tab=history'
);
assert(
  profile.includes('setActiveTab(getInitialTab(location))'),
  'CustomerProfilePage must react when the profile tab query changes'
);

console.log('public header my orders shortcut static checks passed');
