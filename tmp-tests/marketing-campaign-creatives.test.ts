import assert from 'node:assert/strict';
import { selectMarketingCampaignCreatives } from '../services/marketingCampaignCreativeService';

const categories = [
    { id: 'phones', name: 'Smartphones' },
    { id: 'audio', name: 'Áudio' },
    { id: 'wear', name: 'Relógios' },
    { id: 'home', name: 'Casa inteligente' },
    { id: 'games', name: 'Games' },
    { id: 'power', name: 'Energia' },
];

const product = (id: string, categoryId: string, modelId: string, stock = 3) => ({
    id,
    category_id: categoryId,
    model_id: modelId,
    model: modelId,
    name: `Produto ${id}`,
    sku: `SKU-${id}`,
    price_retail: 100_00 + Number(id.replace(/\D/g, '') || 0),
    price_cost: 0,
    price_reseller: 0,
    price_wholesale: 0,
    images: [`https://cdn.example.com/${id}.jpg`],
    eans: [],
    specs: {},
    status: 'active',
    track_inventory: true,
    stock_quantity: stock,
    warranty_type: 'brand',
    created: '2026-08-04',
    updated: '2026-08-04',
} as any);

const products = [
    product('p1', 'phones', 'phone-a'),
    product('p2', 'phones', 'phone-a'),
    product('p3', 'phones', 'phone-b'),
    product('p4', 'phones', 'phone-c'),
    product('p5', 'phones', 'phone-d'),
    product('p6', 'phones', 'phone-e'),
    product('a1', 'audio', 'audio-a'),
    product('w1', 'wear', 'wear-a'),
    product('h1', 'home', 'home-a'),
    product('g1', 'games', 'games-a'),
    product('e1', 'power', 'power-a'),
    product('bad-stock', 'audio', 'bad', 0),
];

const first = selectMarketingCampaignCreatives(products, categories, '2026-08-04');
const repeated = selectMarketingCampaignCreatives(products, categories, '2026-08-04');

assert.equal(first.storeCarousel.length, 5);
assert.equal(new Set(first.storeCarousel.map((card) => card.categoryId)).size, 5);
assert.equal(first.smartphoneCarousel.length, 5);
assert.equal(new Set(first.smartphoneCarousel.map((card) => card.productId)).size, 5);
assert.ok(first.smartphoneCarousel.every((card) => card.categoryId === 'phones'));
assert.ok([...first.storeCarousel, ...first.smartphoneCarousel].every((card) => card.stock > 0 && card.imageUrl.startsWith('https://')));
assert.deepEqual(first.storeCarousel.map((card) => card.productId), repeated.storeCarousel.map((card) => card.productId));
assert.match(first.smartphoneCarousel[0].whatsappMessage, /smartphone: .* \| Codigo: SKU-/);

console.log('marketing campaign creative selection: OK');
