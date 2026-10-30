'use strict';

const TIME_ZONE = 'America/Recife';
const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
  hourCycle: 'h23',
});

function localParts(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour) };
}

function cashSessionCutoff(openedAt, now = new Date()) {
  const opened = localParts(openedAt);
  const current = localParts(now);
  if (!opened || !current) return { requires_closing: true, cutoff_at: null };
  // Recife observes UTC-03 and has no daylight saving time. The deadline belongs to the opening day.
  const cutoffAt = new Date(Date.UTC(opened.year, opened.month - 1, opened.day, 23)).toISOString();
  return { requires_closing: new Date(now).getTime() >= Date.parse(cutoffAt), cutoff_at: cutoffAt };
}

function cashOpeningAllowed(now = new Date()) {
  const current = localParts(now);
  return Boolean(current && current.hour < 20);
}

module.exports = { cashSessionCutoff, cashOpeningAllowed };
