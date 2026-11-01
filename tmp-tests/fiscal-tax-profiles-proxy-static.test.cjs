const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

function loadProxyRule(file) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const start = source.indexOf('function isVpsProxyCustomerSelfServicePath(');
  const end = source.indexOf('\nasync function assertVpsProxyOrdersBelongToCustomer', start);
  assert.ok(start > 0 && end > start, `${file}: função do proxy não encontrada`);
  return new Function(`${source.slice(start, end)}; return isVpsProxyCustomerSelfServicePath;`)();
}

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  test(`${file}: proxy libera as rotas de perfis fiscais para a contadora`, () => {
    const allow = loadProxyRule(file);
    const c = '/accountant/companies/11111111-1111-4111-8111-111111111111';
    for (const [p, m] of [['/accountant/fiscal-catalog/info', 'GET'], ['/accountant/fiscal-catalog/ncm?search=celular', 'GET'], ['/accountant/fiscal-catalog/ncm/85171300', 'GET'],
      ['/accountant/fiscal-catalog/cest/2105300?ncm=85171300', 'GET'], [`${c}/tax-profiles`, 'GET'], [`${c}/tax-profiles`, 'POST'], [`${c}/tax-profiles/x`, 'PUT'], [`${c}/tax-profiles/x`, 'DELETE'],
      [`${c}/fiscal-products?filter=ready`, 'GET'], [`${c}/fiscal-products/x`, 'PUT'], [`${c}/fiscal-products/assign`, 'POST']]) assert.equal(allow(p, m), true, `${m} ${p}`);
    for (const [p, m] of [['/accountant/fiscal-catalog/ncm', 'POST'], [`${c}/tax-profiles/x/y`, 'GET'], [`${c}/certificate`, 'GET'], ['/admin/fiscal-companies', 'GET'], [`${c}/fiscal-products/x/y`, 'PUT']]) assert.equal(allow(p, m), false, `${m} ${p}`);
    assert.equal(allow(`${c}/tax-validation`, 'PUT'), true, 'regra antiga preservada');
  });
}
