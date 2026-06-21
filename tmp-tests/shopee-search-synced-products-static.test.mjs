import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Regressao: o botao "Buscar" da aba Shopee no ModelModal envia a acao
// search_synced_products para /api/shopee-actions. Se o servidor nao tratar
// essa acao, ela cai no default ('Acao desconhecida') e a busca falha em
// silencio (nenhum resultado, nenhum erro visivel). Este teste garante que o
// handler continua existindo e consultando shopee_products + products.

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(
    source,
    /case 'search_synced_products':/,
    `${file} deve tratar a acao search_synced_products usada pelo ModelModal`,
  );

  const handlerStart = source.indexOf("case 'search_synced_products':");
  const handlerSlice = source.slice(handlerStart, handlerStart + 1600);

  assert.match(
    handlerSlice,
    /FROM shopee_products/,
    `${file} search_synced_products deve consultar a tabela shopee_products`,
  );
  assert.match(
    handlerSlice,
    /JOIN products/,
    `${file} search_synced_products deve juntar com products para nome/sku`,
  );
  assert.match(
    handlerSlice,
    /shopee_category_id IS NOT NULL/,
    `${file} deve retornar apenas produtos ja sincronizados (com categoria Shopee)`,
  );
  assert.match(
    handlerSlice,
    /send\(\{ results \}\)/,
    `${file} deve responder no formato { results } esperado pelo frontend`,
  );
}

console.log('shopee search_synced_products handler static checks passed');
