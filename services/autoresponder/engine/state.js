const VALID_FLOWS = new Set([
  'none',
  'greeting',
  'product_search',
  'purchase',
  'delivery',
  'payment',
  'customer_data',
  'handoff',
]);

function createEmptyConversationState() {
  return {
    flow: 'none',
    step: 'idle',
    data: {},
    last_intent: null,
    expires_at: null,
  };
}

function normalizeConversationState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return createEmptyConversationState();
  }

  const flow = VALID_FLOWS.has(String(value.flow || '')) ? String(value.flow) : 'none';
  const step = flow === 'none' ? 'idle' : String(value.step || '').trim() || 'idle';
  const data = value.data && typeof value.data === 'object' && !Array.isArray(value.data) ? value.data : {};
  const lastIntent = value.last_intent == null ? null : String(value.last_intent);
  const expiresAt = value.expires_at == null ? null : String(value.expires_at);

  return {
    flow,
    step,
    data,
    last_intent: lastIntent,
    expires_at: expiresAt,
  };
}

function isConversationStateExpired(state, now = new Date()) {
  const expiresAt = state?.expires_at ? new Date(state.expires_at) : null;
  return Boolean(expiresAt && Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() <= now.getTime());
}

export {
  VALID_FLOWS,
  createEmptyConversationState,
  normalizeConversationState,
  isConversationStateExpired,
};
