import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(
    source,
    /CREATE TABLE IF NOT EXISTS shopee_templates/,
    `${file} must create shopee_templates so Shopee bulk export can load templates through table-data`,
  );

  for (const column of [
    'company_id',
    'rules',
    'title_template',
    'description_template',
    'attribute_defaults',
    'price_mode',
    'stock_mode',
    'dimension_mode',
    'gtin_mode',
    'dangerous_terms',
  ]) {
    assert.match(source, new RegExp(`${column}\\s+`), `${file} shopee_templates migration must include ${column}`);
  }

  assert.match(source, /idx_shopee_templates_company/, `${file} must index company_id for template filtering`);
  assert.match(source, /idx_shopee_templates_active/, `${file} must index active for template listing`);
  assert.match(source, /idx_shopee_templates_priority/, `${file} must index priority for template ordering`);
}

console.log('shopee template VPS table static checks passed');