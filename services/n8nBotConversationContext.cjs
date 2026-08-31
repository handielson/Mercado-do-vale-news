const DEFAULT_CONTEXT_IDLE_MS = 2 * 60 * 60 * 1000;

function timestampMs(value) {
  const parsed = value instanceof Date ? value.getTime() : new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function contextBucket(value, fallbackMs = Date.now()) {
  const parsed = timestampMs(value) || fallbackMs;
  return new Date(parsed).toISOString().slice(0, 13).replace(/[-T]/g, '');
}

function buildMemorySessionKey(remoteJid, resetCount, contextStartedAt, nowMs = Date.now()) {
  const jid = String(remoteJid || '').trim();
  if (!jid) return '';
  const reset = Number(resetCount || 0);
  const resetSuffix = reset > 0 ? `:r${reset}` : '';
  return `${jid}${resetSuffix}:c${contextBucket(contextStartedAt, nowMs)}`;
}

function selectConversationContext(messageRows, {
  contextStartedAt,
  nowMs = Date.now(),
  idleMs = DEFAULT_CONTEXT_IDLE_MS,
} = {}) {
  const rows = Array.isArray(messageRows) ? messageRows : [];
  const latestAtMs = rows.reduce((latest, row) => Math.max(latest, timestampMs(row?.created_at)), 0);
  const isIdle = latestAtMs === 0 || nowMs - latestAtMs > idleMs;
  if (isIdle) {
    return {
      isIdle: true,
      contextStartedAt: new Date(nowMs),
      rows: [],
    };
  }

  const contextStartedAtMs = timestampMs(contextStartedAt);
  const activeRows = contextStartedAtMs > 0
    ? rows.filter((row) => timestampMs(row?.created_at) >= contextStartedAtMs)
    : rows;
  return {
    isIdle: false,
    contextStartedAt: contextStartedAtMs > 0 ? new Date(contextStartedAtMs) : new Date(latestAtMs),
    rows: activeRows,
  };
}

module.exports = {
  DEFAULT_CONTEXT_IDLE_MS,
  buildMemorySessionKey,
  contextBucket,
  selectConversationContext,
  timestampMs,
};
