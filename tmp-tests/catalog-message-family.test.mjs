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
const { generateCatalogMessage, splitCatalogMessageForWhatsApp } = loadTypeScript('utils/catalogMessageGenerator.ts', {
    '@/services/productGroupingCore.js': grouping,
    '@/utils/sharedMessageFormatting': formatting,
    '@/utils/cartShareUtils': loadTypeScript('utils/cartShareUtils.ts', {
        '@/services/installmentCalculator': { calculateInstallments: async () => [], formatPrice: () => '' },
        '@/services/vpsApiService': { vpsApiService: {} },
        '@/utils/productSpecUtils': loadTypeScript('utils/productSpecUtils.ts'),
        '@/utils/sharedMessageFormatting': formatting,
    }),
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
assert.equal((message.match(/\d+\. Poco X8 Pró\n/g) || []).length, 1);
assert.ok(!message.includes('Poco X8 Pró 5G\n'));
assert.ok(message.includes('🎨 Cores: Preto, Branco, Verde, Amarelo'));
assert.ok(message.includes('8GB/256GB'));
assert.ok(message.includes('2.660,00'));

// Compact responses can omit parent_name: identity still comes from parent_id.
assert.equal((generateCatalogMessage(products.map(p => ({ ...p, parent_name: null }))).match(/\d+\. Poco X8 Pró(?: 5G)?\n/g) || []).length, 1);

const separateMemory = variant('Poco X8 Pró 5G', 'Roxo', {
    specs: { ram: '12GB', storage: '512GB', color: 'Roxo' },
});
assert.equal((generateCatalogMessage([...products, separateMemory]).match(/\d+\. Poco X8 Pró\n/g) || []).length, 2);

const featured = variant('Realme Note 70', 'Preto', {
    parent_id: 'realme-note-70', parent_name: 'Note 70', brand: 'Realme',
    specs: { ram: '4GB', storage: '256GB', color: 'Preto', display: '6.74', tipo_de_display: 'IPS LCD', battery_mah: '6300', cam_principal_mpx: '13 MP', carregamento: '15W' },
});
const featuredOtherColor = variant('Realme Note 70', 'Dourado', {
    parent_id: 'realme-note-70', parent_name: 'Note 70', brand: 'Realme',
    specs: { ram: '4GB', storage: '256GB', color: 'Dourado' },
});
const featuredMessage = generateCatalogMessage([featured, featuredOtherColor]);
assert.match(featuredMessage, /1\. Realme Note 70\n   ✨ Tela IPS LCD de 6,74”[^\n]+\n   📱 4GB\/256GB\n      💰 [^\n]+\n      💳 [^\n]+\n      🎨 Cores: Preto, Dourado/);
assert.equal((featuredMessage.match(/1\. Realme Note 70\n/g) || []).length, 1);
const differentPrice = { ...featuredOtherColor, id: 'gold-higher-price', price_retail: 109000 };
const priceSeparated = generateCatalogMessage([featured, differentPrice]);
assert.equal((priceSeparated.match(/\d+\. Realme Note 70\n/g) || []).length, 2);
assert.match(priceSeparated, /🎨 Cores: Preto/);
assert.match(priceSeparated, /🎨 Cores: Dourado/);
assert.doesNotMatch(priceSeparated, /🎨 Cores: Preto, Dourado/);
assert.match(priceSeparated, /R\$\s*1\.090,00/);
assert.match(priceSeparated, /R\$\s*2\.660,00/);

// Similar names in different families must remain separate.
assert.equal((generateCatalogMessage([products[0], { ...products[1], parent_id: 'other-family' }]).match(/\d+\. Poco X8 Pró\n/g) || []).length, 2);

const splitProducts = Array.from({ length: 9 }, (_, index) => variant(`Modelo ${index + 1}`, 'Preto', {
    id: `split-${index + 1}`, parent_id: `family-${index + 1}`, parent_name: `Modelo ${index + 1}`,
    brand: index < 4 ? 'Oukitel' : index < 7 ? 'Realme' : 'Xiaomi',
}));
const splitParts = splitCatalogMessageForWhatsApp(generateCatalogMessage(splitProducts));
assert.equal(splitParts.length, 3);
for (const [index, part] of splitParts.entries()) {
    assert.match(part, new RegExp(`parte ${index + 1}/3`));
    assert.equal((part.match(/^\d+\. /gm) || []).length, 3);
}
assert.equal((splitParts.join('\n').match(/^\d+\. /gm) || []).length, 9);
assert.ok(splitParts[2].includes('*Gostou de algum desses?*'));
assert.ok(splitParts.slice(0, 2).every(part => !part.includes('*Gostou de algum desses?*')));
assert.deepEqual(splitCatalogMessageForWhatsApp('Nenhum produto disponível no momento.'), ['Nenhum produto disponível no momento.']);
const longProducts = Array.from({ length: 24 }, (_, index) => variant(`Longo ${index + 1}`, 'Preto', {
    id: `long-${index + 1}`, parent_id: `long-family-${index + 1}`, parent_name: `Longo ${index + 1}`,
}));
assert.deepEqual(
    splitCatalogMessageForWhatsApp(generateCatalogMessage(longProducts)).map(part => (part.match(/^\d+\. /gm) || []).length),
    [8, 8, 8],
);

for (const file of [
    'components/catalog/ShareCatalogButton.tsx',
    'components/catalog/ShareCategoryButton.tsx',
    'components/admin/ExportCatalogModal.tsx',
]) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /splitCatalogMessageForWhatsApp\(/, `${file} must send or copy one catalog part at a time`);
    assert.doesNotMatch(source, /encodeURIComponent\(message\)|clipboard\.writeText\(message\)/, `${file} must not share the whole catalog as one message`);
}

const hidden = variant('Pai antigo oculto', 'Azul', { hide_from_catalog: true });
const empty = variant('Sem estoque', 'Roxo', { stock_quantity: 0 });
const filtered = generateCatalogMessage([...products, hidden, empty]);
assert.ok(!filtered.includes('Azul'));
assert.ok(!filtered.includes('Roxo'));
console.log('catalog message family grouping: ok');
