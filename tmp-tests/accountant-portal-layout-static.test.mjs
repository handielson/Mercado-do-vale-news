import assert from 'node:assert/strict';
import fs from 'node:fs';

// Espaço do Contador: sem barras de rolagem desnecessárias e cabendo no celular.
const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const page = read('pages/accountant/AccountantPortalPage.tsx');
const app = read('App.tsx');
const bar = read('components/catalog/CompareBar.tsx');
for (const file of ['components/company/CompanyTaxValidationPanel.tsx', 'components/fiscal/FiscalProductTaxPanel.tsx', 'components/company/AccountantNfceSequencePanel.tsx']) {
  const source = read(file);
  assert.doesNotMatch(source, /<textarea\b/, `${file}: caixas de texto crescem com o conteúdo`);
  assert.match(source, /<AutoTextarea\b/);
}
assert.match(read('components/ui/AutoTextarea.tsx'), /overflow: 'hidden', resize: 'none'/);
assert.match(page, /data-accountant-tabs/);
assert.match(page, /grid grid-cols-3 gap-1[^"]*sm:flex/, 'abas em 3 colunas no celular');
for (const list of ['months', 'review', 'sales']) assert.match(page, new RegExp(`md:hidden" data-mobile-list="${list}"`), `lista ${list} no celular`);
assert.equal((page.match(/className="hidden md:block overflow-x-auto/g) || []).length, 3, 'tabelas só a partir do md');
assert.match(app, /pathname\.startsWith\('\/admin'\) \|\| pathname === '\/contador'/, 'Comparar fora do admin e do contador');
assert.match(bar, /'pointer-events-none invisible translate-y-full'/, 'barra vazia não alarga a página');
console.log('accountant portal layout static test passed');
