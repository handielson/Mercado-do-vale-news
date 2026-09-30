import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

for (const fileName of ['vps_server.js', 'vps_server.cjs']) {
  const source = fs.readFileSync(path.join(root, fileName), 'utf8');

  assert.match(
    source,
    /async function syncMarketplaceStockAfterLocalMutationVps[\s\S]*?getShopeeStockTargetsForProductIds\(ids\)[\s\S]*?syncMarketplaceStockFromBlingTargetsVps\(targets\)/,
    `${fileName}: mutacoes locais devem reutilizar o sincronizador central de marketplaces`,
  );
  assert.match(
    source,
    /fastify\.post\('\/stock-locations\/priority-decrements'[\s\S]*?decrementPriorityStock\(pool, input\)[\s\S]*?syncMarketplaceStockAfterLocalMutationVps\(\[input\.product_id\], 'priority_stock_decrement'\)/,
    `${fileName}: venda PDV deve publicar o estoque depois da baixa confirmada`,
  );
  assert.match(
    source,
    /fastify\.post\('\/stock-locations\/entries'[\s\S]*?syncMarketplaceStockAfterLocalMutationVps\(\[input\.product_id\], 'manual_stock_entry'\)/,
    `${fileName}: entrada manual deve publicar o novo estoque`,
  );
  assert.match(
    source,
    /fastify\.post\('\/stock-locations\/adjustments'[\s\S]*?syncMarketplaceStockAfterLocalMutationVps\(\[input\.product_id\], 'manual_stock_adjustment'\)/,
    `${fileName}: ajuste manual deve publicar o novo estoque`,
  );
  assert.match(
    source,
    /async function processOrderReservation[\s\S]*?mode === 'consume'[\s\S]*?syncMarketplaceStockAfterLocalMutationVps\(result\.map\(\(row\) => row\.product_id\), 'order_reservation_consume'\)/,
    `${fileName}: consumo de reserva deve publicar o novo estoque`,
  );
  assert.match(
    source,
    /fastify\.post\('\/stock-locations\/sale-restores'[\s\S]*?syncMarketplaceStockAfterLocalMutationVps\(result\.map\(\(row\) => row\.product_id\), 'sale_stock_restore'\)/,
    `${fileName}: cancelamento/devolucao de venda deve publicar o estoque restaurado`,
  );
}

console.log('Sincronizacao de marketplaces apos mutacoes locais de estoque: OK');
