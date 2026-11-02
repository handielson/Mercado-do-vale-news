import assert from 'node:assert/strict';
import fs from 'node:fs';

// Vitrine logada no celular não pode ficar mais larga que a tela (o navegador dá zoom e arrasta para o lado).
const header = fs.readFileSync(new URL('../components/PublicHeader.tsx', import.meta.url), 'utf8');
const checkin = fs.readFileSync(new URL('../components/catalog/CheckinWidget.tsx', import.meta.url), 'utf8');
const catalog = fs.readFileSync(new URL('../pages/catalog/index.tsx', import.meta.url), 'utf8');

assert.match(header, /className="flex min-w-0 items-center gap-2 sm:gap-3">\s*<StoreStatusBadge \/>/, 'lado direito do topo deve poder encolher');
assert.match(header, /hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold \$\{badge\.color\}/, 'selo do tipo de cliente só a partir do sm');
assert.match(header, /customer_type === 'ADMIN' && \(\s*<div className="relative hidden sm:block">\s*<select/, '"Ver como" no topo só a partir do sm');
assert.match(header, /data-admin-preview-mobile/, '"Ver como" fica dentro do menu da conta no celular');
assert.match(header, /<span className="hidden sm:inline font-medium pr-1">\{customer\.name/, 'nome do usuário só a partir do sm');
assert.match(checkin, /<div className="relative flex min-w-0 items-center gap-2 sm:gap-3">/, 'texto do check-in precisa encolher');
assert.match(checkin, /relative shrink-0 pr-1\.5 pl-2 border-l/, 'seta do check-in não encolhe');
assert.match(catalog, /<span className="sr-only sm:hidden">Favoritos<\/span>/, 'Favoritos só com o coração no celular');

console.log('public header mobile width static test passed');
