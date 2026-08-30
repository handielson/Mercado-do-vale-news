export const STORY_SCHEDULE_PAST_TOLERANCE_MS = 60_000;

export function buildSocialStoryScheduleInstant(dateKey, timeValue) {
  const date = String(dateKey || '').trim();
  const time = String(timeValue || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const instant = new Date(`${date}T${time}:00`);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

export function prepareSocialStoryScheduleDates(selectedDates, timeValue, nowMs = Date.now()) {
  const entries = [...new Set(Array.isArray(selectedDates) ? selectedDates : [])]
    .sort()
    .map((dateKey) => ({
      dateKey,
      instant: buildSocialStoryScheduleInstant(dateKey, timeValue),
    }));
  const invalid = entries.find((entry) => !entry.instant) || null;
  const past = entries.find((entry) => (
    entry.instant && entry.instant.getTime() < Number(nowMs) - STORY_SCHEDULE_PAST_TOLERANCE_MS
  )) || null;
  return { entries, invalid, past };
}
