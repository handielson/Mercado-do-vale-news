'use strict';

// selected-item-card-v1 (12/11/2026): escolha de um item da lista vira "card de venda".
//  1) Foto da cor escolhida com legenda: nome · versão, preço Pix, cartão 12x, cores e a ficha (até 8 linhas com emojis,
//     do cadastro do modelo) + link.
//  2) ~5 s depois, chamada para venda: escassez só quando é real (1 a 3 unidades da versão), entrega grátis e imediata
//     só para smartphone e DDD 87/74 (regra que o bot já usa), senão retirada na loja; fecha com "responder SIM".
//  3) Complemento da escolha ("A opção 2" + "De 512gb" em seguida): a resposta da 1ª mensagem é descartada porque chegou
//     outra; a 2ª, se só confirma o item já escolhido (memória/cor/número batem), reenvia o card em vez de virar busca nova
//     com o filtro antigo (caso real: Poco X8 Pro "8GB/512GB", 12/11).
//  4) "SIM" -> "Perfeito, separei o seu ... 🎉 Vai querer receber em casa (grátis) ou prefere retirar na loja?"
//  5) Título "Celulares com 5G" não aparece quando o "5G" é parte do nome do modelo pedido.

const MARK = 'selected-item-card-v1';
const NODE_POST = 'Vendas - Verificar Pos Lista';
const NODE_CONTEXT = 'Vendas - Contexto Produtos';
const NODES = [NODE_CONTEXT, NODE_POST];
const TABLET_CATEGORY_ID = 'fd2b4b01-e8d7-4085-848e-18176aa58a66';

function once(code, before, after, label) {
  const count = code.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: âncora encontrada ${count} vezes`);
  return code.replace(before, () => after);
}

const HELPERS = `// ${MARK}: card do item escolhido (foto + ficha) e chamada para venda.
const specTextV1 = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
function selectedItemSpecLinesV1(specs) {
  const s = (key) => specTextV1(specs?.[key]);
  const lines = [];
  const screen = [s('display') ? s('display').replace('.', ',') + '"' : '', s('tipo_de_display'), /^\\d+$/.test(s('celular_fps_display')) ? s('celular_fps_display') + 'Hz' : ''].filter(Boolean).join(' ');
  if (screen) lines.push('📱 Tela: ' + screen);
  if (s('chipset') || s('processador')) lines.push('⚙️ Chip: ' + (s('chipset') || s('processador')));
  const mainCamera = s('cam_principal_mpx').split('(')[0].trim();
  const camera = [mainCamera ? (/^\\d+$/.test(mainCamera) ? mainCamera + 'MP' : mainCamera) + (/\\bOIS\\b/i.test(s('cam_principal_mpx')) ? ' com OIS' : '') : '',
    s('cam_selfie_mpx') ? 'Selfie ' + s('cam_selfie_mpx').replace(/\\s*mp$/i, '') + 'MP' : ''].filter(Boolean).join(' · ');
  if (camera) lines.push('📸 Câmera: ' + camera);
  if (/\\d/.test(s('battery_mah'))) lines.push('🔋 Bateria: ' + s('battery_mah').replace(/\\D/g, '') + 'mAh');
  if (s('carregamento')) lines.push('⚡ Carregamento: ' + s('carregamento').split(/[;]/)[0].trim());
  const network = [s('rede_operadora'), s('nfc') ? 'NFC: ' + s('nfc') : ''].filter(Boolean).join(' · ');
  if (network) lines.push('📶 Rede: ' + network);
  if (s('resistencia')) lines.push('💧 Resistência: ' + s('resistencia'));
  const box = normalize(s('conteudo_da_caixa'));
  const boxItems = [/\\b(adaptador|carregador)\\b/.test(box) ? 'carregador' : '', /\\bcabo\\b/.test(box) ? 'cabo USB-C' : '', /\\bcapa\\b/.test(box) ? 'capa' : '', /\\bpelicula\\b/.test(box) ? 'película' : ''].filter(Boolean);
  if (boxItems.length) lines.push('📦 Na caixa: ' + (boxItems.length > 1 ? boxItems.slice(0, -1).join(', ') + ' e ' + boxItems.at(-1) : boxItems[0]));
  return lines.slice(0, 8);
}
function selectedItemSaleCallV1(stock, smartphone, inArea) {
  const scarcity = stock >= 1 && stock <= 3 ? (stock === 1 ? '🔥 Só resta 1 unidade dele aqui na loja!' : '🔥 Só restam ' + stock + ' unidades dele aqui na loja!') : '';
  const delivery = smartphone && inArea
    ? (scarcity ? 'Garanta o seu hoje: entrega grátis e imediata em Petrolina e Juazeiro 🛵💨' : 'Que tal já sair com ele hoje? 😍\\n🛵 Entrega grátis e imediata em Petrolina e Juazeiro, ou retire na loja.')
    : (scarcity ? 'Garanta o seu hoje: retire na loja ou combine o envio com a gente 🏪' : 'Que tal garantir o seu hoje? 😍\\n🏪 Retire na loja ou combine o envio com a gente.');
  return [scarcity, delivery, 'Posso separar o seu? É só responder *SIM* 👇'].filter(Boolean).join('\\n');
}
async function buildSelectedItemCardV1(item) {
  let product = null;
  if (item.productId) {
    try {
      const payload = await helpers.httpRequest({ method: 'GET', json: true, timeout: 5000, headers: { Accept: 'application/json' },
        url: 'https://api.xiaomipetrolina.com.br/products?status=active&compact=true&limit=1&include_model_specs=true&in_ids=' + encodeURIComponent(item.productId) });
      const rows = Array.isArray(payload) ? payload : (Array.isArray(payload?.rows) ? payload.rows : []);
      product = rows.find((row) => String(row?.id || '') === String(item.productId)) || null;
    } catch (error) { product = null; }
  }
  const specs = { ...(product?.model_template_values && typeof product.model_template_values === 'object' ? product.model_template_values : {}), ...(product?.specs && typeof product.specs === 'object' ? product.specs : {}) };
  const isApiImage = (url) => String(url || '').startsWith('https://api.xiaomipetrolina.com.br/images/');
  const image = [...(Array.isArray(item.images) ? item.images : []), ...(Array.isArray(product?.model_color_images) ? product.model_color_images : []),
    ...(Array.isArray(product?.resolved_images) ? product.resolved_images : []), ...(Array.isArray(product?.images) ? product.images : [])].find(isApiImage) || '';
  const header = [
    item.priceChanged ? 'Valor atualizado hoje.' : '',
    '*' + item.name + '*' + (item.memory ? ' · ' + item.memory : ''),
    item.price ? '💰 ' + item.price + ' à vista no Pix' : '',
    item.card?.installment && item.card?.total ? '💳 ' + (item.card.installments || 12) + 'x de ' + item.card.installment + ' (' + item.card.total + ')' : '',
    item.colors?.length ? '🎨 Cores: ' + item.colors.join(', ') : '',
  ].filter(Boolean);
  const specLines = selectedItemSpecLinesV1(specs);
  const link = String(item.url || '').replace(/^https?:\\/\\//, '');
  const caption = [...header, specLines.length ? '' : null, ...specLines, link ? '' : null, link ? '🔗 ' + link : ''].filter((line) => line !== null && line !== '' || line === '')
    .join('\\n').replace(/\\n{3,}/g, '\\n\\n').trim().slice(0, 1000);
  const messages = [];
  const greeting = periodGreeting();
  if (greeting) messages.push({ type: 'text', text: greeting, delayMs: 800 });
  if (image) {
    const extension = image.split(/[?#]/, 1)[0].toLowerCase().match(/\\.(png|webp)$/)?.[1] || 'jpg';
    messages.push({ type: 'image', mediaUrl: image, caption, mimetype: extension === 'jpg' ? 'image/jpeg' : 'image/' + extension,
      fileName: 'produto-' + (normalize(item.color || 'modelo').replace(/\\s+/g, '-') || 'modelo') + '.' + extension, delayMs: 1500 });
  } else {
    messages.push({ type: 'text', text: caption, delayMs: 1500 });
  }
  messages.push({ type: 'text', text: selectedItemSaleCallV1(Number(item.stock || 0), item.smartphone !== false, item.inArea === true), delayMs: 5000 });
  return messages;
}
const selectedItemContextV1 = () => {
  const assumption = contactDeliveryAssumptionV401(remoteJid);
  const draft = activeState?.orderDraft || {};
  const smartphone = String(activeState?.categoryId || source.salesCategoryId || '') !== '${TABLET_CATEGORY_ID}' && isSmartphoneOrderV401(activeState, draft);
  return { inArea: Boolean(assumption.label), smartphone };
};
const stockOfMemoryV1 = (colors, memory) => (Array.isArray(colors) ? colors : [])
  .filter((row) => !memory || !row?.memory || normalize(row.memory) === normalize(memory))
  .reduce((sum, row) => sum + Math.max(0, Number(row?.stock || 0)), 0);
`;


const COMPLEMENT = `  // ${MARK}: "De 512gb" / "a opção 2" / "essa" logo depois de escolher = mesma escolha.
  const draftV1 = activeState?.orderDraft;
  const memoryTokensV1 = [...normalized.matchAll(/\b(\d{2,4})\s*gb\b|\b(\d)\s*tb\b/g)].map((match) => match[1] ? match[1] + 'gb' : match[2] + 'tb');
  const draftMemoryV1 = normalize(draftV1?.memory || '').replace(/\s+/g, '');
  const sameNumberV1 = Number(source.salesFlowItemNumber || 0) > 0 && Number(source.salesFlowItemNumber) === Number(activeState?.selectedOptionNumber || 0);
  const sameMemoryV1 = memoryTokensV1.length > 0 && memoryTokensV1.every((token) => draftMemoryV1.includes(token));
  const sameColorV1 = Boolean(draftV1?.color) && normalize(text).includes(normalize(draftV1.color));
  const shortComplementV1 = normalized.split(' ').filter(Boolean).length <= 6 && !/[?？]/.test(text)
    && !/\b(?:outro|outra|outros|outras|mais barato|mais barata|diferente|tambem|tbm|foto|fotos|video|parcela|parcelas|entrega|frete)\b/.test(normalized);
  if (draftV1?.productId && shortComplementV1 && (sameMemoryV1 || sameNumberV1 || sameColorV1 || /^(?:esse|essa|este|esta|ele|ela|isso)$/.test(normalized))) {
    const optionV1 = (activeState.options || []).find((item) => Number(item?.number) === Number(activeState.selectedOptionNumber)) || {};
    const colorsV1 = (optionV1.colors || []).filter((row) => !row?.memory || normalize(row.memory) === normalize(draftV1.memory));
    const chosenV1 = colorsV1.find((row) => String(row?.productId || '') === String(draftV1.productId)) || {};
    const contextV1 = selectedItemContextV1();
    activeState.updatedAt = new Date(now).toISOString();
    return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, orderDraft: draftV1,
      messages: await buildSelectedItemCardV1({ productId: draftV1.productId, name: draftV1.name || optionV1.name, memory: draftV1.memory, price: draftV1.price || chosenV1.price || optionV1.price,
        card: chosenV1.card || optionV1.card, colors: [...new Set(colorsV1.map((row) => titleCase(row.color)).filter(Boolean))], color: draftV1.color, url: draftV1.url || chosenV1.url || optionV1.url,
        images: chosenV1.images, stock: stockOfMemoryV1(colorsV1, draftV1.memory), ...contextV1 }) } }];
  }
`;

function patchPost(code) {
  if (code.includes(MARK)) return code;
  code = once(code, '// purchase-confirmation-before-fulfillment-v417:gate\n', HELPERS + '// purchase-confirmation-before-fulfillment-v417:gate\n', 'helpers');
  // Complemento da escolha já feita: reenvia o card em vez de virar busca nova.
  code = once(code, '  return buildContinueItem();\n}\n\n// default-one-unit-v245', COMPLEMENT + '  return buildContinueItem();\n}\n\n// default-one-unit-v245', 'complemento da escolha');
  // "SIM" depois do card.
  code = once(code,
    "output: withGreeting('Perfeito, confirmei ' + confirmedModelV417 + '.' + lineBreak + 'Voce prefere retirada na loja ou entrega? 😊') } }];",
    "output: withGreeting((() => { const contextV1 = selectedItemContextV1(); // " + MARK + "\n"
    + "      return 'Perfeito, separei o seu ' + [activeState.orderDraft.name, activeState.orderDraft.memory, activeState.orderDraft.color].filter(Boolean).join(' ') + '! 🎉' + lineBreak\n"
    + "        + (contextV1.smartphone && contextV1.inArea ? 'Vai querer receber em casa (grátis) ou prefere retirar na loja?' : 'Vai querer retirar na loja ou prefere entrega?'); })()) } }];",
    'confirmação');
  // Escolha do item: card com foto + chamada para venda.
  const tailStart = code.indexOf('return [{\n  json: {\n    ...source,\n    salesPostListHandled: true,\n    salesPostListStep: activeState.step,\n    orderDraft: activeState.orderDraft,\n    output: uniqueColorItems(rawOptionExactV1?.colors || []).length === 1 && pendingSelectedOptionSummaryV245');
  if (tailStart < 0 || code.indexOf('return [{\n  json: {\n    ...source,\n    salesPostListHandled: true,\n    salesPostListStep: activeState.step,\n    orderDraft: activeState.orderDraft,\n    output: uniqueColorItems', tailStart + 1) >= 0) throw new Error('retorno final: âncora não única');
  const tailEnd = code.indexOf('}];\n})();', tailStart);
  if (tailEnd < 0) throw new Error('retorno final: fim não encontrado');
  code = code.slice(0, tailStart)
    + '// ' + MARK + ': foto da cor escolhida com a ficha + chamada para venda (no lugar de "Voce quer comprar este modelo?").\n'
    + 'const selectedContextV1 = selectedItemContextV1();\n'
    + 'return [{\n  json: {\n    ...source,\n    salesPostListHandled: true,\n    salesPostListStep: activeState.step,\n    orderDraft: activeState.orderDraft,\n'
    + '    messages: await buildSelectedItemCardV1({ productId: variant.productId, name: option.name, memory: option.memory || variant.memory, price: variant.price || option.price,\n'
    + '      card: variant.card || option.card, colors: optionColorItems.map((item) => titleCase(item.color)).filter(Boolean), color: variant.color,\n'
    + '      url: selectedOptionLinkV245, images: variant.images, priceChanged: revalidatedPriceChanged,\n'
    + '      stock: stockOfMemoryV1(optionColorItems, option.memory || variant.memory), ...selectedContextV1 }),\n'
    + '  },\n}];\n})();'
    + code.slice(tailEnd + '}];\n})();'.length);
  return code;
}

function patchContext(code) {
  if (code.includes(MARK)) return code;
  return once(code, "phone5gFilterRequestV338 ? '5G' : ''",
    "phone5gFilterRequestV338 && !/\\b5g\\b/i.test(String(base.requestedDeviceModelQuery || '')) ? '5G' : '' /* " + MARK + ": 5G do nome do modelo não vira título */",
    'título 5G');
}

function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  const find = (name) => { const node = next.nodes.find((item) => item.name === name); if (!node?.parameters?.jsCode) throw new Error(`Nó ausente: ${name}`); return node; };
  const post = find(NODE_POST); post.parameters.jsCode = patchPost(post.parameters.jsCode);
  const context = find(NODE_CONTEXT); context.parameters.jsCode = patchContext(context.parameters.jsCode);
  return next;
}

module.exports = { MARK, NODES, NODE_POST, NODE_CONTEXT, patchWorkflow, patchPost, patchContext };

if (require.main === module) {
  const fs = require('node:fs');
  const [input, output] = process.argv.slice(2);
  fs.writeFileSync(output, JSON.stringify(patchWorkflow(JSON.parse(fs.readFileSync(input, 'utf8')))), { mode: 0o600 });
  console.log('candidato gravado em', output);
}
