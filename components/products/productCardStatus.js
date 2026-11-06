const PRODUCT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  OUT_OF_STOCK: 'out_of_stock',
  DISCONTINUED: 'discontinued',
  SOLD: 'sold',
};

// Aparelhos vendidos por unidade (IMEI/serial): Smartphones e, pelo tablet-as-phone-v1, Tablet e Tablets.
const SERIALIZED_DEVICE_CATEGORY_IDS = new Set([
  '8b7c4852-c195-4527-8fd7-c3cc2debda42', // Smartphones
  'fd2b4b01-e8d7-4085-848e-18176aa58a66', // Tablet
  '4397aa39-99c3-48a5-aecf-0b04d9d12016', // Tablets
]);

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
  return hasSerializedIdentifier(product) || SERIALIZED_DEVICE_CATEGORY_IDS.has(String(product?.category_id || ''));
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

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Linha de resumo do card fechado: preço, estoque/situação e alertas.
 * Ex.: "R$ 1.299,00 · 3 em estoque" ou "R$ 39,90 · Sem estoque · Sem preço".
 * @param {object} product produto (com status/estoque atuais)
 * @returns {{ price: string | null, chips: Array<{ key: string, label: string, color: string }> }}
 */
export function getAdminProductCardSummary(product) {
  const isParent = Number(product?.is_parent || 0) === 1;
  const priceCents = Number(product?.price_retail || 0);
  const price = priceCents > 0 ? BRL.format(priceCents / 100) : null;
  const chips = [];
  const status = getAdminProductCardStatus(product);
  if (!isParent) {
    if (status.status === PRODUCT_STATUS.ACTIVE && product?.track_inventory !== false) {
      const stock = Math.max(0, Number(product?.stock_quantity || 0));
      chips.push({ key: 'stock', label: `${stock} em estoque`, color: 'bg-green-100 text-green-800 border-green-200' });
    } else if (status.status !== PRODUCT_STATUS.ACTIVE) {
      chips.push({ key: 'status', label: status.label, color: status.color });
    }
    if (!price) chips.push({ key: 'no-price', label: 'Sem preço', color: 'bg-amber-100 text-amber-800 border-amber-200' });
  } else if (status.status !== PRODUCT_STATUS.ACTIVE) {
    chips.push({ key: 'status', label: status.label, color: status.color });
  }
  return { price: isParent ? null : price, chips };
}

/**
 * Faixa de preço de um campo (price_retail, price_reseller, price_wholesale) entre as variações.
 * Ignora as sem preço. null quando nenhuma tem preço.
 */
export function getPriceTierRange(products, field) {
  const values = (products || []).map(product => Number(product?.[field] || 0)).filter(value => value > 0);
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? BRL.format(min / 100) : `${BRL.format(min / 100)} a ${BRL.format(max / 100)}`;
}
