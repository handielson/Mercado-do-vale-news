'use strict';
// Pure workflow transformation; no network or production writes.
const assert = require('node:assert/strict');
const { patchConfigurationNumbering } = require('./n8n-fix-unique-smartphone-config-price.cjs');
const MARKER = 'sales-exact-variant-contract-v1';
function variantsOf(option) {
  const configs = option.memoryOptions?.length ? option.memoryOptions : [option];
  return (option.colors || []).map(item => {
    const config = configs.find(c => (c.productIds || []).includes(item.productId))
      || (configs.length === 1 ? configs[0] : null);
    if (!config) return null;
    return { ...item, memory: item.memory || config.memory || '',
      price: item.price || config.price || '',
      priceCents: Number(item.priceCents || config.priceCents || 0),
      card: item.card || config.card || null };
  }).filter(item => item && item.productId && item.memory && item.price && !item.memory.includes(' / '));
}
function resolveVariant(option, text, color, previousMemory = '') {
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '').trim();
  const variants = variantsOf(option);
  const memories = [...new Set(variants.map(v => v.memory))];
  const compact = norm(text);
  const pair = compact.match(/(?:^|\D)(\d{1,2})(?:gb)?[\/x](\d{2,4})(?:gb)?(?:$|\D)/);
  const storage = pair ? Number(pair[2]) : Number((compact.match(/(?:^|\D)(32|64|128|256|512|1024)(?:gb)?(?:$|\D)/) || [])[1] || 0);
  const ram = pair ? Number(pair[1]) : Number((compact.match(/(?:^|\D)(\d{1,2})(?:gb)?(?:de)?ram/) || [])[1] || 0);
  const explicitMemory = Boolean(storage || ram);
  let candidates = variants.filter(v => {
    const parts = v.memory.match(/(\d+)\s*GB\s*\/\s*(\d+)\s*GB/i);
    if (explicitMemory) return parts && (!ram || Number(parts[1]) === ram) && (!storage || Number(parts[2]) === storage);
    return !previousMemory || v.memory === previousMemory;
  });
  if (color) candidates = candidates.filter(v => norm(v.color) === norm(color));
  const matchedMemories = [...new Set(candidates.map(v => v.memory))];
  return { variants, candidates, memories, explicitMemory,
    memory: matchedMemories.length === 1 ? matchedMemories[0] : '',
    selected: candidates.length === 1 ? candidates[0] : null,
    needsMemory: matchedMemories.length > 1, invalid: candidates.length === 0 };
}
function once(code, anchor, replacement) {
  assert.equal(code.split(anchor).length - 1, 1, 'Changed anchor: ' + anchor.slice(0, 90));
  return code.replace(anchor, replacement);
}
function patchWorkflow(input) {
  const w = structuredClone(input);
  const get = name => { const n = w.nodes.find(n => n.name === name); assert(n, name); return n; };
  const context = get('Vendas - Contexto Produtos');
  if (!context.parameters.jsCode.includes(MARKER)) {
    let c = context.parameters.jsCode;
    c = once(c, 'variants: [{ color: product.color, productId: product.id,',
      `// ${MARKER}: preserve configuration facts alongside each exact product ID.\n      variants: [{ memory: product.memory, price: product.price, priceCents: product.priceCents, card: product.card, color: product.color, productId: product.id,`);
    c = once(c, 'existing.variants.push({ color: product.color, productId: product.id,',
      'existing.variants.push({ memory: product.memory, price: product.price, priceCents: product.priceCents, card: product.card, color: product.color, productId: product.id,');
    c = once(c, "          memory: option.memory || '',\n          price: option.price || '',", "          memory: option.memory || '',\n          priceCents: option.priceCents || 0,\n          price: option.price || '',");
    c = once(c, '            color: variant.color,\n            productId: variant.productId,',
      '            memory: variant.memory,\n            price: variant.price,\n            priceCents: variant.priceCents,\n            card: variant.card,\n            color: variant.color,\n            productId: variant.productId,');
    c = once(c, 'const lines = products.map((product, index) => {',
      `const lines = products.flatMap((family, index) => {\n  const configurations = family.memoryOptions?.length ? family.memoryOptions : [family];\n  return configurations.map(configuration => {\n  const product = {...family, ...configuration, name: family.name};`);
    c = once(c, "  return (index + 1) + '. ' + product.name + ' | ' + details;\n});",
      "  return (index + 1) + '. ' + product.name + ' | ' + details;\n  });\n});");
    context.parameters.jsCode = c;
  }
  context.parameters.jsCode = patchConfigurationNumbering(context.parameters.jsCode);
  const post = get('Vendas - Verificar Pos Lista');
  if (!post.parameters.jsCode.includes(MARKER)) {
    let c = post.parameters.jsCode;
    c = once(c, "staticData.salesPostList = staticData.salesPostList || {};",
      `staticData.salesPostList = staticData.salesPostList || {};\n// ${MARKER}\nconst variantsOf = ${variantsOf.toString()};\nconst resolveVariant = ${resolveVariant.toString()};`);
    c = once(c, 'const optionVariantsV1 = (option) => Array.isArray(option?.colors) ? option.colors : [];',
      'const optionVariantsV1 = (option) => variantsOf(option);');
    c = once(c, '  quoteVariantV1 = quoteVariantV1 || variantsV1[0] || {};',
      `  const quoteResolvedExactV1 = resolveVariant(quoteOptionV1, text, '', quoteVariantV1?.memory || activeState.selectedMemoryExactV1 || '');\n  if (!quoteResolvedExactV1.memory || quoteResolvedExactV1.invalid) {\n    activeState.selectedOptionNumber = quoteOptionV1.number;\n    activeState.step = 'awaiting_memory';\n    return [{json:{...source,salesPostListHandled:true,salesPostListStep:activeState.step,output:withGreeting('Qual memória você quer consultar?' + lineBreak + quoteResolvedExactV1.memories.join(lineBreak))}}];\n  }\n  quoteVariantV1 = quoteResolvedExactV1.candidates.find(v => v.productId === quoteVariantV1?.productId) || quoteResolvedExactV1.candidates[0];`);
    c = once(c, "    memory: quoteOptionV1.memory || '',", "    memory: quoteVariantV1.memory || '',");
    c = once(c, "    price: quoteOptionV1.price || quoteVariantV1.price || '',", "    price: quoteVariantV1.price || '',\n    unitPriceCents: quoteVariantV1.priceCents || 0,");
    c = once(c, "const aiUsesCurrentSelection = ['escolher_cor', 'informar_cor', 'pedir_foto'].includes(aiAction);",
      "const aiUsesCurrentSelection = ['escolher_cor', 'informar_cor', 'pedir_foto'].includes(aiAction) || ['awaiting_memory', 'awaiting_color'].includes(activeState?.step);");
    c = once(c, "if (activeState?.flow === 'sales_post_list' && (bareBudgetV288 || explicitPreferenceV288)) {",
      "if (activeState?.flow === 'sales_post_list' && !['awaiting_memory', 'awaiting_color'].includes(activeState?.step) && (bareBudgetV288 || explicitPreferenceV288)) {");
    c = once(c, 'const option = activeState.options.find((item) => Number(item.number) === selectedNumber);\nconst optionColorItems = uniqueColorItems(option?.colors || []);',
      `const rawOptionExactV1 = activeState.options.find((item) => Number(item.number) === selectedNumber);\nlet option = rawOptionExactV1;\nif (rawOptionExactV1) {\n  const exactColorV1 = findMentionedColor((rawOptionExactV1.colors || []).map(v => v.color));\n  const priorMemoryV1 = Number(activeState.selectedOptionNumber) === Number(selectedNumber) ? activeState.selectedMemoryExactV1 || '' : '';\n  const resolvedExactV1 = resolveVariant(rawOptionExactV1, text, exactColorV1, priorMemoryV1);\n  if (resolvedExactV1.needsMemory || resolvedExactV1.invalid) {\n    activeState.step = 'awaiting_memory';\n    activeState.selectedOptionNumber = selectedNumber;\n    if (exactColorV1) activeState.pendingColorExactV1 = exactColorV1;\n    delete activeState.selectedMemoryExactV1;\n    const configurationsV1 = rawOptionExactV1.memoryOptions?.length ? rawOptionExactV1.memoryOptions : [rawOptionExactV1];\n    const detailsV1 = configurationsV1.map(v => [v.memory, v.price, (v.colors || []).join(', ')].filter(Boolean).join(' — ')).join(lineBreak);\n    return [{json:{...source, salesPostListHandled:true, salesPostListStep:activeState.step, output:withGreeting((resolvedExactV1.invalid ? 'Essa combinação de memória e cor não está disponível. ' : '') + 'Qual versão você prefere?' + lineBreak + detailsV1)}}];\n  }\n  if (resolvedExactV1.memory) {\n    const configExactV1 = rawOptionExactV1.memoryOptions?.find(v => v.memory === resolvedExactV1.memory) || rawOptionExactV1;\n    const pendingColorV1 = exactColorV1 || activeState.pendingColorExactV1 || '';\n    const exactCandidatesV1 = pendingColorV1 ? resolvedExactV1.candidates.filter(v => normalize(v.color) === normalize(pendingColorV1)) : resolvedExactV1.candidates;\n    option = {...rawOptionExactV1, ...configExactV1, number:rawOptionExactV1.number, name:rawOptionExactV1.name, colors:exactCandidatesV1.length ? exactCandidatesV1 : resolvedExactV1.candidates};\n    activeState.selectedMemoryExactV1 = resolvedExactV1.memory;\n    delete activeState.pendingColorExactV1;\n  }\n}\nconst optionColorItems = uniqueColorItems(option?.colors || []);`);
    c = once(c, '    option = {...rawOptionExactV1, ...configExactV1, number:rawOptionExactV1.number, name:rawOptionExactV1.name, colors:exactCandidatesV1.length ? exactCandidatesV1 : resolvedExactV1.candidates};',
      `    if (pendingColorV1 && !exactCandidatesV1.length) {\n      activeState.step = 'awaiting_color';\n      activeState.selectedMemoryExactV1 = resolvedExactV1.memory;\n      delete activeState.pendingColorExactV1;\n      return [{json:{...source,salesPostListHandled:true,salesPostListStep:activeState.step,output:withGreeting('Essa cor não está disponível na versão ' + resolvedExactV1.memory + '. Qual destas cores você prefere?' + lineBreak + resolvedExactV1.candidates.map(v => v.color).join(', '))}}];\n    }\n    option = {...rawOptionExactV1, ...configExactV1, number:rawOptionExactV1.number, name:rawOptionExactV1.name, colors:exactCandidatesV1};`);
    c = once(c, "if (aiAction === 'nova_busca' && !(wantsPhoto && !String(source.salesSearchQuery || '').trim())) {",
      "if (aiAction === 'nova_busca' && !(activeState?.step === 'awaiting_memory' && /^\\s*(?:\\d{1,2}(?:gb)?\\s*\\/\\s*)?(?:32|64|128|256|512|1024)\\s*(?:gb)?\\s*$/i.test(text)) && !(wantsPhoto && !String(source.salesSearchQuery || '').trim())) {");
    c = once(c, '  : (explicitLinkListNumberV245 || deterministicBareListNumberV416 || aiExplicitListNumber ||',
      "  : ((activeState?.step === 'awaiting_memory' && /\\b(?:32|64|128|256|512|1024)\\s*(?:gb)?\\b/i.test(text) ? Number(activeState.selectedOptionNumber || 0) : 0) || explicitLinkListNumberV245 || deterministicBareListNumberV416 || aiExplicitListNumber ||");
    c = once(c, "  memory: option.memory || '',\n  color: item.color,\n  price: option.price || '',",
      "  memory: item.memory || option.memory || '',\n  color: item.color,\n  price: item.price || option.price || '',\n  unitPriceCents: Number(item.priceCents || option.priceCents || 0),");
    post.parameters.jsCode = c;
  }
  const composer = get('Vendas - Compor Resposta IA');
  if (!composer.parameters.jsCode.includes(MARKER)) {
    composer.parameters.jsCode = once(composer.parameters.jsCode,
      'const prependNaturalIntroV1 = catalogReadyV366',
      `// ${MARKER}: official catalog owns monetary facts, including when the model drifts.\nconst priceInIntroExactV1 = /R\\$|\\b(?:reais|pre[cç]o|valor|parcela|\\d+[.,]\\d{2})\\b/i.test(aiOutput);\nconst prependNaturalIntroV1 = !priceInIntroExactV1 && catalogReadyV366`);
  }
  for (const n of [context, post, composer]) new Function('$json', '$input', '$getWorkflowStaticData', '$', n.parameters.jsCode);
  assert.deepEqual(w.connections, input.connections);
  return w;
}
module.exports = { MARKER, variantsOf, resolveVariant, patchWorkflow };
