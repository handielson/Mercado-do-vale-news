'use strict';

const assert = require('node:assert/strict');

const MARK = 'sales-option-color-photos-v1';
const NODES = ['Vendas - Verificar Pos Lista'];

function once(code, anchor, replacement) {
  assert.equal(code.split(anchor).length - 1, 1, 'Âncora alterada: ' + anchor.slice(0, 85));
  return code.replace(anchor, () => replacement);
}

function patchWorkflow(workflow) {
  const next = structuredClone(workflow);
  const matches = next.nodes.filter(node => node.name === NODES[0]);
  assert.equal(matches.length, 1, 'Nó de pós-lista ausente ou duplicado');
  const parameters = matches[0].parameters;
  let code = parameters.jsCode;
  if (code.includes(MARK)) return next;
  assert.ok(code.includes('sales-price-revalidate-v1'), 'Recotação da opção ausente');

  const askStart = 'const askColor = () => {';
  const askEnd = '\n\nif (mentionedColor && !selectedVariant) {';
  assert.equal(code.split(askStart).length - 1, 1);
  assert.equal(code.split(askEnd).length - 1, 1);
  const original = code.slice(code.indexOf(askStart), code.indexOf(askEnd));
  assert.ok(original.includes("output: withGreeting([pendingSelectedOptionSummaryV245, 'Qual cor voce prefere? 😊']"));
  code = once(code, original, [
    '// ' + MARK,
    'const askColor = async () => {',
    "  activeState.step = 'awaiting_color';",
    '  activeState.selectedOptionNumber = option.number;',
    '  activeState.updatedAt = new Date(now).toISOString();',
    '  activeState.selectedOptionSummarySentV245 = true;',
    "  const question = 'Qual cor você prefere? 😊';",
    '  const summary = pendingSelectedOptionSummaryV245;',
    '  const output = withGreeting([summary, question].filter(Boolean).join("[[MSG]]"));',
    '  const result = { ...source, salesPostListHandled: true, salesPostListStep: "awaiting_color", output };',
    '  if (!summary || mentionedColor || optionColorItems.length < 2) return [{ json: result }];',
    '  const photos = optionColorItems.length <= 6',
    '    ? await Promise.all(optionColorItems.map(item => buildOptionColorMessage(item, option.name))) : [];',
    '  const messages = [',
    '    { type: "text", text: withGreeting(summary).split("[[MSG]]").join(lineBreak + lineBreak) },',
    '    ...photos,',
    '    { type: "text", text: question },',
    '  ];',
    '  return [{ json: { ...result, messages, specificProductBlueprintMedia: null } }];',
    '};',
  ].join('\n'));

  // The ordinary one-color path selects the variant immediately. Keep its draft
  // and purchase question, but let the splitter send the question separately.
  const single = "output: withGreeting([pendingSelectedOptionSummaryV245, 'Voce quer comprar este modelo? Se quiser, me confirme por aqui. 😊'].filter(Boolean).join(lineBreak + lineBreak)),";
  code = once(code, single, [
    'output: uniqueColorItems(rawOptionExactV1?.colors || []).length === 1 && pendingSelectedOptionSummaryV245',
    '      ? [withGreeting(pendingSelectedOptionSummaryV245).split("[[MSG]]").join(lineBreak + lineBreak),',
    "          'Voce quer comprar este modelo? Se quiser, me confirme por aqui. 😊'].join('[[MSG]]')",
    '      : ' + single.slice('output: '.length),
  ].join('\n'));

  // Use the SKU lookup already used for photo requests. Only the raw variant
  // gallery can prove ownership, because the cached images mix in model photos.
  const hydrate = 'async function hydratePhotoItem(item) {';
  code = once(code, hydrate, 'async function hydratePhotoItem(item, ownOnly = false) {');
  code = once(code,
    'if (currentImages.length > 0 && currentBlueprintImageUrlV320) {',
    'if (!ownOnly && currentImages.length > 0 && currentBlueprintImageUrlV320) {');
  const missingSku = 'if (!sku) return { ...item, images: currentImages, blueprintImageUrl: currentBlueprintImageUrlV320 };';
  code = once(code, missingSku, 'if (!sku && !(ownOnly && item?.productId)) return { ...item, images: ownOnly ? [] : currentImages, blueprintImageUrl: currentBlueprintImageUrlV320 };');
  const skuLookup = [
    '// photo-http-helper-v285',
    '    const payload = await helpers.httpRequest({',
    "      method: 'GET',",
    "      url: 'https://api.xiaomipetrolina.com.br/products?status=active&compact=true&limit=1&sku=' + encodeURIComponent(sku),",
    "      headers: { Accept: 'application/json' },",
    '      json: true,',
    '      timeout: 8000,',
    '    });',
  ].join('\n');
  code = once(code, skuLookup, [
    '// photo-http-helper-v285',
    '    const query = sku ? "&sku=" + encodeURIComponent(sku) : "";',
    '    const identity = ownOnly && item.productId ? "&in_ids=" + encodeURIComponent(item.productId) : "";',
    '    const payload = await helpers.httpRequest({',
    "      method: 'GET',",
    "      url: 'https://api.xiaomipetrolina.com.br/products?status=active&compact=true&limit=1' + query + identity,",
    "      headers: { Accept: 'application/json' }, json: true, timeout: ownOnly ? 3500 : 8000,",
    '    });',
  ].join('\n'));
  const missingProduct = 'if (!product) return { ...item, images: currentImages, blueprintImageUrl: currentBlueprintImageUrlV320 };';
  code = once(code, missingProduct, [
    'if (!product) return { ...item, images: ownOnly ? [] : currentImages, blueprintImageUrl: currentBlueprintImageUrlV320 };',
    '    if (ownOnly) {',
    '      const blueprint = normalizeBlueprintUrlV309(product.blueprint_image_url || item.blueprintImageUrl);',
    '      const images = [...(Array.isArray(product.images) ? product.images : []), product.image_url]',
    '        .map(url => String(url || "").trim())',
    '        .filter(url => isAllowedMediaUrlV309(url) && url !== blueprint);',
    '      const url = product.slug ? "https://mercadodovale.com.br/produto/" + encodeURIComponent(product.slug) : item.url;',
    '      return { ...item, images, url };',
    '    }',
  ].join('\n'));
  const photoCatch = 'return { ...item, images: currentImages, blueprintImageUrl: currentBlueprintImageUrlV320 };\n  }\n}';
  code = once(code, photoCatch, 'return { ...item, images: ownOnly ? [] : currentImages, blueprintImageUrl: currentBlueprintImageUrlV320 };\n  }\n}');

  const photoMessages = 'async function buildPhotoMessages(item, selectedOption) {';
  code = once(code, photoMessages, [
    'async function buildOptionColorMessage(item, name) {',
    '  const current = await hydratePhotoItem(item, true);',
    '  const color = titleCase(item.color);',
    '  const mediaUrl = current.images[0];',
    '  if (!mediaUrl) {',
    '    const url = current.url || "https://mercadodovale.com.br/produto/" + encodeURIComponent(item.productId);',
    '    return { type: "text", text: color + ": " + url, delayMs: 1200 };',
    '  }',
    '  const extension = mediaUrl.split(/[?#]/, 1)[0].toLowerCase().match(/\\.(png|webp|gif)$/)?.[1] || "jpg";',
    '  return { type: "image", mediaUrl, caption: name + " · " + color,',
    '    mimetype: "image/" + (extension === "jpg" ? "jpeg" : extension),',
    '    fileName: "produto-" + normalize(color).replace(/\\s+/g, "-") + "." + extension, delayMs: 1200 };',
    '}',
    '',
    photoMessages,
  ].join('\n'));
  new Function(code);
  parameters.jsCode = code;
  return next;
}

module.exports = { MARK, NODES, patchWorkflow };
