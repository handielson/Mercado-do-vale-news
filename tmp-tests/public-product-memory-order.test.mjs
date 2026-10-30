import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compareMemoryConfigurations } from '../utils/productMemoryOrder.js';

const groups = [
    { ram: '6GB', storage: '256GB', memoryLabel: '6GB/256GB' },
    { ram: '4GB', storage: '256GB', memoryLabel: '4GB/256GB' },
    { ram: '4GB', storage: '128GB', memoryLabel: '4GB/128GB' },
    { ram: '8GB', storage: '1TB', memoryLabel: '8GB/1TB' },
    { ram: '8GB', storage: '512GB', memoryLabel: '8GB/512GB' },
];
assert.deepEqual(groups.sort(compareMemoryConfigurations).map(group => group.memoryLabel), [
    '4GB/128GB', '4GB/256GB', '6GB/256GB', '8GB/512GB', '8GB/1TB',
]);

const page = readFileSync(new URL('../pages/store/PublicProductPage.tsx', import.meta.url), 'utf8');
assert.match(page, /\.sort\(compareMemoryConfigurations\)/, 'a página pública deve usar a ordem por RAM e armazenamento');
console.log('public product memory order passed');
