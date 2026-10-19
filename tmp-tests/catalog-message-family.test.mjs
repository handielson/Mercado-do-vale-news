import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as grouping from '../services/productGroupingCore.js';
import * as formatting from '../utils/sharedMessageFormatting.js';
import { buildCatalogQuoteProduct } from '../components/catalog/modernProductCardState.js';

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
const { generateCatalogMessage, splitCatalogMessageForWhatsApp, generateProductShareMessage } = loadTypeScript('utils/catalogMessageGenerator.ts', {
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

// PDP: selected variation stays isolated; family uses the same priced catalog blocks.
const note = (id, ram, storage, color, price = 95000, extra = {}) => ({
    id, name: 'Realme Note 70', parent_id: 'note-family', parent_name: 'Note 70',
    brand: 'Realme', slug: `note-70-${id}`, price_retail: price,
    stock_quantity: 1, track_inventory: true, status: 'active',
    specs: { ram, storage, color }, ...extra,
});
const noteVariants = [
    note('black128', '4GB', '128GB', 'Preto'),
    note('gold128', '4GB', '128GB', 'Dourado'),
    note('black256', '4GB', '256GB', 'Preto', 105000),
    note('gold256', '4GB', '256GB', 'Dourado', 105000),
    note('black8', '8GB', '256GB', 'Preto', 120000),
    note('gold8', '8GB', '256GB', 'Dourado', 120000),
];
const shareOptions = {
    product: noteVariants[0], variants: noteVariants, selectedVariantId: null,
    priceForProduct: item => item.price_retail,
    urlForProduct: item => `https://www.mercadodovale.com.br/produto/${item.slug}`,
    paymentFees: [{ channel: 'presencial', installments: 12, applied_fee_pct: 11.9 }],
    pixDiscountPercent: 0,
    cashback: { active: true, coins_per_real: 1 },
};
const beforeShare = JSON.stringify(noteVariants);
const familyShare = generateProductShareMessage(shareOptions);
assert.equal((familyShare.match(/^\d+\. Realme Note 70/gm) || []).length, 3);
for (const configuration of ['4GB/128GB', '4GB/256GB', '8GB/256GB']) assert.ok(familyShare.includes(configuration));
assert.equal((familyShare.match(/Cores: Preto, Dourado/g) || []).length, 3);
for (const price of ['950,00', '1.050,00', '1.200,00', '1.063,05']) assert.ok(familyShare.includes(price));
assert.ok(familyShare.includes('12x de R$\u00a088,59'));
assert.ok(familyShare.includes('Ganhe 1.200 Moedas'));
const selectedShare = generateProductShareMessage({ ...shareOptions, selectedVariantId: 'black128' });
assert.ok(selectedShare.includes('4GB/128GB'));
assert.ok(selectedShare.includes('Cores: Preto'));
assert.ok(selectedShare.includes('/produto/note-70-black128'));
assert.doesNotMatch(selectedShare, /Dourado|4GB\/256GB|8GB\/256GB|note-70-gold/);
const selectedSibling = generateProductShareMessage({ ...shareOptions, selectedVariantId: 'gold8' });
assert.ok(selectedSibling.includes('8GB/256GB'));
assert.ok(selectedSibling.includes('Cores: Dourado'));
assert.ok(selectedSibling.includes('/produto/note-70-gold8'));
assert.doesNotMatch(selectedSibling, /Preto|4GB\/128GB/);
const differingColorPrice = generateProductShareMessage({
    ...shareOptions, variants: [noteVariants[0], { ...noteVariants[1], price_retail: 99000 }],
});
assert.equal((differingColorPrice.match(/^\d+\./gm) || []).length, 2);
assert.doesNotMatch(differingColorPrice, /Cores: Preto, Dourado/);
const unavailable = [
    note('empty', '12GB', '512GB', 'Roxo', 200000, { stock_quantity: 0 }),
    note('hidden', '12GB', '512GB', 'Azul', 200000, { hide_from_catalog: true }),
    note('inactive', '12GB', '512GB', 'Verde', 200000, { status: 'inactive' }),
    note('parent', '12GB', '512GB', 'Branco', 200000, { is_parent: 1 }),
    note('offer', '12GB', '512GB', 'Vermelho', 200000, { offer_type: 'quantity_kit', offer_visibility: 'hidden' }),
];
const filteredShare = generateProductShareMessage({ ...shareOptions, variants: [...noteVariants, ...unavailable] });
assert.doesNotMatch(filteredShare, /Roxo|Azul|Verde|Branco|Vermelho|512GB/);
assert.equal(generateProductShareMessage({ ...shareOptions, variants: [], selectedVariantId: 'missing' }), 'Nenhum produto disponível no momento.');
const discountedShare = generateProductShareMessage({
    ...shareOptions, selectedVariantId: 'black128', priceForProduct: () => 90000,
    pixDiscountPercent: 5, cashback: { active: false },
});
assert.match(discountedShare, /855,00[^\n]+5% de desconto/);
assert.ok(discountedShare.includes('1.007,10'));
assert.doesNotMatch(discountedShare, /Moedas/);
assert.equal(JSON.stringify(noteVariants), beforeShare, 'sharing must not mutate catalog records');
console.log('PDP sharing: selected variation, family memory/price/colors, visibility, payments and cashback: ok');

const cartShare = loadTypeScript('utils/cartShareUtils.ts', {
    '@/services/installmentCalculator': {
        calculateInstallments: async total => Array.from({ length: 13 }, (_, installments) => ({
            installments, total, value: Math.round(total / (installments || 1)),
        })),
        formatPrice: cents => String(cents),
    },
    '@/services/vpsApiService': { vpsApiService: { getProducts: () => { throw new Error('Family budget must use its own catalog options'); } } },
    '@/utils/productSpecUtils': loadTypeScript('utils/productSpecUtils.ts'),
    '@/utils/sharedMessageFormatting': formatting,
});
const quoteProduct = buildCatalogQuoteProduct({
    product: products[0], currentProduct: products[0], currentColorIndex: -1,
    productGroup: { variants: [{ products: [...products, hidden, empty] }] },
});
assert.equal(quoteProduct.name, 'Poco X8 Pró');
assert.equal(quoteProduct.specs.color, undefined);
assert.equal(products[0].specs.color, 'Preto', 'Original catalog data must remain intact');
assert.equal(buildCatalogQuoteProduct({ product: products[0], currentProduct: products[1], currentColorIndex: 1 }), products[1]);
const familyBudget = await cartShare.generateBudgetText([{ product: quoteProduct, unit_price: 266000, quantity: 2 }], {
    expandSiblingVariants: false, includeInstallments: false, includeCalculatorLink: false,
});
assert.match(familyBudget, /Cores: Preto, Branco, Verde, Amarelo/);
assert.match(familyBudget, /Poco X8 Pró \(2x\)/);
assert.ok(!familyBudget.includes('Azul'));
assert.ok(!familyBudget.includes('Roxo'));
const selectedBudget = await cartShare.generateBudgetText([{ product: products[0], unit_price: 266000, quantity: 1 }], {
    expandSiblingVariants: false, includeInstallments: false, includeCalculatorLink: false,
});
assert.match(selectedBudget, /Cores: Preto/);
assert.ok(!selectedBudget.includes('Branco'));
console.log('cart family budget and explicit color selection: ok');

const budgetItems = [{ product: products[0], unit_price: 12000, quantity: 1 }];
const budgetOptions = { expandSiblingVariants: false, includeCalculatorLink: false };
const allInstallments = await cartShare.generateBudgetText(budgetItems, budgetOptions);
assert.equal((allInstallments.match(/x de /g) || []).length, 12);
assert.match(allInstallments, /1️⃣x de 12000 = 12000/);
assert.match(allInstallments, /1️⃣2️⃣x de 1000 = 12000/);
const cardOptions = Array.from({ length: 12 }, (_, index) => ({
    installments: index + 1, monthlyValue: Math.round(6000 / (index + 1)), totalWithFee: 6000, feePercent: 0,
}));
const mixedPaymentState = { cashCents: 6000, cardCents: 6000, selectedInstallment: null, cardOptions };
const withEntry = await cartShare.generateBudgetText(budgetItems, { ...budgetOptions, mixedPaymentState });
assert.equal((withEntry.match(/x de /g) || []).length, 12);
assert.match(withEntry, /Entrada Pix\/Dinheiro: 6000/);
assert.match(withEntry, /1️⃣2️⃣x de 500 = 6000/);
const chosenInstallment = await cartShare.generateBudgetText(budgetItems, {
    ...budgetOptions, mixedPaymentState: { ...mixedPaymentState, selectedInstallment: 3, cardOption: cardOptions[2] },
});
assert.equal((chosenInstallment.match(/x de /g) || []).length, 1);
assert.match(chosenInstallment, /3️⃣x de 2000 = 6000/);
const withoutInstallments = await cartShare.generateBudgetText(budgetItems, { ...budgetOptions, includeInstallments: false });
assert.ok(!withoutInstallments.includes('x de '));
console.log('cart budget installments: all options, selected option, Pix entry and hidden options: ok');
