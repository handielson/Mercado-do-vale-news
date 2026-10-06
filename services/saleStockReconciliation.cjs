'use strict';

const fail=(message)=>{throw Object.assign(new Error(message),{statusCode:409});};
function externalConfirmationQuantity(value,productId) {
  let log;try{log=typeof value==='string'?JSON.parse(value):value;}catch{return 0;}
  for(const entry of [...(log?.stock_reconciliations||[])].reverse()) {
    const row=entry.evidence?.find(row=>row.product_id===productId&&row.source==='bling');
    if(row&&entry.actor)return Number(row.quantity)||0;
  }
  return 0;
}
function parseLog(value) {
  try {const log=typeof value==='string'?JSON.parse(value):value;if(!log||!Array.isArray(log.finalization_issues))fail('Auditoria da venda indisponivel.');return log;}
  catch {fail('Auditoria da venda invalida; nao e seguro encerrar a revisao.');}
}
function stockReport(sale,items,movements) {
  if(!sale) throw Object.assign(new Error('Venda nao encontrada.'),{statusCode:404});
  if(sale.payment_status==='cancelled')fail('Venda cancelada ou estornada exige revisao propria.');
  const log=parseLog(sale.finalization_log);
  if(!log.finalization_issues.some(issue=>issue.step==='stock_decrement'))fail('Nao ha falha de baixa de estoque para reconciliar.');
  const quantities=new Map();
  for(const item of items) {
    if(!item.product_id||item.serialized_unit_id||!Number(item.track_inventory))continue;
    const key=item.product_id,previous=quantities.get(key);
    const quantity=Number(item.quantity);
    if(!Number.isSafeInteger(quantity)||quantity<=0)fail('Quantidade invalida na venda.');
    quantities.set(key,{product_id:key,sku:item.product_sku,quantity:(previous?.quantity||0)+quantity});
  }
  if(!quantities.size)fail('Nao ha itens de estoque numerico para conferir.');
  return [...quantities.values()].map(item=>{
    const applied=movements.filter(row=>row.product_id===item.product_id).reduce((sum,row)=>sum+Number(row.quantity),0);
    return {...item,applied_quantity:applied,confirmed:applied===item.quantity,conflict:applied!==0&&applied!==item.quantity};
  });
}
function reconciledLog(sale,report,evidence,actor) {
  if(report.some(item=>item.conflict))fail('Movimentos parciais ou duplicados exigem investigacao; revisao mantida.');
  if(!Array.isArray(evidence))fail('Evidencias invalidas.');
  const missing=report.filter(item=>!item.confirmed);
  if(evidence.length!==missing.length)fail('Informe a conferencia de cada produto sem baixa local.');
  const seen=new Set();
  for(const row of evidence) {
    const item=missing.find(item=>item.product_id===row.product_id);
    if(!item||seen.has(row.product_id)||row.source!=='bling'||Number(row.quantity)!==item.quantity
      ||String(row.reference||'').toUpperCase()!==sale.id.slice(0,8).toUpperCase()
      ||typeof row.note!=='string'||row.note.trim().length<20||row.note.length>1000)fail('Evidencia do Bling incompleta ou incompatível com esta venda.');
    seen.add(row.product_id);
  }
  const log=parseLog(sale.finalization_log),now=new Date().toISOString();
  const remaining=log.finalization_issues.filter(issue=>issue.step!=='stock_decrement');
  const status=remaining.length?'needs_review':'success';
  return {...log,updated_at:now,finalization_status:status,finalization_issues:remaining,
    stock_reconciliations:[...(log.stock_reconciliations||[]),{timestamp:now,actor,mode:evidence.length?'manual_bling_confirmation':'local_movements',
      original_issues:log.finalization_issues.filter(issue=>issue.step==='stock_decrement'),products:report,evidence}]};
}
async function loadReport(db,id,lock=false) {
  const [[sale]]=await db.query('SELECT id,payment_status,finalization_status,finalization_log FROM sales WHERE id=?'+(lock?' FOR UPDATE':''),[id]);
  if(!sale)throw Object.assign(new Error('Venda nao encontrada.'),{statusCode:404});
  const [items]=await db.query(`SELECT si.product_id,si.product_sku,si.quantity,si.serialized_unit_id,p.track_inventory
    FROM sale_items si LEFT JOIN products p ON p.id=si.product_id WHERE si.sale_id=?`,[id]);
  const [movements]=await db.query("SELECT product_id,quantity FROM stock_location_movements WHERE reference_type='sale' AND reference_id=? AND movement_type='sale'",[id]);
  return {sale,report:stockReport(sale,items,movements)};
}
async function reconcileStock(pool,id,evidence,actor) {
  if(!actor)fail('Responsavel pela conferencia obrigatorio.');
  const db=await pool.getConnection();
  try {
    await db.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');await db.beginTransaction();
    const {sale,report}=await loadReport(db,id,true);
    const log=reconciledLog(sale,report,evidence,actor);
    await db.query('UPDATE sales SET finalization_status=?,finalization_error_summary=?,finalization_log=? WHERE id=?',
      [log.finalization_status,log.finalization_issues.map(issue=>`${issue.step}: ${issue.message}`).join('\n')||null,JSON.stringify(log),id]);
    await db.commit();return {status:log.finalization_status,report};
  } catch(error){await db.rollback();throw error;}finally{db.release();}
}
module.exports={stockReport,reconciledLog,loadReport,reconcileStock,externalConfirmationQuantity};
