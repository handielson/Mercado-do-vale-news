function timestampMs(value) {
  const parsed = value instanceof Date ? value.getTime() : new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildMemorySessionKey(remoteJid, resetCount) {
  const jid = String(remoteJid || '').trim();
  if (!jid) return '';
  const reset = Number(resetCount || 0);
  const resetSuffix = reset > 0 ? `:r${reset}` : '';
  return `${jid}${resetSuffix}`;
}

function selectConversationContext(messageRows) {
  const rows = Array.isArray(messageRows) ? messageRows : [];
  const latestAtMs = rows.reduce((latest, row) => Math.max(latest, timestampMs(row?.created_at)), 0);
  return {
    isIdle: false,
    contextStartedAt: latestAtMs > 0 ? new Date(latestAtMs) : null,
    rows,
  };
}

module.exports = {
  buildMemorySessionKey,
  selectConversationContext,
  timestampMs,
};
