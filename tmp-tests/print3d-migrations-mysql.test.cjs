// Runs only against a disposable Docker Desktop MySQL bound to loopback.
// This test never reads application .env or connects to a configured database.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const mysql=require('mysql2/promise');
const {reservePriorityStock,reservePriorityStockOnConnection}=require('../services/priorityStockReservation.cjs');
const {decrementPriorityStock}=require('../services/priorityStockDecrement.cjs');
const {processOrderReservation}=require('../services/orderStockReservation.cjs');
const {applyManualStockMovement}=require('../services/manualStockMovement.cjs');
const {reconcileExternalStock}=require('../services/externalStockReconciliation.cjs');
const {createPrint3dCheckout}=require('../services/print3dCheckout.cjs');
const {quoteProduct,quotePaymentSchedule}=require('../services/print3dStorefrontQuote.cjs');
const {quoteItemsFingerprint}=require('../services/print3dShippingQuoteToken.cjs');

const docker=(...args)=>execFileSync('docker',['--context','desktop-linux',...args],{
  encoding:'utf8',timeout:args[0]==='run'?180000:15000,windowsHide:true,stdio:['ignore','pipe','pipe']
}).trim();

test('MySQL local: migrations 3D, checkout concorrente, reserva central e rollback', {timeout:240000}, async t=>{
  const context=JSON.parse(docker('context','inspect','desktop-linux'))[0];
  assert.equal(context.Endpoints.docker.Host,'npipe:////./pipe/dockerDesktopLinuxEngine');
  docker('info','--format','{{.ServerVersion}}');
  const name=`mdv-print3d-test-${randomUUID()}`;
  const password=randomUUID();
  let container,pool;
  t.after(async()=>{
    if(pool) await pool.end();
    if(container) docker('rm','-f','-v',container);
  });
  container=docker('run','--rm','-d','--name',name,'-e',`MYSQL_ROOT_PASSWORD=${password}`,
    '-e','MYSQL_ROOT_HOST=%','-e','MYSQL_DATABASE=mdv_print3d_test','-p','127.0.0.1::3306','mysql:8.4');
  const port=Number(docker('port',container,'3306/tcp').split(':').pop());
  assert(Number.isSafeInteger(port)&&port>0);
  const config={host:'127.0.0.1',port,user:'root',password,database:'mdv_print3d_test',connectionLimit:3};
  for(let attempt=0;attempt<60;attempt++) {
    try { const connection=await mysql.createConnection(config);await connection.end();break; }
    catch(error) { if(attempt===59) throw error;await new Promise(resolve=>setTimeout(resolve,1000)); }
  }
  pool=mysql.createPool(config);
  await pool.query("CREATE TABLE products (id CHAR(36) NOT NULL PRIMARY KEY, company_id CHAR(36) NULL, status VARCHAR(32) NOT NULL DEFAULT 'active',stock_quantity INT NOT NULL DEFAULT 0,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  await pool.query(`CREATE TABLE orders (id CHAR(36) NOT NULL PRIMARY KEY,customer_id CHAR(36) NULL,company_id CHAR(36) NULL,
    customer_name VARCHAR(255),customer_phone VARCHAR(30),customer_email VARCHAR(254),status VARCHAR(40),payment_status VARCHAR(40),
    payment_method VARCHAR(40),delivery_type VARCHAR(40),shipping_address JSON,shipping_cost BIGINT,subtotal BIGINT,discount BIGINT,total BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE order_items (id CHAR(36) NOT NULL PRIMARY KEY,order_id CHAR(36) NOT NULL,product_id CHAR(36) NOT NULL,
    product_name VARCHAR(255) NOT NULL,product_sku VARCHAR(191),quantity INT NOT NULL,unit_price BIGINT NOT NULL,subtotal BIGINT NOT NULL,
    INDEX idx_order_items_order (order_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query('CREATE TABLE banners (id CHAR(36) NOT NULL PRIMARY KEY, display_order INT NOT NULL DEFAULT 0) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
  for(let number=28;number<=52;number++) {
    const file=path.join(__dirname,'../migrations',require('node:fs').readdirSync(path.join(__dirname,'../migrations')).find(name=>name.startsWith(String(number).padStart(3,'0')+'_')));
    const statements=readFileSync(file,'utf8').replace(/--[^\n]*/g,'').split(';').map(value=>value.trim()).filter(Boolean);
    for(let index=0;index<statements.length;index++) {
      try { await pool.query(statements[index]); }
      catch(error) { throw new Error(`${path.basename(file)} statement ${index+1}: ${error.code||error.message}`,{cause:error}); }
    }
  }
  const [tables]=await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name LIKE 'print3d_%'");
  assert(tables.length>=20,`Apenas ${tables.length} tabelas 3D foram criadas`);
  const [orderColumns]=await pool.query("SHOW COLUMNS FROM orders WHERE Field IN ('storefront','print3d_customer_id')");
  assert.deepEqual(orderColumns.map(row=>row.Field).sort(),['print3d_customer_id','storefront']);
  const [legacyOrder]=await pool.query("SHOW COLUMNS FROM orders WHERE Field='customer_id'");
  assert.equal(legacyOrder.length,1);
  const [paymentColumns]=await pool.query("SHOW COLUMNS FROM print3d_order_plans WHERE Field IN ('payment_terms_version','shipping_payment_mode')");
  assert.equal(paymentColumns.length,2);
  const [stockTables]=await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('print3d_filament_stock','print3d_supply_stock','print3d_production_outputs','print3d_order_dispatches')");
  assert.equal(stockTables.length,4);
  const customerId=randomUUID(),order3d=randomUUID(),orderMdv=randomUUID();
  await pool.query('INSERT INTO print3d_customers (id,name,email) VALUES (?,?,?)',[customerId,'Cliente 3D','mesma-pessoa@example.test']);
  await pool.query('INSERT INTO orders (id,customer_id,company_id,storefront,print3d_customer_id) VALUES (?,?,?,?,?)',
    [order3d,null,null,'loja_3d',customerId]);
  await pool.query('INSERT INTO orders (id,customer_id,company_id) VALUES (?,?,?)',[orderMdv,randomUUID(),null]);
  const [orders]=await pool.query('SELECT id,storefront,customer_id,print3d_customer_id FROM orders ORDER BY id');
  assert.equal(orders.find(row=>row.id===order3d).customer_id,null);
  assert.equal(orders.find(row=>row.id===order3d).print3d_customer_id,customerId);
  assert.equal(orders.find(row=>row.id===orderMdv).storefront,'mercado_do_vale');
  assert.equal(orders.find(row=>row.id===orderMdv).print3d_customer_id,null);
  await assert.rejects(pool.query('INSERT INTO orders (id,storefront,print3d_customer_id) VALUES (?,?,?)',
    [randomUUID(),'loja_3d',randomUUID()]),{code:'ER_NO_REFERENCED_ROW_2'});
  await pool.query('INSERT INTO print3d_order_plans (order_id,subtotal_cents,ready_amount_cents,preorder_amount_cents,deposit_amount_cents,due_on_confirmation_cents,due_before_shipping_cents,plan_hash) VALUES (?,?,?,?,?,?,?,?)',
    [order3d,10000,0,10000,5000,5000,5000,'a'.repeat(64)]);
  await pool.query('INSERT INTO print3d_checkout_requests (customer_id,idempotency_key,payload_hash,order_id) VALUES (?,?,?,?)',
    [customerId,randomUUID(),'b'.repeat(64),order3d]);
  await assert.rejects(pool.query('INSERT INTO print3d_filament_stock (filament_id,name_snapshot,color_snapshot,quantity_grams) VALUES (?,?,?,?)',
    ['pla','PLA','Preto',-1]),{code:'ER_CHECK_CONSTRAINT_VIOLATED'});
  await assert.rejects(pool.query('INSERT INTO print3d_supply_stock (supply_id,name_snapshot,unit_snapshot,quantity_units) VALUES (?,?,?,?)',
    ['argola','Argola','un',-1]),{code:'ER_CHECK_CONSTRAINT_VIOLATED'});

  // The reservation module is shared by the 3D checkout and the central stock API.
  // Execute its real SQL under concurrent InnoDB transactions, not a mocked lock.
  await pool.query('CREATE TABLE stock_deposits (id CHAR(36) PRIMARY KEY,name VARCHAR(60),code VARCHAR(30),type VARCHAR(30),is_default TINYINT NOT NULL DEFAULT 1) ENGINE=InnoDB');
  await pool.query('CREATE TABLE stock_locations (id CHAR(36) PRIMARY KEY,name VARCHAR(60),code VARCHAR(30),is_default TINYINT NOT NULL DEFAULT 1) ENGINE=InnoDB');
  await pool.query('CREATE TABLE product_stock_locations (id CHAR(36) PRIMARY KEY,company_id CHAR(36),product_id CHAR(36),deposit_id CHAR(36),location_id CHAR(36),quantity INT NOT NULL,reserved_quantity INT NOT NULL DEFAULT 0,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX idx_product_stock_locations_product_id (product_id)) ENGINE=InnoDB');
  await pool.query('CREATE TABLE stock_location_movements (id CHAR(36) PRIMARY KEY,company_id CHAR(36),product_id CHAR(36),from_deposit_id CHAR(36),from_location_id CHAR(36),quantity INT,movement_type VARCHAR(40),reason VARCHAR(255),reference_type VARCHAR(80),reference_id CHAR(36),previous_from_quantity INT,new_from_quantity INT,notes TEXT) ENGINE=InnoDB');
  const companyId=randomUUID(),depositId=randomUUID(),locationId=randomUUID(),productId=randomUUID(),stockId=randomUUID();
  await pool.query('INSERT INTO stock_deposits (id,name,code,type) VALUES (?,?,?,?)',[depositId,'Principal','PR','own']);
  await pool.query('INSERT INTO stock_locations (id,name,code) VALUES (?,?,?)',[locationId,'Prateleira','A1']);
  await pool.query('INSERT INTO products (id,company_id) VALUES (?,?)',[productId,companyId]);
  await pool.query('INSERT INTO product_stock_locations (id,company_id,product_id,deposit_id,location_id,quantity) VALUES (?,?,?,?,?,1)',[stockId,companyId,productId,depositId,locationId]);
  const reserve=referenceId=>reservePriorityStock(pool,{product_id:productId,quantity:1,reference_type:'order_reservation',reference_id:referenceId});
  const results=await Promise.all([reserve(randomUUID()),reserve(randomUUID())]);
  assert.deepEqual(results.map(result=>result.status).sort(),[200,400]);
  const [[reserved]]=await pool.query('SELECT quantity,reserved_quantity FROM product_stock_locations WHERE id=?',[stockId]);
  assert.equal(Number(reserved.quantity),1);
  assert.equal(Number(reserved.reserved_quantity),1);
  const [[movementCount]]=await pool.query('SELECT COUNT(*) AS count FROM stock_location_movements WHERE product_id=?',[productId]);
  assert.equal(Number(movementCount.count),1);

  const rollbackProduct=randomUUID(),rollbackStock=randomUUID();
  await pool.query('INSERT INTO products (id,company_id) VALUES (?,?)',[rollbackProduct,companyId]);
  await pool.query('INSERT INTO product_stock_locations (id,company_id,product_id,deposit_id,location_id,quantity) VALUES (?,?,?,?,?,1)',[rollbackStock,companyId,rollbackProduct,depositId,locationId]);
  const transaction=await pool.getConnection();
  try {
    await transaction.beginTransaction();
    assert.equal((await reservePriorityStockOnConnection(transaction,{product_id:rollbackProduct,quantity:1,reference_id:randomUUID()})).status,200);
    await transaction.rollback();
  } finally { transaction.release(); }
  const [[afterRollback]]=await pool.query('SELECT reserved_quantity FROM product_stock_locations WHERE id=?',[rollbackStock]);
  assert.equal(Number(afterRollback.reserved_quantity),0);
  const [[rollbackMovements]]=await pool.query('SELECT COUNT(*) AS count FROM stock_location_movements WHERE product_id=?',[rollbackProduct]);
  assert.equal(Number(rollbackMovements.count),0);

  const checkoutProduct=randomUUID(),checkoutStock=randomUUID(),buyerIds=[randomUUID(),randomUUID()];
  await pool.query('INSERT INTO products (id,company_id) VALUES (?,?)',[checkoutProduct,companyId]);
  await pool.query('INSERT INTO product_storefront_offers (product_id,storefront,publication_status,title,price_retail) VALUES (?,?,?,?,?)',
    [checkoutProduct,'loja_3d','published','Peça pronta',1000]);
  await pool.query('INSERT INTO product_stock_locations (id,company_id,product_id,deposit_id,location_id,quantity) VALUES (?,?,?,?,?,1)',
    [checkoutStock,companyId,checkoutProduct,depositId,locationId]);
  for(const [index,buyerId] of buyerIds.entries()) {
    await pool.query('INSERT INTO print3d_customers (id,name,email,email_verified_at) VALUES (?,?,?,NOW())',
      [buyerId,`Comprador ${index+1}`,`buyer-${index+1}@example.test`]);
    await pool.query('INSERT INTO print3d_customer_auth (customer_id,password_hash,salt) VALUES (?,?,?)',[buyerId,'test-hash','test-salt']);
  }
  const checkout=(buyerId,targetProduct=checkoutProduct,targetStock=checkoutStock,createProduction)=>{
    const initialItem=quoteProduct({id:targetProduct,name:'Peça pronta',sku:'P-1',price_retail:1000,available_stock:1,
      print3d_preorder_enabled:0},1);
    const fingerprint=quoteItemsFingerprint([initialItem]);
    const readQuote=async(connection,items)=>{
      const [[stock]]=await connection.query('SELECT quantity-reserved_quantity AS available FROM product_stock_locations WHERE id=?',[targetStock]);
      const [[offer]]=await connection.query("SELECT title,price_retail FROM product_storefront_offers WHERE product_id=? AND storefront='loja_3d' AND publication_status='published'",[targetProduct]);
      const quoted=items.map(item=>quoteProduct({id:item.product_id,name:offer.title,sku:'P-1',price_retail:Number(offer.price_retail),
        available_stock:Number(stock.available),print3d_preorder_enabled:0},item.quantity));
      return {items:quoted,paymentSchedule:quotePaymentSchedule(quoted)};
    };
    const dependencies={
    customerId:buyerId,authVersion:1,companyId,loadQuote:readQuote,
    verifyShipping:async()=>({option:{id:'frenet:1',price_cents:500},subtotal_cents:1000,items_fingerprint:fingerprint,
      production_days:0,handling_business_days:1}),
    body:{idempotency_key:randomUUID(),items:[{product_id:targetProduct,quantity:1}],quote_token:'signed-test',shipping_option_id:'frenet:1',
      shipping_address:{cep:'56300000',street:'Rua Teste',number:'1',neighborhood:'Centro',city:'Petrolina',state:'PE'}},
    };
    if(createProduction) dependencies.createProduction=createProduction;
    return createPrint3dCheckout(pool,dependencies);
  };
  const attempts=await Promise.allSettled(buyerIds.map(buyerId=>checkout(buyerId)));
  assert.equal(attempts.filter(result=>result.status==='fulfilled').length,1,
    attempts.map(result=>result.status==='rejected'?`${result.reason.code||result.reason.statusCode}: ${result.reason.message}`:'fulfilled').join(' | '));
  assert.equal(attempts.filter(result=>result.status==='rejected'&&result.reason.statusCode===409).length,1);
  const [[checkoutCounts]]=await pool.query(`SELECT
    (SELECT COUNT(*) FROM orders WHERE storefront='loja_3d' AND id IN (SELECT order_id FROM order_items WHERE product_id=?)) AS orders_count,
    (SELECT COUNT(*) FROM print3d_order_plans WHERE order_id IN (SELECT order_id FROM order_items WHERE product_id=?)) AS plans_count,
    (SELECT COUNT(*) FROM print3d_checkout_requests WHERE order_id IN (SELECT order_id FROM order_items WHERE product_id=?)) AS requests_count,
    (SELECT COUNT(*) FROM print3d_order_stock_reservations WHERE product_id=?) AS reservation_count`,
    [checkoutProduct,checkoutProduct,checkoutProduct,checkoutProduct]);
  assert.deepEqual(Object.values(checkoutCounts).map(Number),[1,1,1,1]);
  const [[checkoutBalance]]=await pool.query('SELECT quantity,reserved_quantity FROM product_stock_locations WHERE id=?',[checkoutStock]);
  assert.equal(Number(checkoutBalance.quantity),1);
  assert.equal(Number(checkoutBalance.reserved_quantity),1);

  const failedProduct=randomUUID(),failedStock=randomUUID();
  await pool.query('INSERT INTO products (id,company_id) VALUES (?,?)',[failedProduct,companyId]);
  await pool.query('INSERT INTO product_storefront_offers (product_id,storefront,publication_status,title,price_retail) VALUES (?,?,?,?,?)',
    [failedProduct,'loja_3d','published','Peça pronta',1000]);
  await pool.query('INSERT INTO product_stock_locations (id,company_id,product_id,deposit_id,location_id,quantity) VALUES (?,?,?,?,?,1)',
    [failedStock,companyId,failedProduct,depositId,locationId]);
  await assert.rejects(checkout(buyerIds[0],failedProduct,failedStock,async()=>{throw new Error('production_failed');}),/production_failed/);
  const [[failedBalance]]=await pool.query('SELECT reserved_quantity FROM product_stock_locations WHERE id=?',[failedStock]);
  assert.equal(Number(failedBalance.reserved_quantity),0);
  const [[failedRows]]=await pool.query(`SELECT
    (SELECT COUNT(*) FROM order_items WHERE product_id=?) AS items_count,
    (SELECT COUNT(*) FROM print3d_order_stock_reservations WHERE product_id=?) AS reservations_count,
    (SELECT COUNT(*) FROM stock_location_movements WHERE product_id=?) AS movements_count`,
    [failedProduct,failedProduct,failedProduct]);
  assert.deepEqual(Object.values(failedRows).map(Number),[0,0,0]);

  const sharedProduct=randomUUID(),sharedStock=randomUUID();
  await pool.query('INSERT INTO products (id,company_id) VALUES (?,?)',[sharedProduct,companyId]);
  await pool.query('INSERT INTO product_storefront_offers (product_id,storefront,publication_status,title,price_retail) VALUES (?,?,?,?,?)',
    [sharedProduct,'loja_3d','published','Peça compartilhada',1000]);
  await pool.query('INSERT INTO product_stock_locations (id,company_id,product_id,deposit_id,location_id,quantity) VALUES (?,?,?,?,?,1)',
    [sharedStock,companyId,sharedProduct,depositId,locationId]);
  const crossChannel=await Promise.allSettled([
    checkout(buyerIds[0],sharedProduct,sharedStock),
    reservePriorityStock(pool,{product_id:sharedProduct,quantity:1,reference_type:'order_reservation',reference_id:randomUUID()}),
  ]);
  const checkoutWon=crossChannel[0].status==='fulfilled';
  const centralWon=crossChannel[1].status==='fulfilled'&&crossChannel[1].value.status===200;
  assert.equal(Number(checkoutWon)+Number(centralWon),1,
    crossChannel.map(result=>result.status==='rejected'?result.reason.message:JSON.stringify(result.value)).join(' | '));
  const [[sharedBalance]]=await pool.query('SELECT reserved_quantity FROM product_stock_locations WHERE id=?',[sharedStock]);
  assert.equal(Number(sharedBalance.reserved_quantity),1);
  const [[sharedMovements]]=await pool.query('SELECT COUNT(*) AS count FROM stock_location_movements WHERE product_id=?',[sharedProduct]);
  assert.equal(Number(sharedMovements.count),1);
  const [[sharedOrders]]=await pool.query('SELECT COUNT(*) AS count FROM order_items WHERE product_id=?',[sharedProduct]);
  assert.equal(Number(sharedOrders.count),Number(checkoutWon));

  const saleProduct=randomUUID(),saleStock=randomUUID();
  await pool.query('INSERT INTO products (id,company_id,stock_quantity) VALUES (?,?,1)',[saleProduct,companyId]);
  await pool.query('INSERT INTO product_storefront_offers (product_id,storefront,publication_status,title,price_retail) VALUES (?,?,?,?,?)',
    [saleProduct,'loja_3d','published','Peça para baixa',1000]);
  await pool.query('INSERT INTO product_stock_locations (id,company_id,product_id,deposit_id,location_id,quantity) VALUES (?,?,?,?,?,1)',
    [saleStock,companyId,saleProduct,depositId,locationId]);
  const saleRace=await Promise.allSettled([
    checkout(buyerIds[0],saleProduct,saleStock),
    decrementPriorityStock(pool,{product_id:saleProduct,quantity:1,reference_type:'sale',reference_id:randomUUID()}),
  ]);
  const saleCheckoutWon=saleRace[0].status==='fulfilled';
  const decrementWon=saleRace[1].status==='fulfilled'&&saleRace[1].value.status===200;
  assert.equal(Number(saleCheckoutWon)+Number(decrementWon),1,
    saleRace.map(result=>result.status==='rejected'?result.reason.message:JSON.stringify(result.value)).join(' | '));
  const [[saleBalance]]=await pool.query('SELECT quantity,reserved_quantity FROM product_stock_locations WHERE id=?',[saleStock]);
  assert.equal(Number(saleBalance.quantity)-Number(saleBalance.reserved_quantity),0);
  assert.equal(Number(saleBalance.quantity),saleCheckoutWon?1:0);
  const [[saleProductRow]]=await pool.query('SELECT stock_quantity FROM products WHERE id=?',[saleProduct]);
  assert.equal(Number(saleProductRow.stock_quantity),saleCheckoutWon?1:0);
  const [[saleMovements]]=await pool.query('SELECT COUNT(*) AS count FROM stock_location_movements WHERE product_id=?',[saleProduct]);
  assert.equal(Number(saleMovements.count),1);

  const rejectedSaleProduct=randomUUID(),rejectedSaleStock=randomUUID();
  await pool.query('INSERT INTO products (id,company_id,stock_quantity) VALUES (?,?,1)',[rejectedSaleProduct,companyId]);
  await pool.query('INSERT INTO product_stock_locations (id,company_id,product_id,deposit_id,location_id,quantity) VALUES (?,?,?,?,?,1)',
    [rejectedSaleStock,companyId,rejectedSaleProduct,depositId,locationId]);
  await assert.rejects(decrementPriorityStock(pool,{product_id:rejectedSaleProduct,quantity:1,reason:'x'.repeat(400)}),
    {code:'ER_DATA_TOO_LONG'});
  const [[rejectedBalance]]=await pool.query('SELECT quantity,reserved_quantity FROM product_stock_locations WHERE id=?',[rejectedSaleStock]);
  assert.deepEqual([Number(rejectedBalance.quantity),Number(rejectedBalance.reserved_quantity)],[1,0]);
  const [[rejectedProduct]]=await pool.query('SELECT stock_quantity FROM products WHERE id=?',[rejectedSaleProduct]);
  assert.equal(Number(rejectedProduct.stock_quantity),1);

  await pool.query('ALTER TABLE stock_location_movements ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, ADD INDEX idx_reference (reference_type,reference_id)');
  async function reservedOrder() {
    const id=randomUUID(),product=randomUUID(),stock=randomUUID();
    await pool.query('INSERT INTO orders (id,storefront) VALUES (?,?)',[id,'mercado_do_vale']);
    await pool.query('INSERT INTO products (id,company_id,stock_quantity) VALUES (?,?,2)',[product,companyId]);
    await pool.query('INSERT INTO product_stock_locations (id,company_id,product_id,deposit_id,location_id,quantity) VALUES (?,?,?,?,?,2)',[stock,companyId,product,depositId,locationId]);
    assert.equal((await reservePriorityStock(pool,{product_id:product,quantity:1,reference_id:id})).status,200);
    return {id,product,stock};
  }
  const process=(fixture,mode,reason='Teste')=>processOrderReservation(pool,{orderId:fixture.id,mode,reason,notes:null});
  const once=await reservedOrder();
  assert.equal((await reservePriorityStock(pool,{product_id:once.product,quantity:1,reference_id:randomUUID()})).status,200);
  const repeated=await Promise.all([process(once,'consume'),process(once,'consume')]);
  assert.deepEqual(repeated.map(rows=>rows.length).sort(),[0,1]);
  const [[onceBalance]]=await pool.query('SELECT quantity,reserved_quantity FROM product_stock_locations WHERE id=?',[once.stock]);
  assert.deepEqual([Number(onceBalance.quantity),Number(onceBalance.reserved_quantity)],[1,1]);
  await assert.rejects(process(once,'release'),{statusCode:409});

  const competing=await reservedOrder();
  const terminals=await Promise.allSettled([process(competing,'consume'),process(competing,'release')]);
  assert.equal(terminals.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(terminals.filter(r=>r.status==='rejected'&&r.reason.statusCode===409).length,1);
  const [[terminalCount]]=await pool.query("SELECT COUNT(*) AS count FROM stock_location_movements WHERE reference_id=? AND movement_type IN ('sale','release_reservation')",[competing.id]);
  assert.equal(Number(terminalCount.count),1);

  const failing=await reservedOrder();
  await assert.rejects(process(failing,'consume','x'.repeat(400)),{code:'ER_DATA_TOO_LONG'});
  const [[failedReservation]]=await pool.query('SELECT quantity,reserved_quantity FROM product_stock_locations WHERE id=?',[failing.stock]);
  assert.deepEqual([Number(failedReservation.quantity),Number(failedReservation.reserved_quantity)],[2,1]);
  assert.equal((await process(failing,'release')).length,1);
  assert.deepEqual(await process(failing,'release'),[]);
  const [[releasedBalance]]=await pool.query('SELECT quantity,reserved_quantity FROM product_stock_locations WHERE id=?',[failing.stock]);
  assert.deepEqual([Number(releasedBalance.quantity),Number(releasedBalance.reserved_quantity)],[2,0]);
  await assert.rejects(process({id:order3d},'consume'),{statusCode:409});
  await assert.rejects(process({id:order3d},'release'),{statusCode:409});
  await pool.query('ALTER TABLE stock_location_movements ADD COLUMN to_deposit_id CHAR(36), ADD COLUMN to_location_id CHAR(36), ADD COLUMN previous_to_quantity INT, ADD COLUMN new_to_quantity INT');
  const manual=await reservedOrder();
  const manualInput={product_id:manual.product,deposit_id:depositId,location_id:locationId,quantity:1,reason:'Conferência'};
  await Promise.all([
    applyManualStockMovement(pool,manualInput,'entry'),
    reservePriorityStock(pool,{product_id:manual.product,quantity:1,reference_id:randomUUID()}),
  ]);
  const [[manualBalance]]=await pool.query('SELECT quantity,reserved_quantity FROM product_stock_locations WHERE id=?',[manual.stock]);
  assert.deepEqual([Number(manualBalance.quantity),Number(manualBalance.reserved_quantity)],[3,2]);
  await assert.rejects(applyManualStockMovement(pool,{...manualInput,quantity:1},'adjustment'),{statusCode:400});
  await assert.rejects(applyManualStockMovement(pool,{...manualInput,quantity:1,reason:'x'.repeat(400)},'entry'),{code:'ER_DATA_TOO_LONG'});
  const [[unchangedManual]]=await pool.query('SELECT quantity,reserved_quantity FROM product_stock_locations WHERE id=?',[manual.stock]);
  assert.deepEqual([Number(unchangedManual.quantity),Number(unchangedManual.reserved_quantity)],[3,2]);
  const [[unchangedProduct]]=await pool.query('SELECT stock_quantity FROM products WHERE id=?',[manual.product]);
  assert.equal(Number(unchangedProduct.stock_quantity),3);
  const adjusted=await applyManualStockMovement(pool,{...manualInput,quantity:2},'adjustment');
  assert.deepEqual([Number(adjusted.quantity),Number(adjusted.reserved_quantity)],[2,2]);
  const adjustRace=await reservedOrder();
  const adjustmentAttempts=await Promise.allSettled([
    applyManualStockMovement(pool,{...manualInput,product_id:adjustRace.product,quantity:1},'adjustment'),
    reservePriorityStock(pool,{product_id:adjustRace.product,quantity:1,reference_id:randomUUID()}),
  ]);
  const [[raceBalance]]=await pool.query('SELECT quantity,reserved_quantity FROM product_stock_locations WHERE id=?',[adjustRace.stock]);
  assert.equal(Number(raceBalance.quantity),Number(raceBalance.reserved_quantity));
  const adjustedSuccessfully=adjustmentAttempts[0].status==='fulfilled';
  const reservedSuccessfully=adjustmentAttempts[1].status==='fulfilled'&&adjustmentAttempts[1].value.status===200;
  assert.equal(Number(adjustedSuccessfully)+Number(reservedSuccessfully),1);
  const newStockProduct=randomUUID();
  await pool.query('INSERT INTO products (id,company_id) VALUES (?,?)',[newStockProduct,companyId]);
  const newEntry={...manualInput,product_id:newStockProduct};
  await Promise.all([applyManualStockMovement(pool,newEntry,'entry'),applyManualStockMovement(pool,newEntry,'entry')]);
  const [newRows]=await pool.query('SELECT quantity,reserved_quantity FROM product_stock_locations WHERE product_id=?',[newStockProduct]);
  assert.equal(newRows.length,1);
  assert.deepEqual([Number(newRows[0].quantity),Number(newRows[0].reserved_quantity)],[2,0]);
  const external=await reservedOrder();
  const incomingLocation=randomUUID();
  await pool.query('INSERT INTO stock_locations (id,name,code) VALUES (?,?,?)',[incomingLocation,'Entrada','IN']);
  const synchronize=(target,options={})=>reconcileExternalStock(pool,{productId:external.product,targetQuantity:target,
    reason:'Teste externo',notes:null,getIncoming:async()=>({depositId,locationId:incomingLocation}),...options});
  assert.equal((await synchronize(0)).error,'external_stock_below_reserved');
  const [[preserved]]=await pool.query('SELECT quantity,reserved_quantity FROM product_stock_locations WHERE id=?',[external.stock]);
  assert.deepEqual([Number(preserved.quantity),Number(preserved.reserved_quantity)],[2,1]);
  assert.equal((await synchronize(4,{resetToIncoming:true})).ok,true);
  const [redistributed]=await pool.query('SELECT location_id,quantity,reserved_quantity FROM product_stock_locations WHERE product_id=?',[external.product]);
  assert.equal(Number(redistributed.find(row=>row.location_id===locationId).quantity),1);
  assert.equal(Number(redistributed.find(row=>row.location_id===locationId).reserved_quantity),1);
  assert.equal(Number(redistributed.find(row=>row.location_id===incomingLocation).quantity),3);
  await assert.rejects(synchronize(5,{reason:'x'.repeat(400)}),{code:'ER_DATA_TOO_LONG'});
  const [[externalTotal]]=await pool.query('SELECT stock_quantity FROM products WHERE id=?',[external.product]);
  assert.equal(Number(externalTotal.stock_quantity),4);
  const externalRace=await Promise.allSettled([
    synchronize(1),reservePriorityStock(pool,{product_id:external.product,quantity:3,reference_id:randomUUID()}),
  ]);
  assert(externalRace.every(result=>result.status==='fulfilled'));
  assert.equal(Number(externalRace[0].value.ok)+Number(externalRace[1].value.status===200),1);
  const [finalExternal]=await pool.query('SELECT quantity,reserved_quantity FROM product_stock_locations WHERE product_id=?',[external.product]);
  assert(finalExternal.every(row=>Number(row.quantity)>=Number(row.reserved_quantity)));
  const {withSmartphonePriceWrite}=require('../services/smartphonePriceGroupsServer.cjs');
  const edit=await reservedOrder();
  const saveEdit=(target,fail=false)=>withSmartphonePriceWrite(pool,{id:edit.product},async connection=>{
    const result=await reconcileExternalStock(pool,{connection,productId:edit.product,targetQuantity:target,
      reason:'product_edit',getIncoming:async()=>({depositId,locationId:incomingLocation})});
    if(!result.ok) throw new Error(result.error);
    await connection.query('UPDATE products SET status=? WHERE id=?',['inactive',edit.product]);
    if(fail) throw new Error('edit_failed');
  },{transactional:true});
  await assert.rejects(saveEdit(4,true),/edit_failed/);
  await assert.rejects(saveEdit(0),/external_stock_below_reserved/);
  const [[unchangedEdit]]=await pool.query('SELECT status,stock_quantity FROM products WHERE id=?',[edit.product]);
  assert.equal(unchangedEdit.status,'active');
  assert.equal(Number(unchangedEdit.stock_quantity),2);
  const [[editBalance]]=await pool.query('SELECT SUM(quantity) total,SUM(reserved_quantity) reserved FROM product_stock_locations WHERE product_id=?',[edit.product]);
  assert.deepEqual([Number(editBalance.total),Number(editBalance.reserved)],[2,1]);
  await saveEdit(3);
  const [[savedEdit]]=await pool.query('SELECT status,stock_quantity FROM products WHERE id=?',[edit.product]);
  assert.equal(savedEdit.status,'inactive');assert.equal(Number(savedEdit.stock_quantity),3);

  // Exercise the actual batch handler/SQL against the isolated minimal schema.
  const serverSource=readFileSync(path.join(__dirname,'../vps_server.cjs'),'utf8');
  const batchSource=serverSource.slice(serverSource.indexOf("fastify.post('/products/batch'"),serverSource.indexOf('// Price/stock sync: deliberately'));
  const columns=batchSource.match(/INSERT INTO products \(([\s\S]*?)\) VALUES/)[1].split(',').map(value=>value.trim());
  const [existingColumns]=await pool.query('SHOW COLUMNS FROM products');
  const knownColumns=new Set(existingColumns.map(row=>row.Field));
  for(const column of columns) if(!knownColumns.has(column)) {
    assert.match(column,/^[a-z_]+$/);
    await pool.query(`ALTER TABLE products ADD COLUMN ${column} ${column==='sku'?'VARCHAR(191)':'TEXT'} NULL`);
  }
  await pool.query('ALTER TABLE products ADD UNIQUE KEY test_batch_sku (sku)');
  let batchHandler;
  require('node:vm').runInNewContext(batchSource,{
    fastify:{post:(url,options,handler)=>{batchHandler=handler;}},pool,requireSyncKey(){},
    findSerializedIdentifierDuplicateInBatch:()=>null,collectProductSerializedIdentifiers:()=>[],
    normalizePrint3dProductOffer:require('../services/print3dProductOffer.cjs').normalizePrint3dProductOffer,findProductSerializedIdentifierConflict:async()=>null,
    withSmartphonePriceWrite,require:()=>({reconcileExternalStock}),
    ensureIncomingStockLocation:async()=>({depositId,locationId:incomingLocation}),getDefaultStockCompanyId:async()=>companyId,
    sanitizeDescription:value=>value||null,jsonStr:value=>value==null?null:JSON.stringify(value),
    normalizeProductSpecsRam:value=>value,optionalBool:value=>value==null?null:Number(Boolean(value)),
  });
  const imported=await reservedOrder();
  const runBatch=body=>batchHandler({body:body.map(p=>({status:'active',...p}))},{});
  const rejectedImport=await runBatch([{id:imported.product,name:'Should roll back',stock_quantity:0}]);
  assert.equal(rejectedImport.upserted,0);assert.match(rejectedImport.errors[0].error,/external_stock_below_reserved/);
  const [[afterRejectedImport]]=await pool.query('SELECT name,stock_quantity FROM products WHERE id=?',[imported.product]);
  assert.equal(afterRejectedImport.name,null);assert.equal(Number(afterRejectedImport.stock_quantity),2);
  const newImportId=randomUUID();
  const importSuccess=await runBatch([{id:newImportId,name:'New',sku:'batch-unique',company_id:companyId,stock_quantity:3}]);
  assert.equal(importSuccess.upserted,1,JSON.stringify(importSuccess.errors));
  const [[newImportStock]]=await pool.query('SELECT SUM(quantity) total FROM product_stock_locations WHERE product_id=?',[newImportId]);
  assert.equal(Number(newImportStock.total),3);
  const duplicateId=randomUUID();
  const collision=await runBatch([{id:duplicateId,name:'Wrong identity',sku:'batch-unique',company_id:companyId,stock_quantity:9}]);
  assert.equal(collision.upserted,0);assert.equal(collision.errors.length,1);
  const [[originalImport]]=await pool.query('SELECT name,stock_quantity FROM products WHERE id=?',[newImportId]);
  assert.equal(originalImport.name,'New');assert.equal(Number(originalImport.stock_quantity),3);
  const [wrongStock]=await pool.query('SELECT id FROM product_stock_locations WHERE product_id=?',[duplicateId]);
  assert.equal(wrongStock.length,0);
  const noStock=await runBatch([{id:newImportId,name:'Renamed'}]);
  assert.equal(noStock.upserted,1);
  const [[keptStock]]=await pool.query('SELECT stock_quantity FROM products WHERE id=?',[newImportId]);
  assert.equal(Number(keptStock.stock_quantity),3);

  // Actual 3D batch write SQL, including policy validation and SKU identity conflict.
  {
  const pieceInput=(id,sku,size,price)=>({id,sku,name:'Peça '+size,company_id:companyId,is_print3d:true,
    print3d_preorder_enabled:true,print3d_preorder_limit:100,production_days:4,track_inventory:true,
    stock_quantity:2,price_retail:price,price_reseller:price,price_wholesale:price,
    specs:{material:'PETG',color:'Azul',size,finish:'Fosco'}});
  const raceSku='3D-RACE-'+randomUUID().slice(0,8);
  const competing=[pieceInput(randomUUID(),raceSku,'P',2500),pieceInput(randomUUID(),raceSku,'G',3500)];
  const competingResults=await Promise.all(competing.map(piece=>runBatch([piece])));
  assert.equal(competingResults.filter(result=>result.upserted===1).length,1);
  assert.equal(competingResults.filter(result=>result.errors.length===1).length,1);
  const winner=competing[competingResults.findIndex(result=>result.upserted===1)];
  const loser=competing.find(piece=>piece.id!==winner.id);
  const [[storedPiece]]=await pool.query('SELECT id,specs,price_retail,is_print3d,print3d_preorder_enabled,production_days FROM products WHERE sku=?',[raceSku]);
  assert.equal(storedPiece.id,winner.id);assert.equal(Number(storedPiece.price_retail),winner.price_retail);
  assert.deepEqual(JSON.parse(storedPiece.specs),winner.specs);assert.equal(Number(storedPiece.is_print3d),1);
  assert.equal(Number(storedPiece.print3d_preorder_enabled),1);assert.equal(Number(storedPiece.production_days),4);
  const [loserStock]=await pool.query('SELECT id FROM product_stock_locations WHERE product_id=?',[loser.id]);assert.equal(loserStock.length,0);
  const other=pieceInput(randomUUID(),'3D-OTHER-'+randomUUID().slice(0,8),'GG',4900);
  assert.equal((await runBatch([other])).upserted,1);
  const changedSpecs={...winner.specs,finish:'Pintado'};
  assert.equal((await runBatch([{id:winner.id,specs:changedSpecs,price_retail:3900}])).upserted,1);
  const [[editedPiece]]=await pool.query('SELECT specs,price_retail,is_print3d,print3d_preorder_enabled FROM products WHERE id=?',[winner.id]);
  assert.deepEqual(JSON.parse(editedPiece.specs),changedSpecs);assert.equal(Number(editedPiece.price_retail),3900);
  assert.equal(Number(editedPiece.is_print3d),1);assert.equal(Number(editedPiece.print3d_preorder_enabled),1);
  const [[otherPiece]]=await pool.query('SELECT price_retail FROM products WHERE id=?',[other.id]);assert.equal(Number(otherPiece.price_retail),4900);
  const invalidPiece={...pieceInput(randomUUID(),'3D-INVALID','Invalid',1000),production_days:0};
  const invalidResult=await runBatch([invalidPiece]);assert.equal(invalidResult.upserted,0);assert.match(invalidResult.errors[0].error,/prazo individual/);
  const [notInserted]=await pool.query('SELECT id FROM products WHERE id=?',[invalidPiece.id]);assert.equal(notInserted.length,0);
  console.log('PASS: actual product batch SQL preserves 3D specs/policy, rejects invalid preorder and rolls back a concurrent SKU conflict under the test unique index.');
  }

  const importRace=await reservedOrder();
  const [importAttempt,reserveAttempt]=await Promise.all([
    runBatch([{id:importRace.product,stock_quantity:1}]),
    reservePriorityStock(pool,{product_id:importRace.product,quantity:1,reference_id:randomUUID()}),
  ]);
  assert.equal(Number(importAttempt.upserted===1)+Number(reserveAttempt.status===200),1);
  const [[importRaceBalance]]=await pool.query('SELECT quantity,reserved_quantity FROM product_stock_locations WHERE id=?',[importRace.stock]);
  assert.equal(Number(importRaceBalance.quantity),Number(importRaceBalance.reserved_quantity));

  const undistributedId=randomUUID();
  await pool.query('INSERT INTO products (id,company_id,stock_quantity) VALUES (?,?,5)',[undistributedId,companyId]);
  const materialize=options=>reconcileExternalStock(pool,{productId:undistributedId,materializeUndistributed:true,
    reason:'undistributed_stock',getIncoming:async()=>({depositId,locationId:incomingLocation}),...options});
  await assert.rejects(materialize({reason:'x'.repeat(400)}),{code:'ER_DATA_TOO_LONG'});
  const [noDistribution]=await pool.query('SELECT id FROM product_stock_locations WHERE product_id=?',[undistributedId]);
  assert.equal(noDistribution.length,0);
  const distributions=await Promise.all([materialize(),materialize()]);
  assert.deepEqual(distributions.map(value=>value.materialized).sort(),[0,5]);
  const [[distributed]]=await pool.query('SELECT SUM(quantity) total FROM product_stock_locations WHERE product_id=?',[undistributedId]);
  assert.equal(Number(distributed.total),5);
  const [[distributionMovements]]=await pool.query("SELECT COUNT(*) total FROM stock_location_movements WHERE product_id=? AND reference_type='undistributed_stock'",[undistributedId]);
  assert.equal(Number(distributionMovements.total),1);
  assert.equal((await reservePriorityStock(pool,{product_id:undistributedId,quantity:2,reference_id:randomUUID()})).status,200);
  assert.equal((await materialize()).materialized,0);
  const [[distributedReserved]]=await pool.query('SELECT quantity,reserved_quantity FROM product_stock_locations WHERE product_id=?',[undistributedId]);
  assert.deepEqual([Number(distributedReserved.quantity),Number(distributedReserved.reserved_quantity)],[5,2]);

  const initialId=randomUUID();
  await pool.query('INSERT INTO products (id,company_id,stock_quantity) VALUES (?,?,3)',[initialId,companyId]);
  const initialize=()=>reconcileExternalStock(pool,{productId:initialId,materializeUndistributed:true,initialMigration:true,
    reason:'inventory',getIncoming:async()=>({depositId,locationId})});
  const initialResults=await Promise.all([initialize(),initialize()]);
  assert.deepEqual(initialResults.map(result=>result.materialized).sort(),[0,3]);
  await reservePriorityStock(pool,{product_id:initialId,quantity:1,reference_id:randomUUID()});
  assert.equal((await initialize()).materialized,0);
  const [[initialStock]]=await pool.query('SELECT quantity,reserved_quantity FROM product_stock_locations WHERE product_id=?',[initialId]);
  assert.deepEqual([Number(initialStock.quantity),Number(initialStock.reserved_quantity)],[3,1]);
  const [[initialHistory]]=await pool.query("SELECT COUNT(*) total FROM stock_location_movements WHERE product_id=? AND reference_type='initial_migration'",[initialId]);
  assert.equal(Number(initialHistory.total),1);
  // Historical initialization prevents a stale aggregate from recreating deleted locations.
  await pool.query('DELETE FROM product_stock_locations WHERE product_id=?',[initialId]);
  assert.equal((await initialize()).materialized,0);
  const [notRecreated]=await pool.query('SELECT id FROM product_stock_locations WHERE product_id=?',[initialId]);
  assert.equal(notRecreated.length,0);

  const {receivePrint3dSupply}=require('../services/print3dSupplyStock.cjs');
  const {receivePrint3dFilament}=require('../services/print3dMaterialStock.cjs');
  await pool.query('CREATE TABLE admin_preferences (preference_key VARCHAR(100) PRIMARY KEY,value_json JSON NOT NULL) ENGINE=InnoDB');
  await pool.query('INSERT INTO admin_preferences VALUES (?,?)',['print3d.cost.v1',JSON.stringify({
    supplies:[{id:'argola',name:'Argola',unitLabel:'un'}],filaments:[{id:'pla',name:'PLA',color:'Preto'}],
  })]);
  const supplyReceipt={body:{supply_id:'argola',quantity_units:10,idempotency_key:randomUUID()},actorId:'test-admin'};
  const supplyReceipts=await Promise.all([receivePrint3dSupply(pool,supplyReceipt),receivePrint3dSupply(pool,supplyReceipt)]);
  assert.equal(supplyReceipts.filter(result=>result.replayed).length,1);
  const filamentReceipt={body:{filament_id:'pla',quantity_grams:100,idempotency_key:randomUUID()},actorId:'test-admin'};
  const filamentReceipts=await Promise.all([receivePrint3dFilament(pool,filamentReceipt),receivePrint3dFilament(pool,filamentReceipt)]);
  assert.equal(filamentReceipts.filter(result=>result.replayed).length,1);

  const {consumePrint3dSuppliesOnConnection}=require('../services/print3dSupplyStock.cjs');
  const {consumePrint3dFilamentsOnConnection}=require('../services/print3dMaterialStock.cjs');
  const job=randomUUID();
  await pool.query(`INSERT INTO print3d_production_jobs
    (id,order_id,order_number,order_item_id,product_id,product_name,sku,target_quantity,recipe_id,primary_file_id)
    VALUES (?,?,?,?,?,?,?,?,?,?)`,[job,randomUUID(),'TEST',randomUUID(),productId,'Peça','TEST',100,randomUUID(),randomUUID()]);
  const consume=async(supplyQuantity,filamentGrams)=>{
    const db=await pool.getConnection();
    try {
      await db.beginTransaction();
      const event=randomUUID();
      await db.query(`INSERT INTO print3d_production_events
        (id,job_id,idempotency_key,payload_hash,approved_quantity,rejected_quantity,actor_id) VALUES (?,?,?,?,1,0,?)`,
        [event,job,randomUUID(),'d'.repeat(64),'test-admin']);
      await consumePrint3dFilamentsOnConnection(db,{allocations:[{filament_id:'pla',grams_millis:filamentGrams*1000}],productionEventId:event,actorId:'test-admin'});
      await consumePrint3dSuppliesOnConnection(db,{allocations:[{supply_id:'argola',quantity_micros:supplyQuantity*1000000}],
        productionEventId:event,actorId:'test-admin',recipeSupplies:[{id:'argola',unit_label:'un'}]});
      await db.commit();return event;
    } catch(error) {await db.rollback();throw error;} finally {db.release();}
  };
  await assert.rejects(consume(11,20),e=>e.statusCode===409);
  const [[rollbackFilament]]=await pool.query("SELECT quantity_grams FROM print3d_filament_stock WHERE filament_id='pla'");
  assert.equal(Number(rollbackFilament.quantity_grams),100);
  const [[rollbackEvents]]=await pool.query('SELECT COUNT(*) total FROM print3d_production_events WHERE job_id=?',[job]);
  assert.equal(Number(rollbackEvents.total),0);
  const consumption=await Promise.allSettled([consume(7,60),consume(7,60)]);
  assert.equal(consumption.filter(result=>result.status==='fulfilled').length,1);
  const [[finalFilament]]=await pool.query("SELECT quantity_grams FROM print3d_filament_stock WHERE filament_id='pla'");
  const [[finalSupply]]=await pool.query("SELECT quantity_units FROM print3d_supply_stock WHERE supply_id='argola'");
  assert.equal(Number(finalFilament.quantity_grams),40);assert.equal(Number(finalSupply.quantity_units),3);

  const productionOrder=randomUUID(),productionJob=randomUUID(),recipeId=randomUUID();
  await pool.query(`INSERT INTO orders (id,storefront,print3d_customer_id,status,payment_status,subtotal,total,shipping_cost,discount)
    VALUES (?,'loja_3d',?,'pending','pending',1000,1000,0,0)`,[productionOrder,customerId]);
  await pool.query(`INSERT INTO print3d_order_plans
    (order_id,subtotal_cents,ready_amount_cents,preorder_amount_cents,deposit_amount_cents,due_on_confirmation_cents,due_before_shipping_cents,plan_hash,
     payment_terms_version,initial_payment_bps,shipping_payment_mode,shipping_initial_cents,minimum_initial_cents)
    VALUES (?,1000,0,1000,500,500,500,?,1,5000,'later',0,500)`,[productionOrder,'e'.repeat(64)]);
  await pool.query(`INSERT INTO print3d_order_payment_receipts
    (id,order_id,event_key,provider,provider_payment_id,amount_cents,confirmed_at,payload_hash) VALUES (?,?,?,'local_test',?,500,NOW(),?)`,
    [randomUUID(),productionOrder,randomUUID(),randomUUID(),'e'.repeat(64)]);
  await pool.query(`INSERT INTO print3d_recipe_revisions (id,product_id,sku_snapshot,revision,draft_json,draft_sha256,created_by)
    VALUES (?,?,'TEST','route-test',?,?,'test-admin')`,[recipeId,productId,JSON.stringify({productId,sku:'TEST',
      filaments:[{id:'pla',name:'PLA',color:'Preto',consumedGrams:10}],supplies:[{id:'argola',name:'Argola',unitLabel:'un',quantity:1}]}),'f'.repeat(64)]);
  await pool.query(`INSERT INTO print3d_production_jobs
    (id,order_id,order_number,order_item_id,product_id,product_name,sku,target_quantity,recipe_id,primary_file_id,status)
    VALUES (?,?,'ROUTE',?,?,'Peça','TEST',100,?,?,'queued')`,[productionJob,productionOrder,randomUUID(),productId,recipeId,randomUUID()]);
  const app=require('fastify')({logger:{level:'error'}});t.after(()=>app.close());
  require('../services/print3dProductionServer.cjs').registerPrint3dProductionRoutes(app,{pool,enabled:true,dispatchEnabled:true,
    getBearerAuthContext:async req=>req.headers.authorization==='Bearer local-admin'?{isAdmin:true,userId:'test-admin'}:null,
    getCustomer:async req=>req.headers.authorization==='Bearer local-customer'?{id:customerId}:null});
  require('../services/print3dAdminServer.cjs').registerPrint3dAdminRoutes(app,{pool,ordersEnabled:true,dispatchEnabled:true,
    getBearerAuthContext:async req=>req.headers.authorization==='Bearer local-admin'?{isAdmin:true,userId:'test-admin'}:null});
  const progressBody={idempotency_key:randomUUID(),approved_quantity:20,material_consumed_grams:10,
    filaments:[{filament_id:'pla',consumed_grams:10}],supplies:[{supply_id:'argola',consumed_quantity:1}]};
  const postProgress=payload=>app.inject({method:'POST',url:`/admin/print3d/production/${productionJob}/progress`,headers:{authorization:'Bearer local-admin'},payload});
  const repeatedProgress=await Promise.all([postProgress(progressBody),postProgress(progressBody)]);
  for(const response of repeatedProgress) assert.equal(response.statusCode,200,response.body);
  assert.equal(repeatedProgress.filter(response=>response.json().replayed).length,1);
  const customerProgress=await app.inject({url:'/print3d/production',headers:{authorization:'Bearer local-customer'}});
  assert.equal(customerProgress.statusCode,200,customerProgress.body);
  const visible=customerProgress.json().jobs.find(item=>item.id===productionJob);
  assert.equal(visible.approved_quantity,20);assert.equal(visible.target_quantity,100);
  assert.equal(visible.reserved_for_order_quantity,20);assert.equal(visible.history.length,1);
  assert.equal(visible.history[0].actor_id,undefined);assert.equal(visible.recipe_id,undefined);

  const beforeFailure=await pool.query("SELECT quantity_grams FROM print3d_filament_stock WHERE filament_id='pla'");
  const progressFailure=await postProgress({...progressBody,idempotency_key:randomUUID(),supplies:[{supply_id:'argola',consumed_quantity:99}]});
  assert.equal(progressFailure.statusCode,409,progressFailure.body);
  const [[unchangedFilament]]=await pool.query("SELECT quantity_grams FROM print3d_filament_stock WHERE filament_id='pla'");
  assert.equal(Number(unchangedFilament.quantity_grams),Number(beforeFailure[0][0].quantity_grams));
  const [[unchangedProgress]]=await pool.query('SELECT approved_quantity FROM print3d_production_jobs WHERE id=?',[productionJob]);
  assert.equal(Number(unchangedProgress.approved_quantity),20);
  const [[unchangedEventCount]]=await pool.query('SELECT COUNT(*) total FROM print3d_production_events WHERE job_id=?',[productionJob]);
  assert.equal(Number(unchangedEventCount.total),1);

  if(require('node:process').env.PRINT3D_MYSQL_BROWSER==='1') await require('./print3d-production-mysql-browser.cjs')({app,jobId:productionJob});

  const [[productionJobRow]]=await pool.query('SELECT * FROM print3d_production_jobs WHERE id=?',[productionJob]);
  await pool.query(`INSERT INTO print3d_order_item_plans
    (order_item_id,order_id,product_id,quantity,ready_quantity,preorder_quantity,unit_price_cents,subtotal_cents,deposit_amount_cents,balance_before_shipping_cents)
    VALUES (?,?,?,100,0,100,10,1000,500,500)`,[productionJobRow.order_item_id,productionOrder,productId]);
  const sendOrder=tracking=>app.inject({method:'POST',url:`/admin/print3d/orders/${productionOrder}/dispatch`,
    headers:{authorization:'Bearer local-admin'},payload:{tracking_code:tracking}});
  const unpaidDispatch=await sendOrder('LOCAL-TRACK');
  assert.equal(unpaidDispatch.statusCode,409);assert.match(unpaidDispatch.json().error,/Quite/);
  await pool.query(`INSERT INTO print3d_order_payment_receipts
    (id,order_id,event_key,provider,provider_payment_id,amount_cents,confirmed_at,payload_hash) VALUES (?,?,?,'local_test',?,500,NOW(),?)`,
    [randomUUID(),productionOrder,randomUUID(),randomUUID(),'e'.repeat(64)]);
  await pool.query("UPDATE orders SET payment_status='paid' WHERE id=?",[productionOrder]);
  const unfinishedDispatch=await sendOrder('LOCAL-TRACK');
  assert.equal(unfinishedDispatch.statusCode,409);assert.match(unfinishedDispatch.json().error,/produção ainda não concluiu/);
  const finishProduction=await postProgress({...progressBody,idempotency_key:randomUUID(),approved_quantity:100-Number(productionJobRow.approved_quantity)});
  assert.equal(finishProduction.statusCode,200,finishProduction.body);
  const dispatched=await Promise.all([sendOrder('LOCAL-TRACK'),sendOrder('LOCAL-TRACK')]);
  for(const response of dispatched) assert.equal(response.statusCode,200,response.body);
  assert.equal(dispatched.filter(response=>response.json().replayed).length,1);
  assert.equal(dispatched[0].json().produced_quantity,100);
  assert.equal((await sendOrder('OTHER-TRACK')).statusCode,409);
  const [[sentOrder]]=await pool.query('SELECT status FROM orders WHERE id=?',[productionOrder]);
  assert.equal(sentOrder.status,'shipped');
  const [[sentPieces]]=await pool.query("SELECT SUM(quantity) total FROM print3d_production_outputs WHERE order_id=? AND status='dispatched'",[productionOrder]);
  assert.equal(Number(sentPieces.total),100);
  const [[dispatchCount]]=await pool.query('SELECT COUNT(*) total FROM print3d_order_dispatches WHERE order_id=?',[productionOrder]);
  assert.equal(Number(dispatchCount.total),1);

  // Ready stock must consume only this order's reservation and retain another's.
  await pool.query('ALTER TABLE stock_location_movements ADD COLUMN created_by VARCHAR(191) NULL');
  const readyDispatch=await reservedOrder();
  await reservePriorityStock(pool,{product_id:readyDispatch.product,quantity:1,reference_id:randomUUID()});
  await pool.query("UPDATE orders SET storefront='loja_3d',print3d_customer_id=?,company_id=?,status='pending',payment_status='paid',subtotal=1000,total=1000,shipping_cost=0,discount=0 WHERE id=?",[customerId,companyId,readyDispatch.id]);
  await pool.query(`INSERT INTO print3d_order_plans
    (order_id,subtotal_cents,ready_amount_cents,preorder_amount_cents,deposit_amount_cents,due_on_confirmation_cents,due_before_shipping_cents,plan_hash,
     payment_terms_version,initial_payment_bps,shipping_payment_mode,shipping_initial_cents,minimum_initial_cents)
    VALUES (?,1000,1000,0,500,500,500,?,1,5000,'later',0,500)`,[readyDispatch.id,'e'.repeat(64)]);
  await pool.query(`INSERT INTO print3d_order_payment_receipts
    (id,order_id,event_key,provider,provider_payment_id,amount_cents,confirmed_at,payload_hash) VALUES (?,?,?,'local_test',?,1000,NOW(),?)`,
    [randomUUID(),readyDispatch.id,randomUUID(),randomUUID(),'e'.repeat(64)]);
  await pool.query(`INSERT INTO print3d_order_item_plans
    (order_item_id,order_id,product_id,quantity,ready_quantity,preorder_quantity,unit_price_cents,subtotal_cents,deposit_amount_cents,balance_before_shipping_cents)
    VALUES (?,?,?,1,1,0,1000,1000,500,500)`,[randomUUID(),readyDispatch.id,readyDispatch.product]);
  await pool.query(`INSERT INTO print3d_order_stock_reservations
    (order_id,product_id,stock_location_id,deposit_id,location_id,quantity_reserved) VALUES (?,?,?,?,?,1)`,
    [readyDispatch.id,readyDispatch.product,readyDispatch.stock,depositId,locationId]);
  const {dispatchPrint3dOrder}=require('../services/print3dDispatch.cjs');
  const sendReady=actorId=>dispatchPrint3dOrder(pool,{orderId:readyDispatch.id,actorId,trackingCode:'READY-TRACK'});
  await assert.rejects(sendReady('x'.repeat(300)),{code:'ER_DATA_TOO_LONG'});
  const [[rolledBackReady]]=await pool.query('SELECT quantity,reserved_quantity FROM product_stock_locations WHERE id=?',[readyDispatch.stock]);
  assert.deepEqual([Number(rolledBackReady.quantity),Number(rolledBackReady.reserved_quantity)],[2,2]);
  const browserDispatch=require('node:process').env.PRINT3D_MYSQL_BROWSER==='1';
  if(browserDispatch) {
    const [[plan]]=await pool.query('SELECT public_number FROM print3d_order_plans WHERE order_id=?',[readyDispatch.id]);
    await require('./print3d-dispatch-mysql-browser.cjs')({app,orderId:readyDispatch.id,orderNumber:'3D-'+plan.public_number});
  }
  const readySends=await Promise.all([sendReady('test-admin'),sendReady('test-admin')]);
  assert.equal(readySends.filter(result=>result.replayed).length,browserDispatch?2:1);
  const [[remainingReady]]=await pool.query('SELECT quantity,reserved_quantity FROM product_stock_locations WHERE id=?',[readyDispatch.stock]);
  assert.deepEqual([Number(remainingReady.quantity),Number(remainingReady.reserved_quantity)],[1,1]);
  const [[readyTotal]]=await pool.query('SELECT stock_quantity FROM products WHERE id=?',[readyDispatch.product]);
  assert.equal(Number(readyTotal.stock_quantity),1);

  const {cancelPrint3dOrder}=require('../services/print3dCancellation.cjs');
  const cancelFixture=await reservedOrder();
  await pool.query("UPDATE orders SET storefront='loja_3d',print3d_customer_id=?,company_id=?,status='awaiting_payment',payment_status='pending' WHERE id=?",[customerId,companyId,cancelFixture.id]);
  await pool.query(`INSERT INTO print3d_order_plans
    (order_id,subtotal_cents,ready_amount_cents,preorder_amount_cents,deposit_amount_cents,due_on_confirmation_cents,due_before_shipping_cents,plan_hash)
    VALUES (?,1000,1000,0,0,1000,0,?)`,[cancelFixture.id,'c'.repeat(64)]);
  await reservePriorityStock(pool,{product_id:cancelFixture.product,quantity:1,reference_id:randomUUID()});
  await pool.query(`INSERT INTO print3d_order_stock_reservations
    (order_id,product_id,stock_location_id,deposit_id,location_id,quantity_reserved) VALUES (?,?,?,?,?,1)`,
    [cancelFixture.id,cancelFixture.product,cancelFixture.stock,depositId,locationId]);
  const cancel=(actorId=customerId,reason='Teste local')=>cancelPrint3dOrder(pool,{orderId:cancelFixture.id,actorType:'customer',actorId,reason});
  await assert.rejects(cancel(randomUUID()),e=>e.statusCode===404);
  // A failure after releasing the balance must restore the entire reservation.
  await assert.rejects(cancel(customerId,'x'.repeat(400)),{code:'ER_DATA_TOO_LONG'});
  const [[cancelRollback]]=await pool.query('SELECT quantity,reserved_quantity FROM product_stock_locations WHERE id=?',[cancelFixture.stock]);
  assert.deepEqual([Number(cancelRollback.quantity),Number(cancelRollback.reserved_quantity)],[2,2]);
  const cancellationAttempts=await Promise.all([cancel(),cancel()]);
  assert.equal(cancellationAttempts.filter(result=>result.already_cancelled).length,1);
  const [[cancelBalance]]=await pool.query('SELECT quantity,reserved_quantity FROM product_stock_locations WHERE id=?',[cancelFixture.stock]);
  assert.deepEqual([Number(cancelBalance.quantity),Number(cancelBalance.reserved_quantity)],[2,1]);
  const [[cancelLedger]]=await pool.query('SELECT quantity_released,quantity_consumed FROM print3d_order_stock_reservations WHERE order_id=?',[cancelFixture.id]);
  assert.deepEqual([Number(cancelLedger.quantity_released),Number(cancelLedger.quantity_consumed)],[1,0]);
  const [[cancelEvents]]=await pool.query('SELECT COUNT(*) total FROM print3d_order_cancellation_events WHERE order_id=?',[cancelFixture.id]);
  assert.equal(Number(cancelEvents.total),1);
  await assert.rejects(cancelPrint3dOrder(pool,{orderId:productionOrder,actorType:'admin',actorId:'test-admin',reason:'Não pode cancelar pedido pago'}),e=>e.statusCode===409);

  const expiringOrder=randomUUID();
  await pool.query("INSERT INTO orders (id,storefront,print3d_customer_id,status,payment_status) VALUES (?,'loja_3d',?,'awaiting_payment','pending')",[expiringOrder,customerId]);
  await pool.query(`INSERT INTO print3d_order_plans
    (order_id,subtotal_cents,ready_amount_cents,preorder_amount_cents,deposit_amount_cents,due_on_confirmation_cents,due_before_shipping_cents,plan_hash)
    VALUES (?,1000,1000,0,0,1000,0,?)`,[expiringOrder,'c'.repeat(64)]);
  await pool.query(`INSERT INTO print3d_payment_charges (id,order_id,stage,idempotency_key,amount_cents,status,payer_email,expires_at)
    VALUES (?,?,'initial',?,1000,'pending','test@example.test','2026-01-01T00:00:00.000Z')`,[randomUUID(),expiringOrder,randomUUID()]);
  const {expireDuePrint3dOrders}=require('../services/print3dCancellation.cjs');
  const expired=await expireDuePrint3dOrders(pool,{now:new Date('2026-09-27T00:00:00.000Z')});
  assert.equal(expired.expired,1);assert(expired.order_ids.includes(expiringOrder));

  const expiryCandidates=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003'];
  for(let index=0;index<expiryCandidates.length;index++) {
    const id=expiryCandidates[index];
    await pool.query("INSERT INTO orders (id,storefront,print3d_customer_id,status,payment_status) VALUES (?,'loja_3d',?,'awaiting_payment',?)",[id,customerId,index===1?'paid':'pending']);
    await pool.query(`INSERT INTO print3d_order_plans
      (order_id,subtotal_cents,ready_amount_cents,preorder_amount_cents,deposit_amount_cents,due_on_confirmation_cents,due_before_shipping_cents,plan_hash)
      VALUES (?,1000,1000,0,0,1000,0,?)`,[id,'c'.repeat(64)]);
    await pool.query(`INSERT INTO print3d_payment_charges (id,order_id,stage,idempotency_key,amount_cents,status,payer_email,expires_at)
      VALUES (?,?,'initial',?,1000,'pending','test@example.test',?)`,[randomUUID(),id,randomUUID(),index===0?'2027-01-01T00:00:00.000Z':'2026-01-01T00:00:00.000Z']);
  }
  const pagedExpiry=await expireDuePrint3dOrders(pool,{now:new Date('2026-09-27T00:00:00.000Z'),limit:1});
  assert.equal(pagedExpiry.scanned,3);assert.equal(pagedExpiry.expired,1);assert.equal(pagedExpiry.skipped,2);
  assert.deepEqual(pagedExpiry.order_ids,[expiryCandidates[2]]);assert.deepEqual(pagedExpiry.review_order_ids,[expiryCandidates[1]]);
  const [retainedExpiry]=await pool.query('SELECT status FROM orders WHERE id IN (?,?)',expiryCandidates.slice(0,2));
  assert(retainedExpiry.every(row=>row.status==='awaiting_payment'));

  const {cancelPrint3dProviderCharges}=require('../services/print3dPayments.cjs');
  const {createPrint3dExpiryWorker}=require('../services/print3dExpiryWorker.cjs');
  await pool.query("UPDATE print3d_payment_charges SET provider_payment_id='123' WHERE order_id=?",[expiringOrder]);
  const [[providerCharge]]=await pool.query('SELECT * FROM print3d_payment_charges WHERE order_id=?',[expiringOrder]);
  let providerFails=true,providerGets=0,providerCancels=0;
  const remote={id:123,collector_id:456,currency_id:'BRL',payment_method_id:'pix',external_reference:'print3d:'+providerCharge.id,transaction_amount:10,status:'pending'};
  const adapter={get:async()=>{providerGets++;if(providerFails) throw new Error('local simulated timeout');return remote;},
    cancel:async()=>{providerCancels++;return {...remote,status:'cancelled'};}};
  const makeRetryWorker=()=>createPrint3dExpiryWorker({pool,checkoutEnabled:true,
    env:{MDV_PRINT3D_CHECKOUT_ENABLED:'1',MDV_PRINT3D_EXPIRY_ENABLED:'1'},
    expire:async()=>({scanned:0,expired:0,skipped:0,order_ids:[]}),
    cancelProviderCharges:orderId=>cancelPrint3dProviderCharges(pool,{orderId,adapter,collectorId:'456'})});
  await makeRetryWorker().runOnce();
  const [[retryPending]]=await pool.query('SELECT status FROM print3d_payment_charges WHERE id=?',[providerCharge.id]);
  assert.equal(retryPending.status,'cancelled');assert.equal(providerGets,1);assert.equal(providerCancels,0);
  providerFails=false;
  await makeRetryWorker().runOnce();
  const [[retryConfirmed]]=await pool.query('SELECT status FROM print3d_payment_charges WHERE id=?',[providerCharge.id]);
  assert.equal(retryConfirmed.status,'provider_cancelled');assert.equal(providerGets,2);assert.equal(providerCancels,1);
  await makeRetryWorker().runOnce();assert.equal(providerGets,2);
  const [[stillCancelled]]=await pool.query('SELECT status FROM orders WHERE id=?',[expiringOrder]);
  assert.equal(stillCancelled.status,'cancelled');

  // A provider response received after cancellation must not lose its remote ID.
  const {createCharge}=require('../services/print3dPayments.cjs');
  const concurrentOrder=expiryCandidates[0];
  const [[concurrentCharge]]=await pool.query('SELECT * FROM print3d_payment_charges WHERE order_id=?',[concurrentOrder]);
  let beginCreation,finishCreation;
  const creationStarted=new Promise(resolve=>{beginCreation=resolve;});
  const remoteResponse=new Promise(resolve=>{finishCreation=resolve;});
  const concurrentRemote={...remote,id:45678,external_reference:'print3d:'+concurrentCharge.id};
  const creating=createCharge(pool,{orderId:concurrentOrder,customer:{id:customerId,email:'test@example.test'},
    body:{stage:'initial',idempotency_key:concurrentCharge.idempotency_key},collectorId:'456',
    adapter:{create:async()=>{beginCreation();await remoteResponse;return concurrentRemote;}}});
  await creationStarted;
  await cancelPrint3dOrder(pool,{orderId:concurrentOrder,actorType:'customer',actorId:customerId,reason:'Cancelado enquanto o PIX estava sendo criado.'});
  finishCreation();
  const lateCreation=await creating;
  assert.equal(lateCreation.charge.status,'cancelled');assert.equal(lateCreation.charge.pix_code,'');
  const [[persistedRemote]]=await pool.query('SELECT status,provider_payment_id FROM print3d_payment_charges WHERE id=?',[concurrentCharge.id]);
  assert.equal(persistedRemote.status,'cancelled');assert.equal(persistedRemote.provider_payment_id,'45678');
  const closing=await cancelPrint3dProviderCharges(pool,{orderId:concurrentOrder,collectorId:'456',
    adapter:{get:async()=>concurrentRemote,cancel:async()=>({...concurrentRemote,status:'cancelled'})}});
  assert.equal(closing[0].review_required,false);
  const [[closedConcurrent]]=await pool.query('SELECT status FROM orders WHERE id=?',[concurrentOrder]);
  assert.equal(closedConcurrent.status,'cancelled');
  const [[unexpectedReceipts]]=await pool.query('SELECT COUNT(*) total FROM print3d_order_payment_receipts WHERE order_id=?',[concurrentOrder]);
  assert.equal(Number(unexpectedReceipts.total),0);

  // Permanently lost creation response: discover by reference on a later worker run.
  const lostOrder=expiryCandidates[2];
  const [[lostCharge]]=await pool.query('SELECT * FROM print3d_payment_charges WHERE order_id=?',[lostOrder]);
  const lostRemote={...remote,id:98765,external_reference:'print3d:'+lostCharge.id};
  let searchable=false,searches=0,closedLost=0;
  const recoveryAdapter={findByReference:async id=>{searches++;assert.equal(id,lostCharge.id);return searchable?lostRemote:null;},
    get:async id=>{assert.equal(String(id),'98765');return lostRemote;},
    cancel:async id=>{assert.equal(String(id),'98765');closedLost++;return {...lostRemote,status:'cancelled'};},
    create:async()=>assert.fail('cancelled order must never create another PIX')};
  const recover=()=>createPrint3dExpiryWorker({pool,checkoutEnabled:true,
    env:{MDV_PRINT3D_CHECKOUT_ENABLED:'1',MDV_PRINT3D_EXPIRY_ENABLED:'1'},
    expire:async()=>({scanned:0,expired:0,skipped:0,order_ids:[]}),
    cancelProviderCharges:id=>id===lostOrder?cancelPrint3dProviderCharges(pool,{orderId:id,adapter:recoveryAdapter,collectorId:'456'}):undefined}).runOnce();
  await recover();assert.equal(searches,1);assert.equal(closedLost,0);
  const [[unresolved]]=await pool.query('SELECT status,provider_payment_id FROM print3d_payment_charges WHERE id=?',[lostCharge.id]);
  assert.equal(unresolved.status,'cancelled');assert.equal(unresolved.provider_payment_id,null);
  const pendingList=await app.inject({url:'/admin/print3d/orders?page_size=100',headers:{authorization:'Bearer local-admin'}});
  assert.equal(pendingList.statusCode,200);
  assert.deepEqual(pendingList.json().items.find(row=>row.id===lostOrder).payment_review,{pending_cancellations:1,refunded_payments:0,late_payments:0,late_amount_cents:0});
  searchable=true;await recover();assert.equal(searches,2);assert.equal(closedLost,1);
  const [[recovered]]=await pool.query('SELECT status,provider_payment_id FROM print3d_payment_charges WHERE id=?',[lostCharge.id]);
  assert.equal(recovered.status,'provider_cancelled');assert.equal(recovered.provider_payment_id,'98765');
  await recover();assert.equal(searches,2);
  const resolvedList=await app.inject({url:'/admin/print3d/orders?page_size=100',headers:{authorization:'Bearer local-admin'}});
  assert.equal(resolvedList.json().items.find(row=>row.id===lostOrder).payment_review.pending_cancellations,0);
  const [[lostReceipts]]=await pool.query('SELECT COUNT(*) total FROM print3d_order_payment_receipts WHERE order_id=?',[lostOrder]);
  assert.equal(Number(lostReceipts.total),0);
  // Active or Mercado do Vale orders must not be searched/cancelled through this helper.
  assert.deepEqual(await cancelPrint3dProviderCharges(pool,{orderId:expiryCandidates[1],adapter:recoveryAdapter,collectorId:'456'}),[]);

  // A late payment stays reviewable through partial refunds and stale snapshots.
  const {settlePayment}=require('../services/print3dPayments.cjs');
  const lateApproved={...lostRemote,status:'approved',date_approved:'2026-09-27T12:00:00Z'};
  const reconcileLate=payment=>settlePayment(pool,{payment,chargeId:lostCharge.id,collectorId:'456'});
  assert.equal((await reconcileLate(lateApproved)).late_payment,true);
  assert.equal((await reconcileLate({...lateApproved,transaction_amount_refunded:3})).review_required,true);
  assert.equal((await reconcileLate({...lostRemote,status:'cancelled'})).review_required,true);
  const reviewList=await app.inject({url:'/admin/print3d/orders?page_size=100',headers:{authorization:'Bearer local-admin'}});
  assert.deepEqual(reviewList.json().items.find(row=>row.id===lostOrder).payment_review,
    {pending_cancellations:0,refunded_payments:0,late_payments:1,late_amount_cents:1000});
  let refundPolls=0;
  const refundWorker=()=>createPrint3dExpiryWorker({pool,checkoutEnabled:true,
    env:{MDV_PRINT3D_CHECKOUT_ENABLED:'1',MDV_PRINT3D_EXPIRY_ENABLED:'1'},
    expire:async()=>({scanned:0,expired:0,skipped:0,order_ids:[]}),
    cancelProviderCharges:id=>id===lostOrder?cancelPrint3dProviderCharges(pool,{orderId:id,collectorId:'456',
      adapter:{get:async()=>{refundPolls++;return {...lostRemote,status:'refunded',transaction_amount_refunded:10};},
        cancel:async()=>assert.fail('must not cancel or refund an already settled payment')}}):undefined}).runOnce();
  await refundWorker();assert.equal(refundPolls,1);
  await refundWorker();assert.equal(refundPolls,1);
  const completedRefund=await reconcileLate(lateApproved);
  assert.equal(completedRefund.charge.status,'refunded');assert.equal(completedRefund.review_required,false);
  const refundList=await app.inject({url:'/admin/print3d/orders?page_size=100',headers:{authorization:'Bearer local-admin'}});
  const refundedOrder=refundList.json().items.find(row=>row.id===lostOrder);
  assert.deepEqual(refundedOrder.payment_review,{pending_cancellations:0,refunded_payments:1,late_payments:0,late_amount_cents:0});
  assert.equal(refundedOrder.status,'cancelled');assert.equal(refundedOrder.confirmed_cents,0);
  const [[auditEvent]]=await pool.query("SELECT COUNT(*) total FROM print3d_order_cancellation_events WHERE order_id=? AND event_type='late_payment'",[lostOrder]);
  assert.equal(Number(auditEvent.total),1);

  // Duplicate gateway notifications waiting on the same order must replay.
  const paymentOrder=expiryCandidates[1];
  await pool.query("UPDATE orders SET subtotal=1000,shipping_cost=0,total=1000,discount=0,payment_status='pending' WHERE id=?",[paymentOrder]);
  const [[paymentCharge]]=await pool.query('SELECT * FROM print3d_payment_charges WHERE order_id=?',[paymentOrder]);
  const settledRemote={...remote,id:111222,external_reference:'print3d:'+paymentCharge.id,status:'approved',date_approved:'2026-09-27T12:00:00Z'};
  const orderBlocker=await pool.getConnection();
  await orderBlocker.beginTransaction();
  await orderBlocker.query('SELECT id FROM orders WHERE id=? FOR UPDATE',[paymentOrder]);
  let references=0,referencesReady;
  const bothReferenced=new Promise(resolve=>{referencesReady=resolve;});
  const observeQuery=async(target,sql,args)=>{
    const result=await target.query(sql,args);
    if(sql.startsWith('SELECT order_id FROM print3d_payment_charges') && ++references===2) referencesReady();
    return result;
  };
  const observedPool={query:(sql,args)=>observeQuery(pool,sql,args),getConnection:async()=>{
    const c=await pool.getConnection();
    return {beginTransaction:()=>c.beginTransaction(),commit:()=>c.commit(),rollback:()=>c.rollback(),release:()=>c.release(),query:(sql,args)=>observeQuery(c,sql,args)};
  }};
  const parallelSettlements=Promise.allSettled([1,2].map(()=>settlePayment(observedPool,{payment:settledRemote,chargeId:paymentCharge.id,collectorId:'456'})));
  await bothReferenced;await orderBlocker.commit();orderBlocker.release();
  const notifications=await parallelSettlements;
  assert(notifications.every(result=>result.status==='fulfilled'),JSON.stringify(notifications));
  assert(notifications.every(result=>result.value.coverage.confirmed_cents===1000));
  const [[oneReceipt]]=await pool.query('SELECT COUNT(*) total FROM print3d_order_payment_receipts WHERE order_id=?',[paymentOrder]);
  assert.equal(Number(oneReceipt.total),1);

  await require('./print3d-accounts-mysql-scenario.cjs')(pool);
  await require('./print3d-google-mysql-scenario.cjs')(pool);
  await require('./print3d-price-isolation-mysql.cjs')(pool);
  await require('./print3d-sku-audit-mysql.cjs')(pool);

});
