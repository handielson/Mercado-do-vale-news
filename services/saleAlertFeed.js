const MAX_AGE_MS = 30 * 60 * 1000;
const MAX_SEEN_IDS = 200;

export function classifySaleAlerts(events, seenIds, initialized, nowMs = Date.now()) {
  const previous = new Set(Array.isArray(seenIds) ? seenIds.filter((id) => typeof id === 'string') : []);
  const validEvents = Array.isArray(events)
    ? events.filter((event) => event && typeof event.id === 'string' && event.id)
    : [];
  const fresh = initialized
    ? validEvents.filter((event) => {
      if (previous.has(event.id)) return false;
      const createdAt = Date.parse(event.created_at);
      const age = nowMs - createdAt;
      return Number.isFinite(age) && age >= -5 * 60 * 1000 && age <= MAX_AGE_MS;
    })
    : [];
  const nextSeenIds = [...new Set([...validEvents.map((event) => event.id), ...previous])].slice(0, MAX_SEEN_IDS);
  return { alerts: fresh.reverse(), seenIds: nextSeenIds };
}
