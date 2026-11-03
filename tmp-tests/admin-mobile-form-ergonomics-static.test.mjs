import assert from 'node:assert/strict';
import fs from 'node:fs';

// Formulários do admin no celular: sem zoom do iPhone ao tocar nos campos e rodapé confortável.
const css = fs.readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const form = fs.readFileSync(new URL('../components/products/ProductForm.tsx', import.meta.url), 'utf8');
const specs = fs.readFileSync(new URL('../components/products/sections/ProductSpecifications.tsx', import.meta.url), 'utf8');
const layout = fs.readFileSync(new URL('../layouts/AdminLayout.tsx', import.meta.url), 'utf8');

assert.match(layout, /data-admin-layout-build=/, 'raiz do admin precisa do atributo usado pelo CSS');
assert.match(css, /@media \(max-width: 767px\) \{\s*\[data-admin-layout-build\] input:not\(\[type="checkbox"\]\)[\s\S]*?\[data-admin-layout-build\] select,\s*\[data-admin-layout-build\] textarea \{\s*font-size: 16px;/, 'campos do admin com 16px no celular (iPhone não dá zoom)');
assert.match(form, /flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3" data-product-form-footer/, 'rodapé do produto empilhado no celular, botão principal em cima');
assert.match(form, /min-h-\[52px\] sm:min-h-0 w-full sm:w-auto/, 'botão salvar largo e alto no celular');
assert.match(specs, /text-sm text-slate-800 break-words \[overflow-wrap:anywhere\]/, 'características do modelo quebram texto longo');

console.log('admin mobile form ergonomics static test passed');

// product-form-steps-v1
assert.match(form, /const formSections = \(\[/, 'etapas do cadastro definidas numa lista só (abas e rodapé usam a mesma ordem)');
assert.match(form, /formSections\.map\(\(\[section, label\], index\) =>/, 'abas numeradas a partir da mesma lista');
assert.match(form, /Próximo: \{nextStep\[1\]\} →/, 'rodapé leva para a próxima etapa');
assert.match(form, /← Voltar: \{previousStep\[1\]\}/, 'rodapé permite voltar uma etapa');
assert.match(form, /\{\(!nextStep \|\| isEditingExisting\) && <button\s+type="submit"/, 'produto novo só salva na última etapa; edição salva a qualquer momento');
assert.match(form, /Etapa \{activeStepIndex \+ 1\} de \{formSections\.length\}/, 'mostra em que etapa está');
assert.doesNotMatch(form, /Continuar para variações/, 'o "Próximo" substitui o atalho antigo para variações');
console.log('product form steps ok');
