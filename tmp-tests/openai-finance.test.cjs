const assert = require('node:assert/strict');
const test = require('node:test');
const { fetchOpenAiFinance, financeRange, summarizeCosts, registerOpenAiFinanceRoutes } = require('../services/openAiFinanceServer.cjs');
test('range is UTC, rejects arbitrary expensive periods', () => {
  assert.deepEqual(financeRange(7, new Date('2026-10-12T17:00:00Z')), { start_time: Date.parse('2026-10-06T00:00:00Z')/1000, end_time: Date.parse('2026-10-12T17:00:00Z')/1000, days: 7 });
  assert.throws(() => financeRange(10000));
});
test('missing admin key is unavailable, never zero balance', async () => {
  const result = await fetchOpenAiFinance({ apiKey: '', fetchImpl: () => { throw Error('must not call'); } });
  assert.equal(result.costs, null); assert.equal(result.balance_usd, null); assert.equal(result.status, 'missing_admin_key');
});
test('official costs paginate and usage is separate; no key reaches response', async () => {
  const urls = [];
  const result = await fetchOpenAiFinance({ apiKey: 'SECRET', fetchImpl: async (url, options) => {
    urls.push(url); assert.equal(options.headers.Authorization, 'Bearer SECRET');
    if (url.includes('/usage/')) return { ok: true, json: async () => ({ data: [{ results: [{ model: 'm', num_model_requests: 2, input_tokens: 100, input_cached_tokens: 30, output_tokens: 20 }] }] }) };
    const second = url.includes('page=next');
    return { ok: true, json: async () => ({ data: [{ start_time: second ? 86400 : 0, results: [{ amount: { currency: 'usd', value: second ? 2 : 1 }, line_item: 'm, input', project_id: 'p' }] }], has_more: !second, next_page: second ? null : 'next' }) };
  } });
  assert.equal(result.costs.total_usd, 3); assert.equal(result.costs.items[0].cost_usd, 3);
  assert.equal(result.models[0].input_tokens, 100); assert.equal(result.models[0].cached_tokens, 30);
  assert.equal(result.balance_usd, null); assert.doesNotMatch(JSON.stringify(result), /SECRET/);
  assert.ok(urls.some(url => url.includes('group_by%5B%5D=line_item')));
});
test('pagination failure must not show a partial total as confirmed', async () => {
  const result = await fetchOpenAiFinance({ apiKey: 'x', fetchImpl: async url => ({ ok: true, json: async () => url.includes('/costs?') ? { data: [], has_more: true, next_page: 'same' } : { data: [] } }) });
  assert.equal(result.costs, null); assert.equal(result.status, 'costs_unavailable');
});
test('401/errors never masquerade as zero spending or leak upstream details', async () => {
  const result = await fetchOpenAiFinance({ apiKey: 'x', fetchImpl: async () => ({ ok: false, status: 401, text: () => 'sensitive' }) });
  assert.equal(result.costs, null); assert.equal(result.models, null); assert.doesNotMatch(JSON.stringify(result), /sensitive/);
});
test('different currency cannot be silently summed as USD', () => {
  assert.throws(() => summarizeCosts([{start_time: 0, results: [{amount: {currency: 'eur', value: 1}}]}]));
});
test('finance route uses admin bearer gate and invalid period makes no SQL call', async () => {
  let route;
  const guard = () => {};
  registerOpenAiFinanceRoutes({get: (url, options, handler) => {route={url,options,handler};}}, {pool: {query: () => {throw Error('must not query');}}, requireAdminBearerToken: guard});
  assert.equal(route.options.preHandler, guard);
  const reply = { code: n => ({ send: payload => ({ status: n, payload }) }) };
  assert.equal((await route.handler({query:{days:100}}, reply)).status, 400);
});
test('view distinguishes unknown balance/spend and escapes billing names', () => {
  const React = require('react');
  const source = require('fs').readFileSync('components/whatsapp/OpenAiFinancePanel.tsx','utf8');
  const js = require('typescript').transpileModule(source, {compilerOptions: {jsx: require('typescript').JsxEmit.React, module: require('typescript').ModuleKind.CommonJS, target: require('typescript').ScriptTarget.ES2022, esModuleInterop: true}}).outputText;
  const context = {exports:{}, require: name => name === 'react' ? React : name === 'lucide-react' ? require('lucide-react') : {}, Map, Math, Intl, Date};
  require('vm').runInNewContext(js,context);
  const render = props => require('react-dom/server').renderToStaticMarkup(React.createElement(context.exports.OpenAiFinanceView,props));
  const unavailable = render({data:null,error:null});
  assert.match(unavailable,/Conferir saldo na OpenAI/); assert.doesNotMatch(unavailable,/US\$/);
  const empty = render({data:{days:7,status:'ok',costs:{total_usd:0,daily:[],items:[],projects:[]},models:[]},error:null});
  assert.match(empty,/Sem cobranças registradas/);
  const actual = render({data:{days:7,status:'ok',costs:{total_usd:2,daily:[],items:[{name:'<script>bad</script>',cost_usd:2}],projects:[]},models:null},error:null});
  assert.match(actual,/&lt;script&gt;/); assert.doesNotMatch(actual,/<script>/);
  assert.match(actual,/discriminação de tokens/);
});
