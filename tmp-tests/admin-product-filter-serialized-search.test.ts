import assert from 'node:assert/strict';
import { filterAdminProducts } from '../hooks/adminProductFilters';
import { ProductStatus } from '../utils/field-standards';
import type { Product } from '../types/product';

const baseFilters = {
  search: '',
  status: 'all' as const,
  sortBy: 'newest' as const,
  imageStatus: 'all' as const,
  parentVisibility: 'show_all' as const,
  brand: 'all',
  categoryId: 'all',
  shopeeStatus: 'all' as const,
  videoStatus: 'all' as const,
};

const serializedProduct = {
  id: 'prod-serial',
  model_id: 'model-1',
  model: '',
  name: 'Redmi Note 15 Pro 5G',
  sku: 'RN15P8256T',
  specs: {
    imei1: '865750084601982',
    serial: '72698W5XJ04308',
  },
  eans: [],
  images: [],
  status: ProductStatus.ACTIVE,
  track_inventory: true,
  stock_quantity: 1,
  price_cost: 0,
  price_retail: 0,
  price_reseller: 0,
  price_wholesale: 0,
  warranty_type: 'brand',
  created: '2026-06-17T00:00:00Z',
  updated: '2026-06-17T00:00:00Z',
} satisfies Product;

assert.deepEqual(
  filterAdminProducts([serializedProduct], { ...baseFilters, search: '865750084601982' }).map(product => product.id),
  ['prod-serial'],
  'admin product search should match specs.imei1',
);

assert.deepEqual(
  filterAdminProducts([serializedProduct], { ...baseFilters, search: 'w5xj04308' }).map(product => product.id),
  ['prod-serial'],
  'admin product search should match specs.serial case-insensitively',
);

console.log('admin product filter serialized search ok');
