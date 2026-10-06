'use strict';

const {randomUUID}=require('node:crypto');

function positiveInteger(value) {
  const number=Number(value);
  return Number.isSafeInteger(number)&&number>0?number:null;
}

async function decrementPriorityStockOnConnection(connection,input) {
  const productId=String(input?.product_id||'');
  const quantity=positiveInteger(input?.quantity);
  if(!productId||!quantity) return {status:400,error:'Produto e quantidade inteira positiva sao obrigatorios.'};
  let sale;
  if(input.reference_type==='sale') {
    if(!String(input.reference_id||'').trim())return {status:400,error:'sale_reference_required'};
    // Mesma trava e ordem da reconciliacao: a conferencia externa nao pode
    // disputar com uma nova baixa enquanto sua evidencia e registrada.
    [[sale]]=await connection.query('SELECT payment_status,finalization_log FROM sales WHERE id=? FOR UPDATE',[input.reference_id]);
    if(!sale)return {status:404,error:'sale_not_found'};
    if(sale.payment_status==='cancelled')return {status:409,error:'sale_cancelled'};
  }
  const [[product]]=await connection.query('SELECT id,company_id FROM products WHERE id=? LIMIT 1 FOR UPDATE',[productId]);
  if(!product) return {status:404,error:'Produto nao encontrado.'};
  if (input.reference_type === 'sale') {
    const externallyApplied=require('./saleStockReconciliation.cjs').externalConfirmationQuantity(sale.finalization_log,productId);
    if(externallyApplied>0)return externallyApplied===quantity
      ? {status:200,decrements:[],already_applied:true}
      : {status:409,error:'sale_stock_quantity_conflict'};
    // A trava do produto serializa a consulta e a gravacao, inclusive entre requests simultaneos.
    const [[existing]]=await connection.query(`SELECT COALESCE(SUM(quantity),0) AS quantity
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
  await connection.query('SELECT id FROM product_stock_locations WHERE product_id=? ORDER BY id FOR UPDATE',[productId]);
  const [sources]=await connection.query(`SELECT psl.*,
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
    const [updated]=await connection.query(`UPDATE product_stock_locations
      SET quantity=quantity-?,updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND (quantity-reserved_quantity)>=?`,[decrement,source.id,decrement]);
    if(updated.affectedRows!==1) throw new Error('stock_decrement_conflict');
    const next=previous-decrement;
    await connection.query(`INSERT INTO stock_location_movements
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
  const [[total]]=await connection.query('SELECT COALESCE(SUM(quantity),0) AS quantity FROM product_stock_locations WHERE product_id=?',[productId]);
  await connection.query('UPDATE products SET stock_quantity=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[Number(total.quantity),productId]);
  return {status:200,decrements};
}

async function decrementPriorityStock(pool,input) {
  for (let attempt=0;attempt<3;attempt++) {
    const connection=await pool.getConnection();
    let previousTimeout;
    let reusable=true;
    try {
      const [[settings]]=await connection.query('SELECT @@SESSION.innodb_lock_wait_timeout AS timeout');
      previousTimeout=Number(settings.timeout);
      await connection.query('SET SESSION innodb_lock_wait_timeout=5');
      await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
      await connection.beginTransaction();
      const outcome=await decrementPriorityStockOnConnection(connection,input);
      if(outcome.status!==200) {await connection.rollback();return outcome;}
      await connection.commit();
      return outcome;
    } catch(error) {
      let rolledBack=false;
      try {await connection.rollback();rolledBack=true;} catch {}
      if(!rolledBack){reusable=false;connection.destroy();}
      if (!rolledBack || attempt===2 || !['ER_LOCK_WAIT_TIMEOUT','ER_LOCK_DEADLOCK'].includes(error.code)) throw error;
    } finally {
      // Nao deixar a configuracao temporaria na conexao devolvida ao pool.
      if (reusable && Number.isInteger(previousTimeout)) {
        try {await connection.query('SET SESSION innodb_lock_wait_timeout=?',[previousTimeout]);}
        catch {reusable=false;connection.destroy();}
      }
      if(reusable)connection.release();
    }
    await new Promise(resolve=>setTimeout(resolve,100*(attempt+1)));
  }
}

module.exports={decrementPriorityStock,decrementPriorityStockOnConnection};
