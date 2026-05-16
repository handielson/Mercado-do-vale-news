import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = {
  admin: readFileSync('pages/admin/products/ProductCombosPage.tsx', 'utf8'),
  pdp: readFileSync('pages/store/PublicProductPage.tsx', 'utf8'),
  cart: readFileSync('contexts/CartContext.tsx', 'utf8'),
  vpsCjs: readFileSync('vps_server.cjs', 'utf8'),
  vpsJs: readFileSync('vps_server.js', 'utf8'),
};

assert.match(files.admin, /combo_choice_groups/u, 'admin must save combo choice groups');
assert.match(files.admin, /addChoiceGroupToCombo/u, 'admin must turn a parent family into a choice group');
assert.match(files.pdp, /comboChoiceGroups/u, 'public PDP must group combo options');
assert.match(files.pdp, /selectedComboOptions/u, 'public PDP must track selected combo options');
assert.match(files.cart, /comboSelections/u, 'cart items must keep combo selections');

for (const [name, source] of Object.entries({ vpsCjs: files.vpsCjs, vpsJs: files.vpsJs })) {
  assert.match(source, /component_type/u, `${name} must persist component type`);
  assert.match(source, /choice_group/u, `${name} must persist choice group rows`);
  assert.match(source, /parent_product_id/u, `${name} must persist parent product id`);
  assert.match(source, /combo_choice_groups/u, `${name} must accept combo_choice_groups payload`);
  assert.match(
    source,
    /GROUP BY pc\.combo_product_id,\s*COALESCE\(pc\.component_type,\s*'fixed'\),/u,
    `${name} combo stock query must satisfy ONLY_FULL_GROUP_BY for component_type`,
  );
}

console.log('combo choice group static checks passed');
