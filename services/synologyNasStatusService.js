const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

function isPresent(value) {
  return value !== undefined && value !== null && value !== '';
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readNumber(...values) {
  for (const value of values) {
    if (!isPresent(value)) continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return { value: parsed, present: true };
    }
  }

  return { value: 0, present: false };
}

function clampNonNegative(value) {
  return Math.max(0, toNumber(value));
}

function toPercent(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function normalizeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

export function resolveSynologyFreshness(timestamp, now = new Date()) {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return { state: 'offline', age_ms: null };
  }

  const ageMs = Math.max(0, now.getTime() - parsed.getTime());
  if (ageMs >= OFFLINE_THRESHOLD_MS) {
    return { state: 'offline', age_ms: ageMs };
  }
  if (ageMs >= ONLINE_THRESHOLD_MS) {
    return { state: 'stale', age_ms: ageMs };
  }

  return { state: 'online', age_ms: ageMs };
}

export function resolveSynologyHealth({
  freshnessState,
  memoryAvailablePercent,
  swapUsedPercent,
}) {
  if (freshnessState === 'offline') {
    return {
      level: 'critical',
      message: 'Heartbeat do NAS expirou',
    };
  }

  if (memoryAvailablePercent < 15 || swapUsedPercent >= 40) {
    return {
      level: 'critical',
      message: 'Memoria critica no NAS',
    };
  }

  if (memoryAvailablePercent < 25 || swapUsedPercent >= 20 || freshnessState === 'stale') {
    return {
      level: 'warning',
      message: 'NAS requer atencao',
    };
  }

  return {
    level: 'ok',
    message: 'Memoria estavel',
  };
}

function normalizeMemory(memory = {}) {
  const total = readNumber(memory.total_mb, memory.totalMB, memory.total).value;
  const usedField = readNumber(memory.used_mb, memory.usedMB, memory.used);
  const availableField = readNumber(memory.available_mb, memory.availableMB, memory.available);

  const used = usedField.present
    ? clampNonNegative(usedField.value)
    : (total > 0 && availableField.present ? clampNonNegative(total - availableField.value) : 0);
  const available = availableField.present
    ? clampNonNegative(availableField.value)
    : (total > 0 ? clampNonNegative(total - used) : 0);

  return {
    total_mb: clampNonNegative(total),
    used_mb: used,
    available_mb: available,
    used_percent: toPercent(used, total),
    available_percent: toPercent(available, total),
  };
}

function normalizeSwap(swap = {}) {
  const total = readNumber(swap.total_mb, swap.totalMB, swap.total).value;
  const usedField = readNumber(swap.used_mb, swap.usedMB, swap.used);
  const freeField = readNumber(swap.free_mb, swap.freeMB, swap.free);

  const used = usedField.present
    ? clampNonNegative(usedField.value)
    : (total > 0 && freeField.present ? clampNonNegative(total - freeField.value) : 0);
  const free = freeField.present
    ? clampNonNegative(freeField.value)
    : (total > 0 ? clampNonNegative(total - used) : 0);

  return {
    total_mb: clampNonNegative(total),
    used_mb: used,
    free_mb: free,
    used_percent: toPercent(used, total),
  };
}

function normalizeCache(cache = {}) {
  return {
    cached_mb: clampNonNegative(cache.cached_mb ?? cache.cachedMB ?? cache.cached),
    buffers_mb: clampNonNegative(cache.buffers_mb ?? cache.buffersMB ?? cache.buffers),
    slab_mb: clampNonNegative(cache.slab_mb ?? cache.slabMB ?? cache.slab),
  };
}

function normalizeScheduledReboot(value = {}) {
  return {
    enabled: Boolean(value.enabled),
    label: normalizeText(value.label),
  };
}

export function normalizeSynologyStatusPayload(payload = {}, now = new Date()) {
  const timestamp = isPresent(payload.timestamp) ? payload.timestamp : now.toISOString();
  const freshness = resolveSynologyFreshness(timestamp, now);

  const memory = normalizeMemory(payload.memory || {});
  const swap = normalizeSwap(payload.swap || {});
  const cache = normalizeCache(payload.cache || {});
  const health = resolveSynologyHealth({
    freshnessState: freshness.state,
    memoryAvailablePercent: memory.available_percent,
    swapUsedPercent: swap.used_percent,
  });

  return {
    ok: freshness.state === 'online',
    hostname: normalizeText(payload.hostname, 'Synology NAS'),
    model: normalizeText(payload.model),
    timestamp: new Date(timestamp).toISOString(),
    received_at: now.toISOString(),
    uptime_seconds: clampNonNegative(payload.uptime_seconds ?? payload.uptimeSeconds),
    memory,
    swap,
    cache,
    health,
    freshness,
    scheduled_reboot: normalizeScheduledReboot(payload.scheduled_reboot || {}),
  };
}

export function buildSynologyStatusResponse({ snapshot, command = null, now = new Date() } = {}) {
  if (!snapshot) {
    return {
      ok: false,
      state: 'missing',
      snapshot: null,
      command,
    };
  }

  const normalized = normalizeSynologyStatusPayload(snapshot, now);
  return {
    ok: normalized.freshness.state === 'online',
    state: normalized.freshness.state,
    snapshot: normalized,
    command,
  };
}
