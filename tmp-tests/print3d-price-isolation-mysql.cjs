'use strict';
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
module.exports=async pool=>{
 // Minimal central-model schema for this disposable database only.
 await pool.query('CREATE TABLE categories (id CHAR(36) PRIMARY KEY,name VARCHAR(120))');
 await pool.query('CREATE TABLE models (id CHAR(36) PRIMARY KEY,name VARCHAR(120),company_id CHAR(36),category_id CHAR(36),template_values JSON)');
 await pool.query('CREATE TABLE units (product_id CHAR(36),cost_price INT,status VARCHAR(30))');
 await pool.query('CREATE TABLE product_price_history (id CHAR(36),product_id CHAR(36),price_cost INT,price_retail INT,price_reseller INT,price_wholesale INT)');
 const [columns]=await pool.query('SHOW COLUMNS FROM products');const known=new Set(columns.map(c=>c.Field));
 for(const [name,type] of Object.entries({model_id:'CHAR(36)',name:'VARCHAR(120)',specs:'JSON',is_parent:'TINYINT',is_combo:'TINYINT',offer_type:'VARCHAR(30)',price_cost:'INT',price_retail:'INT',price_reseller:'INT',price_wholesale:'INT'}))
  if(!known.has(name))await pool.query(`ALTER TABLE products ADD COLUMN ${name} ${type} NULL`);
 const category=randomUUID(),model=randomUUID(),company=randomUUID(),phone=randomUUID(),piece=randomUUID();
 await pool.query('INSERT INTO categories VALUES (?,?)',[category,'Smartphones']);
 await pool.query('INSERT INTO models VALUES (?,?,?,?,?)',[model,'Modelo teste',company,category,JSON.stringify({ram:'8',storage:'128'})]);
 for(const [id,is3d,price] of [[phone,0,120000],[piece,1,2500]])await pool.query(`INSERT INTO products
  (id,model_id,company_id,name,sku,specs,is_print3d,price_cost,price_retail,price_reseller,price_wholesale) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  [id,model,company,'Teste local',id,JSON.stringify({ram:'8',storage:'128',material:'PLA',size:'Grande'}),is3d,100,price,price,price]);
 const {registerSmartphonePriceGroupRoutes,withSmartphonePriceWrite}=require('../services/smartphonePriceGroupsServer.cjs');
 const app=require('fastify')();
 registerSmartphonePriceGroupRoutes(app,{pool,requireSyncKey:async()=>{}});
 try {
  const listing=await app.inject({url:`/models/${model}/smartphone-price-groups`});assert.equal(listing.statusCode,200,listing.body);
  const {groups,unresolved}=listing.json();assert.equal(groups.length,1);assert.deepEqual(unresolved,[]);assert.equal(groups[0].products.length,1);assert.equal(groups[0].products[0].id,phone);
  const changed=await app.inject({method:'PUT',url:`/models/${model}/smartphone-price-groups/${groups[0].id}`,payload:{product_id:phone,revision:groups[0].revision,prices:{price_retail:125000,price_reseller:125000,price_wholesale:125000}}});
  assert.equal(changed.statusCode,200,changed.body);
  const [[unchanged]]=await pool.query('SELECT price_retail FROM products WHERE id=?',[piece]);assert.equal(Number(unchanged.price_retail),2500);
  await withSmartphonePriceWrite(pool,{id:piece,price_retail:2900,specs:{material:'PETG',size:'Grande',finish:'Fosco'}},async(connection,product)=>{
   await connection.query('UPDATE products SET price_retail=?,specs=? WHERE id=?',[product.price_retail,JSON.stringify(product.specs),piece]);
  });
  const [[saved]]=await pool.query('SELECT price_retail,specs FROM products WHERE id=?',[piece]);assert.equal(Number(saved.price_retail),2900);
  const specs=typeof saved.specs==='string'?JSON.parse(saved.specs):saved.specs;assert.equal(specs.finish,'Fosco');assert.equal(specs.material,'PETG');
  console.log('PASS: MySQL phone price groups exclude 3D products from listing, group updates and price inheritance.');
 } finally {await app.close();}
};
