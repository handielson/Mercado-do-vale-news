import { buildContextualFallback } from '../fallbacks.js';
import { resolveAutoresponderMessage } from '../messages.js';

const DEFAULT_PRODUCT_CHOICE_PROMPT = 'vamos ficar com qual deles hoje? quer ver a lista completa?';
const DEFAULT_PRODUCT_MORE_PROMPT = 'Se quiser ver mais opcoes, digite "mais".';

function formatProductSearchReplyInstructions(hasMore, settings = null) {
  const lines = [
    resolveAutoresponderMessage(settings, 'product_search.choice_prompt') || DEFAULT_PRODUCT_CHOICE_PROMPT,
    'Responda com o numero da opcao ou com o nome/modelo do produto.',
  ];
  if (hasMore) {
    lines.push('Se quiser, me diga a faixa de preco, marca ou uso que eu filtro melhor.');
    lines.push(resolveAutoresponderMessage(settings, 'product_search.more_prompt') || DEFAULT_PRODUCT_MORE_PROMPT);
  }
  return lines.filter(Boolean).join('\n');
}

function normalizeProductSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function findSelectedProduct(message, options) {
  const safeOptions = Array.isArray(options) ? options : [];
  const text = normalizeProductSearchText(message);
  const numbered = text.match(/^(\d{1,2})$/);
  if (numbered) {
    const index = Number(numbered[1]) - 1;
    return safeOptions[index] || null;
  }

  if (!text) return null;
  return safeOptions.find((product) => {
    const name = normalizeProductSearchText(product?.name);
    const sku = normalizeProductSearchText(product?.sku);
    return (name && name.includes(text)) || (sku && sku === text);
  }) || null;
}

function buildProductSearchReply(products, keyword, hasMore, settings = null) {
  const safeProducts = Array.isArray(products) ? products : [];
  const lines = [`Encontrei estas opcoes para ${keyword}:`, ''];

  safeProducts.forEach((product, index) => {
    lines.push(`${index + 1}. ${product.name}`);
    if (product.price_text) lines.push(product.price_text);
    if (product.colors_text) lines.push(product.colors_text);
    if (Array.isArray(product.colors) && product.colors.length > 0) lines.push(`Cores: ${product.colors.join(', ')}`);
    if (product.priceRange) lines.push(product.priceRange);
    lines.push('');
  });

  lines.push(formatProductSearchReplyInstructions(hasMore, settings));

  return lines.join('\n').trim();
}

function buildProductSearchState({ options, keyword, hasMore, pageSize, total }) {
  return {
    flow: 'product_search',
    step: 'awaiting_choice',
    data: {
      options,
      keyword,
      has_more: Boolean(hasMore),
      page_size: pageSize || options.length,
      total: total == null ? options.length : total,
    },
    last_intent: 'product_search',
    expires_at: null,
  };
}

const productSearchFlowHandler = {
  name: 'product_search',
  canHandle({ state, context }) {
    if (state.flow === 'product_search') return true;
    return state.flow === 'none' && Boolean(context?.productSearchTokens?.length);
  },
  async handle({ message, state, settings, context }) {
    if (state.flow === 'product_search' && state.step === 'awaiting_choice') {
      const selected = (context.findSelectedProduct || findSelectedProduct)(message, state.data.options || []);
      if (!selected) return buildContextualFallback(state);
      return {
        message: await context.buildProductDetailReply(selected),
        intent: 'product_selected',
        nextState: {
          flow: 'purchase',
          step: 'awaiting_action',
          data: { selected_product: selected },
          last_intent: 'product_selected',
          expires_at: null,
        },
        matchedCount: 1,
        matchedProducts: [selected],
      };
    }

    const tokens = Array.isArray(context.productSearchTokens) ? context.productSearchTokens : [];
    const products = await context.findProducts(tokens);
    if (!Array.isArray(products) || products.length === 0) return null;

    const options = context.buildProductOptions(products);
    const pageSize = Number(context.pageSize || options.length || products.length);
    const visibleOptions = options.slice(0, pageSize);
    const hasMore = Boolean(context.hasMore ?? (options.length > visibleOptions.length));
    const keyword = tokens.join(' ');

    return {
      message: buildProductSearchReply(visibleOptions, keyword, hasMore, settings),
      intent: 'product_search',
      nextState: buildProductSearchState({
        options: visibleOptions,
        keyword,
        hasMore,
        pageSize,
        total: context.total,
      }),
      matchedCount: products.length,
      matchedProducts: options,
    };
  },
};

export {
  productSearchFlowHandler,
  buildProductSearchReply,
  buildProductSearchState,
  formatProductSearchReplyInstructions,
  findSelectedProduct,
};
