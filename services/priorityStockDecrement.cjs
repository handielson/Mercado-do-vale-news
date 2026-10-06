'use strict';

const {randomUUID}=require('node:crypto');

function positiveInteger(value) {
  const number=Number(value);
  return Number.isSafeInteger(number)&&number>0?number:null;
}

async function decrementPriorityStockOnConnection(connection,input,run=(_stage,action)=>action()) {
  const query=(stage,sql,args)=>run(stage,()=>connection.query(sql,args));
  const productId=String(input?.product_id||'');
  const quantity=positiveInteger(input?.quantity);
  if(!productId||!quantity) return {status:400,error:'Produto e quantidade inteira positiva sao obrigatorios.'};
  let sale;
  if(input.reference_type==='sale') {
    if(!String(input.reference_id||'').trim())return {status:400,error:'sale_reference_required'};
    // Mesma trava e ordem da reconciliacao: a conferencia externa nao pode
    // disputar com uma nova baixa enquanto sua evidencia e registrada.
    [[sale]]=await query('lock_sale','SELECT payment_status,finalization_log FROM sales WHERE id=? FOR UPDATE',[input.reference_id]);
    if(!sale)return {status:404,error:'sale_not_found'};
    if(sale.payment_status==='cancelled')return {status:409,error:'sale_cancelled'};
  }
  const [[product]]=await query('lock_product','SELECT id,company_id FROM products WHERE id=? LIMIT 1 FOR UPDATE',[productId]);
  if(!product) return {status:404,error:'Produto nao encontrado.'};
  if (input.reference_type === 'sale') {
    const externallyApplied=require('./saleStockReconciliation.cjs').externalConfirmationQuantity(sale.finalization_log,productId);
    if(externallyApplied>0)return externallyApplied===quantity
      ? {status:200,decrements:[],already_applied:true}
      : {status:409,error:'sale_stock_quantity_conflict'};
    // A trava do produto serializa a consulta e a gravacao, inclusive entre requests simultaneos.
    const [[existing]]=await query('read_sale_movements',`SELECT COALESCE(SUM(quantity),0) AS quantity
      FROM stock_location_movements WHERE product_id=? AND reference_type='sale'
      AND reference_id=? AND movement_type='sale'`,[productId,input.reference_id]);
    if (Number(existing.quantity) > 0) {
      return Number(existing.quantity) === quantity
        ? {status:200,decrements:[],already_applied:true}
        : {status:409,error:'sale_stock_quantity_conflict'};
    }
  }
  // Bloquear somente os saldos deste produto. FOR UPDATE em um JOIN tambem
  // bloqueava os cadastros compartilhados de deposito/local entre produtos distintos.
  await query('lock_stock_locations','SELECT id FROM product_stock_locations WHERE product_id=? ORDER BY id FOR UPDATE',[productId]);
  const [sources]=await query('read_stock_sources',`SELECT psl.*,
      sd.name AS deposit_name,sd.code AS deposit_code,sd.type AS deposit_type,sd.is_default AS deposit_is_default,
      sl.name AS location_name,sl.code AS location_code,sl.is_default AS location_is_default
    FROM product_stock_locations psl
    LEFT JOIN stock_deposits sd ON sd.id=psl.deposit_id
    LEFT JOIN stock_locations sl ON sl.id=psl.location_id
    WHERE psl.product_id=? AND (psl.quantity-psl.reserved_quantity)>0
    ORDER BY sd.is_default DESC,sl.is_default DESC,psl.quantity DESC,psl.id`,[productId]);
  const available=sources.reduce((sum,row)=>sum+Math.max(0,Number(row.quantity)-Number(row.reserved_quantity)),0);
  if(available<quantity) return {status:400,error:'insufficient_stock_by_location'};
  let remaining=quantity;
  const decrements=[];
  for(const source of sources) {
    if(remaining<=0) break;
    const previous=Number(source.quantity);
    const reserved=Number(source.reserved_quantity);
    const decrement=Math.min(remaining,previous-reserved);
    if(decrement<=0) continue;
    const [updated]=await query('decrement_location',`UPDATE product_stock_locations
      SET quantity=quantity-?,updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND (quantity-reserved_quantity)>=?`,[decrement,source.id,decrement]);
    if(updated.affectedRows!==1) throw new Error('stock_decrement_conflict');
    const next=previous-decrement;
    await query('insert_movement',`INSERT INTO stock_location_movements
      (id,company_id,product_id,from_deposit_id,from_location_id,quantity,movement_type,reason,
       reference_type,reference_id,previous_from_quantity,new_from_quantity,notes)
      VALUES (?,?,?,?,?,?,'sale',?,?,?,?,?,?)`,
      [randomUUID(),source.company_id||product.company_id,productId,source.deposit_id,source.location_id,decrement,
        String(input.reason||'').trim()||'Baixa por prioridade',input.reference_type||null,input.reference_id||null,
        previous,next,input.notes||null]);
    decrements.push({stock_location_id:source.id,deposit_id:source.deposit_id,location_id:source.location_id,
      deposit_name:source.deposit_name||null,deposit_code:source.deposit_code||null,deposit_type:source.deposit_type||null,
      deposit_is_default:Boolean(source.deposit_is_default),location_name:source.location_name||null,
      location_code:source.location_code||null,location_is_default:Boolean(source.location_is_default),
      quantity_decremented:decrement,previous_quantity:previous,new_quantity:next});
    remaining-=decrement;
  }
  const [[total]]=await query('read_stock_total','SELECT COALESCE(SUM(quantity),0) AS quantity FROM product_stock_locations WHERE product_id=?',[productId]);
  await query('update_product_total','UPDATE products SET stock_quantity=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[Number(total.quantity),productId]);
  return {status:200,decrements};
}

async function decrementPriorityStock(pool,input,{logger=record=>console.warn(JSON.stringify(record))}={}) {
  // Lista fechada: nunca registrar SQL, parametros, mensagem bruta, notes ou dados pessoais.
  const operationId=randomUUID();
  const started=Date.now();
  const safeId=value=>/^[a-zA-Z0-9_-]{1,80}$/.test(String(value||''))?String(value):null;
  const emit=record=>{try{logger({event:'priority_stock_decrement',operation_id:operationId,
    product_id:safeId(input?.product_id),reference_type:safeId(input?.reference_type),
    reference_id:safeId(input?.reference_id),quantity:positiveInteger(input?.quantity),
    elapsed_ms:Date.now()-started,...record});}catch{/* Log nao pode provocar nova baixa ou impedir rollback. */}};
  for (let attempt=0;attempt<3;attempt++) {
    let connection;
    let stage='acquire_connection';
    let stageStarted=Date.now();
    let transactionStarted=false;
    let previousTimeout;
    let reusable=true;
    const run=async(name,action)=>{stage=name;stageStarted=Date.now();return action();};
    try {
      connection=await run('acquire_connection',()=>pool.getConnection());
      const [[settings]]=await run('read_lock_timeout',()=>connection.query('SELECT @@SESSION.innodb_lock_wait_timeout AS timeout'));
      previousTimeout=Number(settings.timeout);
      await run('set_lock_timeout',()=>connection.query('SET SESSION innodb_lock_wait_timeout=5'));
      await run('set_isolation',()=>connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED'));
      await run('begin_transaction',()=>connection.beginTransaction());
      transactionStarted=true;
      const outcome=await decrementPriorityStockOnConnection(connection,input,run);
      if(outcome.status!==200) {await run('rollback_rejected',()=>connection.rollback());transactionStarted=false;return outcome;}
      await run('commit',()=>connection.commit());
      transactionStarted=false;
      if(attempt>0)emit({result:'recovered',attempt:attempt+1,already_applied:Boolean(outcome.already_applied)});
      return outcome;
    } catch(error) {
      const failedStage=stage;
      const stageElapsed=Date.now()-stageStarted;
      let rolledBack=false;
      let rollbackCode=null;
      if(connection)try {await connection.rollback();rolledBack=true;} catch(rollbackError){rollbackCode=safeId(rollbackError.code);}
      if(connection&&!rolledBack){reusable=false;connection.destroy();}
      const retry=rolledBack&&attempt<2&&['ER_LOCK_WAIT_TIMEOUT','ER_LOCK_DEADLOCK'].includes(error.code);
      emit({result:'failed',attempt:attempt+1,max_attempts:3,stage:failedStage,stage_elapsed_ms:stageElapsed,
        connection_id:Number.isSafeInteger(connection?.threadId)?connection.threadId:null,
        transaction_started:transactionStarted,code:safeId(error.code),
        rollback:connection?(rolledBack?'completed':'failed'):'not_applicable',rollback_code:rollbackCode,
        will_retry:retry});
      if (!retry) throw error;
    } finally {
      // Nao deixar a configuracao temporaria na conexao devolvida ao pool.
      if (connection && reusable && Number.isInteger(previousTimeout)) {
        try {await connection.query('SET SESSION innodb_lock_wait_timeout=?',[previousTimeout]);}
        catch(error){reusable=false;connection.destroy();emit({result:'connection_discarded',attempt:attempt+1,
          stage:'restore_lock_timeout',code:safeId(error.code)});}
      }
      if(connection&&reusable)connection.release();
    }
    await new Promise(resolve=>setTimeout(resolve,100*(attempt+1)));
  }
}

module.exports={decrementPriorityStock,decrementPriorityStockOnConnection};
