'use strict';

const TABLE = 'unit_journal_events';
const quote = name => {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error('Invalid schema identifier');
  return '`' + name + '`';
};

// Capture every current column, including JSON specs, costs and identifiers.
// Schema changes require regenerating these triggers as an explicit migration.
function snapshot(columns, alias) {
  if (!columns?.length) throw new Error('Snapshot schema missing');
  return 'JSON_OBJECT(' + columns.flatMap(name => ["'" + name + "'", `${alias}.${quote(name)}`]).join(',') + ')';
}

function buildUnitJournalMigration(schema) {
  for (const table of ['units', 'products', 'sale_items', 'sales', 'orders', 'product_stock_locations', 'stock_location_movements']) {
    if (!schema[table]?.includes('id')) throw new Error(`Missing ${table} schema`);
  }
  const j = quote(TABLE);
  const columns = '(event_key,unit_id,product_id,event_type,db_actor,before_data,after_data)';
  const unit = alias => snapshot(schema.units, alias);
  const product = alias => snapshot(schema.products, alias);
  const context = (u, p) => `JSON_OBJECT('unit',${unit(u)},'product',${product(p)})`;
  const statements = [{ name: 'table', sql: `CREATE TABLE IF NOT EXISTS ${j} (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    event_key VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    unit_id CHAR(36) NOT NULL, product_id CHAR(36) NULL,
    event_type VARCHAR(48) NOT NULL,
    recorded_at DATETIME(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6)),
    db_actor VARCHAR(288) NOT NULL,
    before_data JSON NULL, after_data JSON NULL,
    imei_1_before VARCHAR(100) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(before_data,'$.unit.imei_1'))) STORED,
    imei_1_after VARCHAR(100) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(after_data,'$.unit.imei_1'))) STORED,
    imei_2_before VARCHAR(100) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(before_data,'$.unit.imei_2'))) STORED,
    imei_2_after VARCHAR(100) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(after_data,'$.unit.imei_2'))) STORED,
    serial_before VARCHAR(100) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(before_data,'$.unit.serial'))) STORED,
    serial_after VARCHAR(100) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(after_data,'$.unit.serial'))) STORED,
    INDEX idx_uj_imei1_before (imei_1_before,unit_id), INDEX idx_uj_imei1_after (imei_1_after,unit_id),
    INDEX idx_uj_imei2_before (imei_2_before,unit_id), INDEX idx_uj_imei2_after (imei_2_after,unit_id),
    INDEX idx_uj_serial_before (serial_before,unit_id), INDEX idx_uj_serial_after (serial_after,unit_id),
    INDEX idx_unit_journal_unit (unit_id,id), INDEX idx_unit_journal_product (product_id,id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` }];
  const trigger = (name, timing, event, table, body) => statements.push({
    name, sql: `CREATE TRIGGER ${quote(name)} ${timing} ${event} ON ${quote(table)} FOR EACH ROW BEGIN ${body} END`,
  });
  trigger('mdv_unit_journal_no_update', 'BEFORE', 'UPDATE', TABLE, "SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Diario imutavel: edicao proibida';");
  trigger('mdv_unit_journal_no_delete', 'BEFORE', 'DELETE', TABLE, "SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Diario imutavel: exclusao proibida';");
  for (const event of ['INSERT', 'UPDATE', 'DELETE']) {
    const ref = event === 'DELETE' ? 'OLD' : 'NEW';
    const state = r => `JSON_OBJECT('unit',${unit(r)},'product',(SELECT ${product('p')} FROM products p WHERE p.id=${r}.product_id),
      'sale',(SELECT ${snapshot(schema.sales, 's')} FROM sales s WHERE s.id=${r}.sale_id),
      'order',(SELECT ${snapshot(schema.orders, 'o')} FROM orders o WHERE o.id=${r}.order_id))`;
    const before = event === 'INSERT' ? 'NULL' : state('OLD');
    const after = event === 'DELETE' ? 'NULL' : state('NEW');
    const changed = schema.units.filter(c => c !== 'updated_at').map(c => `NOT (OLD.${quote(c)} <=> NEW.${quote(c)})`).join(' OR ');
    const insert = `INSERT INTO ${j} ${columns} VALUES (UUID(),${ref}.id,${ref}.product_id,'unit_${event.toLowerCase()}',USER(),${before},${after});`;
    trigger(`mdv_unit_journal_${event.toLowerCase()}`, 'AFTER', event, 'units', event === 'UPDATE' ? `IF ${changed} THEN ${insert} END IF;` : insert);
  }
  for (const event of ['UPDATE', 'DELETE']) {
    const changed = schema.orders.filter(c => c !== 'updated_at').map(c => `NOT (OLD.${quote(c)} <=> NEW.${quote(c)})`).join(' OR ');
    const data = r => `JSON_OBJECT('unit',${unit('u')},'product',${product('p')},'order',${snapshot(schema.orders, r)})`;
    const insert = `INSERT INTO ${j} ${columns} SELECT UUID(),u.id,u.product_id,'order_${event.toLowerCase()}',USER(),${data('OLD')},${event === 'DELETE' ? 'NULL' : data('NEW')}
      FROM units u LEFT JOIN products p ON p.id=u.product_id WHERE u.order_id=OLD.id;`;
    trigger(`mdv_unit_journal_order_${event.toLowerCase()}`, event === 'DELETE' ? 'BEFORE' : 'AFTER', event, 'orders', event === 'UPDATE' ? `IF ${changed} THEN ${insert} END IF;` : insert);
  }
  // Product changes preserve the previous commercial data of each device.
  const changedProduct = schema.products.filter(c => c !== 'updated_at').map(c => `NOT (OLD.${quote(c)} <=> NEW.${quote(c)})`).join(' OR ');
  trigger('mdv_unit_journal_product_update', 'AFTER', 'UPDATE', 'products', `IF ${changedProduct} THEN
    INSERT INTO ${j} ${columns} SELECT UUID(),u.id,u.product_id,'product_update',USER(),${context('u', 'OLD')},${context('u', 'NEW')} FROM units u WHERE u.product_id=NEW.id;
    END IF;`);
  trigger('mdv_unit_journal_product_delete', 'BEFORE', 'DELETE', 'products', `INSERT INTO ${j} ${columns} SELECT UUID(),u.id,u.product_id,'product_delete',USER(),${context('u', 'OLD')},NULL FROM units u WHERE u.product_id=OLD.id;`);
  // Sales and location changes are recorded even when a unit status update fails.
  for (const table of ['sale_items', 'product_stock_locations', 'stock_location_movements']) {
    for (const event of ['INSERT', 'UPDATE', 'DELETE']) {
      const ref = event === 'DELETE' ? 'OLD' : 'NEW';
      const match = r => table === 'sale_items'
        ? `(u.id=${r}.serialized_unit_id OR (${r}.imei IS NOT NULL AND TRIM(${r}.imei)<>'' AND (u.imei_1=${r}.imei OR u.imei_2=${r}.imei OR u.serial=${r}.imei)))`
        : `u.product_id=${r}.product_id`;
      const predicate = event === 'UPDATE' ? `(${match('OLD')} OR ${match('NEW')})` : match(ref);
      const data = r => `JSON_OBJECT('unit',${unit('u')},'product',${product('p')},'${table}',${snapshot(schema[table], r)}${table === 'sale_items' ? `,'sale',(SELECT ${snapshot(schema.sales, 's')} FROM sales s WHERE s.id=${r}.sale_id)` : ''})`;
      const changed = schema[table].filter(c => c !== 'updated_at').map(c => `NOT (OLD.${quote(c)} <=> NEW.${quote(c)})`).join(' OR ');
      const insert = `INSERT INTO ${j} ${columns} SELECT UUID(),u.id,u.product_id,'${table}_${event.toLowerCase()}',USER(),${event === 'INSERT' ? 'NULL' : data('OLD')},${event === 'DELETE' ? 'NULL' : data('NEW')} FROM units u LEFT JOIN products p ON p.id=u.product_id WHERE ${predicate};`;
      trigger(`mdv_uj_${table}_${event.toLowerCase()}`, 'AFTER', event, table, event === 'UPDATE' ? `IF ${changed} THEN ${insert} END IF;` : insert);
    }
  }
  for (const event of ['UPDATE', 'DELETE']) {
    const changed = schema.sales.filter(c => c !== 'updated_at').map(c => `NOT (OLD.${quote(c)} <=> NEW.${quote(c)})`).join(' OR ');
    const data = r => `JSON_OBJECT('unit',${unit('u')},'product',${product('p')},'sale',${snapshot(schema.sales, r)})`;
    const insert = `INSERT INTO ${j} ${columns} SELECT UUID(),u.id,u.product_id,'sale_${event.toLowerCase()}',USER(),${data('OLD')},${event === 'DELETE' ? 'NULL' : data('NEW')}
      FROM units u LEFT JOIN products p ON p.id=u.product_id WHERE u.sale_id=OLD.id OR EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id=OLD.id AND (si.serialized_unit_id=u.id OR (si.imei IS NOT NULL AND TRIM(si.imei)<>'' AND si.imei IN (u.imei_1,u.imei_2,u.serial))));`;
    trigger(`mdv_unit_journal_sale_${event.toLowerCase()}`, event === 'DELETE' ? 'BEFORE' : 'AFTER', event, 'sales', event === 'UPDATE' ? `IF ${changed} THEN ${insert} END IF;` : insert);
  }
  // No FK cascade: the journal survives deletion of the operational record.
  // Baseline is today's snapshot, never presented as a recovered original entry.
  statements.push({ name: 'baseline', sql: `INSERT INTO ${j} ${columns}
    SELECT CONCAT('baseline:',u.id),u.id,u.product_id,'baseline',USER(),NULL,
      JSON_OBJECT('unit',${unit('u')},'product',${product('p')},'order',(SELECT ${snapshot(schema.orders, 'o')} FROM orders o WHERE o.id=u.order_id))
    FROM units u LEFT JOIN products p ON p.id=u.product_id
    WHERE NOT EXISTS (SELECT 1 FROM ${j} e WHERE e.unit_id=u.id)` });
  statements.push({ name: 'existing_sales', sql: `INSERT INTO ${j} ${columns}
    SELECT CONCAT('existing-sale:',u.id,':',si.id),u.id,u.product_id,'existing_sale_reference',USER(),NULL,
      JSON_OBJECT('unit',${unit('u')},'product',${product('p')},'sale_items',${snapshot(schema.sale_items, 'si')},'sale',${snapshot(schema.sales, 's')})
    FROM units u JOIN sale_items si ON si.serialized_unit_id=u.id OR (si.imei IS NOT NULL AND TRIM(si.imei)<>'' AND si.imei IN (u.imei_1,u.imei_2,u.serial))
    LEFT JOIN products p ON p.id=u.product_id LEFT JOIN sales s ON s.id=si.sale_id
    WHERE NOT EXISTS (SELECT 1 FROM ${j} e WHERE e.event_key=CONCAT('existing-sale:',u.id,':',si.id))` });
  return statements;
}
module.exports = { TABLE, buildUnitJournalMigration, snapshot };
