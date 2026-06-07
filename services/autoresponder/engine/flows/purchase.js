import { buildContextualFallback } from '../fallbacks.js';

const PURCHASE_FLOW_STEPS = [
  { flow: 'purchase', step: 'awaiting_action' },
  { flow: 'purchase', step: 'awaiting_variation' },
  { flow: 'purchase', step: 'awaiting_quantity' },
  { flow: 'purchase', step: 'item_added' },
  { flow: 'purchase', step: 'awaiting_fulfillment' },
  { flow: 'delivery', step: 'awaiting_cep' },
  { flow: 'delivery', step: 'awaiting_number' },
  { flow: 'payment', step: 'awaiting_payment_method' },
  { flow: 'customer_data', step: 'awaiting_name' },
  { flow: 'customer_data', step: 'awaiting_document' },
  { flow: 'handoff', step: 'ready' },
];

function buildState(flow, step, data = {}, lastIntent = null) {
  return {
    flow,
    step,
    data,
    last_intent: lastIntent,
    expires_at: null,
  };
}

function getSelectedProduct(state) {
  return state?.data?.selected_product || null;
}

function getCartItems(state) {
  return Array.isArray(state?.data?.items) ? state.data.items : [];
}

function parsePositiveInteger(value) {
  const match = String(value || '').trim().match(/^(\d{1,3})$/);
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function hasStock(product, quantity = 1) {
  const stock = product?.stock_quantity == null ? null : Number(product.stock_quantity);
  return stock == null || stock >= quantity;
}

async function maybeCall(fn, ...args) {
  return typeof fn === 'function' ? fn(...args) : null;
}

const purchaseFlowHandler = {
  name: 'purchase',
  canHandle({ state }) {
    return ['purchase', 'payment', 'customer_data', 'handoff'].includes(state.flow);
  },
  async handle({ message, state, settings, context }) {
    if (state.flow === 'purchase' && state.step === 'awaiting_action') {
      const selectedProduct = getSelectedProduct(state);
      if (!selectedProduct?.id) return buildContextualFallback(state, settings);

      if (context.isDetailsRequest?.(message)) {
        const detailMessage = await maybeCall(context.buildProductDetailReply, selectedProduct, settings);
        if (!detailMessage) return null;
        return {
          message: detailMessage,
          intent: 'purchase_product_details',
          nextState: state,
          matchedCount: 1,
          matchedProducts: [selectedProduct],
        };
      }

      if (!context.isBuyRequest?.(message)) return buildContextualFallback(state, settings);

      const variations = await maybeCall(context.findProductVariations, selectedProduct);
      if (Array.isArray(variations) && variations.length > 1) {
        const messageText = await maybeCall(context.buildVariationPrompt, variations, settings);
        if (!messageText) return null;
        return {
          message: messageText,
          intent: 'purchase_variation_prompt',
          nextState: buildState(
            'purchase',
            'awaiting_variation',
            { ...state.data, variation_options: variations },
            'purchase_variation_prompt'
          ),
          matchedCount: variations.length,
          matchedProducts: variations,
        };
      }

      const product = Array.isArray(variations) && variations[0] ? variations[0] : selectedProduct;
      const messageText = await maybeCall(context.buildQuantityPrompt, product, settings);
      if (!messageText) return null;
      return {
        message: messageText,
        intent: 'purchase_quantity_prompt',
        nextState: buildState(
          'purchase',
          'awaiting_quantity',
          { ...state.data, selected_product: product, requested_quantity: null },
          'purchase_quantity_prompt'
        ),
        matchedCount: 1,
        matchedProducts: [product],
      };
    }

    if (state.flow === 'purchase' && state.step === 'awaiting_variation') {
      const variations = Array.isArray(state.data?.variation_options) ? state.data.variation_options : [];
      const selectedVariation = await maybeCall(context.findSelectedVariation, message, variations);
      if (!selectedVariation) return buildContextualFallback(state, settings);
      const messageText = await maybeCall(context.buildQuantityPrompt, selectedVariation, settings);
      if (!messageText) return null;
      return {
        message: messageText,
        intent: 'purchase_variation_selected',
        nextState: buildState(
          'purchase',
          'awaiting_quantity',
          { ...state.data, selected_product: selectedVariation, requested_quantity: null },
          'purchase_variation_selected'
        ),
        matchedCount: 1,
        matchedProducts: [selectedVariation],
      };
    }

    if (state.flow === 'purchase' && state.step === 'awaiting_quantity') {
      const selectedProduct = getSelectedProduct(state);
      if (!selectedProduct?.id) return buildContextualFallback(state, settings);
      const quantity = context.parseQuantity?.(message) || parsePositiveInteger(message);
      if (!quantity) return buildContextualFallback(state, settings);
      if (!hasStock(selectedProduct, quantity)) {
        const stockMessage = await maybeCall(context.buildStockBlockedReply, selectedProduct, quantity, settings);
        if (!stockMessage) return buildContextualFallback(state, settings);
        return {
          message: stockMessage,
          intent: 'purchase_stock_blocked',
          nextState: buildState('purchase', 'awaiting_quantity', state.data, 'purchase_stock_blocked'),
          matchedCount: 0,
          matchedProducts: [selectedProduct],
        };
      }

      const item = await maybeCall(context.buildCartItem, selectedProduct, quantity) || {
        product_id: selectedProduct.id,
        name: selectedProduct.name,
        sku: selectedProduct.sku || null,
        quantity,
        unit_price_cents: Number(selectedProduct.price_cents || 0),
        subtotal_cents: Number(selectedProduct.price_cents || 0) * quantity,
      };
      const items = [...getCartItems(state), item];
      const messageText = await maybeCall(context.buildItemAddedPrompt, item, settings);
      if (!messageText) return null;
      return {
        message: messageText,
        intent: 'purchase_item_added',
        nextState: buildState(
          'purchase',
          'item_added',
          { ...state.data, items, requested_quantity: quantity },
          'purchase_item_added'
        ),
        matchedCount: 1,
        matchedProducts: [item],
      };
    }

    if (state.flow === 'purchase' && state.step === 'item_added') {
      if (context.isAddMoreRequest?.(message)) {
        const messageText = await maybeCall(context.buildAddMorePrompt, settings);
        if (!messageText) return null;
        return {
          message: messageText,
          intent: 'purchase_add_more_prompt',
          nextState: buildState(
            'product_search',
            'awaiting_query',
            { items: getCartItems(state) },
            'purchase_add_more_prompt'
          ),
          matchedCount: getCartItems(state).length,
          matchedProducts: getCartItems(state),
        };
      }

      if (context.isFinalizeRequest?.(message)) {
        const messageText = await maybeCall(context.buildFulfillmentPrompt, settings);
        if (!messageText) return null;
        return {
          message: messageText,
          intent: 'purchase_fulfillment_prompt',
          nextState: buildState('purchase', 'awaiting_fulfillment', state.data, 'purchase_fulfillment_prompt'),
          matchedCount: getCartItems(state).length,
          matchedProducts: getCartItems(state),
        };
      }

      return buildContextualFallback(state, settings);
    }

    if (state.flow === 'purchase' && state.step === 'awaiting_fulfillment') {
      if (context.isDeliveryRequest?.(message)) {
        const messageText = await maybeCall(context.buildDeliveryCepPrompt, settings);
        if (!messageText) return null;
        return {
          message: messageText,
          intent: 'purchase_delivery_cep_prompt',
          nextState: buildState('delivery', 'awaiting_cep', { ...state.data, fulfillment: 'delivery' }, 'purchase_delivery_cep_prompt'),
          matchedCount: getCartItems(state).length,
          matchedProducts: getCartItems(state),
        };
      }

      if (context.isPickupRequest?.(message)) {
        const messageText = await maybeCall(context.buildPaymentMethodPrompt, { ...state.data, fulfillment: 'pickup' }, settings);
        if (!messageText) return null;
        return {
          message: messageText,
          intent: 'purchase_payment_method_prompt',
          nextState: buildState('payment', 'awaiting_payment_method', { ...state.data, fulfillment: 'pickup' }, 'purchase_payment_method_prompt'),
          matchedCount: getCartItems(state).length,
          matchedProducts: getCartItems(state),
        };
      }

      return buildContextualFallback(state, settings);
    }

    if (state.flow === 'payment' && state.step === 'awaiting_payment_method') {
      const payment = await maybeCall(context.parsePaymentMethod, message);
      if (!payment) return buildContextualFallback({ flow: 'payment', step: 'awaiting_method', data: state.data }, settings);
      const selectedPayment = await maybeCall(context.buildSelectedPayment, payment, state.data);
      if (!selectedPayment) return null;
      const messageText = await maybeCall(context.buildCustomerNamePrompt, settings);
      if (!messageText) return null;
      return {
        message: messageText,
        intent: 'purchase_customer_name_prompt',
        nextState: buildState('customer_data', 'awaiting_name', { ...state.data, payment: selectedPayment }, 'purchase_customer_name_prompt'),
        matchedCount: getCartItems(state).length,
        matchedProducts: getCartItems(state),
      };
    }

    if (state.flow === 'customer_data' && state.step === 'awaiting_name') {
      const customerName = String(message || '').trim();
      if (customerName.length < 5) return buildContextualFallback(state, settings);
      const messageText = await maybeCall(context.buildCustomerDocumentPrompt, settings);
      if (!messageText) return null;
      return {
        message: messageText,
        intent: 'purchase_customer_document_prompt',
        nextState: buildState('customer_data', 'awaiting_document', { ...state.data, customer_name: customerName }, 'purchase_customer_document_prompt'),
        matchedCount: getCartItems(state).length,
        matchedProducts: getCartItems(state),
      };
    }

    if (state.flow === 'customer_data' && state.step === 'awaiting_document') {
      const document = await maybeCall(context.parseCustomerDocument, message);
      if (!document) return buildContextualFallback(state, settings);
      const messageText = await maybeCall(context.buildHandoffReadyReply, { ...state.data, customer_document: document }, settings);
      if (!messageText) return null;
      return {
        message: messageText,
        intent: 'purchase_handoff_ready',
        nextState: buildState('handoff', 'ready', { ...state.data, customer_document: document }, 'purchase_handoff_ready'),
        matchedCount: getCartItems(state).length,
        matchedProducts: getCartItems(state),
      };
    }

    return buildContextualFallback(state, settings);
  },
};

export {
  purchaseFlowHandler,
  PURCHASE_FLOW_STEPS,
  buildState,
  parsePositiveInteger,
  hasStock,
};
