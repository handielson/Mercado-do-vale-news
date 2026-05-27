import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const servicePath = resolve('services/productService.ts');
const source = readFileSync(servicePath, 'utf8');

assert(
  !source.includes("from './supabase'") && !source.includes('from "./supabase"'),
  'PDV productService must not import Supabase directly',
);

assert(
  !/supabase\s*\./.test(source),
  'PDV productService must not call Supabase directly',
);

assert(
  /vpsApiService\.getProductById/.test(source),
  'getProductById should read from VPS',
);

assert(
  /vpsApiService\.getProducts/.test(source),
  'SKU and search lookups should read from VPS products endpoint',
);

assert(
  /vpsApiService\.getProductByEan/.test(source),
  'Barcode lookup should read from VPS EAN endpoint',
);

console.log('pdv productService VPS-only static checks passed');
