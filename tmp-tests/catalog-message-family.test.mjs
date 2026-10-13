import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as grouping from '../services/productGroupingCore.js';
import * as formatting from '../utils/sharedMessageFormatting.js';

// Keep the real grouping, memory, formatting and price logic; no API access.
function loadTypeScript(path, dependencies = {}) {
    const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    const exports = {};
    new Function('exports', 'require', outputText)(exports, name => {
        assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
        return dependencies[name];
    });
    return exports;
}
const { generateCatalogMessage } = loadTypeScript('utils/catalogMessageGenerator.ts', {
    '@/services/productGroupingCore.js': grouping,
    '@/utils/sharedMessageFormatting': formatting,
    '@/utils/productSpecUtils': loadTypeScript('utils/productSpecUtils.ts'),
    '@/services/installmentCalculator': loadTypeScript('services/installmentCalculator.ts', { './payment-fees': { paymentFeesService: {} } }),
    '@/services/catalogService': { catalogService: {} },
    '@/services/vpsApiService': { vpsApiService: {} },
    '@/services/publicCompanySettings': { publicCompanySettingsService: {} },
    '@/services/payment-fees': { paymentFeesService: {} },
});

const variant = (name, color, overrides = {}) => ({
    id: color, name, model: name, model_id: 'poco-model',
    parent_id: 'poco-family', parent_name: 'Poco X8 Pró',
    brand: 'Xiaomi', price_retail: 266000, stock_quantity: 1,
    specs: { ram: '8GB', storage: '256GB', color }, ...overrides,
});
const products = [
    variant('Poco X8 Pró', 'Preto'),
    variant('Poco X8 Pró', 'Branco'),
    variant('Poco X8 Pró 5G', 'Verde'),
    variant('Poco X8 Pró 5G', 'Amarelo'),
];
const message = generateCatalogMessage(products);
assert.equal((message.match(/\d+\. \*Poco X8 Pró\*/g) || []).length, 1);
assert.ok(!message.includes('*Poco X8 Pró 5G*'));
for (const color of ['Preto', 'Branco', 'Verde', 'Amarelo']) assert.ok(message.includes(`. ${color}`));
assert.ok(message.includes('8GB/256GB'));
assert.ok(message.includes('2.660,00'));

// Compact responses can omit parent_name: identity still comes from parent_id.
assert.equal((generateCatalogMessage(products.map(p => ({ ...p, parent_name: null }))).match(/\d+\. \*/g) || []).length, 1);

const separateMemory = variant('Poco X8 Pró 5G', 'Roxo', {
    specs: { ram: '12GB', storage: '512GB', color: 'Roxo' },
});
assert.equal((generateCatalogMessage([...products, separateMemory]).match(/\d+\. \*/g) || []).length, 2);

// Similar names in different families must remain separate.
assert.equal((generateCatalogMessage([products[0], { ...products[1], parent_id: 'other-family' }]).match(/\d+\. \*/g) || []).length, 2);

const hidden = variant('Pai antigo oculto', 'Azul', { hide_from_catalog: true });
const empty = variant('Sem estoque', 'Roxo', { stock_quantity: 0 });
const filtered = generateCatalogMessage([...products, hidden, empty]);
assert.ok(!filtered.includes('Azul'));
assert.ok(!filtered.includes('Roxo'));
console.log('catalog message family grouping: ok');
