'use strict';

// Read-only audit. Caller supplies an explicitly selected connection; this module
// never reads .env, connects automatically, changes schema or returns product rows.
async function auditPrint3dSku(connection) {
  const [columns] = await connection.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='products' AND COLUMN_NAME IN ('sku','is_print3d')");
  if (!['sku','is_print3d'].every(name => columns.some(column => column.COLUMN_NAME === name))) {
    return { ready:false, reasons:['missing_product_columns'], global_unique_sku:false, counts:null };
  }
  const [indexes] = await connection.query("SELECT INDEX_NAME,COLUMN_NAME,NON_UNIQUE,SEQ_IN_INDEX,SUB_PART FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='products'");
  const grouped = new Map();
  for (const index of indexes) grouped.set(index.INDEX_NAME,[...(grouped.get(index.INDEX_NAME) || []),index]);
  // A composite, prefix or nonunique index does not prove global SKU uniqueness.
  const globalUnique = [...grouped.values()].some(parts => parts.length === 1 && parts[0].COLUMN_NAME === 'sku'
    && Number(parts[0].NON_UNIQUE) === 0 && parts[0].SUB_PART == null);
  const [[missing]] = await connection.query("SELECT COUNT(*) total FROM products WHERE is_print3d=1 AND (sku IS NULL OR TRIM(sku)='')");
  const [[conflicts]] = await connection.query(`SELECT COUNT(*) total FROM (
    SELECT TRIM(sku) AS sku_key FROM products WHERE sku IS NOT NULL AND TRIM(sku)<>''
    GROUP BY TRIM(sku) HAVING COUNT(*)>1 AND SUM(CASE WHEN is_print3d=1 THEN 1 ELSE 0 END)>0
  ) duplicated_3d_skus`);
  const counts = { missing_sku:Number(missing.total), conflicting_sku_groups:Number(conflicts.total) };
  const reasons = [];
  if (!globalUnique) reasons.push('global_unique_sku_not_proven');
  if (counts.missing_sku) reasons.push('print3d_missing_sku');
  if (counts.conflicting_sku_groups) reasons.push('print3d_sku_conflicts');
  return { ready:reasons.length === 0, reasons, global_unique_sku:globalUnique, counts };
}
module.exports = { auditPrint3dSku };
