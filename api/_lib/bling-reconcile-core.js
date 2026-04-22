function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function normalizeInteger(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric));
}

function getRemoteStockProductId(item) {
  return item?.produto?.id ?? item?.product?.id ?? item?.idProduto ?? item?.id ?? null;
}

function getRemoteStockEntryValue(item) {
  if (item?.saldoFisicoTotal !== undefined && item?.saldoFisicoTotal !== null) {
    return { mode: 'total', value: normalizeInteger(item.saldoFisicoTotal) };
  }
  if (item?.saldoVirtualTotal !== undefined && item?.saldoVirtualTotal !== null) {
    return { mode: 'total', value: normalizeInteger(item.saldoVirtualTotal) };
  }
  if (item?.saldoFisico !== undefined && item?.saldoFisico !== null) {
    return { mode: 'partial', value: normalizeInteger(item.saldoFisico) };
  }
  if (item?.saldoVirtual !== undefined && item?.saldoVirtual !== null) {
    return { mode: 'partial', value: normalizeInteger(item.saldoVirtual) };
  }
  return { mode: 'partial', value: 0 };
}

export function buildBlingReconcilePlan({
  localProducts = [],
  remoteProducts = [],
  remoteStocks = [],
} = {}) {
  const localByBlingId = new Map();
  for (const localProduct of localProducts) {
    if (!localProduct?.bling_id) continue;
    localByBlingId.set(String(localProduct.bling_id), localProduct);
  }

  const remoteProductsById = new Map();
  for (const remoteProduct of remoteProducts) {
    if (!remoteProduct?.id) continue;
    remoteProductsById.set(String(remoteProduct.id), remoteProduct);
  }

  const remoteStocksById = new Map();
  for (const remoteStock of remoteStocks) {
    const productId = getRemoteStockProductId(remoteStock);
    if (!productId) continue;

    const key = String(productId);
    const entry = getRemoteStockEntryValue(remoteStock);

    if (entry.mode === 'total') {
      remoteStocksById.set(key, entry.value);
      continue;
    }

    remoteStocksById.set(key, (remoteStocksById.get(key) || 0) + entry.value);
  }

  const stockChanges = [];
  const nameChanges = [];

  for (const [blingId, localProduct] of localByBlingId.entries()) {
    const remoteProduct = remoteProductsById.get(blingId);
    const remoteStock = remoteStocksById.get(blingId);

    if (remoteStock !== undefined) {
      const previousStock = normalizeInteger(localProduct.stock_quantity);
      if (previousStock !== remoteStock) {
        stockChanges.push({
          productId: localProduct.id,
          sku: localProduct.sku || remoteProduct?.codigo || null,
          blingId: Number(blingId),
          previousStock,
          nextStock: remoteStock,
        });
      }
    }

    const previousName = normalizeText(localProduct.name);
    const nextName = normalizeText(remoteProduct?.nome);
    if (nextName && previousName !== nextName) {
      nameChanges.push({
        productId: localProduct.id,
        sku: localProduct.sku || remoteProduct?.codigo || null,
        blingId: Number(blingId),
        previousName,
        nextName,
      });
    }
  }

  return {
    stockChanges,
    nameChanges,
    totals: {
      localProducts: localProducts.length,
      localMappedProducts: localByBlingId.size,
      remoteProducts: remoteProducts.length,
      remoteStocks: remoteStocks.length,
    },
  };
}
