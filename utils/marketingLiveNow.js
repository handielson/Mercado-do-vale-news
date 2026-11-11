// marketing-live-now-v1: o que está no ar agora no marketing (Central de Aprovações) e arquivo das falhas antigas.

const FINAL_STORY_STATUSES = new Set(['completed', 'cancelled', 'canceled', 'failed', 'partial', 'rejected', 'expired']);
export const FAILURE_ARCHIVE_DAYS = 30;

const ms = (value) => {
  if (!value) return NaN;
  const text = String(value);
  return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(text) || !text.includes(' ') ? text : text.replace(' ', 'T') + 'Z');
};

/** Stories ainda por publicar (ou publicando agora), do mais próximo ao mais distante. */
export function upcomingStories(schedules, now = Date.now()) {
  return (Array.isArray(schedules) ? schedules : [])
    .filter((schedule) => !FINAL_STORY_STATUSES.has(String(schedule?.status || '').toLowerCase()))
    .map((schedule) => {
      const times = (schedule.items || []).map((item) => ms(item.scheduled_at)).filter(Number.isFinite);
      const next = times.filter((time) => time >= now - 15 * 60 * 1000).sort((a, b) => a - b)[0] ?? ms(schedule.scheduled_at);
      return { schedule, next, last: times.length ? Math.max(...times) : ms(schedule.scheduled_at) };
    })
    .filter((entry) => Number.isFinite(entry.next) && entry.last >= now - 15 * 60 * 1000)
    .sort((a, b) => a.next - b.next);
}

/**
 * Horário gravado no horário da loja (America/Sao_Paulo) que a API devolve como se fosse UTC
 * (ex.: next_run_at da campanha do Marketplace). Mostra o relógio como está, sem converter fuso.
 */
export function storeClockLabel(value) {
  const time = ms(value);
  if (!Number.isFinite(time)) return '';
  const date = new Date(time);
  const pad = (number) => String(number).padStart(2, '0');
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

/** Falha antiga (mais de 30 dias) sai das abas e dos contadores; continua em "Todas". */
export function isArchivedFailure(request, now = Date.now(), days = FAILURE_ARCHIVE_DAYS) {
  if (request?.status !== 'failed') return false;
  const time = ms(request.updated_at || request.created_at);
  return Number.isFinite(time) && now - time > days * 24 * 60 * 60 * 1000;
}

export const isActiveFlag = (value) => value === true || value === 1 || value === '1';
