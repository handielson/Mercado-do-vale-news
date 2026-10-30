import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { buildModelParentPrefill } from '../services/modelParentPrefill.mjs';

const require = createRequire(import.meta.url);
const cache = new Map();
function loadTs(file) {
    const absolute = path.resolve(file);
    if (cache.has(absolute)) return cache.get(absolute);
    const exports = {};
    cache.set(absolute, exports);
    const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(code, {
        exports,
        require: id => id.startsWith('.') ? loadTs(path.resolve(path.dirname(absolute), `${id}.ts`)) : require(id),
    }, { filename: absolute });
    return exports;
}

const { buildProductFormDefaults } = loadTs('components/products/productFormDefaults.ts');
const { productSchema } = loadTs('schemas/product.ts');
const prefill = buildModelParentPrefill({ id: 'model-test', name: 'Modelo teste', category_id: 'phones' }, 'Marca teste');
const original = JSON.stringify(prefill);
// Reproduce exactly the four reported errors from resetting to a partial draft.
const broken = productSchema.safeParse(prefill);
assert.equal(broken.success, false);
assert.deepEqual(broken.error.issues.map(issue => issue.path.join('.')).sort(), ['price_reseller', 'price_retail', 'price_wholesale', 'status']);
const restored = buildProductFormDefaults(prefill);
assert.equal(productSchema.safeParse(restored).success, true);
assert.equal(restored.product_format, 'parent');
assert.equal(restored.track_inventory, false);
assert.equal(restored.status, 'active');
assert.equal(JSON.stringify(prefill), original, 'loading a draft must not mutate its source');

const saved = { ...prefill, status: 'inactive', price_cost: 95000, price_retail: 150000, price_reseller: 140000, price_wholesale: 130000, specs: { color: 'Verde' } };
const reopened = buildProductFormDefaults(saved);
for (const field of ['status', 'price_cost', 'price_retail', 'price_reseller', 'price_wholesale', 'specs']) {
    assert.equal(reopened[field], saved[field], `preserve saved ${field}`);
}
assert.equal(productSchema.safeParse(reopened).success, true);
const missing = buildProductFormDefaults({ ...prefill, status: undefined, price_retail: undefined });
assert.equal(missing.status, 'active');
assert.equal(missing.price_retail, 0);
for (const invalid of [{ price_retail: NaN }, { price_retail: 'erro' }, { status: 'pending' }, { status: null }]) {
    assert.equal(productSchema.safeParse(buildProductFormDefaults({ ...prefill, ...invalid })).success, false, 'invalid explicit values must remain blocked');
}
assert.equal(buildProductFormDefaults({ name: 'Produto simples' }).product_format, 'simple');
assert.equal(buildProductFormDefaults({ parent_id: 'parent-test' }).product_format, 'variation');
assert.equal(buildProductFormDefaults({}, true).is_print3d, true);
assert.equal(buildProductFormDefaults({ is_print3d: false }, true).is_print3d, false);
const form = fs.readFileSync('components/products/ProductForm.tsx', 'utf8');
// UI integration guard: keep both initialization and asynchronous reset on the
// baseline tested above when reorganizing the form.
assert.match(form, /defaultValues: buildProductFormDefaults\(initialData, defaultIsPrint3d\)/);
assert.match(form, /reset\(buildProductFormDefaults\(initialData, defaultIsPrint3d\)\)/);
console.log('product form partial draft: reproduced four errors, restored defaults, preserved prices/status and validation');
