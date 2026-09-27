'use strict';

const {randomUUID}=require('node:crypto');
const {canUseMercadoDoValeOrderAutomation}=require('./orderStorefront.cjs');

function fail(statusCode,message) {throw Object.assign(new Error(message),{statusCode});}
function quantity(value) {
  const number=Number(value);
  if(!Number.isSafeInteger(number)||number<=0) fail(409,'order_reservation_stock_inconsistent');
  return number;
}

async function processOrderReservationOnConnection(connection,{orderId,mode,reason,notes}) {
  if(!orderId||typeof orderId!=='string'||orderId.length>100||!['consume','release'].includes(mode)) fail(400,'Pedido ou operação inválida.');
  const [[order]]=await connection.query('SELECT id,storefront FROM orders WHERE id=? LIMIT 1 FOR UPDATE',[orderId]);
  if(!order) fail(404,'Pedido não encontrado.');
  if(order.storefront==='loja_3d') fail(409,'Reservas da loja 3D exigem o fluxo próprio de pagamento e expedição.');
  if(!canUseMercadoDoValeOrderAutomation(order)) fail(409,'Origem do pedido não permite operação de estoque do Mercado do Vale.');
  const referenceType=mode==='consume'?'order':'order_release';
  const movementType=mode==='consume'?'sale':'release_reservation';
  const [terminal]=await connection.query(`SELECT reference_type,movement_type FROM stock_location_movements
    WHERE reference_id=? AND ((reference_type='order' AND movement_type='sale')
      OR (reference_type='order_release' AND movement_type='release_reservation')) FOR UPDATE`,[orderId]);
  if(terminal.some(row=>row.reference_type!==referenceType||row.movement_type!==movementType))
    fail(409,'Reserva do pedido já foi finalizada de outra forma.');
  if(terminal.length) return [];
  const [reservations]=await connection.query(`SELECT * FROM stock_location_movements
    WHERE reference_type='order_reservation' AND reference_id=? AND movement_type='reservation'
    ORDER BY created_at,id FOR UPDATE`,[orderId]);
  if(!reservations.length) return [];
  const productIds=[...new Set(reservations.map(row=>row.product_id))].sort();
  for(const productId of productIds) {
    const [[product]]=await connection.query('SELECT id FROM products WHERE id=? LIMIT 1 FOR UPDATE',[productId]);
    if(!product) fail(409,'order_reservation_stock_inconsistent');
  }
  const result=[];
  for(const reservation of reservations) {
    const [locations]=await connection.query(`SELECT * FROM product_stock_locations
      WHERE product_id=? AND deposit_id=? AND location_id=? FOR UPDATE`,
      [reservation.product_id,reservation.from_deposit_id,reservation.from_location_id]);
    if(locations.length!==1) fail(409,'order_reservation_stock_inconsistent');
    const current=locations[0];
    const reserved=Number(current.reserved_quantity);
    const previous=Number(current.quantity);
    const consumed=quantity(reservation.quantity);
    if(!Number.isSafeInteger(reserved)||!Number.isSafeInteger(previous)||reserved<consumed||previous<reserved)
      fail(409,'order_reservation_stock_inconsistent');
    const next=mode==='consume'?previous-consumed:previous;
    const [updated]=await connection.query(mode==='consume'
      ? `UPDATE product_stock_locations SET quantity=quantity-?,reserved_quantity=reserved_quantity-?,updated_at=CURRENT_TIMESTAMP
         WHERE id=? AND product_id=? AND reserved_quantity>=? AND quantity>=reserved_quantity`
      : `UPDATE product_stock_locations SET reserved_quantity=reserved_quantity-?,updated_at=CURRENT_TIMESTAMP
         WHERE id=? AND product_id=? AND reserved_quantity>=? AND quantity>=reserved_quantity`,
      mode==='consume'?[consumed,consumed,current.id,reservation.product_id,consumed]
        :[consumed,current.id,reservation.product_id,consumed]);
    if(updated.affectedRows!==1) fail(409,'order_reservation_stock_inconsistent');
    await connection.query(`INSERT INTO stock_location_movements
      (id,company_id,product_id,from_deposit_id,from_location_id,quantity,movement_type,reason,reference_type,
       reference_id,previous_from_quantity,new_from_quantity,notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [randomUUID(),current.company_id,reservation.product_id,reservation.from_deposit_id,reservation.from_location_id,
        consumed,movementType,reason,referenceType,orderId,previous,next,notes]);
    result.push({reservation_movement_id:reservation.id,product_id:reservation.product_id,
      deposit_id:reservation.from_deposit_id,location_id:reservation.from_location_id,quantity_processed:consumed,
      previous_quantity:previous,new_quantity:next,previous_reserved_quantity:reserved,new_reserved_quantity:reserved-consumed});
  }
  if(mode==='consume') for(const productId of productIds) {
    const [[total]]=await connection.query('SELECT COALESCE(SUM(quantity),0) AS quantity FROM product_stock_locations WHERE product_id=?',[productId]);
    await connection.query('UPDATE products SET stock_quantity=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[Number(total.quantity),productId]);
  }
  return result;
}

async function processOrderReservation(pool,{orderId,mode,reason,notes}) {
  const connection=await pool.getConnection();
  try {
    await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await connection.beginTransaction();
    const result=await processOrderReservationOnConnection(connection,{orderId,mode,reason,notes});
    await connection.commit();
    return result;
  } catch(error) {try {await connection.rollback();} catch {}throw error;}
  finally {connection.release();}
}

module.exports={processOrderReservation,processOrderReservationOnConnection};
