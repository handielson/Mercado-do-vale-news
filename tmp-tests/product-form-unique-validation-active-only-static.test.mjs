import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('components/products/ProductForm.tsx'), 'utf8');

// Começa na verificação de duplicidade do envio (o primeiro "if (serialList.length > 0)" do arquivo
// agora é um efeito no topo, e pegaria as buscas de SKU do Bling, que olham todos os status de propósito).
const start = source.indexOf("message: 'Verificando duplicidades...'");
// O bloco termina quando o produto passa a ser salvo (stock-entry-only-v1: a identidade serializada
// e a lista em massa saíram; a checagem vale para produto antigo editado com IMEI/serial nos specs).
const end = source.indexOf("message: 'Salvando produto...'", start);
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
