import assert from 'node:assert/strict';

import {
    buildTelegramDraft,
    pickEditorialCandidates,
} from './marketingEditorialEngine.js';

const products = [
    {
        id: 'p-new',
        name: 'iPhone 15 Pro 256GB',
        category_id: 'smartphones',
        brand: 'Apple',
        price_retail: 799000,
        stock_quantity: 3,
        images: ['https://cdn.example.com/p-new.png'],
        is_new: true,
        discount_percentage: 0,
        views_count: 40,
        created: '2026-04-20T10:00:00.000Z',
        updated: '2026-04-20T10:00:00.000Z',
        specs: { storage: '256GB', ram: '8GB' },
    },
    {
        id: 'p-manual',
        name: 'Galaxy S24 256GB',
        category_id: 'smartphones',
        brand: 'Samsung',
        price_retail: 499000,
        stock_quantity: 12,
        images: ['https://cdn.example.com/p-manual.png'],
        is_new: false,
        discount_percentage: 10,
        views_count: 90,
        created: '2026-04-12T10:00:00.000Z',
        updated: '2026-04-20T09:00:00.000Z',
        specs: { storage: '256GB', ram: '8GB' },
    },
    {
        id: 'p-reserve',
        name: 'Moto Edge 50 256GB',
        category_id: 'smartphones',
        brand: 'Motorola',
        price_retail: 329000,
        stock_quantity: 8,
        images: ['https://cdn.example.com/p-reserve.png'],
        is_new: false,
        discount_percentage: 5,
        views_count: 30,
        created: '2026-04-18T10:00:00.000Z',
        updated: '2026-04-20T08:00:00.000Z',
        specs: { storage: '256GB', ram: '8GB' },
    },
];

const selection = pickEditorialCandidates({
    products,
    dayRule: { mode: 'recentes', categoryId: 'smartphones' },
    manualPicks: [
        { productId: 'p-manual', priority: 1 },
        { productId: 'p-reserve', priority: 2 },
    ],
    cooldownProductIds: [],
    nowIso: '2026-04-21T08:00:00.000Z',
});

assert.equal(selection.primary.id, 'p-manual');
assert.deepEqual(selection.reserves.map((item) => item.id), ['p-reserve', 'p-new']);

const draft = buildTelegramDraft({
    categoryLabel: 'Smartphones',
    dayTheme: 'Mais vendidos / oportunidade',
    selection,
    company: { whatsapp: '(11) 99999-9999', instagram: 'mercadodovale' },
    primaryFormat: 'sticker',
    cta: 'Chame no WhatsApp para fechar agora.',
});

assert.match(draft.summary, /Smartphones/);
assert.match(draft.summary, /Galaxy S24/);
assert.match(draft.instructions, /reserva/i);
assert.match(draft.hashtags, /#MercadoDoVale/i);

const emptySelection = pickEditorialCandidates({
    products: [],
    dayRule: { mode: 'recentes', categoryId: 'smartphones' },
    manualPicks: [],
    cooldownProductIds: [],
    nowIso: '2026-04-21T08:00:00.000Z',
});

assert.equal(emptySelection.primary, null);
assert.deepEqual(emptySelection.reserves, []);

console.log('marketingEditorialEngine.test.mjs: ok');
