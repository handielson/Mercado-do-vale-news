import fs from 'node:fs';

const modal = fs.readFileSync('components/settings/ModelModal.tsx', 'utf8');
const categorySelect = fs.readFileSync('components/products/CategorySelect.tsx', 'utf8');
const categoryEdit = fs.readFileSync('components/categories/CategoryEditPage.tsx', 'utf8');
const publicPage = fs.readFileSync('pages/store/PublicProductPage.tsx', 'utf8');

if (!modal.includes("GLOBAL_SPEC_FIELD_BLOCKLIST") || !modal.includes("'battery_health'")) {
  throw new Error('ModelModal must block battery_health from generic model template specs.');
}

if (/battery_health:\s*'optional'/.test(categorySelect)) {
  throw new Error('CategorySelect must not create new categories with battery_health enabled by default.');
}

if (/battery_health:\s*'optional'/.test(categoryEdit)) {
  throw new Error('CategoryEditPage must not enable battery_health globally by default.');
}

if (!publicPage.includes('shopee_attribute_defaults') || !publicPage.includes('shopee_attribute_labels')) {
  throw new Error('Public product page must merge saved Shopee attributes into public specs.');
}

if (!publicPage.includes("HIDDEN_KEYS.add('battery_health')")) {
  throw new Error('Public product page must hide the legacy generic battery_health spec.');
}
