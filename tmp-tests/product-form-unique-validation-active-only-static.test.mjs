import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('components/products/ProductForm.tsx'), 'utf8');

// Começa na verificação de duplicidade do envio (o primeiro "if (serialList.length > 0)" do arquivo
// agora é um efeito no topo, e pegaria as buscas de SKU do Bling, que olham todos os status de propósito).
const start = source.indexOf("message: 'Verificando duplicidades...'");
// O bloco termina onde o produto único passa a montar a identidade serializada
// (antes era um "if (hasSerializedIdentity(...))", virou constante).
const end = source.indexOf('const singleSerializedIdentity = hasSerializedIdentity(mergedData.specs || {});', start);
assert(start >= 0 && end > start, 'Could not isolate ProductForm serialized uniqueness block');

const block = source.slice(start, end);

assert(
  /vpsApiService\.getProducts\(\{\s*status:\s*'active'[\s\S]*limit:\s*5000[\s\S]*noCache:\s*true/.test(block),
  'ProductForm must validate serial/IMEI uniqueness only against active VPS products',
);

assert(
  !/vpsApiService\.getProducts\(\{\s*status:\s*'all'[\s\S]*limit:\s*5000[\s\S]*noCache:\s*true/.test(block),
  'ProductForm must not block recadastro because of inactive/deleted product rows',
);

console.log('ProductForm unique validation ignores inactive/deleted products');
