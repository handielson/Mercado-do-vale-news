import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const form = readFileSync('components/products/ProductForm.tsx', 'utf8');
assert.match(form, /import\s+\{\s*unitService\s*\}\s+from\s+['"]\.\.\/\.\.\/services\/units['"]/, 'ProductForm must create serialized units through unitService');
assert.match(form, /import\s+\{\s*UnitStatus\s*\}\s+from\s+['"]\.\.\/\.\.\/utils\/field-standards['"]/, 'ProductForm must set created units to available');
assert.match(form, /function\s+stripSerializedIdentityFromSpecs\(/, 'ProductForm must strip IMEI/serial from the base product specs');
assert.match(form, /function\s+groupSerializedBatchItemsForUnits\(/, 'ProductForm must group serialized batch items by shared variation specs');
assert.match(form, /await\s+unitService\.create\(\{[\s\S]*product_id:\s*savedProduct\.id[\s\S]*status:\s*UnitStatus\.AVAILABLE/, 'ProductForm must create available units linked to the saved base product');
assert.match(form, /unitService\.searchByIdentifier\(String\(val\)\.trim\(\)\)/, 'ProductForm must block duplicate IMEI/serial values already stored as units');
assert.match(form, /Salvar \$\{serialList\.length\} Unidades/, 'ProductForm must label serialized batch submission as units, not products');
assert.doesNotMatch(form, /for \(let index = 0; index < linkedSerialList\.length; index\+\+\)[\s\S]*const savedProduct = await onSubmit\(itemData\);[\s\S]*Produto \$\{index \+ 1\} de \$\{totalToSave\} salvo\./, 'ProductForm must not keep saving one product per serialized item');

const hook = readFileSync('hooks/useProducts.ts', 'utf8');
assert.match(hook, /import\s+\{\s*groupAdminSerializedProducts\s*\}\s+from\s+['"]\.\/adminSerializedProductGrouping['"]/, 'useProducts must group legacy serialized admin products');
assert.match(hook, /groupAdminSerializedProducts\(data\)/, 'useProducts must apply serialized grouping before rendering/caching');

const card = readFileSync('components/products/ProductCard.tsx', 'utf8');
assert.match(card, /const serializedUnits = Array\.isArray\(product\.specs\?\._serialized_units\)/, 'ProductCard must render aggregated serialized units');
assert.match(card, /serializedUnits\.map/, 'ProductCard must list serialized IMEI/serial units inside the grouped card');

console.log('smartphone serialized unit grouping static checks passed');
