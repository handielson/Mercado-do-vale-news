'use strict';
// Clones structure only, into a disposable schema. Never copies operational rows.
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('../tmp-tests/vps-ssh-config.cjs');
const names = ['smartphoneMovingAverageCore.cjs','smartphoneMovingAverageServer.cjs','smartphonePriceGroupsCore.cjs','physicalRamCore.cjs','serializedSaleFinalization.cjs','unitJournalSchema.cjs'];
const files = Object.fromEntries(names.map(name => [name, fs.readFileSync(path.join(__dirname,'../services',name),'utf8')]));
const migration = fs.readFileSync(path.join(__dirname,'../migrations/vps-smartphone-moving-average.sql'),'utf8');
async function validate(files, migration) {
  require('dotenv').config({path:'/var/www/mdv-api/.env',quiet:true});
  const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
  const {randomUUID,randomBytes}=require('node:crypto');
  const mysql=require('mysql2/promise');
  const operational=process.env.DB_NAME;
  if(!/^[a-zA-Z0-9_]+$/.test(operational)) throw Error('Invalid database');
  const schema='mdv_moving_average_test_'+Date.now()+'_'+randomBytes(4).toString('hex');
  const root=await mysql.createConnection({user:'root',socketPath:'/var/run/mysqld/mysqld.sock'});
  let dir,pool;
  try {
    const [[version]]=await root.query('SELECT VERSION() version');
    assert.match(version.version,/^8\.0\./);
    await root.query('CREATE DATABASE '+schema);
    const tables=['models','categories','products','units','sales','sale_items','orders','product_stock_locations','stock_location_movements'];
    for(const table of tables) await root.query(`CREATE TABLE ${schema}.${table} LIKE ${operational}.${table}`);
    dir=fs.mkdtempSync('/var/tmp/mdv-moving-average-test-');
    for(const [name,source] of Object.entries(files)) fs.writeFileSync(path.join(dir,name),source,{mode:0o600});
    const costs=require(path.join(dir,'smartphoneMovingAverageServer.cjs'));
    const {finalizeSerializedSale}=require(path.join(dir,'serializedSaleFinalization.cjs'));
    const {buildUnitJournalMigration}=require(path.join(dir,'unitJournalSchema.cjs'));
    pool=mysql.createPool({user:'root',socketPath:'/var/run/mysqld/mysqld.sock',database:schema,connectionLimit:8});
    const columns={};for(const table of tables){const [rows]=await pool.query('SHOW COLUMNS FROM '+table);columns[table]=rows.map(r=>r.Field);}
    for(const statement of buildUnitJournalMigration(columns)) await pool.query(statement.sql);
    const statements=migration.split(';').map(s=>s.trim()).filter(Boolean);
    for(let repeat=0;repeat<2;repeat++) for(const statement of statements) await pool.query(statement);
    const category=randomUUID(), company=randomUUID();
    await pool.query('INSERT INTO categories (id,name) VALUES (?,?)',[category,'Smartphones']);
    const createModel=async()=>{
      const model={id:randomUUID(),name:'Fixture phone',company_id:company,category_name:'Smartphones'};
      const product={id:randomUUID(),model_id:model.id,company_id:company,specs:{ram:'4GB',storage:'256GB',version:'Global'},price_retail:97200,price_reseller:92200,price_wholesale:78200};
      await pool.query('INSERT INTO models (id,name,category_id,company_id,template_values) VALUES (?,?,?,?,?)',[model.id,model.name,category,company,'{}']);
      await pool.query('INSERT INTO products (id,name,sku,model_id,company_id,specs,stock_quantity,price_cost,price_retail,price_reseller,price_wholesale) VALUES (?,?,?,?,?,?,?,?,?,?,?)',[product.id,'Fixture','TEST-'+model.id,model.id,company,JSON.stringify(product.specs),3,92500,97200,92200,78200]);
      const units=[];
      for(const cost of [92500,99900,117000]){const id=randomUUID();await pool.query("INSERT INTO units (id,product_id,status,cost_price) VALUES (?,?,'available',?)",[id,product.id,cost]);units.push({id,cost});}
      return {model,product,units};
    };
    const syncProductStock=async(id,db)=>{
      await db.query("UPDATE products SET stock_quantity=(SELECT COUNT(*) FROM units WHERE product_id=? AND status='available') WHERE id=?",[id,id]);
      await costs.synchronizeProduct(pool,id,db);
    };
    const body=(f,index,id=randomUUID())=>({sale:{id,payment_status:'paid',total:97200,payment_methods:[{operator_fee_amount:100,method:'pix',amount:97200}],delivery_total:200,cost_total:f.units[index].cost,profit:0},items:[{sale_id:id,product_id:f.product.id,serialized_unit_id:f.units[index].id,quantity:1,unit_price:97200,total:97200,unit_cost:f.units[index].cost}]});
    const f=await createModel();
    const oldSale=randomUUID();await pool.query("INSERT INTO sales (id,total,cost_total,profit,payment_status,created_at) VALUES (?,97200,77200,20000,'paid',NOW()-INTERVAL 1 DAY)",[oldSale]);
    await pool.query('INSERT INTO sale_items (id,sale_id,product_id,quantity,unit_price,total,unit_cost) VALUES (?,?,?,1,97200,97200,77200)',[randomUUID(),oldSale,f.product.id]);
    const oldBefore=JSON.stringify([(await pool.query('SELECT * FROM sales WHERE id=?',[oldSale]))[0],(await pool.query('SELECT * FROM sale_items WHERE sale_id=?',[oldSale]))[0]]);
    await pool.query("INSERT INTO units (id,product_id,status,cost_price,sale_id) VALUES (?,?,'sold',77200,?)",[randomUUID(),f.product.id,oldSale]);
    await costs.synchronizeProduct(pool,f.product.id);
    assert.equal((await costs.saleCostBasisInfo(pool,oldSale)).historical,true);
    const quote=()=>costs.preview(pool,f.model).then(r=>Object.values(r)[0]);
    assert.equal((await quote()).moving_average_cost,103133);
    const request=body(f,0),first=await finalizeSerializedSale({pool,syncProductStock,...request});
    assert.equal(Number(first.sale.cost_total),103133);assert.equal(Number(first.sale.profit),-6233);
    assert.equal((await quote()).moving_average_cost,103133);
    assert.equal((await finalizeSerializedSale({pool,syncProductStock,...request})).replay,true);
    assert.equal(Number((await pool.query('SELECT cost_price FROM units WHERE id=?',[f.units[0].id]))[0][0].cost_price),92500);
    const receipt=randomUUID();await pool.query("INSERT INTO units (id,product_id,status,cost_price) VALUES (?,?,'available',90000)",[receipt,f.product.id]);
    await costs.synchronizeProduct(pool,f.product.id);assert.equal((await quote()).moving_average_cost,98756);
    await pool.query("UPDATE units SET status='available',sale_id=NULL,sold_at=NULL WHERE id=?",[f.units[0].id]);
    await costs.synchronizeProduct(pool,f.product.id);assert.equal((await quote()).moving_average_cost,99850);
    assert.equal((await costs.saleBasis(pool,request.sale.id))[0].unit_cost,103133);
    const protectedAfter=JSON.stringify([(await pool.query('SELECT * FROM sales WHERE id=?',[oldSale]))[0],(await pool.query('SELECT * FROM sale_items WHERE sale_id=?',[oldSale]))[0]]);
    assert.equal(protectedAfter,oldBefore);
    const concurrent=await createModel();await costs.synchronizeProduct(pool,concurrent.product.id);
    const results=await Promise.all([finalizeSerializedSale({pool,syncProductStock,...body(concurrent,0)}),finalizeSerializedSale({pool,syncProductStock,...body(concurrent,1)})]);
    assert.deepEqual(results.map(r=>Number(r.sale.cost_total)).sort(),[103133,103134]);
    assert.equal(Object.values(await costs.preview(pool,concurrent.model))[0].moving_average_cost,103133);
    const failed=await createModel();await costs.synchronizeProduct(pool,failed.product.id);
    const rejected=body(failed,0);await assert.rejects(finalizeSerializedSale({pool,syncProductStock:async()=>{throw Error('fixture rollback');},...rejected}),/fixture rollback/);
    assert.equal((await pool.query('SELECT id FROM sales WHERE id=?',[rejected.sale.id]))[0].length,0);
    assert.equal((await pool.query('SELECT status FROM units WHERE id=?',[failed.units[0].id]))[0][0].status,'available');
    assert.equal((await costs.saleBasis(pool,rejected.sale.id)).length,0);
    const [prices]=await pool.query('SELECT price_retail,price_reseller,price_wholesale FROM products');
    assert.ok(prices.every(p=>Number(p.price_retail)===97200&&Number(p.price_reseller)===92200&&Number(p.price_wholesale)===78200));
    console.log(JSON.stringify({mysql:version.version,isolated:true,migrationIdempotent:true,realJournalTriggers:true,atomicSale:true,retry:true,concurrentSales:true,receipt:true,return:true,rollback:true,purchasePreserved:true,salePricesPreserved:true,oldSalesPreserved:true}));
  } finally {
    if(pool) await pool.end();
    if(!/^mdv_moving_average_test_\d+_[a-f0-9]+$/.test(schema)) throw Error('Unsafe test cleanup');
    await root.query('DROP DATABASE IF EXISTS '+schema);await root.end();
    if(dir){if(!dir.startsWith('/var/tmp/mdv-moving-average-test-'))throw Error('Unsafe directory');fs.rmSync(dir,{recursive:true});}
  }
}
const program=`(${validate.toString()})(${JSON.stringify(files)},${JSON.stringify(migration)}).catch(e=>{console.error(JSON.stringify({error:e.code||e.message,stack:e.stack?.split(String.fromCharCode(10)).slice(0,4)}));process.exitCode=1;});`;
const client=new Client();
client.on('error',e=>{console.error(e.message);process.exitCode=1;});
client.on('ready',()=>client.exec('cd /var/www/mdv-api && node',(error,stream)=>{
  if(error)throw error;stream.pipe(process.stdout);stream.stderr.pipe(process.stderr);
  stream.on('close',code=>{process.exitCode=code;client.end();});stream.end(program);
})).connect(getVpsSshConfig());
