// Structural preflight only. The accountant must approve the operation and tax treatment
// before these fields can be used to build or transmit NF-e/NFC-e XML.
function validGtin(value) {
  const digits = String(value || '').trim();
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(digits)) return false;
  let sum = 0;
  for (let index = digits.length - 2, weight = 3; index >= 0; index--, weight = weight === 3 ? 1 : 3) {
    sum += Number(digits[index]) * weight;
  }
  return (10 - sum % 10) % 10 === Number(digits.at(-1));
}

function inspectFiscalSaleItem({ product = {}, item = {}, operation = {} } = {}) {
  const issues = [];
  if (!item.product_id || item.product_id !== product.id) issues.push('product_not_resolved');
  if (product.is_virtual) issues.push('virtual_service_requires_separate_document_decision');
  const ncm = String(product.ncm || '').replace(/\D/g, '');
  if (!/^\d{8}$/.test(ncm) || ncm === '00000000') issues.push('ncm_missing_or_invalid');
  const origin = String(product.origin ?? '').trim();
  if (!/^[0-8]$/.test(origin)) issues.push('origin_missing_or_invalid');
  const unit = String(operation.unit || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{1,6}$/.test(unit)) issues.push('commercial_unit_missing_or_invalid');
  const cfop = String(operation.cfop || '').trim();
  if (!/^\d{4}$/.test(cfop)) issues.push('cfop_missing_or_invalid');
  if (!String(operation.taxTreatment || '').trim()) issues.push('tax_treatment_missing');
  const cestApplicability = operation.cestApplicability;
  const cest = String(product.cest || '').replace(/\D/g, '');
  if (cestApplicability !== 'required' && cestApplicability !== 'not_applicable') issues.push('cest_applicability_undecided');
  else if (cestApplicability === 'required' && !/^\d{7}$/.test(cest)) issues.push('cest_missing_or_invalid');
  else if (cest && !/^\d{7}$/.test(cest)) issues.push('cest_invalid');
  const gtins = Array.isArray(product.eans) ? product.eans.map(value => String(value).trim()).filter(Boolean) : [];
  let gtin = '';
  if (gtins.length) {
    gtin = gtins[0];
    if (!validGtin(gtin)) issues.push('gtin_invalid');
  } else if (operation.gtinDecision === 'sem_gtin') gtin = 'SEM GTIN';
  else issues.push('gtin_or_sem_gtin_undecided');
  const quantity = String(item.quantity ?? '');
  if (!/^\d{1,11}(?:\.\d{1,4})?$/.test(quantity) || Number(quantity) <= 0) issues.push('quantity_invalid');
  if (!Number.isSafeInteger(item.unit_price) || item.unit_price < 0) issues.push('unit_price_cents_invalid');
  if (!Number.isSafeInteger(item.total) || item.total < 0) issues.push('line_total_cents_invalid');
  return {
    structurallyReady: issues.length === 0,
    issues,
    fields: { ncm, origin, unit, cfop, cest: cestApplicability === 'required' ? cest : '', gtin },
  };
}

module.exports = { validGtin, inspectFiscalSaleItem };
