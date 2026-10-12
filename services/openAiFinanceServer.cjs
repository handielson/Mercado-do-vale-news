// OpenAI is the authority for billed costs. No documented prepaid balance API.
const COSTS_PATH = '/organization/costs';
function financeRange(days = 30, now = new Date()) {
  const count = Number(days);
  if (![7, 30, 90, 365].includes(count)) throw new Error('Selecione 7, 30, 90 ou 365 dias.');
  const end = Math.floor(now.getTime() / 1000);
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - count + 1);
  return { start_time: Math.floor(start.getTime() / 1000), end_time: end, days: count };
}
async function fetchBuckets(path, params, key, fetchImpl) {
  const data = [];
  const cursors = new Set();
  for (let i = 0; i < 20; i++) {
    const res = await fetchImpl(`https://api.openai.com/v1${path}?${params}`, {
      headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
    const payload = await res.json();
    if (!Array.isArray(payload.data)) throw new Error('Resposta OpenAI inválida.');
    data.push(...payload.data);
    if (!payload.has_more) return data;
    if (!payload.next_page || cursors.has(payload.next_page)) throw new Error('Paginação OpenAI incompleta.');
    cursors.add(payload.next_page);
    params.set('page', payload.next_page);
  }
  throw new Error('Paginação OpenAI excedeu o limite.');
}
const numeric = v => Number.isFinite(Number(v)) ? Number(v) : 0;
function summarizeCosts(buckets) {
  const daily = new Map(), items = new Map(), projects = new Map();
  let total = 0;
  for (const bucket of buckets) {
    const date = new Date(bucket.start_time * 1000).toISOString().slice(0, 10);
    daily.set(date, daily.get(date) || 0);
    for (const row of bucket.results || []) {
      if (row.amount?.currency !== 'usd') throw new Error('Moeda OpenAI não suportada.');
      const amount = numeric(row.amount?.value);
      total += amount;
      daily.set(date, daily.get(date) + amount);
      const item = row.line_item || 'Não discriminado';
      const project = row.project_id || 'Organização / sem projeto';
      items.set(item, (items.get(item) || 0) + amount);
      projects.set(project, (projects.get(project) || 0) + amount);
    }
  }
  const costRows = map => [...map].map(([name, cost_usd]) => ({ name, cost_usd })).sort((a,b) => b.cost_usd-a.cost_usd);
  return { total_usd: total, daily: [...daily].sort().map(([date, cost_usd]) => ({ date, cost_usd })), items: costRows(items), projects: costRows(projects) };
}
function summarizeUsage(buckets) {
  const models = new Map();
  for (const b of buckets) for (const row of b.results || []) {
    const name = row.model || 'Não discriminado';
    const sum = models.get(name) || { model: name, requests: 0, input_tokens: 0, cached_tokens: 0, output_tokens: 0 };
    sum.requests += numeric(row.num_model_requests);
    sum.input_tokens += numeric(row.input_tokens);
    sum.cached_tokens += numeric(row.input_cached_tokens);
    sum.output_tokens += numeric(row.output_tokens);
    models.set(name, sum);
  }
  return [...models.values()].sort((a,b) => b.input_tokens+b.output_tokens-a.input_tokens-a.output_tokens);
}
async function fetchOpenAiFinance({ apiKey, days = 30, now = new Date(), fetchImpl = fetch }) {
  const range = financeRange(days, now);
  const base = { start_time: String(range.start_time), end_time: String(range.end_time), bucket_width: '1d', limit: '31' };
  const common = { ...range, balance_usd: null, balance_status: 'not_available_via_public_api', source: 'openai', currency: 'USD', timezone: 'UTC' };
  if (!apiKey) return { ...common, status: 'missing_admin_key', costs: null, models: null, updated_at: null };
  const costParams = new URLSearchParams(base);
  costParams.set('limit', '180');
  costParams.append('group_by[]', 'line_item');
  costParams.append('group_by[]', 'project_id');
  const usageParams = new URLSearchParams(base);
  usageParams.append('group_by[]', 'model');
  const [costs, usage] = await Promise.allSettled([
    fetchBuckets(COSTS_PATH, costParams, apiKey, fetchImpl),
    fetchBuckets('/organization/usage/completions', usageParams, apiKey, fetchImpl),
  ]);
  let normalizedCosts = null;
  try { if (costs.status === 'fulfilled') normalizedCosts = summarizeCosts(costs.value); } catch { /* Never show incomplete totals. */ }
  return { ...common, status: normalizedCosts ? 'ok' : 'costs_unavailable', costs: normalizedCosts,
    models: usage.status === 'fulfilled' ? summarizeUsage(usage.value) : null,
    usage_status: usage.status === 'fulfilled' ? 'ok' : 'unavailable', updated_at: new Date().toISOString(),
  };
}
function registerOpenAiFinanceRoutes(fastify, { pool, requireAdminBearerToken }) {
  const cache = new Map();
  fastify.get('/admin/openai/finance', { preHandler: requireAdminBearerToken }, async (req, reply) => {
    const days = Number(req.query?.days || 30);
    try { financeRange(days); } catch (err) { return reply.code(400).send({ error: err.message }); }
    const [rows] = await pool.query('SELECT openai_admin_api_key FROM autoresponder_settings WHERE id = 1 LIMIT 1');
    const apiKey = String(rows[0]?.openai_admin_api_key || process.env.OPENAI_ADMIN_KEY || process.env.OPENAI_ADMIN_API_KEY || '').trim();
    const previous = cache.get(days);
    if (previous && previous.apiKey === apiKey && Date.now() - previous.time < 60000) return previous.promise;
    const promise = fetchOpenAiFinance({ apiKey, days });
    cache.set(days, { apiKey, time: Date.now(), promise });
    return promise;
  });
}
module.exports = { financeRange, summarizeCosts, summarizeUsage, fetchOpenAiFinance, registerOpenAiFinanceRoutes };
