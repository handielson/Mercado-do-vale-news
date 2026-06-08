import { Product } from '../types/product';
import { ProductStatus } from '../utils/field-standards';

const SERIALIZED_SPEC_KEYS = new Set(['imei1', 'imei2', 'serial', 'serial_number']);

const normalizePart = (value: unknown) => String(value || '').trim().toLowerCase();

function hasSerializedIdentity(product: Product): boolean {
  const specs = product.specs || {};
  return Boolean(specs.imei1 || specs.imei2 || specs.serial || specs.serial_number);
}

function getGroupKey(product: Product): string {
  const specs = product.specs || {};
  return [
    product.model_id || normalizePart(product.name),
    normalizePart(specs.color),
    normalizePart(specs.storage),
    normalizePart(specs.ram),
    normalizePart(specs.version),
    normalizePart(product.price_retail),
    normalizePart(product.price_reseller),
    normalizePart(product.price_wholesale),
  ].join('|');
}

function stripSerializedSpecs(specs: Record<string, any> = {}) {
  return Object.fromEntries(
    Object.entries(specs).filter(([key]) => !SERIALIZED_SPEC_KEYS.has(key))
  );
}

function buildSerializedUnit(product: Product) {
  const specs = product.specs || {};
  return {
    product_id: product.id,
    sku: product.sku,
    status: product.status || ProductStatus.ACTIVE,
    imei1: specs.imei1 || '',
    imei2: specs.imei2 || '',
    serial: specs.serial || specs.serial_number || '',
  };
}

export function groupAdminSerializedProducts(products: Product[]): Product[] {
  const groups = new Map<string, Product[]>();
  const ordered: Array<{ key: string; serialized: boolean; product?: Product }> = [];

  for (const product of products) {
    if (!hasSerializedIdentity(product)) {
      ordered.push({ key: product.id, serialized: false, product });
      continue;
    }

    const key = getGroupKey(product);
    if (!groups.has(key)) {
      groups.set(key, []);
      ordered.push({ key, serialized: true });
    }
    groups.get(key)!.push(product);
  }

  return ordered.map((entry) => {
    if (!entry.serialized) return entry.product!;

    const group = groups.get(entry.key) || [];
    const representative = group.find((product) => Array.isArray(product.images) && product.images.length > 0) || group[0];
    const activeUnits = group.filter((product) => String(product.status || '').toLowerCase() === ProductStatus.ACTIVE);
    return {
      ...representative,
      specs: {
        ...stripSerializedSpecs(representative.specs),
        _serialized_units: group.map(buildSerializedUnit),
      },
      stock_quantity: activeUnits.length,
    };
  });
}
