const { inspectFiscalSaleItem } = require('./fiscalItemReadiness.cjs');
const { taxValidationView } = require('./fiscalTaxValidationCore.cjs');

const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const issue = (code, itemId = null) => ({ code, ...(itemId ? { itemId } : {}) });
const cents = value => Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const jsonArray = value => {
  try { const parsed = typeof value === 'string' ? JSON.parse(value) : value; return Array.isArray(parsed) ? parsed : null; }
  catch { return null; }
};

/** Leitura da venda persistida; não infere tratamento tributário nem reserva número fiscal. */
async function inspectNfceSale(pool, { profileId, settingsId, saleId, includePlan = false, lock = false }) {
  if (!UUID.test(profileId || '') || !UUID.test(saleId || '')) throw Object.assign(new Error('Empresa ou venda inválida.'), { statusCode:400 });
  if (!settingsId) throw Object.assign(new Error('Vendas de empresas adicionais ainda não estão segregadas.'), { statusCode:409 });
  const [sales] = await pool.query(`SELECT * FROM sales WHERE id=? LIMIT 1${lock ? ' FOR UPDATE' : ''}`, [saleId]);
  const sale = sales[0];
  if (!sale || (sale.company_id && String(sale.company_id) !== String(settingsId))) throw Object.assign(new Error('Venda não encontrada para esta empresa.'), { statusCode:404 });
  const [items] = await pool.query(`SELECT * FROM sale_items WHERE sale_id=? ORDER BY created_at,id LIMIT 991${lock ? ' FOR UPDATE' : ''}`, [saleId]);
  const productIds = [...new Set(items.map(row => String(row.product_id || '')).filter(Boolean))];
  const [products] = productIds.length ? await pool.query(`SELECT id,ncm,cest,origin,ean,alternative_eans,is_virtual FROM products WHERE id IN (?)${lock ? ' FOR UPDATE' : ''}`, [productIds]) : [[]];
  const byId = new Map(products.map(row => [String(row.id), row]));
  const [validations] = await pool.query(`SELECT * FROM company_fiscal_tax_validations WHERE profile_id=? LIMIT 1${lock ? ' FOR UPDATE' : ''}`, [profileId]);
  const validation = taxValidationView(validations[0]);
  const operation = validation.rules.find(row => row.id === 'OP01');
  const nfce = operation?.nfce || {};
  const reviewed = !!operation?.review?.actor && operation.review.outdated === false
    && !!operation.review.reviewerRegistration && operation.review.reviewerRegistration === validation.reviewerRegistration;
  let accountantGrant = false;
  if (reviewed) {
    const [grants] = await pool.query(`SELECT a.id FROM company_accountant_access a JOIN customers c ON c.id=a.customer_id
      WHERE a.profile_id=? AND a.is_active=1 AND a.can_edit_tax_validation=1 AND (c.user_id=? OR c.id=?)
        AND UPPER(COALESCE(c.customer_type,''))<>'ADMIN' LIMIT 1`,
    [profileId,operation.review.actor,operation.review.actor]);
    accountantGrant = !!grants[0];
  }
  const treatmentReady = validation.status === 'approved' && operation?.used && operation?.source === 'accountant'
    && operation.model === '65' && operation.cfop === '5102' && nfce.csosn === '400'
    && nfce.pisCst === '07' && nfce.cofinsCst === '07' && /^[A-Z0-9]{1,6}$/.test(nfce.unit || '')
    && nfce.cestApplicability === 'required' && ['from_product','sem_gtin'].includes(nfce.gtinDecision)
    && ['icmsRate','pisRate','cofinsRate'].every(field => nfce[field] !== '' && nfce[field] != null && Number(nfce[field]) === 0)
    && reviewed && accountantGrant && validation.generalDecisions.productExceptions === 'none';
  const issues = [];
  if (String(sale.payment_status || '').toLowerCase() !== 'paid') issues.push(issue('sale_not_paid'));
  if (String(sale.finalization_status || '').toLowerCase() !== 'success') issues.push(issue('sale_finalization_incomplete'));
  if (/cancel|refund|return/i.test(String(sale.status || ''))) issues.push(issue('sale_cancelled_or_refunded'));
  if (sale.delivery_type) issues.push(issue('not_in_person_sale'));
  if (items.length === 0 || items.length > 990) issues.push(issue('item_count_unsupported'));
  if (validation.status !== 'approved') issues.push(issue('accountant_validation_pending'));
  else if (!treatmentReady) issues.push(issue('operation_tax_parameters_unsupported'));
  if (validation.status === 'approved' && (!reviewed || !accountantGrant)) issues.push(issue('accountant_operation_review_pending'));
  const saleTotal = cents(sale.total);
  if (saleTotal === null || saleTotal === 0) issues.push(issue('sale_total_invalid'));
  for (const field of ['discount','discount_total','promotional_discount','delivery_cost_store','delivery_cost_customer','final_adjustment_discount']) {
    if (cents(sale[field]) !== 0) issues.push(issue('adjustment_unsupported'));
  }
  let itemTotal = 0;
  const fiscalItems = [];
  for (const item of items) {
    const id = String(item.id || '');
    const product = byId.get(String(item.product_id || '')) || {};
    const quantity = Number(item.quantity);
    const unitPrice = cents(item.unit_price);
    const lineTotal = cents(item.total);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || unitPrice === null || unitPrice < 1 || lineTotal !== quantity * unitPrice || cents(item.discount) !== 0) issues.push(issue('item_amount_unsupported', id));
    if (lineTotal !== null) itemTotal += lineTotal;
    const eans = jsonArray(product.alternative_eans) || [];
    const structural = inspectFiscalSaleItem({ product:{ ...product, eans:eans.length ? eans : product.ean ? [product.ean] : [] }, item:{ ...item, unit_price:unitPrice, total:lineTotal }, operation: treatmentReady ? {
      unit:nfce.unit,cfop:operation.cfop,taxTreatment:'CSOSN '+nfce.csosn,cestApplicability:nfce.cestApplicability,gtinDecision:nfce.gtinDecision,
    } : {} });
    for (const code of structural.issues.filter(code => treatmentReady || !['commercial_unit_missing_or_invalid','cfop_missing_or_invalid','tax_treatment_missing','cest_applicability_undecided','gtin_or_sem_gtin_undecided'].includes(code))) issues.push(issue(code, id));
    if (!treatmentReady) issues.push(issue('item_tax_parameters_pending', id));
    if (treatmentReady) fiscalItems.push({ sku:String(item.product_sku || ''), description:String(item.product_name || ''),
      ncm:structural.fields.ncm,cest:structural.fields.cest,gtin:structural.fields.gtin,unit:structural.fields.unit,
      quantity,unitPriceCents:unitPrice,cfop:operation.cfop,origin:structural.fields.origin,
      csosn:nfce.csosn,pisCst:nfce.pisCst,cofinsCst:nfce.cofinsCst });
  }
  if (saleTotal !== null && saleTotal !== itemTotal) issues.push(issue('sale_items_total_mismatch'));
  const payments = jsonArray(sale.payment_methods);
  if (!payments?.length) issues.push(issue('payment_details_missing'));
  else {
    const paymentTotal = payments.reduce((sum, payment) => sum + (cents(payment.amount) ?? NaN), 0);
    if (!Number.isSafeInteger(paymentTotal) || paymentTotal !== saleTotal) issues.push(issue('payment_total_mismatch'));
    // O recorte XML ainda não gera grupo de cartões; outros meios aguardam mapeamento completo.
    if (payments.some(payment => !['money','dinheiro','cash'].includes(String(payment.method || '').toLowerCase()))) issues.push(issue('payment_method_mapping_pending'));
  }
  const [attempts] = await pool.query('SELECT id,status,environment,series,document_number FROM company_fiscal_nfce_issuances WHERE profile_id=? AND sale_id=? ORDER BY created_at DESC LIMIT 5', [profileId, saleId]);
  const result = { saleId, profileId, saleTotalCents:saleTotal, itemTotalCents:itemTotal, itemCount:items.length, attempts, issues,
    saleDataReady:issues.length === 0, readyToReserve:false };
  if (includePlan && result.saleDataReady) result.plan = { items:fiscalItems, payments:payments.map(payment=>({method:'01',amountCents:cents(payment.amount)})) };
  return result;
}

module.exports = { inspectNfceSale };
