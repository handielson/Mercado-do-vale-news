import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const layout = read('layouts/AdminLayout.tsx');
const capture = read('components/products/photo-intake/PhotoCapturePanel.tsx');
const review = read('components/products/photo-intake/PhotoIntakeReviewCard.tsx');

// Celular: menu em gaveta fora do fluxo da página; no computador continua lateral.
assert.match(layout, /admin-sidebar-scroll fixed inset-y-0 left-0 w-\[85vw\] max-w-\[320px\][^"\n]*md:sticky[^"\n]*md:translate-x-0[^"\n]*overflow-y-auto/, 'gaveta fixa no celular e lateral no computador');
assert.match(layout, /mobileMenuOpen \? "translate-x-0" : "-translate-x-full"/, 'gaveta escondida até abrir');
assert.match(layout, /data-admin-mobile-topbar/, 'barra do topo no celular');
assert.match(layout, /data-admin-mobile-backdrop[\s\S]{0,40}|onClick=\{closeMobileMenu\} aria-hidden="true" data-admin-mobile-backdrop/, 'tocar fora fecha');
assert.match(layout, /window\.history\.pushState\(/, 'voltar do celular fecha a gaveta');
assert.match(layout, /addEventListener\('popstate'/, 'escuta o voltar');
assert.match(layout, /event\.key === 'Escape'/, 'ESC fecha');
assert.match(layout, /document\.body\.style\.overflow = 'hidden'/, 'página atrás não rola');
assert.match(layout, /\}, \[location\.key\]\);/, 'fecha ao navegar, mesmo para a mesma página');
assert.match(layout, /replace=\{mobileMenuOpen\}/, 'item do menu substitui a entrada da gaveta no histórico');
assert.match(layout, /openMobileGroup === group\.title \? "block" : "hidden", "md:block"/, 'grupos recolhíveis só no celular');
assert.match(layout, /min-h-\[44px\] md:min-h-0[^"\n]*py-3 md:py-2\.5/, 'itens com altura de toque');
assert.match(layout, /data-admin-mobile-shortcuts/, 'rodapé de atalhos');
for (const route of ['/admin/products', '/admin/products/photo-intake', '/admin/inventory', '/admin/products/labels']) assert.ok(layout.includes(`to: '${route}'`), `atalho ${route}`);
assert.match(layout, /flex-1 min-w-0 p-4 pb-24/, 'conteúdo não fica escondido atrás do rodapé');
// Desktop preservado.
assert.match(layout, /sidebarCollapsed \? "md:w-\[72px\] md:p-3" : "md:w-64"/);

// Foto da caixa: câmera direta (uma por vez, sem multiple) separada da galeria.
const cameraInput = capture.match(/<input\s+ref=\{cameraRef\}[\s\S]*?\/>/);
assert.ok(cameraInput, 'input da câmera');
assert.match(cameraInput[0], /capture="environment"/);
assert.doesNotMatch(cameraInput[0], /multiple/, 'câmera abre direto, sem seletor');
const galleryInput = capture.match(/<input\s+ref=\{inputRef\}[\s\S]*?\/>/);
assert.match(galleryInput[0], /multiple/); assert.doesNotMatch(galleryInput[0], /capture=/);
assert.match(capture, /Fotografar caixa/); assert.match(capture, /envie como arquivo/);

// Campos de identificação: teclado certo e validação na hora.
assert.match(review, /identifierInputProps\(field\.kind\)/);
assert.match(review, /describeIdentifier\(field\.kind, draft\[field\.key\]\)/);
assert.match(review, /enterKeyHint=\{NEXT_SCAN_FIELD\[field\.key\] \? 'next' : 'done'\}/);
assert.match(review, /key: 'detected_imei_1', label: 'IMEI 1', mono: true, kind: 'imei'/);
assert.match(review, /key: 'detected_ean', label: 'EAN\/GTIN', mono: true, kind: 'ean'/);
console.log('admin mobile navigation ok');

// admin-mobile-shortcuts-keyboard-v1
assert.match(layout, /\{!mobileKeyboardOpen && <nav aria-label="Atalhos do celular" data-admin-mobile-shortcuts/, 'rodapé de atalhos some com o teclado aberto (não flutua sobre o formulário)');
assert.match(layout, /addEventListener\('focusin', update\)/, 'detecta foco em campo de texto');
console.log('admin mobile shortcuts keyboard ok');
