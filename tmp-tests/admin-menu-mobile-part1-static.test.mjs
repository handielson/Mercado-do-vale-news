import assert from 'node:assert/strict';
import fs from 'node:fs';

// Menu lateral (parte 1): no celular o menu inteiro rola, topo e rodapé compactos.
const s = fs.readFileSync(new URL('../layouts/AdminLayout.tsx', import.meta.url), 'utf8');
assert.doesNotMatch(s, /Área reservada para a logomarca 3DMV/);
assert.match(s, /admin-sidebar-scroll space-y-0.5 md:space-y-1 flex-none md:flex-1 md:overflow-y-auto/, 'lista não rola numa caixinha no celular');
assert.match(s, /"hidden md:flex items-center gap-3", sidebarCollapsed/, 'logos só no computador');
assert.match(s, /"hidden md:flex items-center gap-1\.5 mt-2 mb-4"/, '"Painel" só no computador');
assert.match(s, /"hidden md:block mx-2 rounded-lg border border-slate-800 bg-slate-950\/70/, 'caixa de versão só no computador');
assert.match(s, /data-menu-footer[\s\S]*Abrir site[\s\S]*Abrir 3DMV/, 'links dos sites no rodapé do celular');
assert.match(s, /text-base md:text-xs rounded-lg py-2\.5/, 'busca com 16px no celular (sem zoom no iPhone)');
console.log('admin menu mobile part 1 static test passed');
