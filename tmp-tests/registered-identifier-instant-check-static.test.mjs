import assert from 'node:assert/strict';
import fs from 'node:fs';

// IMEI/serial já cadastrado aparece na hora (digitado ou lido pela câmera), com link, sem esperar o Salvar.
const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const lookup = read('services/registeredIdentifier.ts');
const imei = read('components/ui/IMEIInput.tsx');
const specs = read('components/products/sections/ProductSpecifications.tsx');
const form = read('components/products/ProductForm.tsx');
const notice = read('components/ui/RegisteredIdentifierNotice.tsx');

assert.match(lookup, /unitService\.searchByIdentifier\(/, 'consulta a tabela de aparelhos (onde ficam os IMEIs), não só o cadastro de produtos');
assert.match(lookup, /unit\.product_id !== excludeProductId/, 'ao editar, os aparelhos do próprio produto não contam');
assert.match(lookup, /\/admin\/serializados\?search=/, 'traz o link para ver o aparelho');
assert.match(lookup, /shouldLookupIdentifier\(kind, text\)/, 'IMEI consulta ao completar 15 dígitos');
assert.match(imei, /useRegisteredIdentifier\('imei', value/, 'todo campo de IMEI confere na hora');
assert.match(imei, /<RegisteredIdentifierNotice check=\{registered\} \/>/);
assert.match(notice, /Ver aparelho/);
assert.match(specs, /useRegisteredIdentifier\('serial'/, 'serial confere na hora');
assert.match(specs, /excludeProductId=\{currentProductId \|\| null\}/);
assert.match(form, /const handleAddToBatchList = async[\s\S]*lookupRegisteredIdentifier\(value, initialData\?\.id \|\| null\)[\s\S]*toast\.error[\s\S]*Ver aparelho[\s\S]*return;[\s\S]*setSerialList\(prev => \[\.\.\.prev, item\]\)/, 'Adicionar à Lista recusa aparelho já cadastrado antes de entrar na lista');

console.log('registered identifier instant check static test passed');
