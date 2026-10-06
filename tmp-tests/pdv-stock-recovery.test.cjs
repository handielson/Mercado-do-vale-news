const assert=require('node:assert/strict');
const fs=require('node:fs');
const {decrementPriorityStock}=require('../services/priorityStockDecrement.cjs');
const {stockReport,reconciledLog,reconcileStock}=require('../services/saleStockReconciliation.cjs');

function fixture({error,failAfterWrite=false,external=null}={}) {
  const state={quantity:5,movements:[],writes:0,tries:0,releases:0,rollbacks:0,timeout:50};let tail=Promise.resolve();
  const sql=[];
  const pool={getConnection:async()=>{
    let unlock,snapshot;
    return {
      beginTransaction:async()=>{state.tries++;},
      commit:async()=>{unlock?.();unlock=null;},
      rollback:async()=>{state.rollbacks++;if(snapshot){state.quantity=snapshot.quantity;state.movements=snapshot.movements;}unlock?.();unlock=null;},
      release:()=>{state.releases++;},destroy:()=>{},
      query:async(q,args=[])=>{
        sql.push(q);
        if(q.startsWith('SELECT @@'))return [[{timeout:state.timeout}]];
        if(q.startsWith('SET SESSION')){state.timeout=args[0]||5;return [{}];}
        if(q.startsWith('SET TRANSACTION'))return [{}];
        if(q.startsWith('SELECT id,company_id')) {
          const previous=tail;tail=new Promise(r=>{unlock=r;});await previous;
          snapshot={quantity:state.quantity,movements:state.movements.slice()};
          if(error&&state.tries===1&&!failAfterWrite)throw Object.assign(new Error(error),{code:error});
          return [[{id:'p',company_id:'c'}]];
        }
        if(q.startsWith('SELECT payment_status'))return [[{payment_status:'paid',finalization_log:external}]];
        if(q.includes("reference_type='sale'"))return [[{quantity:state.movements.reduce((n,r)=>n+r.quantity,0)}]];
        if(q.startsWith('SELECT id FROM product_stock_locations'))return [[{id:'l'}]];
        if(q.includes('SELECT psl.*')){assert.ok(!q.includes('FOR UPDATE'));return [[{id:'l',quantity:state.quantity,reserved_quantity:0,deposit_id:'d',location_id:'loc'}]];}
        if(q.startsWith('UPDATE product_stock_locations')){state.quantity-=args[0];state.writes++;return [{affectedRows:1}];}
        if(q.startsWith('INSERT INTO stock_location_movements')) {
          state.movements.push({quantity:args[5]});
          if(error&&state.tries===1&&failAfterWrite)throw Object.assign(new Error(error),{code:error});
          return [{}];
        }
        if(q.includes('SUM(quantity)'))return [[{quantity:state.quantity}]];
        if(q.startsWith('UPDATE products'))return [{}];
        throw Error('Unexpected SQL: '+q);
      },
    };
  }};
  return {pool,state,sql};
}
const input={product_id:'p',quantity:1,reference_type:'sale',reference_id:'s'};
(async()=>{
  const normal=fixture();await decrementPriorityStock(normal.pool,input);await decrementPriorityStock(normal.pool,input);
  assert.equal(normal.state.quantity,4);assert.equal(normal.state.movements.length,1);
  assert.ok(normal.sql.findIndex(q=>q.startsWith('SELECT payment_status'))<normal.sql.findIndex(q=>q.startsWith('SELECT id,company_id')));
  assert.match(normal.sql.find(q=>q.startsWith('SELECT payment_status')),/FOR UPDATE/);
  assert.equal((await decrementPriorityStock(normal.pool,{...input,reference_id:''})).status,400);
  assert.equal((await decrementPriorityStock(normal.pool,{...input,quantity:2})).status,409);
  const concurrent=fixture();await Promise.all([decrementPriorityStock(concurrent.pool,input),decrementPriorityStock(concurrent.pool,input)]);
  assert.equal(concurrent.state.quantity,4);assert.equal(concurrent.state.movements.length,1);
  for(const error of ['ER_LOCK_WAIT_TIMEOUT','ER_LOCK_DEADLOCK']) {
    const retry=fixture({error,failAfterWrite:true});await decrementPriorityStock(retry.pool,input);
    assert.equal(retry.state.quantity,4);assert.equal(retry.state.movements.length,1);assert.equal(retry.state.tries,2);assert.equal(retry.state.timeout,50);assert.equal(retry.state.releases,2);
  }
  const nonretry=fixture({error:'ER_BAD_FIELD_ERROR'});await assert.rejects(decrementPriorityStock(nonretry.pool,input));assert.equal(nonretry.state.tries,1);
  const exhausted=fixture();exhausted.pool.getConnection=async()=>({query:async q=>q.startsWith('SELECT @@')?[[{timeout:50}]]:[{}],beginTransaction:async()=>{throw Object.assign(Error('busy'),{code:'ER_LOCK_WAIT_TIMEOUT'});},rollback:async()=>{},release:()=>{exhausted.state.releases++;}});
  await assert.rejects(decrementPriorityStock(exhausted.pool,input));assert.equal(exhausted.state.releases,3);

  // Diagnostico por etapa, sem SQL, parametros livres ou dados pessoais.
  const quiet=fixture();const quietLogs=[];
  await decrementPriorityStock(quiet.pool,input,{logger:r=>quietLogs.push(r)});
  await decrementPriorityStock(quiet.pool,input,{logger:r=>quietLogs.push(r)});
  assert.equal(quietLogs.length,0);assert.equal(quiet.state.movements.length,1);
  const logs=[];const observed=fixture({error:'ER_LOCK_WAIT_TIMEOUT',failAfterWrite:true});
  await decrementPriorityStock(observed.pool,{...input,notes:'SEGREDO_NOTES',reason:'SEGREDO_REASON'}, {logger:r=>logs.push(r)});
  assert.equal(observed.state.quantity,4);assert.equal(observed.state.movements.length,1);
  assert.equal(logs.length,2);assert.equal(logs[0].stage,'insert_movement');
  assert.equal(logs[0].code,'ER_LOCK_WAIT_TIMEOUT');assert.equal(logs[0].rollback,'completed');
  assert.equal(logs[0].will_retry,true);assert.equal(logs[0].attempt,1);
  assert.equal(logs[0].transaction_started,true);assert.ok(logs[0].stage_elapsed_ms>=0);
  assert.equal(logs[0].product_id,'p');assert.equal(logs[0].reference_id,'s');
  assert.equal(logs[1].result,'recovered');assert.equal(logs[1].attempt,2);
  assert.equal(logs[1].operation_id,logs[0].operation_id);
  assert.doesNotMatch(JSON.stringify(logs),/SEGREDO|INSERT|SELECT|UPDATE|sqlMessage/);
  const locked=fixture({error:'ER_LOCK_DEADLOCK'});const lockLogs=[];
  await decrementPriorityStock(locked.pool,input,{logger:r=>lockLogs.push(r)});
  assert.equal(lockLogs[0].stage,'lock_product');assert.equal(lockLogs[0].will_retry,true);
  const terminal=[];await assert.rejects(decrementPriorityStock(exhausted.pool,input,{logger:r=>terminal.push(r)}));
  assert.equal(terminal.length,3);assert.equal(terminal[2].will_retry,false);
  assert.equal(terminal[2].stage,'begin_transaction');assert.equal(terminal[2].max_attempts,3);
  const acquisition=[];const poolError=Object.assign(Error('SEGREDO_SQL'),{code:'ECONNREFUSED',sqlMessage:'SEGREDO_SQL'});
  await assert.rejects(decrementPriorityStock({getConnection:async()=>{throw poolError;}},input,{logger:r=>acquisition.push(r)}),e=>e===poolError);
  assert.equal(acquisition[0].stage,'acquire_connection');assert.equal(acquisition[0].rollback,'not_applicable');
  assert.doesNotMatch(JSON.stringify(acquisition),/SEGREDO_SQL/);
  const broken=fixture({error:'ER_LOCK_WAIT_TIMEOUT'});const getBroken=broken.pool.getConnection;let destroyed=0;const brokenLogs=[];
  broken.pool.getConnection=async()=>{const c=await getBroken();c.threadId=123;c.rollback=async()=>{throw Object.assign(Error('private'),{code:'PROTOCOL_CONNECTION_LOST'});};c.destroy=()=>{destroyed++;};return c;};
  await assert.rejects(decrementPriorityStock(broken.pool,input,{logger:r=>brokenLogs.push(r)}));
  assert.equal(broken.state.tries,1);assert.equal(broken.state.releases,0);assert.equal(destroyed,1);
  assert.equal(brokenLogs[0].rollback,'failed');assert.equal(brokenLogs[0].will_retry,false);
  assert.equal(brokenLogs[0].rollback_code,'PROTOCOL_CONNECTION_LOST');assert.equal(brokenLogs[0].connection_id,123);
  const badLogger=fixture({error:'ER_LOCK_WAIT_TIMEOUT',failAfterWrite:true});
  await decrementPriorityStock(badLogger.pool,input,{logger:()=>{throw Error('logger unavailable');}});
  assert.equal(badLogger.state.quantity,4);assert.equal(badLogger.state.movements.length,1);
  const restore=fixture();const getRestore=restore.pool.getConnection;const restoreLogs=[];let restoreDestroyed=0;
  restore.pool.getConnection=async()=>{const c=await getRestore();const query=c.query;c.query=async(q,a)=>{if(q.startsWith('SET SESSION')&&a?.[0]===50)throw Object.assign(Error('restore'),{code:'PROTOCOL_CONNECTION_LOST'});return query(q,a);};c.destroy=()=>{restoreDestroyed++;};return c;};
  assert.equal((await decrementPriorityStock(restore.pool,input,{logger:r=>restoreLogs.push(r)})).status,200);
  assert.equal(restore.state.quantity,4);assert.equal(restoreDestroyed,1);assert.equal(restore.state.releases,0);
  assert.equal(restoreLogs[0].stage,'restore_lock_timeout');assert.equal(restoreLogs[0].result,'connection_discarded');

  const sale={id:'b11b6196-0c86-47a1-8b95-49ffc90f9ae2',payment_status:'paid',finalization_log:JSON.stringify({finalization_issues:[{step:'stock_decrement',message:'timeout'},{step:'customer_debt',message:'debt pending'}],finalization_warnings:[{step:'sale_whatsapp',message:'missing_phone'}]})};
  const items=[{product_id:'p',product_sku:'SKU',quantity:1,track_inventory:1}];
  const report=stockReport(sale,items,[]);assert.throws(()=>reconciledLog(sale,report,[],'admin'),/cada produto/);
  const evidence=[{product_id:'p',quantity:1,source:'bling',reference:'B11B6196',note:'Saida conferida no historico do Bling, saldo refletido.'}];
  const log=reconciledLog(sale,report,evidence,'admin');assert.equal(log.finalization_status,'needs_review');assert.equal(log.finalization_issues.length,1);assert.equal(log.stock_reconciliations[0].original_issues[0].message,'timeout');assert.equal(log.finalization_warnings.length,1);
  const external=fixture({external:JSON.stringify(log)});assert.equal((await decrementPriorityStock(external.pool,input)).already_applied,true);assert.equal(external.state.writes,0);
  assert.throws(()=>reconciledLog(sale,report,[{...evidence[0],reference:'WRONG'}],'admin'));
  assert.throws(()=>reconciledLog(sale,stockReport(sale,items,[{product_id:'p',quantity:2}]),[],'admin'),/duplicados/);
  assert.throws(()=>stockReport({...sale,payment_status:'cancelled'},items,[]));
  const allLocal=stockReport(sale,items,[{product_id:'p',quantity:1}]);assert.equal(allLocal[0].confirmed,true);
  const onlyStock={...sale,finalization_log:JSON.stringify({finalization_issues:[{step:'stock_decrement',message:'timeout'}]})};
  assert.equal(reconciledLog(onlyStock,allLocal,[],'admin').finalization_status,'success');
  // A reconciliacao grava somente a auditoria da venda, nunca saldos/movimentos.
  const updates=[];const db={query:async(q,a)=>{
    if(q.startsWith('SET'))return [{}];
    if(q.includes('FROM sales'))return [[onlyStock]];
    if(q.includes('FROM sale_items'))return [items];
    if(q.includes('FROM stock_location_movements'))return [[{product_id:'p',quantity:1}]];
    assert.ok(q.startsWith('UPDATE sales SET'));updates.push(q);return [{affectedRows:1}];
  },beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{}};
  assert.equal((await reconcileStock({getConnection:async()=>db},sale.id,[],'admin')).status,'success');assert.equal(updates.length,1);
  const server=fs.readFileSync('vps_server.cjs','utf8');
  assert.match(server,/post\('\/sales\/:id\/stock-reconciliation', \{ preHandler: requireAdminBearerToken \}/);
  assert.match(fs.readFileSync('deploy-vps-server-only.cjs','utf8'),/services\/saleStockReconciliation.cjs/);
  assert.match(fs.readFileSync('components/admin/sales/SaleStockReconciliation.tsx','utf8'),/Registrar conferência sem alterar estoque/);
  console.log('PDV stock recovery: retry, rollback, concorrencia, idempotencia, diagnostico seguro por etapa e auditoria sem alterar estoque OK.');
})();
