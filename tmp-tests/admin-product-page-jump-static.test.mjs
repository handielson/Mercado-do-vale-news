import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/admin/products/ProductListPage.tsx', 'utf8');

assert.match(source, /label htmlFor="product-page-input"[\s\S]*?Ir para:/);
assert.match(source, /Number\.parseInt\(pageInput, 10\)/);
assert.match(source, /Math\.min\(Math\.max\(1, requestedPage\), Math\.max\(1, totalPages\)\)/);
assert.match(source, /onSubmit=\{\(event\) => \{[\s\S]*?goToTypedPage\(\)/);
assert.match(source, /const goToPage = \(nextPage: number\) => \{[\s\S]*?setCurrentPage\(safePage\);[\s\S]*?window\.scrollTo\(\{ top: 0, behavior: 'smooth' \}\)/);
assert.match(source, /onClick=\{\(\) => goToPage\(currentPage - 1\)\}/);
assert.match(source, /onClick=\{\(\) => goToPage\(currentPage \+ 1\)\}/);
assert.match(source, /goToPage\(safePage\);[\s\S]*?setPageInput\(String\(safePage\)\)/);

console.log('admin-product-page-jump-static.test.mjs: ok');
