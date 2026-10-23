'use strict';

const assert = require('node:assert/strict');

const NODE_NAME = 'Vendas - Verificar Pos Lista';
const PARSER_NAME = 'Parse Classificacao';
const MARKER = 'photo-multi-model-query-0642-v1';
const CATEGORY_ID = '8b7c4852-c195-4527-8fd7-c3cc2debda42';

function replaceOnce(code, before, after) {
  assert.equal(code.split(before).length, 2, `Photo recovery anchor changed: ${before.slice(0, 70)}`);
  return code.replace(before, after);
}

function patchCode(input) {
  let code = String(input || '');
  if (code.includes(MARKER)) return code;
  const oldSearch = `  const searchWords = normalize(effectiveQueryV319).split(/\\s+/).filter((word) => word && !ignoredWords.has(word));
  if (!historyProductSku && searchWords.length === 0) return [];
  try {
    const requestUrl = historyProductSku
      ? 'https://api.xiaomipetrolina.com.br/products?status=active&compact=true&limit=1&sku=' + encodeURIComponent(historyProductSku)
      : 'https://api.xiaomipetrolina.com.br/products?status=active&compact=true&limit=20&category_id=' + encodeURIComponent(SMARTPHONES_CATEGORY_ID_V289) + '&search=' + encodeURIComponent(searchWords.join(' '));
    const payload = await helpers.httpRequest({ method: 'GET', url: requestUrl, headers: { Accept: 'application/json' }, json: true, timeout: 8000 });
    const products = Array.isArray(payload) ? payload : (Array.isArray(payload?.rows) ? payload.rows : []);`;
  const newSearch = `  // ${MARKER}: the API accepts category, and searches each named model as one phrase.
  const normalizedPhotoQueryV421 = normalize(effectiveQueryV319);
  const brandMatchV421 = normalizedPhotoQueryV421.match(/^(poco|redmi|xiaomi|realme|samsung|motorola|moto|infinix|tecno)\\b/);
  const partsV421 = normalizedPhotoQueryV421.split(/\\s+(?:e|ou)\\s+(?=(?:(?:poco|redmi|xiaomi|realme|samsung|motorola|moto|infinix|tecno)\\s+)?[a-z]?\\d)/);
  const modelQueriesV421 = [...new Set(partsV421.map((partV421, indexV421) => {
    const withBrandV421 = indexV421 > 0 && brandMatchV421
      && !/^(?:poco|redmi|xiaomi|realme|samsung|motorola|moto|infinix|tecno)\\b/.test(partV421)
      ? brandMatchV421[1] + ' ' + partV421 : partV421;
    return normalize(withBrandV421).split(/\\s+/).filter((wordV421) => wordV421 && !ignoredWords.has(wordV421)).join(' ');
  }).filter(Boolean))];
  const genericBrandV421 = /^(?:poco|redmi|xiaomi|realme|samsung|motorola|moto|infinix|tecno)s?$/.test(normalizedPhotoQueryV421);
  if (!historyProductSku && modelQueriesV421.length === 0) return [];
  if (modelQueriesV421.length > 3) return [{ type: 'text', text: withGreeting('Posso enviar fotos de até 3 modelos por vez. Quais você quer ver primeiro? 😊') }];
  try {
    const products = [];
    const queriesV421 = historyProductSku ? [''] : modelQueriesV421;
    for (const queryV421 of queriesV421) {
      const requestUrlV421 = historyProductSku
        ? 'https://api.xiaomipetrolina.com.br/products?status=active&compact=true&limit=1&sku=' + encodeURIComponent(historyProductSku)
        : 'https://api.xiaomipetrolina.com.br/products?status=active&compact=true&limit=200&category=' + encodeURIComponent(SMARTPHONES_CATEGORY_ID_V289) + '&search=' + encodeURIComponent(queryV421);
      const payloadV421 = await helpers.httpRequest({ method: 'GET', url: requestUrlV421, headers: { Accept: 'application/json' }, json: true, timeout: 8000 });
      const rowsV421 = Array.isArray(payloadV421) ? payloadV421 : (Array.isArray(payloadV421?.rows) ? payloadV421.rows : []);
      products.push(...rowsV421);
    }`;
  code = replaceOnce(code, oldSearch, newSearch);
  code = replaceOnce(code,
    `      return historyProductSku || searchWords.every((word) => haystack.includes(word));`,
    `      return historyProductSku || modelQueriesV421.some((queryV421) => queryV421.split(/\\s+/).every((wordV421) => haystack.includes(wordV421)));`);
  code = replaceOnce(code,
    `      if (candidates.length === 0) return [];\n      const configurationGroupsV344 = new Map();`,
    `      const missingModelQueriesV421 = historyProductSku || genericBrandV421 ? [] : modelQueriesV421.filter((queryV421) => !candidates.some((productV421) => {\n        const haystackV421 = normalize([productV421?.name, productV421?.sku, ...(Array.isArray(productV421?.specs?.keywords) ? productV421.specs.keywords : [])].join(' '));\n        return queryV421.split(/\\s+/).every((wordV421) => haystackV421.includes(wordV421));\n      }));\n      if (candidates.length === 0) return missingModelQueriesV421.length > 1\n        ? [{ type: 'text', text: withGreeting('Não consegui confirmar as fotos de ' + missingModelQueriesV421.join(' e ') + ' agora. Vou conferir esses modelos; você procura alguma memória ou cor específica? 😊') }]\n        : [];\n      if (genericBrandV421) {\n        const namesV421 = [...new Set(candidates.map((productV421) => String(productV421?.name || '').trim()).filter(Boolean))].slice(0, 12);\n        return [{ type: 'text', text: withGreeting('Tenho fotos de vários modelos ' + brandMatchV421[1].toUpperCase() + '. Qual deles você quer ver? ' + namesV421.join(', ') + '. Posso enviar até 3 modelos por vez. 😊') }];\n      }\n      const configurationGroupsV344 = new Map();`);
  code = replaceOnce(code, `      const configurationGroupsV344 = new Map();`,
    `      // photo-card-quote-0642-v1: one current presencial 12x fee for this reply, never infer a fee.
      let selectedCardFeeV421 = null;
      try {
        const feePayloadV421 = await helpers.httpRequest({ method: 'GET',
          url: 'https://api.xiaomipetrolina.com.br/payment-fees',
          headers: { Accept: 'application/json' }, json: true, timeout: 8000 });
        const feeRowsV421 = Array.isArray(feePayloadV421) ? feePayloadV421 : [];
        selectedCardFeeV421 = feeRowsV421
          .filter((feeV421) => String(feeV421?.channel || '') === 'presencial' && Number(feeV421?.installments) === 12)
          .filter((feeV421) => feeV421?.applied_fee_pct !== null && feeV421?.applied_fee_pct !== undefined
            && Number.isFinite(Number(feeV421.applied_fee_pct)) && Number(feeV421.applied_fee_pct) >= 0)
          .sort((aV421, bV421) => Number(aV421.applied_fee_pct) - Number(bV421.applied_fee_pct))[0] || null;
      } catch (error) { selectedCardFeeV421 = null; }
      const formatPriceV421 = (centsV421) => 'R$ ' + (centsV421 / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const configurationGroupsV344 = new Map();`);
  code = replaceOnce(code,
    `        const priceV344 = priceCentsV344 > 0
          ? 'R$ ' + (priceCentsV344 / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' no PIX'
          : '';
        const summaryV344 = [String(firstV344?.name || effectiveQueryV319 || 'Modelo'), memoryV344, priceV344].filter(Boolean).join(' - ')
          + (colorsV344.length ? '. Cores disponíveis: ' + colorsV344.join(', ') + '.' : '.');`,
    `        const verifiedCardQuoteV421 = selectedCardFeeV421 && Number.isSafeInteger(priceCentsV344) && priceCentsV344 > 0;
        const cardTotalCentsV421 = verifiedCardQuoteV421
          ? Math.round(priceCentsV344 * (1 + Number(selectedCardFeeV421.applied_fee_pct) / 100)) : 0;
        const cardInstallmentCentsV421 = verifiedCardQuoteV421 ? Math.round(cardTotalCentsV421 / 12) : 0;
        const summaryV344 = [
          String(firstV344?.name || effectiveQueryV319 || 'Modelo'),
          memoryV344 ? '📱 ' + memoryV344 : '',
          verifiedCardQuoteV421 ? '💰 ' + formatPriceV421(priceCentsV344) + ' à vista no PIX' : '',
          verifiedCardQuoteV421 ? '💳 Cartão: 12x de ' + formatPriceV421(cardInstallmentCentsV421) + ' (total ' + formatPriceV421(cardTotalCentsV421) + ')' : '',
          colorsV344.length ? '🎨 Cores: ' + colorsV344.join(', ') : '',
        ].filter(Boolean).join('\\n');`);
  code = replaceOnce(code,
    `      return recoveredMessagesV344;\n  } catch (error) {`,
    `      if (missingModelQueriesV421.length > 0) recoveredMessagesV344.push({\n        type: 'text', text: 'Não consegui confirmar as fotos de ' + missingModelQueriesV421.join(' e ') + ' agora. Vou conferir esse modelo para você. 😊',\n      });\n      return recoveredMessagesV344;\n  } catch (error) {`);
  code = replaceOnce(code,
    `          output: withGreeting(String(source.salesSearchQuery || '').trim()\n            ? 'Nao encontrei esse modelo disponivel no estoque agora. Posso te enviar a lista dos celulares disponiveis.'\n            : 'Consigo te mandar a foto sim 😊 Me informa qual modelo voce quer ver.'),`,
    `          output: withGreeting(String(source.salesSearchQuery || '').trim()\n            ? 'Não consegui confirmar as fotos desse modelo agora. Me diga a memória e a cor que você procura para eu conferir. 😊'\n            : 'Consigo te mandar a foto sim 😊 Me informa qual modelo voce quer ver.'),`);
  new Function('$json', '$input', '$getWorkflowStaticData', '$', '$env', 'helpers', code);
  return code;
}

function patchParserCode(input) {
  let code = String(input || '');
  if (code.includes('photo-vs-delivery-intent-0642-v1')) return code;
  code = replaceOnce(code,
    `const deliveryFreightIntentV337 = deliveryTermsV337 && !explicitPaymentTermsV337;`,
    `// photo-vs-delivery-intent-0642-v1: "enviar fotos" is a sales/media request, not freight.\nconst transportTermsV421 = /\\b(?:entreg(?:a|as|ar|am|amos|ando|ue|ues)|frete|fretes|motoboy|motoboys|retir(?:ada|adas|ar|am|amos|ando)|delivery)\\b/.test(deliveryIntentNormalizedV337);\nconst mediaTermsV421 = /\\b(?:foto|fotos|imagem|imagens|video|videos|ficha|link)\\b/.test(deliveryIntentNormalizedV337);\nconst sendProductTermsV421 = /\\b(?:pedido|compra|produto|aparelho|celular|mercadoria)\\b/.test(deliveryIntentNormalizedV337);\nconst deliveryFreightIntentV337 = (transportTermsV421 || (deliveryTermsV337 && sendProductTermsV421 && !mediaTermsV421))\n  && !explicitPaymentTermsV337;`);
  new Function('$json', '$', code);
  return code;
}

function patchWorkflow(input) {
  const workflow = structuredClone(input);
  const photoNodes = workflow.nodes.filter(node => node.name === NODE_NAME);
  const parserNodes = workflow.nodes.filter(node => node.name === PARSER_NAME);
  assert.equal(photoNodes.length, 1, `Expected one ${NODE_NAME} node`);
  assert.equal(parserNodes.length, 1, `Expected one ${PARSER_NAME} node`);
  photoNodes[0].parameters.jsCode = patchCode(photoNodes[0].parameters.jsCode);
  parserNodes[0].parameters.jsCode = patchParserCode(parserNodes[0].parameters.jsCode);
  return workflow;
}

module.exports = { patchCode, patchParserCode, patchWorkflow, NODE_NAME, PARSER_NAME, MARKER, CATEGORY_ID };
