import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const page = fs.readFileSync(path.join(root, 'pages/admin/inventory/StockLocationsPage.tsx'), 'utf8');

assert.doesNotMatch(
  page,
  /Todas as origens com saldo/,
  'batch transfer must not allow an implicit all-origins source'
);

assert.doesNotMatch(
  page,
  /materializeBatchItemDistribution/,
  'batch transfer must not automatically create missing location stock before transfer'
);

assert.match(
  page,
  /Selecione a origem/,
  'batch transfer should tell the operator to choose the source location'
);

assert.match(
  page,
  /Estoque registrado por origem/,
  'batch transfer should label the per-origin stock summary clearly'
);

assert.match(
  page,
  /originSummaryRows/,
  'batch transfer should render a separate per-origin summary instead of reusing only selectable origins'
);

assert.match(
  page,
  /originOptions = item\.distribution/,
  'batch row origin selector should list all available source options even after one origin is selected'
);

assert.match(
  page,
  /disabled=\{source\.location_id === batchToLocationId\}/,
  'batch row should show destination stock sources in the selector but disable them'
);

assert.match(
  page,
  /ja esta no destino/,
  'batch row should explain when a stock source is already the selected destination'
);

assert.match(
  page,
  /Saindo de/,
  'batch transfer should name the source column as the place stock will leave from'
);

assert.match(
  page,
  /Estoque de origem/,
  'batch transfer should label the source selector as origin stock'
);

assert.doesNotMatch(
  page,
  /originOptions\.length > 1 \?/,
  'batch transfer must render the origin selector even when there is only one source'
);

assert.match(
  page,
  /Selecione a origem \(1 local\)/,
  'batch transfer should keep an explicit origin choice when only one source exists'
);

assert.match(
  page,
  /Quantidade a movimentar/,
  'batch transfer should label the moved quantity input clearly'
);

assert.match(
  page,
  /unidade/,
  'batch transfer should describe origin quantities as units, not only as abbreviated availability'
);

assert.match(
  page,
  /Escolha a origem de cada produto/,
  'batch transfer validation must require source selection for each product'
);

assert.match(
  page,
  /item\.fromLocationId \? sourceAvailable : 0/,
  'batch transfer availability should be zero until a source location is selected'
);

console.log('stock location batch origin selection static checks passed');
