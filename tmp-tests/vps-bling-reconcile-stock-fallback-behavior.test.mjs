import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function loadStockFetcher(file, fetchMock) {
  const source = readFileSync(file, 'utf8');
  const start = source.indexOf('async function fetchAllBlingStocksForReconcileVps');
  const end = source.indexOf('\nfunction normalizeReconcileTextVps', start);
  assert.ok(start >= 0 && end > start, `${file} must expose the reconcile stock fetcher`);
  const functionSource = source.slice(start, end);
  return new Function('fetch', 'readBlingProxyResponse', 'sleepBlingReconcileVps', 'getRemoteStockProductIdVps', `${functionSource}; return fetchAllBlingStocksForReconcileVps;`)(
    fetchMock,
    async (response) => response.body,
    async () => {},
    (item) => item?.produto?.id ?? item?.product?.id ?? item?.idProduto ?? item?.id ?? null,
  );
}

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const requestedUrls = [];
  const fetchMock = async (url) => {
    requestedUrls.push(url);
    if (url.includes('idsProdutos[]=')) {
      assert.match(url, /idsProdutos\[\]=16693307529/, `${file} must request the omitted Lii-S12 Bling ID`);
      return { ok: true, status: 200, body: { text: '', json: { data: [{ produto: { id: 16693307529 }, saldoFisicoTotal: 2 }] } } };
    }
    return { ok: true, status: 200, body: { text: '', json: { data: [{ produto: { id: 111 }, saldoFisicoTotal: 7 }] } } };
  };
  const fetchStocks = loadStockFetcher(file, fetchMock);
  const stocks = await fetchStocks('test-token', [111, 16693307529]);
  assert.equal(requestedUrls.length, 2, `${file} must supplement a non-empty but partial stock listing`);
  assert.deepEqual(stocks.map((item) => [String(item.produto.id), item.saldoFisicoTotal]), [['111', 7], ['16693307529', 2]], `${file} must return both listed and recovered stock balances`);
}

console.log('vps Bling reconcile stock fallback behavior checks ok');
