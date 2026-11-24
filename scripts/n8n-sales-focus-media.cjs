'use strict';

// sales-focus-product-v2: indicação do celular em foco no formato pedido pelo dono e com mídia.
// - Mensagem: "⭐ *Nossa indicação:*", linha em branco, "N. modelo memória", Pix, 12x, NFC, cores e o ✨ resumo de
//   características (buildFeatureSummaryV365, o mesmo formatador da ficha), sem pergunta no fim.
// - Em seguida: uma foto por cor/variação em estoque daquela configuração e o vídeo do produto, se houver
//   (video_url, senão marketing_video_url). Vai em salesFocusMediaV2 e o "Dividir mensagens" anexa depois do texto.
// - "Enviar WhatsApp - Imagem" passa a mandar vídeo quando o item é vídeo (mediaKind).
const MARK = 'sales-focus-product-v2';
const CONTEXTO = 'Vendas - Contexto Produtos';
const DIVIDIR = 'Dividir mensagens';
const MEDIA_NODE = 'Enviar WhatsApp - Imagem';
const NODES = [CONTEXTO, DIVIDIR];
const once = (code, a, b, label) => {
  if (code.split(a).length !== 2) throw new Error(`${MARK}: âncora "${label}" não encontrada`);
  return code.replace(a, () => b);
};

const OLD_LINES = `    const focusLinesV1 = ['⭐ *Nossa indicação:* ' + (focusIndexV1 + 1) + '. ' + focusProductV1.name + (focusOptionV1.memory ? ' ' + focusOptionV1.memory : ''),
      pixPriceLineV826(focusOptionV1)];
    if (focusOptionV1.card) focusLinesV1.push('💳 Cartão: 12x de ' + focusOptionV1.card.installment + ' (' + focusOptionV1.card.total + ')');
    focusLinesV1.push('Quer ver esse em detalhes ou prefere outro da lista? 😊');
    quoteMessages[quoteMessages.length - 1] = focusLinesV1.join('[[BR]]');`;
const NEW_LINES = `    // ${MARK}: formato pedido pelo dono + características; fotos das cores em estoque e vídeo vão em seguida.
    const focusTitleV2 = focusProductV1.name + (focusOptionV1.memory ? ' ' + focusOptionV1.memory : '');
    const focusLinesV1 = ['⭐ *Nossa indicação:*', '', (focusIndexV1 + 1) + '. ' + focusTitleV2, pixPriceLineV826(focusOptionV1)];
    if (focusOptionV1.card) focusLinesV1.push('💳 Cartão: 12x de ' + focusOptionV1.card.installment + ' (' + focusOptionV1.card.total + ')');
    if (catalogNfcLineV1(focusOptionV1)) focusLinesV1.push(catalogNfcLineV1(focusOptionV1));
    if (focusOptionV1.colors?.length) focusLinesV1.push('🎨 Cores: ' + focusOptionV1.colors.join(', '));
    const focusFeaturesV2 = buildFeatureSummaryV365(focusOptionV1) || buildFeatureSummaryV365(focusProductV1);
    if (focusFeaturesV2) focusLinesV1.push(focusFeaturesV2);
    quoteMessages[quoteMessages.length - 1] = focusLinesV1.join('[[BR]]');
    const focusVariantsV2 = (Array.isArray(focusOptionV1.variants) && focusOptionV1.variants.length ? focusOptionV1.variants : [focusOptionV1])
      .filter((variant) => toNumber(variant.stock) > 0);
    const seenMediaV2 = new Set();
    for (const variant of focusVariantsV2) {
      const url = (Array.isArray(variant.images) ? variant.images : []).find((item) => /^https:\\/\\//.test(String(item || '')));
      if (!url || seenMediaV2.has(url)) continue;
      seenMediaV2.add(url);
      salesFocusMediaV2.push({ type: 'image', mediaUrl: url, mimetype: /\\.png(?:$|[?#])/i.test(url) ? 'image/png' : 'image/jpeg',
        fileName: 'produto.' + (/\\.png(?:$|[?#])/i.test(url) ? 'png' : 'jpg'), caption: focusTitleV2 + (variant.color ? ' · ' + variant.color : ''), delayMs: 1500 });
      if (salesFocusMediaV2.length >= 6) break;
    }
    const focusRowIdsV2 = new Set(focusVariantsV2.map((variant) => String(variant.productId || variant.id || '')).filter(Boolean));
    const focusVideoRowV2 = (Array.isArray(rows) ? rows : []).find((row) => row && (focusRowIdsV2.has(String(row.id)) || focusIdsV1.has(String(row.id)))
      && /^https:\\/\\//.test(String(row.video_url || row.marketing_video_url || '')));
    const focusVideoUrlV2 = focusVideoRowV2 ? String(focusVideoRowV2.video_url || focusVideoRowV2.marketing_video_url) : '';
    if (focusVideoUrlV2) salesFocusMediaV2.push({ type: 'video', mediaUrl: focusVideoUrlV2, mimetype: 'video/mp4', fileName: 'produto.mp4', caption: focusTitleV2, delayMs: 2500 });`;

function patchContexto(code) {
  if (code.includes(MARK)) return code;
  if (!code.includes('sales-focus-product-v1')) throw new Error(`${MARK}: precisa do sales-focus-product-v1`);
  code = once(code, OLD_LINES, NEW_LINES, 'linhas da indicação');
  code = once(code, '// sales-focus-product-v1: a lista de celulares fecha', `const salesFocusMediaV2 = []; // ${MARK}\n// sales-focus-product-v1: a lista de celulares fecha`, 'início do bloco');
  code = once(code, '    specificProductBlueprintMedia: specificModelBlueprintMediaV336,\n', `    specificProductBlueprintMedia: specificModelBlueprintMediaV336,\n    salesFocusMediaV2, // ${MARK}\n`, 'retorno');
  return code;
}

function patchDividir(code) {
  if (code.includes(MARK)) return code;
  code = once(code, `const escapeGreetingRegex = (value) =>`, `// ${MARK}: fotos das cores em estoque e vídeo do celular em foco, logo depois da indicação.
const focusMediaV2 = Array.isArray($json.salesFocusMediaV2) ? $json.salesFocusMediaV2 : [];
if (focusMediaV2.length && String(text).includes('⭐ *Nossa indicação:*')) {
  for (const media of focusMediaV2.slice(0, 7)) {
    if (media && ['image', 'video'].includes(media.type) && /^https:\\/\\//.test(String(media.mediaUrl || ''))) suffix.push(media);
  }
}
const escapeGreetingRegex = (value) =>`, 'antes de escapeGreetingRegex');
  code = once(code, `const quoteThisTextV2 = index === 0 && message?.type !== 'image' && !locationV1`, `const quoteThisTextV2 = index === 0 && message?.type !== 'image' && message?.type !== 'video' && !locationV1`, 'citação');
  code = once(code, `messageType: message.type === 'image' ? 'image' : (locationV1 ? 'location' : 'text'),`,
    `messageType: (message.type === 'image' || message.type === 'video') ? 'image' : (locationV1 ? 'location' : 'text'), mediaKind: message.type === 'video' ? 'video' : 'image',`, 'tipo de mensagem');
  code = once(code, `mimetype: message.mimetype || (message.type === 'image' ? 'image/jpeg' : ''),`,
    `mimetype: message.mimetype || (message.type === 'image' ? 'image/jpeg' : (message.type === 'video' ? 'video/mp4' : '')),`, 'mimetype');
  return code;
}

function patchMediaNode(node) {
  const params = node.parameters?.bodyParameters?.parameters;
  if (!Array.isArray(params)) throw new Error(`${MARK}: parâmetros do ${MEDIA_NODE} não encontrados`);
  const byName = (name) => params.find((p) => p.name === name);
  const type = byName('mediatype'); const mime = byName('mimetype');
  if (!type || !mime) throw new Error(`${MARK}: mediatype/mimetype ausentes no ${MEDIA_NODE}`);
  if (String(type.value).includes('mediaKind')) return;
  if (type.value !== 'image') throw new Error(`${MARK}: mediatype inesperado: ${type.value}`);
  type.value = "={{$json.mediaKind === 'video' ? 'video' : 'image'}}";
  mime.value = "={{$json.mimetype || ($json.mediaKind === 'video' ? 'video/mp4' : 'image/jpeg')}}";
}

function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  const get = (name) => { const n = next.nodes.find((x) => x.name === name); if (!n) throw new Error(`nó ausente: ${name}`); return n; };
  get(CONTEXTO).parameters.jsCode = patchContexto(get(CONTEXTO).parameters.jsCode);
  get(DIVIDIR).parameters.jsCode = patchDividir(get(DIVIDIR).parameters.jsCode);
  patchMediaNode(get(MEDIA_NODE));
  return next;
}

module.exports = { MARK, NODES, CONTEXTO, DIVIDIR, MEDIA_NODE, patchContexto, patchDividir, patchWorkflow };
