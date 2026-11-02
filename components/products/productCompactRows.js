import { getAdminProductCardSummary } from './productCardStatus.js';
import { getProductVariationSpecs } from '../../services/modelProductAggregator.js';

// Lista compacta da página de produtos (celular): uma linha por produto ou família,
// sem consultas extras — usa só o que a lista já trouxe.

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const firstImage = (product) => (Array.isArray(product?.images) ? product.images.find(Boolean) : null) || null;

export function variantLabel(product) {
  const { color, ram, storage } = getProductVariationSpecs(product);
  const memory = [ram, storage].filter(Boolean).join('/');
  return [color, memory].filter(Boolean).join(' · ') || product?.sku || product?.name || '';
}

function familyPrice(prices) {
  const valid = prices.filter(value => value > 0);
  if (!valid.length) return null;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  return min === max ? BRL.format(min / 100) : `${BRL.format(min / 100)} a ${BRL.format(max / 100)}`;
}

/** Monta a linha compacta de um grupo (produto solto ou família). */
export function getCompactRow(group) {
  const representative = group.parent || group.representative;
  if (!group.isFamily) {
    const product = group.representative;
    const summary = getAdminProductCardSummary(product);
    const { color, ram, storage } = getProductVariationSpecs(product);
    return {
      key: group.key,
      isFamily: false,
      product,
      title: product.name,
      subtitle: [color, [ram, storage].filter(Boolean).join('/')].filter(Boolean).join(' · '),
      sku: product.sku || '',
      image: firstImage(product),
      price: summary.price,
      chips: summary.chips,
      variants: [],
    };
  }
  const parentId = String(group.parent?.id || '');
  // Destaque só quando a busca achou parte da família (ex.: um SKU ou cor), não todas.
  const familyVariantCount = (group.familyProducts || []).filter(product => String(product.id) !== parentId).length;
  const matchedIds = new Set((group.matchedProducts || []).map(match => match.id));
  const partialMatch = matchedIds.size > 0 && [...matchedIds].filter(id => String(id) !== parentId).length < familyVariantCount;
  const variants = (group.familyProducts || [])
    .filter(product => String(product.id) !== parentId)
    .map(product => ({
      product,
      label: variantLabel(product),
      sku: product.sku || '',
      stock: Math.max(0, Number(product.stock_quantity || 0)),
      price: Number(product.price_retail || 0) > 0 ? BRL.format(Number(product.price_retail) / 100) : null,
      matched: partialMatch && matchedIds.has(product.id),
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR', { numeric: true }));
  const image = firstImage(group.parent) || variants.map(variant => firstImage(variant.product)).find(Boolean) || null;
  const totalStock = Number.isFinite(Number(group.totalStock))
    ? Number(group.totalStock)
    : variants.reduce((total, variant) => total + variant.stock, 0);
  const parentSummary = getAdminProductCardSummary(representative);
  const chips = [
    { key: 'variants', label: `${variants.length} ${variants.length === 1 ? 'variação' : 'variações'}`, color: 'bg-violet-50 text-violet-700 border-violet-200' },
    { key: 'stock', label: `${Math.max(0, totalStock)} em estoque`, color: totalStock > 0 ? 'bg-green-100 text-green-800 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-200' },
    ...parentSummary.chips,
  ];
  return {
    key: group.key,
    isFamily: true,
    product: representative,
    title: representative.name,
    subtitle: '',
    sku: representative.sku || '',
    image,
    price: familyPrice(variants.map(variant => Number(variant.product.price_retail || 0))),
    chips,
    variants,
  };
}
