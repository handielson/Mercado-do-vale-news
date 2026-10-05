'use strict';
const {randomUUID}=require('node:crypto');
async function reconcileExternalStock(pool,{productId,targetQuantity,reason,notes,resetToIncoming=false,materializeUndistributed=false,initialMigration=false,getIncoming,getDefaultCompanyId,connection:providedConnection}) {
  let target=Number(targetQuantity);
  if(!materializeUndistributed&&(!Number.isSafeInteger(target)||target<0||target>2147483647)) throw Object.assign(new Error('Saldo externo inválido.'),{statusCode:400});
  const connection=providedConnection||await pool.getConnection();
  const ownsTransaction=!providedConnection;
  try {
    if(ownsTransaction) {
      await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
      await connection.beginTransaction();
    }
    const [[product]]=await connection.query('SELECT id,company_id,stock_quantity FROM products WHERE id=? LIMIT 1 FOR UPDATE',[productId]);
    if(!product) {if(ownsTransaction) await connection.rollback();return {ok:false,appliedDelta:0};}
    if(materializeUndistributed) {
      target=Number(product.stock_quantity);
      if(!Number.isSafeInteger(target)||target<0||target>2147483647) throw new Error('undistributed_stock_invalid');
    }
    const companyId=product.company_id||await getDefaultCompanyId?.();
    if(!companyId) throw new Error('Empresa do produto não configurada.');
    // Lock only balances. A joined FOR UPDATE also locks deposit/location rows;
    // getIncoming uses the pool to update those rows and would wait on our own transaction.
    const [rows]=await connection.query('SELECT * FROM product_stock_locations WHERE product_id=? FOR UPDATE',[productId]);
    if(rows.length) {
      const [priority]=await connection.query(`SELECT psl.id,sd.is_default AS deposit_default,sl.is_default AS location_default
        FROM product_stock_locations psl
        LEFT JOIN stock_deposits sd ON sd.id=psl.deposit_id
        LEFT JOIN stock_locations sl ON sl.id=psl.location_id
        WHERE psl.product_id=?`,[productId]);
      const byId=new Map(priority.map(row=>[row.id,row]));
      rows.sort((a,b)=>Number(byId.get(b.id)?.deposit_default||0)-Number(byId.get(a.id)?.deposit_default||0)
        || Number(byId.get(b.id)?.location_default||0)-Number(byId.get(a.id)?.location_default||0)
        || Number(b.quantity)-Number(a.quantity)
        || String(a.id).localeCompare(String(b.id)));
    }
    for(const row of rows) {
      row.quantity=Number(row.quantity);row.reserved_quantity=Number(row.reserved_quantity);
      if(!Number.isSafeInteger(row.quantity)||!Number.isSafeInteger(row.reserved_quantity)||row.quantity<row.reserved_quantity||row.reserved_quantity<0
        ||(row.company_id&&row.company_id!==companyId)) throw new Error('external_stock_location_inconsistent');
    }
    if(initialMigration) {
      const [history]=await connection.query("SELECT id FROM stock_location_movements WHERE product_id=? AND reference_type='initial_migration' LIMIT 1",[productId]);
      if(rows.length||history.length) {
        if(ownsTransaction) await connection.commit();
        return {ok:true,materialized:0};
      }
    }
    const currentTotal=rows.reduce((sum,row)=>sum+row.quantity,0);
    const reservedTotal=rows.reduce((sum,row)=>sum+row.reserved_quantity,0);
    if(materializeUndistributed&&target<=currentTotal) {
      if(ownsTransaction) await connection.commit();
      return {ok:true,materialized:0};
    }
    if(target<reservedTotal) {
      await connection.query('UPDATE products SET stock_quantity=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[currentTotal,productId]);
      if(ownsTransaction) await connection.commit();
      return {ok:false,appliedDelta:0,syncedTotal:currentTotal,targetQuantity:target,reservedQuantity:reservedTotal,error:'external_stock_below_reserved'};
    }
    const desired=new Map(rows.map(row=>[row.id,row.quantity]));
    if(target>currentTotal||resetToIncoming) {
      const incoming=await getIncoming(companyId);
      let row=rows.find(row=>row.deposit_id===incoming.depositId&&row.location_id===incoming.locationId);
      if(!row) {
        row={id:randomUUID(),product_id:productId,company_id:companyId,deposit_id:incoming.depositId,location_id:incoming.locationId,quantity:0,reserved_quantity:0,isNew:true};
        rows.push(row);desired.set(row.id,0);
      }
      if(resetToIncoming) {
        for(const source of rows) desired.set(source.id,source.reserved_quantity);
        desired.set(row.id,row.reserved_quantity+target-reservedTotal);
      } else desired.set(row.id,row.quantity+target-currentTotal);
    } else if(target<currentTotal) {
      let remaining=currentTotal-target;
      for(const row of rows) {
        const removed=Math.min(remaining,row.quantity-row.reserved_quantity);
        desired.set(row.id,row.quantity-removed);remaining-=removed;
      }
    }
    for(const row of rows) {
      const next=desired.get(row.id);
      if(next===row.quantity) continue;
      if(row.isNew) await connection.query(`INSERT INTO product_stock_locations
        (id,company_id,product_id,deposit_id,location_id,quantity,reserved_quantity) VALUES (?,?,?,?,?,?,0)`,
        [row.id,companyId,productId,row.deposit_id,row.location_id,next]);
      else await connection.query('UPDATE product_stock_locations SET quantity=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[next,row.id]);
      const increase=next>row.quantity;
      await connection.query(`INSERT INTO stock_location_movements
        (id,company_id,product_id,from_deposit_id,from_location_id,to_deposit_id,to_location_id,quantity,
         movement_type,reason,reference_type,previous_from_quantity,new_from_quantity,previous_to_quantity,new_to_quantity,notes)
        VALUES (?,?,?,?,?,?,?,?,'sync',?,?,?,?,?,?,?)`,
        [randomUUID(),companyId,productId,increase?null:row.deposit_id,increase?null:row.location_id,
          increase?row.deposit_id:null,increase?row.location_id:null,Math.abs(next-row.quantity),reason,
          initialMigration?'initial_migration':materializeUndistributed?'undistributed_stock':resetToIncoming?'external_stock_reentry':'external_stock_total',increase?null:row.quantity,increase?null:next,
          increase?row.quantity:null,increase?next:null,notes||null]);
    }
    await connection.query('UPDATE products SET stock_quantity=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[target,productId]);
    if(ownsTransaction) await connection.commit();
    return {ok:true,...(materializeUndistributed?{materialized:target-currentTotal}:{}),appliedDelta:target-currentTotal,syncedTotal:target,...(resetToIncoming?{resetToIncoming:true}:{} )};
  } catch(error) {try {if(ownsTransaction) await connection.rollback();} catch {}throw error;}
  finally {if(ownsTransaction) connection.release();}
}
module.exports={reconcileExternalStock};
