import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { patchContext, patchPostList, summarize } = require('./n8n-simplify-phone-catalog-links.cjs');

const contextFixture = `
const normalizeKey = (value) => String(value).toLowerCase();
const isQuoteDeviceProduct = () => true;
// product-variation-numbering-v229
const quoteProductGroupKey = (product) => [
  'product',
  normalizeKey(product.name),
  normalizeKey(product.memory),
  product.priceCents,
].join('|');
const quoteBrandGroupV227 = () => ({ label: 'POCO', rank: 1 });
const toNumber = Number;
const mergeQuoteProducts = (items) => items;
const rawProducts = [];
const prefersSmartphones = true;
const products = mergeQuoteProducts(rawProducts).sort((a, b) => {
  if (!prefersSmartphones) return 0;
  const ga = quoteBrandGroupV227(a);
  const gb = quoteBrandGroupV227(b);
  return ga.rank - gb.rank || ga.label.localeCompare(gb.label, 'pt-BR') || toNumber(a.priceCents) - toNumber(b.priceCents);
});
const quoteLines = [];
const chunkLines = [];
products.forEach((product) => {
  const details = [
    product.url ? 'Link: ' + product.url : '',
  ];
  if (product.url) quoteLines.push('   🔗 ' + product.url);
  if (product.url) chunkLines.push('   🔗 ' + product.url);
});
`;

const postListFixture = `
return (() => {
const source = $json;
const normalize = (value) => String(value || '').toLowerCase();
const text = String(source.conversation || source.text || '').trim();
const normalized = normalize(text);
const wantsPhoto = /\\b(foto|fotos|imagem|imagens|manda foto|ver foto|mostrar foto)\\b/.test(normalized);
const numberMatch = normalized.match(/\\b(?:opcao|opcao numero|numero|n|produto|item|do|da)?\\s*(\\d{1,3})\\b/);
const hasOrderDraft = true;
const isQuantityStep = hasOrderDraft && ['awaiting_quantity', 'awaiting_photo_confirmation'].includes(String(activeState?.step || ''));
const requestedQuantity = 0;
const aiExplicitListNumber = 0;
const aiUsesCurrentSelection = false;
const selectedNumber = requestedQuantity
  ? Number(activeState?.selectedOptionNumber || 0)
  : (aiExplicitListNumber || (aiUsesCurrentSelection ? Number(activeState?.selectedOptionNumber || 0) : 0));
const wantsPhotoFromAI = false;
const mentionedColor = '';
if (!selectedNumber && !wantsPhoto && !wantsPhotoFromAI && !mentionedColor) return [];
if (activeState?.step === 'awaiting_fulfillment') {
  return [];
}
const option = activeState.options.find((item) => Number(item.number) === selectedNumber);
const uniqueColorItems = (items) => items;
const optionColorItems = uniqueColorItems(option?.colors || []);
const allColors = optionColorItems.map((item) => item.color);
const titleCase = (value) => value;
const joinPt = (values) => values.join(' e ');
const lineBreak = '[[BR]]';
const withGreeting = (value) => value;
if (!option) {
  return [{ json: {} }];
}
const askColor = () => {
  activeState.step = 'awaiting_color';
  activeState.selectedOptionNumber = option.number;
  activeState.updatedAt = new Date(now).toISOString();
  const colorsText = joinPt(allColors.map(titleCase));
  return [{ json: { output: withGreeting('Perfeito 😊 Temos ' + colorsText + '. Qual cor voce prefere?') } }];
};
const draftLines = [
  draft.url ? 'Link: ' + draft.url : '',
];
const buildPhotoMessages = (item) => {
  const productUrl = item.url || option.url || '';
  const linkText = productUrl ? 'No link tem mais fotos, video e as caracteristicas dele: ' + productUrl : '';
  if (!item.images?.length) return [{ type: 'text', text: 'Ainda nao tenho foto cadastrada dessa cor. ' + (linkText || 'Esse produto esta sem link cadastrado no momento.') }];
  return [...[linkText].filter(Boolean).map((text) => ({ type: 'text', text }))];
};
const buildAllPhotoMessages = () => {
  const linkText = option.url ? 'No link tem mais fotos, video e as caracteristicas dele: ' + option.url : '';
  const messages = [];
  const sentImages = false;
  if (!sentImages) {
    messages.push({ type: 'text', text: linkText || 'Ainda nao tenho foto cadastrada dessas cores.', delayMs: 1200 });
  } else if (linkText) {
    messages.push({ type: 'text', text: linkText, delayMs: 1200 + messages.length * 4500 });
  }
  return messages;
};
const variant = { color: 'preto' };
activeState.step = 'awaiting_quantity';
activeState.selectedOptionNumber = option.number;
activeState.selectedColor = variant.color;
activeState.orderDraft = buildOrderDraft(variant);
const finalResult = {
  output: withGreeting('Perfeito 😊 Separei o ' + option.name + (option.memory ? ' ' + option.memory : '') + ' na cor ' + titleCase(variant.color) + '.' + lineBreak + 'Quantas unidades voce deseja?'),
};
return [];
})();
`;

const context = patchContext(contextFixture);
const postList = patchPostList(postListFixture);
const result = summarize(context, postList);

assert.deepEqual(result, {
  modelGrouping: true,
  variationNumberingPreserved: true,
  initialLinksRemoved: true,
  explicitLinkRequest: true,
  selectedNumberSendsLink: true,
  defaultsToOneUnit: true,
  noRepeatedSelectionSummary: true,
  orderSummaryLinksRemoved: true,
});

const groupKey = (product) => ['product', product.name.toLowerCase(), product.memory.toLowerCase(), product.priceCents].join('|');
assert.notEqual(
  groupKey({ name: 'Poco C85', memory: '6GB/128GB', priceCents: 90000 }),
  groupKey({ name: 'Poco C85', memory: '8GB/256GB', priceCents: 110000 }),
  'each memory and price variation must retain its own list number',
);
assert.match(context, /normalizeKey\(a\.name\)\.localeCompare\(normalizeKey\(b\.name\)/, 'same-model variations must be adjacent');
assert.match(postList, /wantsProductLink/);
assert.match(postList, /Aqui está o link do/);
assert.match(postList, /selectedOptionSummaryV245/);
assert.match(postList, /📱/);
assert.match(postList, /🎨 Cores:/);
assert.match(postList, /Veja fotos, vídeos e mais detalhes neste link:/);
assert.match(postList, /selectedOptionSummaryV245[\s\S]*Qual cor voce prefere/);
assert.match(postList, /selectedOptionSummaryV245[\s\S]*Voce prefere retirada na loja ou entrega/);
assert.match(postList, /quantity: 1/);
assert.match(postList, /Atualizei para/);
assert.match(postList, /awaiting_photo_confirmation', 'awaiting_fulfillment/);
assert.match(postList, /selectedOptionSummarySentV245 = true/);
assert.match(postList, /pendingSelectedOptionSummaryV245/);
assert.doesNotMatch(postList, /selectedOptionSummaryV245[\s\S]*Quantas unidades voce deseja/);
assert.doesNotMatch(postList, /selectedOptionSummaryV245, 'Perfeito 😊 Temos '/);
assert.doesNotMatch(postList, /selectedOptionSummaryV245, 'Perfeito 😊 Separei o '/);

console.log('n8n phone catalog grouping and link regression test passed');
