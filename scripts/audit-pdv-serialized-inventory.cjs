#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const mysql = require('mysql2/promise');

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function hasLegacyIdentifier(specs) {
  const parsed = parseJson(specs, {});
  return ['imei', 'imei1', 'imei_1', 'imei2', 'imei_2', 'serial', 'serial_number']
    .some((key) => String(parsed?.[key] || '').trim());
}

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 2,
  });

  try {
    const [unitColumns] = await pool.query('SHOW COLUMNS FROM units');
    const unitColumnNames = new Set(unitColumns.map((column) => column.Field));
    const serialColumn = unitColumnNames.has('serial') ? 'serial' : 'serial_number';

    const [products] = await pool.query(
      `SELECT id, name, sku, stock_quantity, specs
         FROM products
        WHERE status = 'active'
        ORDER BY name ASC`
    );

    const [units] = await pool.query(
      `SELECT id, product_id, status, imei_1, imei_2, ${serialColumn} AS serial
         FROM units
        ORDER BY product_id ASC, id ASC`
    );

    const availableUnits = units.filter((unit) => String(unit.status) === 'available');
    const availableCountByProduct = new Map();
    for (const unit of availableUnits) {
      availableCountByProduct.set(unit.product_id, (availableCountByProduct.get(unit.product_id) || 0) + 1);
    }

    const productById = new Map(products.map((product) => [product.id, product]));

    const productsWithLegacyIdentifiers = products
      .filter((product) => hasLegacyIdentifier(product.specs))
      .map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
      }));

    const availableUnitsMissingIdentifiers = availableUnits
      .filter((unit) => !String(unit.imei_1 || '').trim() && !String(unit.imei_2 || '').trim() && !String(unit.serial || '').trim())
      .map((unit) => ({
        id: unit.id,
        product_id: unit.product_id,
        product_name: productById.get(unit.product_id)?.name || null,
        sku: productById.get(unit.product_id)?.sku || null,
      }));

    const stockMismatchesWhenUnitsExist = [...availableCountByProduct.entries()]
      .map(([productId, available_unit_count]) => {
        const product = productById.get(productId);
        if (!product) return null;
        const stock_quantity = Number(product.stock_quantity || 0);
        if (stock_quantity === available_unit_count) return null;
        return {
          id: product.id,
          name: product.name,
          sku: product.sku,
          stock_quantity,
          available_unit_count,
        };
      })
      .filter(Boolean);

    console.log(JSON.stringify({
      generated_at: new Date().toISOString(),
      read_only: true,
      summary: {
        products_with_legacy_identifiers: productsWithLegacyIdentifiers.length,
        available_units_missing_identifiers: availableUnitsMissingIdentifiers.length,
        stock_mismatches_when_units_exist: stockMismatchesWhenUnitsExist.length,
      },
      products_with_legacy_identifiers: productsWithLegacyIdentifiers,
      available_units_missing_identifiers: availableUnitsMissingIdentifiers,
      stock_mismatches_when_units_exist: stockMismatchesWhenUnitsExist,
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  const record = error && typeof error === 'object' ? error : {};
  console.error(JSON.stringify({
    ok: false,
    read_only: true,
    error: error instanceof Error ? error.message : String(error),
    name: record.name || null,
    code: record.code || null,
    errno: record.errno || null,
    sql_state: record.sqlState || null,
    stack: error instanceof Error ? String(error.stack || '').split('\n').slice(0, 4).join('\n') : null,
  }, null, 2));
  process.exitCode = 1;
});
