// Local policy: weighted acquisition cost, independently of the Bling report setting.
// Only a reviewed, complete ledger for one stock-owning deposit is accepted.
function acquisitionCost(history) {
  if (history?.schema !== 'mdv.bling.acquisition.v1' || history.complete !== true || !history.sku || !history.blingId || !history.deposit || !history.sourceUrl || !Array.isArray(history.movements)) throw new Error('Histórico de custo incompleto ou sem identificação.');
  if (!Number.isFinite(Date.parse(history.observedAt))) throw new Error('Data de conferência inválida.');
  const seen = new Set();
  const movements = history.movements.map(m => {
    if (!m.id || seen.has(m.id) || !Number.isFinite(Date.parse(m.at)) || !['balance', 'entry', 'exit'].includes(m.kind) || !Number.isSafeInteger(m.quantityMilli) || m.quantityMilli < 0) throw new Error('Movimento inválido, duplicado ou transferência não conciliada.');
    seen.add(m.id);
    if (Date.parse(m.at) > Date.parse(history.observedAt)) throw new Error('Movimento posterior à conferência.');
    return m;
  }).sort((a,b) => Date.parse(a.at) - Date.parse(b.at));
  const lastBalance = movements.findLastIndex(m => m.kind === 'balance');
  if (lastBalance < 0) throw new Error('É necessário conferir o último balanço do depósito.');
  let quantity = 0n, total = 0n, stock = 0n;
  const relevant = movements.slice(lastBalance);
  for (const m of relevant) {
    const q = BigInt(m.quantityMilli);
    if (m.kind === 'exit') { stock -= q; if (stock < 0n) throw new Error('Histórico gera saldo negativo.'); continue; }
    stock = m.kind === 'balance' ? q : stock + q;
    if (q === 0n) continue;
    if (!Number.isSafeInteger(m.costCents) || m.costCents <= 0) throw new Error('Aquisição sem custo com despesas: revisão necessária.');
    quantity += q;
    total += q * BigInt(m.costCents);
  }
  if (!Number.isSafeInteger(history.currentQuantityMilli) || BigInt(history.currentQuantityMilli) !== stock) throw new Error('Saldo do histórico diverge do saldo conferido.');
  if (quantity === 0n) throw new Error('Nenhuma aquisição com custo confirmado.');
  const costCents = Number((total + quantity / 2n) / quantity);
  if (!Number.isSafeInteger(costCents) || costCents <= 0) throw new Error('Custo médio inválido.');
  return { costCents, metadata: { basis: 'weighted_acquisition_with_expenses', source: 'bling_stock_ledger', ...history, costCents, acquisitionQuantityMilli: Number(quantity), movements: relevant } };
}
async function importCosts(db, entries, { apply = false, saveReceipt = async () => {} } = {}) {
  if (!Array.isArray(entries) || !entries.length || new Set(entries.map(e => e.sku)).size !== entries.length) throw new Error('Lote vazio ou SKUs repetidos.');
  const calculated = entries.map(history => ({ history, ...acquisitionCost(history) }));
  await db.beginTransaction();
  try {
    const receipt = [];
    for (const {history,costCents,metadata} of calculated) {
      const [rows] = await db.query('SELECT id,sku,bling_id,is_parent,stock_quantity,price_cost,specs FROM products WHERE sku=? FOR UPDATE', [history.sku]);
      const p=rows[0];
      if(rows.length !== 1 || String(p.bling_id)!==String(history.blingId) || p.is_parent || !history.productId || p.id!==history.productId) throw new Error('Identidade/variação divergente: '+history.sku);
      if(Number(p.stock_quantity)*1000!==history.currentQuantityMilli || (p.price_cost==null?null:Number(p.price_cost))!==history.expectedCostCents) throw new Error('Custo ou estoque mudou desde a conferência: '+history.sku);
      const specs=typeof p.specs==='string'?JSON.parse(p.specs):p.specs||{};
      receipt.push({productId:p.id,sku:p.sku,previousCostCents:p.price_cost==null?null:Number(p.price_cost),previousEvidence:specs._acquisition_cost||null,costCents,metadata});
    }
    // Durable receipt before commit makes an interrupted import auditable.
    await saveReceipt(receipt);
    if(apply) {
      for(const r of receipt) await db.query("UPDATE products SET price_cost=?, specs=JSON_SET(COALESCE(specs,JSON_OBJECT()), '$._acquisition_cost', CAST(? AS JSON)), updated_at=CURRENT_TIMESTAMP WHERE id=?",[r.costCents,JSON.stringify(r.metadata),r.productId]);
      await db.commit();
    } else await db.rollback();
    return {applied:apply,products:receipt};
  } catch(error) {await db.rollback();throw error;}
}
module.exports = { acquisitionCost, importCosts };
