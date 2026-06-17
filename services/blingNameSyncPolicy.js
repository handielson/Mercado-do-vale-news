export const BLING_NAME_SYNC = Object.freeze({
  LOCAL: 'local',
  BLING: 'bling',
});

const SYNC_KEY = '_bling_name_sync';

function normalizeSpecs(specs) {
  return specs && typeof specs === 'object' && !Array.isArray(specs) ? specs : {};
}

export function markLocalNameManaged(specs) {
  return {
    ...normalizeSpecs(specs),
    [SYNC_KEY]: BLING_NAME_SYNC.LOCAL,
  };
}

export function markBlingNameManaged(specs) {
  return {
    ...normalizeSpecs(specs),
    [SYNC_KEY]: BLING_NAME_SYNC.BLING,
  };
}

export function shouldApplyBlingNameUpdate(productOrSpecs) {
  const specs = productOrSpecs?.specs ? productOrSpecs.specs : productOrSpecs;
  return normalizeSpecs(specs)[SYNC_KEY] !== BLING_NAME_SYNC.LOCAL;
}

export function stripBlingNameFieldsWhenLocalManaged(existingProduct, updateFields) {
  if (shouldApplyBlingNameUpdate(existingProduct)) return updateFields;

  const { name, slug, ...safeFields } = updateFields || {};
  return safeFields;
}

