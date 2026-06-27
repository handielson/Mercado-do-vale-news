import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const helperPath = 'components/products/productCardStatus.js';

assert.ok(existsSync(helperPath), `${helperPath} must expose admin product card status rules`);

const {
  getAdminProductCardStatus,
} = await import(`../${helperPath}`);

assert.deepEqual(
  getAdminProductCardStatus({
    status: 'active',
    track_inventory: true,
    stock_quantity: 0,
    specs: { imei1: '868345084479245' },
  }),
  {
    status: 'sold',
    label: 'Vendido',
    color: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  'tracked active products with zero effective stock must render as sold in admin cards',
);

assert.deepEqual(
  getAdminProductCardStatus({
    status: 'active',
    track_inventory: true,
    stock_quantity: 0,
    specs: {},
  }),
  {
    status: 'out_of_stock',
    label: 'Sem Estoque',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  'tracked active non-serialized products with zero stock render as out of stock',
);

assert.equal(
  getAdminProductCardStatus({
    status: 'active',
    track_inventory: true,
    stock_quantity: 2,
  }).label,
  'Ativo',
  'tracked products with stock must remain active',
);

assert.equal(
  getAdminProductCardStatus({
    status: 'inactive',
    track_inventory: true,
    stock_quantity: 0,
  }).label,
  'Inativo',
  'inactive products keep their cadastral status',
);

console.log('admin product card status checks passed');
