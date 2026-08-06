import assert from 'node:assert/strict';

import {
  buildStatusCaption,
  buildStatusPayload,
  buildStatusSendDebug,
  clampDailyProductLimit,
  getStatusProductImage,
  getStatusProductVariation,
  groupStatusProductsByVariation,
  resolveScheduledSendTimes,
  selectStatusProducts,
} from '../services/whatsappStatusCampaignHelper.js';

const products = Array.from({ length: 12 }, (_, index) => ({
  id: `p-${index + 1}`,
  name: `Produto ${index + 1}`,
  slug: `produto-${index + 1}`,
  price_retail: 100000 + index * 1000,
  stock_quantity: 2,
  images: [`https://cdn.example.com/p-${index + 1}.jpg`],
  marketing_background_url: `https://cdn.example.com/marketing-p-${index + 1}.png`,
}));

assert.equal(clampDailyProductLimit(99), 10);
assert.equal(clampDailyProductLimit(0), 1);
assert.equal(clampDailyProductLimit(4), 4);

assert.deepEqual(
  resolveScheduledSendTimes({ startTime: '08:00', count: 4, intervalMinutes: 30 }),
  ['08:00', '08:30', '09:00', '09:30'],
);

assert.deepEqual(
  selectStatusProducts(products, { dailyLimit: 99, lastProductId: 'p-2' }).map((product) => product.id),
  ['p-3', 'p-4', 'p-5', 'p-6', 'p-7', 'p-8', 'p-9', 'p-10', 'p-11', 'p-12'],
);

const variantProducts = [
  {
    id: 'x8-blue',
    model_id: 'model-x8-pro',
    name: 'Poco X8 Pro 5G',
    slug: 'poco-x8-pro-5g-azul',
    sku: 'PX85G8512A',
    price_retail: 250000,
    stock_quantity: 2,
    images: ['https://cdn.example.com/azul.jpg'],
    marketing_background_url: 'https://cdn.example.com/marketing-azul.png',
    specs: { ram: '8GB', storage: '512GB', color: 'Azul' },
  },
  {
    id: 'x8-black',
    model_id: 'model-x8-pro',
    name: 'Poco X8 Pro 5G',
    slug: 'poco-x8-pro-5g-preto',
    sku: 'PX85G8512P',
    price_retail: 245000,
    stock_quantity: 3,
    images: ['https://cdn.example.com/preto.jpg'],
    marketing_background_url: 'https://cdn.example.com/marketing-preto.png',
    specs: { ram: '8GB', storage: '512GB', color: 'Preto' },
  },
  {
    id: 'x8-green',
    model_id: 'model-x8-pro',
    name: 'Poco X8 Pro 5G',
    slug: 'poco-x8-pro-5g-verde',
    sku: 'PX85G8512V',
    price_retail: 255000,
    stock_quantity: 1,
    images: ['https://cdn.example.com/verde.jpg'],
    marketing_background_url: 'https://cdn.example.com/marketing-verde.png',
    specs: { ram: '8GB', storage: '512GB', color: 'Verde' },
  },
  {
    id: 'x8-256',
    model_id: 'model-x8-pro',
    name: 'Poco X8 Pro 5G',
    slug: 'poco-x8-pro-5g-256-preto',
    sku: 'PX85G8256P',
    price_retail: 230000,
    stock_quantity: 2,
    images: ['https://cdn.example.com/preto-256.jpg'],
    marketing_background_url: 'https://cdn.example.com/marketing-preto-256.png',
    specs: { ram: '8GB', storage: '256GB', color: 'Preto' },
  },
];

assert.deepEqual(
  getStatusProductVariation(variantProducts[0]),
  { ram: '8GB', storage: '512GB', color: 'Azul' },
);

const groupedVariants = groupStatusProductsByVariation(variantProducts);
assert.equal(groupedVariants.length, 2);
assert.deepEqual(
  groupedVariants.find((product) => product.status_variation.storage === '512GB')?.status_variation.colors,
  ['Azul', 'Preto', 'Verde'],
);
assert.equal(
  groupedVariants.find((product) => product.status_variation.storage === '512GB')?.images[0],
  'https://cdn.example.com/azul.jpg',
);

const selectedVariants = selectStatusProducts(variantProducts, { dailyLimit: 10 });
assert.equal(selectedVariants.length, 2);

const groupedCaption = buildStatusCaption({
  product: selectedVariants.find((product) => product.status_variation.storage === '512GB'),
  siteBaseUrl: 'https://mercadodovale.com.br',
});

assert.match(groupedCaption, /Poco X8 Pro 5G/);
assert.match(groupedCaption, /Memoria: 8GB RAM \+ 512GB armazenamento/);
assert.match(groupedCaption, /Cores disponiveis: Azul, Preto, Verde/);
assert.match(groupedCaption, /Confira os detalhes e as condicoes na arte/);
assert.doesNotMatch(groupedCaption, /PIX|Cartao|R\$/);

const caption = buildStatusCaption({
  product: products[0],
  siteBaseUrl: 'https://mercadodovale.com.br',
});

assert.match(caption, /Produto 1/);
assert.doesNotMatch(caption, /PIX|Cartao|R\$/);
assert.match(caption, /https:\/\/mercadodovale\.com\.br\/produto\/produto-1/);

assert.deepEqual(
  buildStatusPayload({
    product: products[0],
    caption,
  }),
  {
    type: 'image',
    content: 'https://cdn.example.com/marketing-p-1.png',
    caption,
    allContacts: false,
    statusJidList: [],
  },
);

const imageUrlOnlyProduct = {
  id: 'image-url-only',
  name: 'Produto com image_url',
  slug: 'produto-com-image-url',
  price_retail: 200000,
  stock_quantity: 1,
  image_url: 'https://cdn.example.com/image-url-only.jpg',
};

assert.equal(getStatusProductImage(imageUrlOnlyProduct), '');
assert.equal(selectStatusProducts([imageUrlOnlyProduct], { dailyLimit: 1 }).length, 0);

const marketingImageProduct = {
  ...imageUrlOnlyProduct,
  marketing_background_url: 'https://cdn.example.com/status-art.png',
};

assert.equal(getStatusProductImage(marketingImageProduct), 'https://cdn.example.com/status-art.png');
assert.equal(selectStatusProducts([marketingImageProduct], { dailyLimit: 1 }).length, 1);
assert.equal(
  buildStatusPayload({
    product: marketingImageProduct,
    caption,
  }).content,
  'https://cdn.example.com/status-art.png',
);

const debug = buildStatusSendDebug({
  campaign: { id: 'c-1', title: 'Campanha Celulares' },
  product: products[0],
  endpoint: 'https://bot.mercadodovale.com.br/message/sendStatus/botmercadodovale',
  httpStatus: 500,
  errorMessage: 'apikey: segredo-super-secreto falhou',
});

assert.match(debug, /WHATSAPP_STATUS_SEND_DEBUG/);
assert.match(debug, /Campanha Celulares/);
assert.match(debug, /Produto 1/);
assert.match(debug, /HTTP: 500/);
assert.doesNotMatch(debug, /segredo-super-secreto/);
assert.match(debug, /apikey:\s*\[redacted\]/);

console.log('whatsapp-status-campaign-helper.test.mjs: ok');
