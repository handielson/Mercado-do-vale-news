import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const routes = readFileSync(new URL('../routes/index.tsx', import.meta.url), 'utf8');
const pages = readFileSync(new URL('../pages/legal/LegalPages.tsx', import.meta.url), 'utf8');
const catalog = readFileSync(new URL('../pages/catalog/index.tsx', import.meta.url), 'utf8');

for (const route of ['/privacidade', '/termos-de-uso', '/exclusao-de-dados']) {
    assert.match(routes, new RegExp(`path: ["']${route}["']`), `rota pública ausente: ${route}`);
    assert.match(catalog, new RegExp(`to=["']${route}["']`), `link no rodapé ausente: ${route}`);
}

assert.match(pages, /34\.719\.515\/0001-68/, 'CNPJ do controlador ausente');
assert.match(pages, /contato@mercadodovale\.com\.br/g, 'contato de privacidade ausente');
assert.match(pages, /Apps e sites/, 'instruções de revogação da Meta ausentes');
assert.match(pages, /tokens de acesso/, 'tratamento de token da Meta não descrito');
assert.match(pages, /obrigações legais, fiscais, contábeis/, 'exceção de conservação legal ausente');

console.log('legal-pages-static: ok');
