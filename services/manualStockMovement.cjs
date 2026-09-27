'use strict';
const {randomUUID}=require('node:crypto');
function fail(statusCode,message) {throw Object.assign(new Error(message),{statusCode});}

async function applyManualStockMovement(pool,input,mode,{getDefaultCompanyId}={}) {
  if(!['entry','adjustment'].includes(mode)) fail(400,'Operação de estoque inválida.');
  if(!input?.product_id||!input.deposit_id||!input.location_id) fail(400,'Produto, deposito e local sao obrigatorios.');
  const amount=Number(input.quantity);
  if(input.quantity==null||input.quantity===''||!Number.isSafeInteger(amount)||amount<(mode==='entry'?1:0))
    fail(400,'Informe uma quantidade inteira valida.');
  const reason=String(input.reason||'').trim();
  if(!reason) fail(400,'Informe o motivo da movimentação.');
  const connection=await pool.getConnection();
  try {
    await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await connection.beginTransaction();
    const [[product]]=await connection.query('SELECT id,company_id FROM products WHERE id=? LIMIT 1 FOR UPDATE',[input.product_id]);
    if(!product) fail(404,'Produto nao encontrado.');
    const companyId=product.company_id||await getDefaultCompanyId?.();
    if(!companyId) fail(409,'Empresa do produto não configurada.');
    const [rows]=await connection.query(`SELECT * FROM product_stock_locations
      WHERE product_id=? AND deposit_id=? AND location_id=? FOR UPDATE`,[input.product_id,input.deposit_id,input.location_id]);
    if(rows.length>1) fail(409,'Saldo duplicado para o local.');
    const current=rows[0];
    const previous=Number(current?.quantity||0),reserved=Number(current?.reserved_quantity||0);
    const next=mode==='entry'?previous+amount:amount;
    if(!Number.isSafeInteger(next)||next>2147483647) fail(400,'Quantidade acima do limite.');
    if(next<reserved) fail(400,'A quantidade ajustada nao pode ficar menor que o saldo reservado atual.');
    if(current?.company_id&&current.company_id!==companyId) fail(409,'Localização incompatível com a empresa do produto.');
    const id=current?.id||randomUUID();
    if(current) {
      await connection.query('UPDATE product_stock_locations SET quantity=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[next,id]);
    } else {
      await connection.query(`INSERT INTO product_stock_locations
        (id,company_id,product_id,deposit_id,location_id,quantity,reserved_quantity) VALUES (?,?,?,?,?,?,0)`,
        [id,companyId,input.product_id,input.deposit_id,input.location_id,next]);
    }
    const adjustment=mode==='adjustment';
    await connection.query(`INSERT INTO stock_location_movements
      (id,company_id,product_id,from_deposit_id,from_location_id,to_deposit_id,to_location_id,quantity,
       movement_type,reason,reference_type,previous_from_quantity,new_from_quantity,previous_to_quantity,new_to_quantity,notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [randomUUID(),companyId,input.product_id,adjustment?input.deposit_id:null,adjustment?input.location_id:null,
        input.deposit_id,input.location_id,Math.abs(next-previous),adjustment?'adjustment':'in',reason,
        adjustment?'manual_adjustment':'manual_entry',adjustment?previous:null,adjustment?next:null,previous,next,input.notes||null]);
    const [[total]]=await connection.query('SELECT COALESCE(SUM(quantity),0) AS quantity FROM product_stock_locations WHERE product_id=?',[input.product_id]);
    await connection.query('UPDATE products SET stock_quantity=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[Number(total.quantity),input.product_id]);
    const [[result]]=await connection.query('SELECT * FROM product_stock_locations WHERE id=?',[id]);
    await connection.commit();
    return result;
  } catch(error) {try {await connection.rollback();} catch {}throw error;}
  finally {connection.release();}
}
module.exports={applyManualStockMovement};
