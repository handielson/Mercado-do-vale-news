function sanitizeStock(stock) {
  const parsed = Number(stock);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function sanitizeLocationIds(locationIds = []) {
  return Array.from(
    new Set(
      locationIds
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  );
}

function buildSellerStockEntries(stock, locationIds = [], includeAllocatedStock = false) {
  const safeStock = sanitizeStock(stock);
  const ids = sanitizeLocationIds(locationIds);
  if (ids.length === 0) {
    return includeAllocatedStock
      ? [{ stock: safeStock, allocated_stock: 0 }]
      : [{ stock: safeStock }];
  }

  return ids.map((locationId) => ({
    location_id: locationId,
    stock: safeStock,
    ...(includeAllocatedStock ? { allocated_stock: 0 } : {}),
  }));
}

export function buildShopeeAddItemStockVariants({ stock, locationIds = [] }) {
  const safeStock = sanitizeStock(stock);

  return [
    {
      key: 'seller_stock_top_level',
      label: 'seller_stock no topo',
      stockFields: {
        seller_stock: buildSellerStockEntries(safeStock, locationIds, false),
      },
    },
    {
      key: 'normal_stock_legacy',
      label: 'normal_stock legada',
      stockFields: {
        normal_stock: safeStock,
      },
    },
    {
      key: 'stock_info_normal',
      label: 'stock_info NORMAL',
      stockFields: {
        stock_info: [
          {
            stock_type: 'NORMAL',
            normal_stock: safeStock,
          },
        ],
      },
    },
    {
      key: 'stock_info_v2_seller',
      label: 'stock_info_v2 seller_stock',
      stockFields: {
        stock_info_v2: {
          seller_stock: buildSellerStockEntries(safeStock, locationIds, false),
        },
      },
    },
    {
      key: 'stock_info_seller',
      label: 'stock_info SELLER',
      stockFields: {
        stock_info: [
          {
            stock_type: 'SELLER',
            seller_stock: buildSellerStockEntries(safeStock, locationIds, true),
          },
        ],
      },
    },
  ];
}

export function applyShopeeStockFields(basePayload, stockFields) {
  const nextPayload = { ...basePayload };
  delete nextPayload.seller_stock;
  delete nextPayload.normal_stock;
  delete nextPayload.stock_info;
  delete nextPayload.stock_info_v2;
  return {
    ...nextPayload,
    ...stockFields,
  };
}

export function buildShopeeUpdateStockPayload({ itemId, stock }) {
  return {
    item_id: Number(itemId),
    stock_list: [
      {
        model_id: 0,
        seller_stock: buildSellerStockEntries(stock),
      },
    ],
  };
}

export function isShopeeSellerStockConstraintError(message) {
  const normalized = String(message || '').toLowerCase();
  return normalized.includes('seller_stock') && normalized.includes('must not null');
}

export function extractShopeeLocationIds(payload) {
  const candidates = [
    payload?.response?.merchant_warehouse_location_list,
    payload?.response?.merchant_warehouse_list,
    payload?.response?.warehouse_list,
    payload?.response?.location_list,
    payload?.response?.list,
    // /api/v2/shop/get_warehouse_detail returns the array directly under "response"
    Array.isArray(payload?.response) ? payload.response : null,
  ];

  const locationIds = [];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    for (const entry of candidate) {
      const value = entry?.location_id ?? entry?.warehouse_location_id ?? entry?.warehouse_id ?? entry?.id;
      if (value != null && String(value).trim()) {
        locationIds.push(String(value).trim());
      }
    }
  }

  return sanitizeLocationIds(locationIds);
}
