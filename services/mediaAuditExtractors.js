import { classifyMediaUrl } from './mediaOrigin.js';

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function pushClassifiedRef(refs, ref) {
  if (!nonEmptyString(ref.url)) return;
  const classified = classifyMediaUrl(ref.url);
  refs.push({
    ...ref,
    url: ref.url.trim(),
    sourceUrl: classified.sourceUrl,
    normalizedUrl: classified.normalizedUrl,
    redactedUrl: classified.redactedUrl,
    origin: classified.origin,
    shouldMigrate: classified.shouldMigrate,
    reason: classified.reason,
  });
}

function pushArrayRefs(refs, baseRef, values) {
  if (!Array.isArray(values)) return;
  values.forEach((url, index) => {
    pushClassifiedRef(refs, {
      ...baseRef,
      field: `${baseRef.field}[${index}]`,
      url,
    });
  });
}

export function extractMediaRefsFromProducts(products = []) {
  const refs = [];

  for (const product of products || []) {
    const entityId = String(product.id || product.sku || product.name || 'unknown-product');
    const label = [product.sku, product.name].filter(Boolean).join(' - ') || entityId;
    const base = { entityType: 'product', entityId, label };

    pushClassifiedRef(refs, { ...base, field: 'image_url', url: product.image_url });
    pushArrayRefs(refs, { ...base, field: 'images' }, product.images);
    pushArrayRefs(refs, { ...base, field: 'custom_images' }, product.custom_images);
  }

  return refs;
}

export function extractMediaRefsFromModelColorImages(rows = []) {
  const refs = [];

  for (const row of rows || []) {
    const entityId = String(row.id || `${row.model_id || 'model'}:${row.color_id || 'color'}`);
    const label = `model=${row.model_id || 'unknown'} color=${row.color_id || 'unknown'}`;
    pushArrayRefs(refs, {
      entityType: 'model_color_images',
      entityId,
      label,
      field: 'images',
    }, row.images);
  }

  return refs;
}

export function extractMediaRefsFromCompanySettings(settings) {
  const refs = [];
  if (!settings) return refs;

  const entityId = String(settings.id || 'company_settings');
  const label = settings.name || entityId;
  const fields = ['logo', 'favicon', 'about_us_image_url', 'watermark_url'];

  for (const field of fields) {
    pushClassifiedRef(refs, {
      entityType: 'company_settings',
      entityId,
      label,
      field,
      url: settings[field],
    });
  }

  return refs;
}

export function extractMediaRefsFromCatalogBanners(rows = []) {
  const refs = [];

  for (const row of rows || []) {
    const entityId = String(row.id || row.title || 'unknown-banner');
    const label = row.title || entityId;
    const fields = ['image_url', 'desktop_image_url', 'mobile_image_url'];

    for (const field of fields) {
      pushClassifiedRef(refs, {
        entityType: 'catalog_banner',
        entityId,
        label,
        field,
        url: row[field],
      });
    }
  }

  return refs;
}

export function summarizeMediaRefs(refs = []) {
  const byOrigin = {};
  const byEntityType = {};
  let migrationCandidates = 0;
  let alreadyCanonical = 0;

  for (const ref of refs) {
    byOrigin[ref.origin] = (byOrigin[ref.origin] || 0) + 1;
    byEntityType[ref.entityType] = (byEntityType[ref.entityType] || 0) + 1;
    if (ref.shouldMigrate) migrationCandidates += 1;
    if (ref.origin === 'vps') alreadyCanonical += 1;
  }

  return {
    total: refs.length,
    migrationCandidates,
    alreadyCanonical,
    byOrigin,
    byEntityType,
  };
}
