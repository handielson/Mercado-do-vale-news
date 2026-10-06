import assert from 'node:assert/strict';
import { getPublicProductName } from '../pages/store/publicProductName.js';
import { getCatalogCardDisplayName } from '../components/catalog/modernProductCardState.js';
import { getCatalogFamilyName } from '../services/productGroupingCore.js';

const parentName = 'POCO X8 Pro 5G';
const variants = [
  { name: 'Poco X8 Pró Preto', specs: { color: 'Preto', ram: '8GB', storage: '256GB' } },
  { name: 'Poco X8 Pró 5G, NFC, 256GB, 8GB Ram, Global Cor:Verde', specs: { color: 'Verde', ram: '8GB', storage: '256GB' } },
  { name: 'Poco X8 Pró Branco 12GB/512GB', specs: { color: 'Branco', ram: '12GB', storage: '512GB' } },
];
for (const variant of variants) {
  const child = { ...variant, parent_id: 'family', parent_name: parentName };
  assert.equal(getPublicProductName(child), parentName);
  assert.equal(getCatalogCardDisplayName({ product: child, productGroup: {model: 'Nome divergente'} }), parentName);
  assert.equal(getCatalogFamilyName(child), parentName);
  assert.deepEqual(child.specs, variant.specs);
  assert.equal(getPublicProductName({...child,parent_name:'POCO X8 Pro atualizado'}),'POCO X8 Pro atualizado');
}
assert.equal(getCatalogFamilyName({parent_name:parentName}), '');
assert.equal(getPublicProductName({name:'Produto independente',parent_name:parentName}), 'Produto independente');
assert.equal(getCatalogFamilyName({parent_id:'family',parent_name:'  '}), '');
assert.equal(getCatalogCardDisplayName({product:variants[0],productGroup:{representativeProduct:{parent_id:'family',parent_name:parentName}}}),parentName);
console.log('Family title is stable across variants; exact parent spelling preserved; standalone fallback preserved.');
