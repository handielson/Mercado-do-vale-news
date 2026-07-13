import assert from 'node:assert/strict';
import {
  getPublicProductRouteTarget,
  getPublicProductVariantRouteTarget,
} from '../pages/store/productRouteTarget.js';

const greenVariant = {
  id: '0e381a4b-fcdd-4989-9dee-c73ed0f12f77',
  sku: 'PC858256V',
  slug: 'poco-c85',
};

const purpleVariant = {
  id: '030b8a2e-85a9-47aa-a4a3-bd1d2e66b565',
  sku: 'PC858256R',
  slug: 'poco-c85',
};

assert.equal(
  getPublicProductRouteTarget(greenVariant),
  'poco-c85',
  'catalog links must keep the readable slug even when duplicate records share it',
);

assert.equal(
  getPublicProductVariantRouteTarget(greenVariant, [greenVariant, purpleVariant]),
  greenVariant.id,
  'variant navigation must use id when another product shares the same slug',
);

assert.equal(
  getPublicProductRouteTarget({ id: 'single-id', slug: 'redmi-note-15' }, []),
  'redmi-note-15',
  'single products should keep their SEO slug',
);

assert.equal(
  getPublicProductRouteTarget({ id: 'no-slug-id', name: 'Athomics Inspire Lite' }),
  'athomics-inspire-lite',
  'products without a saved slug should derive one from the product name',
);

console.log('public product route target checks passed');
