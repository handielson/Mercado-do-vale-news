'use strict';
function patchStockSync(source) {
  const marker='async function syncProductStock(productId, db = pool) {';
  const start=source.indexOf(marker), end=source.indexOf('\n}',start)+2;
  if(start<0||end<=start||source.indexOf(marker,start+1)>=0) throw Error('Unexpected stock sync function');
  const body=source.slice(start,end);
  if(body.includes("require('./services/smartphoneMovingAverageServer.cjs').synchronizeProduct")) return source;
  const hook="  await require('./services/smartphoneMovingAverageServer.cjs').synchronizeProduct(pool, productId, db === pool ? null : db);";
  let next;
  if(body.replace(/\r/g,'').trim()===marker+'\n  return syncSerializedProductStockFromUnits(productId, db);\n}') {
    next=marker+'\n  const stock = await syncSerializedProductStockFromUnits(productId, db);\n'+hook+'\n  return stock;\n}';
  } else {
    const target='  return rows?.[0]?.stock_quantity ?? null;';
    if(!body.includes("SELECT stock_quantity FROM products WHERE id = ? LIMIT 1")||!body.includes(target)) throw Error('Unreviewed legacy stock sync');
    next=body.replace(target,hook+'\n'+target);
  }
  return source.slice(0,start)+next+source.slice(end);
}
module.exports={patchStockSync};
