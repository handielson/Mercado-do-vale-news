const { problem } = require('./companyFiscalCore.cjs');
const json = value => { if (typeof value === 'object') return value; try { return JSON.parse(value); } catch { return null; } };
const cents = (value, scale = 1) => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Math.round(Number(value) * scale);
const date = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toISOString() : null;

async function readAccountantSale(pool, profile, channel, saleId) {
  if (profile.public_id !== 'primary' || !profile.operational_company_id) throw problem('Vendas indisponíveis para esta empresa.', 403);
  if (!['pdv', 'online', 'shopee', 'tiktok'].includes(channel) || !saleId || saleId.length > 100) throw problem('Venda inválida.', 400);
  let row, items, payments, subtotal, discount, shipping, capturedAt = null, moneyScale = 1;
  if (channel === 'pdv') {
    const [rows] = await pool.query('SELECT s.*,c.name AS customer_name FROM sales s LEFT JOIN customers c ON c.id=s.customer_id WHERE s.id=? LIMIT 1', [saleId]);
    row = rows[0];
    if (!row) throw problem('Venda não encontrada.', 404);
    [items] = await pool.query('SELECT product_name,product_sku,quantity,unit_price,total FROM sale_items WHERE sale_id=? ORDER BY created_at', [saleId]);
    payments = json(row.payment_methods);
    // Same legacy boundary used by saleService.saleRowUsesLegacyDecimalItemMoney:
    // older rows stored reais and have neither modern subtotal nor payment_methods.
    const numericTotal = Math.abs(Number(row.total));
    const looksLikeStoredCents = Number.isFinite(numericTotal) && Math.abs(numericTotal - Math.round(numericTotal)) <= 0.001 && numericTotal >= 1000;
    if (typeof row.total === 'string' && /\.\d{2}$/.test(row.total) && !looksLikeStoredCents && !(Number(row.subtotal || 0) > 0) && (row.payment_methods == null || row.payment_methods === '')) moneyScale = 100;
    if (!Array.isArray(payments) && row.payment_method) payments = [{method:row.payment_method,amount:row.total}];
    subtotal = row.subtotal; discount = row.discount_total ?? row.discount; shipping = row.delivery_cost_customer;
  } else if (channel === 'online') {
    const [rows] = await pool.query('SELECT * FROM orders WHERE id=? AND company_id=? LIMIT 1', [saleId, profile.operational_company_id]);
    row = rows[0];
    if (!row) throw problem('Pedido não encontrado nesta empresa.', 404);
    [items] = await pool.query('SELECT product_name,product_sku,quantity,unit_price,subtotal AS total FROM order_items WHERE order_id=? ORDER BY created_at', [saleId]);
    payments = [{ method: row.payment_method, amount: row.total }];
    subtotal = row.subtotal; discount = row.discount; shipping = row.shipping_cost;
  } else {
    const [rows] = await pool.query('SELECT * FROM mobile_sale_events WHERE channel=? AND external_id=? ORDER BY created_at DESC,id DESC LIMIT 1', [channel, saleId]);
    row = rows[0];
    if (!row) throw problem('Venda não encontrada.', 404);
    const details = json(row.details_json) || {};
    items = (Array.isArray(details.items) ? details.items : []).map(item => ({ product_name:item.name, product_sku:item.sku, quantity:item.quantity, unit_price:item.unit_price_cents, total:item.total_cents }));
    payments = [{ method:details.payment, amount:null }];
    discount = details.discount_cents; capturedAt = date(row.created_at);
  }
  const [documents] = await pool.query('SELECT id,model,status,document_number,series,access_key,issued_at FROM company_fiscal_documents WHERE profile_id=? AND channel=? AND external_sale_id=? ORDER BY issued_at DESC', [profile.id, channel, saleId]);
  let receipt = null;
  if (channel === 'pdv') {
    try {
      const [rows] = await pool.query("SELECT status,document_number,series,authorized_at,access_key,(authorized_xml IS NOT NULL AND authorized_xml_sha256 IS NOT NULL) AS has_xml FROM company_fiscal_nfce_issuances WHERE profile_id=? AND sale_id=? AND environment='production' LIMIT 1", [profile.id,saleId]);
      if (rows[0]) receipt = { status:rows[0].status, number:rows[0].document_number, series:rows[0].series, authorizedAt:date(rows[0].authorized_at), accessKey:rows[0].access_key, available:['authorized','cancelled'].includes(rows[0].status) && Boolean(Number(rows[0].has_xml)) };
    } catch (error) { if (error.code !== 'ER_NO_SUCH_TABLE') throw error; }
  }
  return {
    channel, saleId, customerName:row.customer_name || '', occurredAt:date(row.occurred_at || row.created_at), capturedAt,
    status:row.status || row.finalization_status || '', paymentStatus:row.payment_status || '',
    totalCents:cents(channel === 'shopee' || channel === 'tiktok' ? row.total_cents : row.total,moneyScale), subtotalCents:cents(subtotal,moneyScale), discountCents:cents(discount,moneyScale), shippingCents:cents(shipping,moneyScale),
    items:items.map(item => ({ name:String(item.product_name || ''), sku:String(item.product_sku || ''), quantity:Number(item.quantity), unitPriceCents:cents(item.unit_price,moneyScale), totalCents:cents(item.total,moneyScale) })),
    payments:(Array.isArray(payments) ? payments : []).map(payment => ({ method:String(payment.method || ''), amountCents:cents(payment.total_with_fee ?? payment.amount,moneyScale), installments:payment.installments == null ? null : Number(payment.installments) })),
    documents:documents.map(doc => ({ id:doc.id, model:doc.model, status:doc.status, number:doc.document_number, series:doc.series, accessKey:doc.access_key, issuedAt:date(doc.issued_at) })), receipt,
  };
}
module.exports = { readAccountantSale };
