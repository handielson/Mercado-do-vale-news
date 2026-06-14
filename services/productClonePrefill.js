const UNIQUE_SERIALIZED_SPEC_KEYS = ['imei1', 'imei2', 'serial'];

export function buildProductClonePrefill(product = {}) {
  const clone = {
    ...product,
    specs: {
      ...(product.specs || {}),
    },
  };

  delete clone.id;
  delete clone.created_at;
  delete clone.updated_at;

  UNIQUE_SERIALIZED_SPEC_KEYS.forEach((key) => {
    clone.specs[key] = '';
  });

  return clone;
}

export function getProductCloneState(product = {}) {
  return {
    cloneProduct: buildProductClonePrefill(product),
  };
}
