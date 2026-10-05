const {test}=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const mysql=require('mysql2/promise');
const {reconcileExternalStock}=require('../services/externalStockReconciliation.cjs');

const docker=(...args)=>execFileSync('docker',['--context','desktop-linux',...args],{
  encoding:'utf8',timeout:args[0]==='run'?180000:15000,windowsHide:true,stdio:['ignore','pipe','pipe'],
}).trim();

test('Bling stock re-entry does not lock deposit metadata across connections', {timeout:90000}, async t=>{
  const password=`test-${randomUUID()}`;
  const container=docker('run','--rm','-d','--name',`mdv-stock-test-${randomUUID()}`,
    '-e',`MYSQL_ROOT_PASSWORD=${password}`,'-e','MYSQL_ROOT_HOST=%',
    '-e','MYSQL_DATABASE=mdv_stock_test','-p','127.0.0.1::3306','mysql:8.4');
  t.after(()=>docker('rm','-f','-v',container));
  const port=Number(docker('port',container,'3306/tcp').split(':').pop());
  const config={host:'127.0.0.1',port,user:'root',password,database:'mdv_stock_test',connectionLimit:3};
  for(let attempt=0;attempt<40;attempt++) {
    try {const connection=await mysql.createConnection(config);await connection.end();break;}
    catch(error) {if(attempt===39) throw error;await new Promise(resolve=>setTimeout(resolve,1000));}
  }
  const pool=mysql.createPool(config);
  t.after(()=>pool.end());
  await pool.query('CREATE TABLE products (id CHAR(36) PRIMARY KEY,company_id CHAR(36),stock_quantity INT NOT NULL DEFAULT 0,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB');
  await pool.query('CREATE TABLE stock_deposits (id CHAR(36) PRIMARY KEY,name VARCHAR(60),is_default TINYINT NOT NULL DEFAULT 1) ENGINE=InnoDB');
  await pool.query('CREATE TABLE stock_locations (id CHAR(36) PRIMARY KEY,name VARCHAR(60),is_default TINYINT NOT NULL DEFAULT 1) ENGINE=InnoDB');
  await pool.query('CREATE TABLE product_stock_locations (id CHAR(36) PRIMARY KEY,company_id CHAR(36),product_id CHAR(36),deposit_id CHAR(36),location_id CHAR(36),quantity INT NOT NULL,reserved_quantity INT NOT NULL DEFAULT 0,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX (product_id)) ENGINE=InnoDB');
  await pool.query('CREATE TABLE stock_location_movements (id CHAR(36) PRIMARY KEY,company_id CHAR(36),product_id CHAR(36),from_deposit_id CHAR(36),from_location_id CHAR(36),to_deposit_id CHAR(36),to_location_id CHAR(36),quantity INT,movement_type VARCHAR(40),reason VARCHAR(255),reference_type VARCHAR(80),previous_from_quantity INT,new_from_quantity INT,previous_to_quantity INT,new_to_quantity INT,notes TEXT) ENGINE=InnoDB');
  const companyId=randomUUID(),productId=randomUUID(),depositId=randomUUID(),locationId=randomUUID(),stockId=randomUUID();
  await pool.query('INSERT INTO products (id,company_id) VALUES (?,?)',[productId,companyId]);
  await pool.query('INSERT INTO stock_deposits (id,name) VALUES (?,?)',[depositId,'Deposito']);
  await pool.query('INSERT INTO stock_locations (id,name) VALUES (?,?)',[locationId,'Entrada']);
  await pool.query('INSERT INTO product_stock_locations (id,company_id,product_id,deposit_id,location_id,quantity) VALUES (?,?,?,?,?,0)',[stockId,companyId,productId,depositId,locationId]);
  const blocker=await pool.getConnection();
  const writer=await pool.getConnection();
  try {
    await blocker.beginTransaction();
    await blocker.query(`SELECT psl.* FROM product_stock_locations psl
      LEFT JOIN stock_deposits sd ON sd.id=psl.deposit_id
      LEFT JOIN stock_locations sl ON sl.id=psl.location_id
      WHERE psl.product_id=? FOR UPDATE`,[productId]);
    await writer.query('SET SESSION innodb_lock_wait_timeout=2');
    await assert.rejects(writer.query('UPDATE stock_deposits SET name=name WHERE id=?',[depositId]),{code:'ER_LOCK_WAIT_TIMEOUT'});
  } finally {
    await blocker.rollback();
    blocker.release();writer.release();
  }
  const result=await reconcileExternalStock(pool,{productId,targetQuantity:1,reason:'bling_reconcile',getIncoming:async()=>{
    const helper=await pool.getConnection();
    try {
      await helper.query('SET SESSION innodb_lock_wait_timeout=2');
      await helper.query('UPDATE stock_deposits SET name=name WHERE id=?',[depositId]);
      await helper.query('UPDATE stock_locations SET name=name WHERE id=?',[locationId]);
    } finally {helper.release();}
    return {depositId,locationId};
  }});
  assert.equal(result.ok,true);
  const [[product]]=await pool.query('SELECT stock_quantity FROM products WHERE id=?',[productId]);
  const [[stock]]=await pool.query('SELECT quantity FROM product_stock_locations WHERE id=?',[stockId]);
  const [[movement]]=await pool.query('SELECT quantity,reference_type FROM stock_location_movements WHERE product_id=?',[productId]);
  assert.equal(Number(product.stock_quantity),1);
  assert.equal(Number(stock.quantity),1);
  assert.deepEqual([Number(movement.quantity),movement.reference_type],[1,'external_stock_total']);
});
