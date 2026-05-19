import assert from 'node:assert/strict';
import { normalizeModelImportPayload, parseModelImportJson } from '../components/settings/modelJsonImport.js';

const rawJson = `{
  "name": "Realme C85",
  "brand": "Realme",
  "category": "Smartphones",
  "description": "O Realme C85 e um smartphone da linha Realme C desenvolvido para oferecer recursos equilibrados para o uso diario.",
  "eans": [],
  "seo": {
    "slug": "realme-c85",
    "meta_title": "Realme C85 no Mercado do Vale",
    "meta_description": "Confira o Realme C85 com suporte, garantia e entrega facilitada no Mercado do Vale.",
    "keywords": ["realme c85", "realme", "smartphone"]
  },
  "logistics": {
    "weight_kg": null,
    "dimensions": {
      "width_cm": null,
      "height_cm": null,
      "depth_cm": null
    }
  },
  "template_values": {
    "battery_health": "100%"
  }
}`;

const normalized = normalizeModelImportPayload(parseModelImportJson(rawJson), {
  brands: [{ id: 'brand-realme', name: 'Realme' }],
  categories: [{ id: 'cat-smartphones', name: 'Smartphones', slug: 'smartphones' }],
  customFields: [],
  choiceOptions: {},
});

assert.equal(normalized.name, 'Realme C85');
assert.equal(normalized.brandId, 'brand-realme');
assert.equal(normalized.categoryId, 'cat-smartphones');
assert.equal(normalized.description, 'O Realme C85 e um smartphone da linha Realme C desenvolvido para oferecer recursos equilibrados para o uso diario.');
assert.equal(normalized.templateValues.slug, 'realme-c85');
assert.equal(normalized.templateValues.meta_title, 'Realme C85 no Mercado do Vale');
assert.deepEqual(normalized.templateValues.keywords, ['realme c85', 'realme', 'smartphone']);

console.log('model json full payload regression ok');
