import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs', 'server.js']) {
  const source = readFileSync(file, 'utf8');

  assert.match(
    source,
    /function\s+effectiveProductStockSql\s*\(/,
    `${file} must compute product stock from serialized units when they exist`,
  );

  assert.match(
    source,
    /EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+units[\s\S]+COUNT\(\*\)\s+FROM\s+units[\s\S]+status\s*=\s*'available'/,
    `${file} effective stock must use available serialized unit count`,
  );

  assert.match(
    source,
    /ELSE\s+\$\{productAlias\}\.stock_quantity/,
    `${file} non-serialized products must keep products.stock_quantity fallback`,
  );

  assert.match(
    source,
    /const\s+childStock\s*=\s*effectiveProductStockSql\('child'\)/,
    `${file} combo stock must use effective child stock`,
  );
}

console.log('serialized stock effective SQL static checks passed');
