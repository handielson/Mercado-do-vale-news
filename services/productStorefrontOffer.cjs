'use strict';

const STOREFRONTS = Object.freeze(['mercado_do_vale', 'loja_3d']);
const STATUSES = Object.freeze(['draft', 'published', 'hidden']);

function cents(value, field) {
  if (value === undefined || value === null || value === '') return null;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${field} deve ser um inteiro em centavos.`);
  return value;
}

function optionalText(value, field, maxLength) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > maxLength) throw new Error(`${field} é inválido.`);
  return value.trim() || null;
}

function resolveStorefrontDescription(product) {
  const parentDescription = typeof product?.parent_description === 'string'
    ? product.parent_description.trim()
    : '';
  return parentDescription || product?.description || null;
}

function validateStorefrontOffer(storefront, input) {
  if (!STOREFRONTS.includes(storefront)) throw new Error('Site desconhecido.');
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Oferta inválida.');
  if (!STATUSES.includes(input.publication_status)) throw new Error('Estado de publicação inválido.');

  const offer = {
    publication_status: input.publication_status,
    title: optionalText(input.title, 'Título', 255),
    description: null,
    category_label: optionalText(input.category_label, 'Categoria do site', 120),
    slug: optionalText(input.slug, 'Slug', 255),
    price_retail: cents(input.price_retail, 'Preço de varejo'),
    price_reseller: cents(input.price_reseller, 'Preço de revenda'),
    price_wholesale: cents(input.price_wholesale, 'Preço de atacado'),
    price_promo: cents(input.price_promo, 'Preço promocional'),
    meta_title: optionalText(input.meta_title, 'Título SEO', 255),
    meta_description: optionalText(input.meta_description, 'Descrição SEO', 65535),
  };

  if (offer.publication_status === 'published' && (!offer.price_retail || offer.price_retail <= 0)) {
    throw new Error('Informe preço de varejo maior que zero antes de publicar.');
  }
  if (offer.publication_status === 'published' && !offer.category_label) {
    throw new Error('Escolha a categoria deste site antes de publicar.');
  }
  if (offer.price_promo !== null && offer.price_retail !== null && offer.price_promo >= offer.price_retail) {
    throw new Error('O preço promocional precisa ser menor que o preço de varejo.');
  }
  return offer;
}

function projectStorefrontProduct(product, offer) {
  if (!product || !offer || offer.publication_status !== 'published') return null;
  if (product.status !== 'active' || product.is_parent === true || Number(product.is_parent) === 1) return null;
  if (!Number.isSafeInteger(Number(offer.price_retail)) || Number(offer.price_retail) <= 0) return null;
  return {
    id: product.id,
    sku: product.sku,
    ean: product.ean,
    alternative_eans: product.alternative_eans,
    model_id: product.model_id,
    parent_id: product.parent_id || null,
    parent_sku: product.parent_sku || null,
    parent_name: product.parent_name || null,
    parent_slug: product.parent_slug || null,
    category_id: product.category_id,
    category_name: product.category_name,
    category_slug: product.category_slug,
    storefront_category: offer.category_label || null,
    brand: product.brand,
    name: offer.title || product.name,
    description: resolveStorefrontDescription(product),
    slug: offer.slug || product.slug,
    price_retail: Number(offer.price_retail),
    price_reseller: offer.price_reseller == null ? null : Number(offer.price_reseller),
    price_wholesale: offer.price_wholesale == null ? null : Number(offer.price_wholesale),
    price_promo: offer.price_promo == null ? null : Number(offer.price_promo),
    meta_title: offer.meta_title || null,
    meta_description: offer.meta_description || null,
    stock_quantity: Number(product.stock_quantity) || 0,
    ...(offer.storefront === 'loja_3d' ? { available_stock: Math.max(0, Number(product.available_stock) || 0) } : {}),
    track_inventory: product.track_inventory,
    hide_from_catalog: false,
    images: product.images,
    image_url: product.image_url,
    video_url: product.video_url,
    marketing_video_url: product.marketing_video_url,
    blueprint_image_url: product.blueprint_image_url,
    warranty_type: product.warranty_type,
    warranty_template_id: product.warranty_template_id,
    created_at: product.created_at,
    specs: product.specs,
    is_print3d: product.is_print3d,
    dimensions: product.dimensions,
    weight_kg: product.weight_kg,
    custom_fields: product.custom_fields,
    model_template_values: product.model_template_values,
    production_days: product.production_days,
    print3d_preorder_enabled: product.print3d_preorder_enabled,
    status: 'active',
    storefront: offer.storefront,
  };
}

module.exports = { STOREFRONTS, STATUSES, validateStorefrontOffer, projectStorefrontProduct, resolveStorefrontDescription };
