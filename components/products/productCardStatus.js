const PRODUCT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  OUT_OF_STOCK: 'out_of_stock',
  DISCONTINUED: 'discontinued',
  SOLD: 'sold',
};

const SMARTPHONE_CATEGORY_ID = '8b7c4852-c195-4527-8fd7-c3cc2debda42';

const STATUS_VIEW = {
  [PRODUCT_STATUS.ACTIVE]: {
    label: 'Ativo',
    color: 'bg-green-100 text-green-800 border-green-200',
  },
  [PRODUCT_STATUS.INACTIVE]: {
    label: 'Inativo',
    color: 'bg-red-100 text-red-800 border-red-200',
  },
  [PRODUCT_STATUS.OUT_OF_STOCK]: {
    label: 'Sem Estoque',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  [PRODUCT_STATUS.DISCONTINUED]: {
    label: 'Descontinuado',
    color: 'bg-gray-100 text-gray-800 border-gray-200',
  },
  [PRODUCT_STATUS.SOLD]: {
    label: 'Vendido',
    color: 'bg-slate-100 text-slate-700 border-slate-200',
  },
};

function hasSerializedIdentifier(product) {
  const specs = product?.specs || {};
  return Boolean(
    specs.imei1 ||
    specs.imei2 ||
    specs.imei_1 ||
    specs.imei_2 ||
    specs.imei ||
    specs.serial ||
    specs.serial_number
  );
}

function isSerializedProduct(product) {
  return hasSerializedIdentifier(product) || String(product?.category_id || '') === SMARTPHONE_CATEGORY_ID;
}

export function getAdminProductCardStatus(product) {
  const status = String(product?.status || PRODUCT_STATUS.ACTIVE);
  const view = STATUS_VIEW[status] || {
    label: status,
    color: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  if (
    status === PRODUCT_STATUS.ACTIVE &&
    product?.track_inventory !== false &&
    Number(product?.is_parent || 0) !== 1 &&
    Number(product?.stock_quantity || 0) <= 0
  ) {
    const nextStatus = isSerializedProduct(product)
      ? PRODUCT_STATUS.SOLD
      : PRODUCT_STATUS.OUT_OF_STOCK;
    return {
      status: nextStatus,
      ...STATUS_VIEW[nextStatus],
    };
  }

  return {
    status,
    ...view,
  };
}
