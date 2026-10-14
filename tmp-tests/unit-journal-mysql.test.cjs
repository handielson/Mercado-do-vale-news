'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildUnitJournalMigration}=require('../services/unitJournalSchema.cjs');

// Run only on an explicitly configured disposable LOCAL MySQL database.
// Never fall back to .env or operational DB credentials.
test('MySQL: snapshots, sale exit, rollback and immutable history after deletion',{
  skip:process.env.UNIT_JOURNAL_TEST_MYSQL!=='1',
},async t=>{
  const host=process.env.UNIT_JOURNAL_TEST_HOST||'127.0.0.1';
  const database=process.env.UNIT_JOURNAL_TEST_DATABASE||'';
  assert.ok(['127.0.0.1','localhost','::1'].includes(host),'Local test host required');
  assert.match(database,/^mdv_unit_journal_test_[a-z0-9_]+$/,'Disposable DB name required');
  const db=await require('mysql2/promise').createConnection({host,database,user:process.env.UNIT_JOURNAL_TEST_USER,password:process.env.UNIT_JOURNAL_TEST_PASSWORD});
  t.after(()=>db.end());
  const [existing]=await db.query('SHOW TABLES');assert.equal(existing.length,0,'Test database must be empty');
  const definitions={
    products:'id CHAR(36) PRIMARY KEY,name TEXT,sku VARCHAR(100),specs JSON,stock_quantity INT',
    units:'id CHAR(36) PRIMARY KEY,product_id CHAR(36),imei_1 VARCHAR(20),imei_2 VARCHAR(20),serial VARCHAR(100),status VARCHAR(20),sale_id CHAR(36),order_id CHAR(36),cost_price INT',
    sales:'id CHAR(36) PRIMARY KEY,payment_status VARCHAR(20),total INT',
    orders:'id CHAR(36) PRIMARY KEY,status VARCHAR(20)',
    sale_items:'id CHAR(36) PRIMARY KEY,product_id CHAR(36),sale_id CHAR(36),serialized_unit_id CHAR(36),imei VARCHAR(100),quantity INT',
    product_stock_locations:'id CHAR(36) PRIMARY KEY,product_id CHAR(36),quantity INT',
    stock_location_movements:'id CHAR(36) PRIMARY KEY,product_id CHAR(36),quantity INT,reason TEXT',
  };
  const schema={};
  for(const [table,definition] of Object.entries(definitions)) {
    await db.query(`CREATE TABLE ${table} (${definition}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    const [columns]=await db.query(`SHOW COLUMNS FROM ${table}`);schema[table]=columns.map(c=>c.Field);
  }
  for(const {sql} of buildUnitJournalMigration(schema)) await db.query(sql);
  await db.query("INSERT INTO products(id,name,sku,stock_quantity) VALUES ('p1','Poco','SAME-SKU',1),('p2','Poco','SAME-SKU',1)");
  await db.query("INSERT INTO units(id,product_id,imei_1,status,cost_price) VALUES ('u1','p1','test-imei','available',10000)");
  const [[created]]=await db.query("SELECT after_data FROM unit_journal_events WHERE event_type='unit_insert'");
  const parse=value=>typeof value==='string'?JSON.parse(value):value;
  assert.equal(parse(created.after_data).unit.cost_price,10000);
  assert.equal(parse(created.after_data).product.sku,'SAME-SKU');
  await db.query("INSERT INTO orders VALUES ('order1','pending')");
  await db.query("UPDATE units SET order_id='order1' WHERE id='u1'");
  await db.query("UPDATE orders SET status='confirmed' WHERE id='order1'");
  await db.query("UPDATE products SET name='Poco atualizado' WHERE id='p1'");
  await db.query("INSERT INTO product_stock_locations VALUES ('loc1','p1',1)");
  await db.query("UPDATE product_stock_locations SET quantity=2 WHERE id='loc1'");
  await db.query("DELETE FROM product_stock_locations WHERE id='loc1'");
  await db.query("INSERT INTO stock_location_movements VALUES ('move1','p1',1,'test')");
  await db.query("UPDATE stock_location_movements SET reason='test-updated' WHERE id='move1'");
  await db.query("DELETE FROM stock_location_movements WHERE id='move1'");
  const [[beforeRollback]]=await db.query("SELECT COUNT(*) n FROM unit_journal_events WHERE event_type='unit_update'");
  await db.beginTransaction();
  await db.query("UPDATE units SET status='sold' WHERE id='u1'");
  await db.rollback();
  const [[rolledBack]]=await db.query("SELECT COUNT(*) n FROM unit_journal_events WHERE event_type='unit_update'");assert.equal(rolledBack.n,beforeRollback.n);
  await db.query("INSERT INTO sales VALUES ('sale1','paid',20000)");
  await db.query("INSERT INTO sale_items VALUES ('si1','p1','sale1','u1','test-imei',1)");
  await db.query("UPDATE sale_items SET quantity=2 WHERE id='si1'");
  await db.query("UPDATE units SET status='sold',sale_id='sale1' WHERE id='u1'");
  const [[exit]]=await db.query("SELECT before_data,after_data FROM unit_journal_events WHERE event_type='unit_update' ORDER BY id DESC LIMIT 1");
  assert.equal(parse(exit.before_data).unit.status,'available');assert.equal(parse(exit.after_data).unit.status,'sold');
  await db.query("UPDATE sales SET total=22000 WHERE id='sale1'");
  await db.query("DELETE FROM sales WHERE id='sale1'");
  await db.query("DELETE FROM sale_items WHERE id='si1'");
  await db.query("DELETE FROM orders WHERE id='order1'");
  await db.query("DELETE FROM products WHERE id='p1'");
  const [types]=await db.query("SELECT DISTINCT event_type FROM unit_journal_events");
  for(const expected of ['order_update','order_delete','product_update','product_delete','sale_update','sale_delete',
    'sale_items_insert','sale_items_update','sale_items_delete',
    'product_stock_locations_insert','product_stock_locations_update','product_stock_locations_delete',
    'stock_location_movements_insert','stock_location_movements_update','stock_location_movements_delete']) {
    assert.ok(types.some(row=>row.event_type===expected),expected);
  }
  await db.query("DELETE FROM units WHERE id='u1'");
  const [[history]]=await db.query("SELECT COUNT(*) n FROM unit_journal_events WHERE imei_1_after='test-imei'");assert.ok(history.n>=3);
  await assert.rejects(db.query('DELETE FROM unit_journal_events'),error=>error.sqlState==='45000');
  await assert.rejects(db.query("UPDATE unit_journal_events SET event_type='changed'"),error=>error.sqlState==='45000');
});
