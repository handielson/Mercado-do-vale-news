const assert = require('node:assert/strict');
const { patchWorkflow, runSelfTest, MARKER } = require('./n8n-fix-memory-context-confirmation.cjs');

const nodes = [
  { name: 'Agente Geral - Atendimento', parameters: { options: { systemMessage: 'Prompt atual' } } },
  { name: 'Dividir mensagens', parameters: { jsCode: `const currentGreeting = 'Boa tarde';
const normalizeGreetingPeriod = (value) => String(value || '');
const normalizeContinuationGreeting = (value) => {
  const normalized = normalizeGreetingPeriod(value);
  return normalized;
};
return normalizeContinuationGreeting($json.value);` } },
  { name: 'Vendas - Verificar Pos Lista', parameters: { jsCode: `const source = $json;
const normalized = String(source.conversation || '').toLowerCase();
const aiAction = source.salesFlowAction;
const aiColor = source.requestedColor || '';
const aiSelectedNumber = Number(source.salesFlowItemNumber || 0);
const wantsPhoto = false;
const wantsPhotoFromAI = aiAction === 'pedir_foto';
const normalize = (value) => String(value || '').toLowerCase();
const withGreeting = (value) => value;
const classifiedQuery = String(source.salesSearchQuery || '').trim();
async function buildPhotoMessages(item, selectedOption) { return [item.blueprintImageUrl, ...(item.images || []).slice(0, 1)].filter(Boolean).map((mediaUrl) => ({ type: 'image', mediaUrl })); }
async function recoverPhotoWithoutListState() {
  const SMARTPHONES_CATEGORY_ID_V289 = '8b7c4852-c195-4527-8fd7-c3cc2debda42';
  const recentText = [source.conversationHistory, ...(Array.isArray(source.recentMessages) ? source.recentMessages.map((item) => item?.text) : [])].filter(Boolean).join(' ');
  const productLinks = [...recentText.matchAll(new RegExp('https://mercadodovale[.]com[.]br/produto/([a-z0-9-]+)', 'gi'))];
  const recentSlug = productLinks.length ? productLinks.at(-1)[1] : '';
  const previousOutbound = [...(Array.isArray(source.recentMessages) ? source.recentMessages : [])].reverse()
    .find((item) => String(item?.direction || '') === 'outbound');
  const followsPhotoNumberPrompt = false;
  const historyProductSku = followsPhotoNumberPrompt && recentSlug.includes('-') ? recentSlug.split('-').pop().toUpperCase() : '';
  const requestedColor = normalize(aiColor);
  const ignoredWords = new Set(['foto', 'fotos', 'imagem', 'imagens', 'video', 'videos', 'dele', 'dela', requestedColor].filter(Boolean));
  const searchWords = normalize(classifiedQuery).split(/\\s+/).filter((word) => word && !ignoredWords.has(word));
  if (!historyProductSku && searchWords.length === 0) return [];
  const requestUrl = historyProductSku ? 'sku=' + historyProductSku : 'https://api.xiaomipetrolina.com.br/products?status=active&compact=true&limit=20&category_id=' + encodeURIComponent(SMARTPHONES_CATEGORY_ID_V289) + '&search=' + encodeURIComponent(searchWords.join(' '));
  const products = await helpers.httpRequest({ url: requestUrl });
  const candidates = products.filter((product) => {
    if (!historyProductSku && String(product?.category_id || '') !== SMARTPHONES_CATEGORY_ID_V289) return false;
      const productColor = normalize(product?.specs?.color || product?.specs?.cor || product?.color);
      if (requestedColor && productColor !== requestedColor) return false;
    const haystack = normalize([product?.name, product?.sku, ...(Array.isArray(product?.specs?.keywords) ? product.specs.keywords : [])].join(' '));
    return historyProductSku || searchWords.every((word) => haystack.includes(word));
  });
  if (candidates.length !== 1) return [];
  const product = candidates[0];
  const images = product.images || [];
  const blueprintImageUrlV309 = product.blueprint_image_url;
  const recoveredVariant = { productId: product.id, sku: product.sku, color: product.specs.color, images, blueprintImageUrl: blueprintImageUrlV309 };
  const recoveredOption = { number: aiSelectedNumber || 0, name: product?.name || classifiedQuery || 'Produto', memory: '', url: '' };
  return await buildPhotoMessages(recoveredVariant, recoveredOption);
}
if (wantsPhoto || wantsPhotoFromAI) {
  const recoveredPhotoMessages = await recoverPhotoWithoutListState();
  if (recoveredPhotoMessages.length > 0) return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: 'photo_recovered_without_list', messages: recoveredPhotoMessages } }];
}
return [{ json: source }];` } },
];

const patched = patchWorkflow(nodes);
const patchedAgain = patchWorkflow(patched);
assert.deepEqual(patchedAgain, patched, 'workflow patch must be idempotent');
assert.match(patched[0].parameters.options.systemMessage, new RegExp(MARKER));
assert.match(patched[1].parameters.jsCode, /collapseRepeatedPeriodGreetingV319/);
assert.match(patched[2].parameters.jsCode, /affirmativePhotoConfirmationV319/);
const normalizeGreeting = new Function('$json', patched[1].parameters.jsCode);
assert.equal(normalizeGreeting({ value: 'Boa tarde Handielson, boa tarde! 😊' }), 'Boa tarde Handielson! 😊');
assert.equal(normalizeGreeting({ value: 'Boa tarde Handielson, como posso ajudar?' }), 'Boa tarde Handielson, como posso ajudar?');

runSelfTest(patched)
  .then((result) => {
    assert.equal(result.confirmationRecovered, true);
    assert.equal(result.blueprintFirst, true);
    console.log('ok - greeting context and affirmative photo confirmation regression');
  })
  .catch((error) => { console.error(error.stack || error.message); process.exit(1); });
