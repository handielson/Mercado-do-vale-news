import type { CatalogProduct } from '@/types/catalog';
import { print3dVariantLabel } from './print3dVariantLabel.js';

export type Print3dStoreProduct = CatalogProduct & {
  available_stock?: number;
  storefront_category?: string | null;
  parent_sku?: string | null;
  parent_name?: string | null;
  parent_slug?: string | null;
  previewKind?: 'vase' | 'organizer' | 'keychain' | 'lamp';
};

const demoBase = {
  brand: '3D do Vale', status: 'active' as CatalogProduct['status'], price_cost: 0,
  price_reseller: 0, price_wholesale: 0, track_inventory: true, images: [], eans: [],
  warranty_type: 'brand' as const, created: '', updated: '', is_print3d: true,
};

export const print3dDemoProducts: Print3dStoreProduct[] = [
  { ...demoBase, id: 'preview-vaso', model_id: 'vaso-aura', sku: 'PREV-VASO-AREIA', name: 'Vaso Aura', model: 'Vaso Aura', category_id: 'Decoração', price_retail: 4900, stock_quantity: 4, specs: { material: 'PLA', color: 'Areia' }, previewKind: 'vase' },
  { ...demoBase, id: 'preview-vaso-terracota', model_id: 'vaso-aura', sku: 'PREV-VASO-TERRA', name: 'Vaso Aura', model: 'Vaso Aura', category_id: 'Decoração', price_retail: 5400, stock_quantity: 0, specs: { material: 'PLA', color: 'Terracota' }, print3d_preorder_enabled: true, production_days: 4, previewKind: 'vase' },
  { ...demoBase, id: 'preview-organizador', model_id: 'organizador-modular', sku: 'PREV-ORG', name: 'Organizador Modular', model: 'Organizador Modular', category_id: 'Organização', price_retail: 7900, stock_quantity: 2, specs: { material: 'PETG', color: 'Grafite' }, previewKind: 'organizer' },
  { ...demoBase, id: 'preview-chaveiro', model_id: 'chaveiro-personalizado', sku: 'PREV-CHAV', name: 'Chaveiro Personalizado', model: 'Chaveiro Personalizado', category_id: 'Presentes', price_retail: 1900, stock_quantity: 0, specs: { material: 'PLA', color: 'Terracota' }, print3d_preorder_enabled: true, production_days: 3, previewKind: 'keychain' },
  { ...demoBase, id: 'preview-luminaria', model_id: 'luminaria-orbita', sku: 'PREV-LUZ', name: 'Luminária Órbita', model: 'Luminária Órbita', category_id: 'Decoração', price_retail: 12900, stock_quantity: 1, specs: { material: 'PLA', color: 'Marfim' }, previewKind: 'lamp' },
];

export const print3dAvailableStock = (product: Print3dStoreProduct) =>
  Math.max(0, Number(product.available_stock ?? product.stock_quantity) || 0);

export const print3dAvailability = (product: Print3dStoreProduct) => print3dAvailableStock(product) > 0
  ? `${print3dAvailableStock(product)} em estoque`
  : product.print3d_preorder_enabled
    ? Number(product.production_days) > 0 ? `${product.production_days} dias úteis estimados` : 'Prazo sob consulta'
    : 'Indisponível';

export const print3dGroupKey = (product: Print3dStoreProduct) => String(product.model_id || '').trim() || product.id;

export const print3dMatchesQuery = (product: Print3dStoreProduct, query: string) =>
  `${product.name} ${product.sku} ${print3dVariantLabel(product)}`.toLocaleLowerCase('pt-BR').includes(query);

export function print3dBaseProductName(product: Pick<Print3dStoreProduct, 'name'>): string {
  const name = String(product.name || '').trim();
  return name
    .replace(/(?:\s*[-–—|]\s*|\s+)(?:cor|color)\s*:?\s*[^|,/]+$/iu, '')
    .trim() || name;
}

export function print3dSlug(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 170);
}

function commonSkuPrefix(products: Array<Pick<Print3dStoreProduct, 'sku'>>): string {
  const skus = products.map(product => String(product.sku || '').trim()).filter(Boolean);
  if (skus.length < 2) return '';
  let prefix = skus[0];
  for (const sku of skus.slice(1)) {
    while (prefix && !sku.toLocaleLowerCase('pt-BR').startsWith(prefix.toLocaleLowerCase('pt-BR'))) prefix = prefix.slice(0, -1);
  }
  return prefix.replace(/[-_.]+$/, '').length >= 4 ? prefix.replace(/[-_.]+$/, '') : '';
}

export function print3dProductRouteTarget(
  product: Pick<Print3dStoreProduct, 'id' | 'sku' | 'slug' | 'name' | 'parent_sku' | 'parent_name'>,
  family: Array<Pick<Print3dStoreProduct, 'sku'>> = [],
): string {
  const base = print3dSlug(product.parent_name || print3dBaseProductName(product)) || 'produto';
  const familySku = product.parent_sku || commonSkuPrefix(family);
  const unique = print3dSlug(familySku || product.sku || product.id) || print3dSlug(product.id);
  return `${base}-${unique}`;
}

export function print3dLegacyProductRouteTarget(product: Pick<Print3dStoreProduct, 'id' | 'sku' | 'slug' | 'name'>): string {
  const base = print3dSlug(product.slug || product.name) || 'produto';
  const unique = print3dSlug(product.sku || product.id) || print3dSlug(product.id);
  return `${base}-${unique}`;
}

export function print3dProductPath(
  product: Pick<Print3dStoreProduct, 'id' | 'sku' | 'slug' | 'name' | 'parent_sku' | 'parent_name'>,
  demo = false,
  family: Array<Pick<Print3dStoreProduct, 'sku'>> = [],
  selectVariant = false,
): string {
  const search = new URLSearchParams();
  if (demo) search.set('demo', '1');
  if (selectVariant && family.length > 1) search.set('variante', String(product.sku));
  const query = search.toString();
  return `/loja-3d/produto/${encodeURIComponent(print3dProductRouteTarget(product, family))}${query ? `?${query}` : ''}`;
}

export function print3dPlainText(value: unknown): string {
  if (!value) return '';
  if (typeof document !== 'undefined') {
    const element = document.createElement('div');
    element.innerHTML = String(value);
    return (element.textContent || '').replace(/\s+/g, ' ').trim();
  }
  return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
