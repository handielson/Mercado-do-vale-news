const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../services/fiscalCatalog.cjs');
const { buildCest } = require('../scripts/fiscal-catalog-import.cjs');

test('NCM de 6 dígitos é recusado com motivo claro', () => {
  const r = catalog.lookupNcm('851713');
  assert.equal(r.valid, false); assert.equal(r.issue, 'ncm_incomplete');
});
test('NCM de smartphone vem com descrição oficial', () => {
  const r = catalog.lookupNcm('8517.13.00');
  assert.equal(r.valid, true); assert.equal(r.formatted, '8517.13.00'); assert.match(r.description, /smartphones/i);
});
test('NCM inexistente é recusado', () => assert.equal(catalog.lookupNcm('85171399').issue, 'ncm_not_found'));
test('CEST de smartphone: 21.053.00 e 21.053.01 primeiro, sem porta a porta', () => {
  const list = catalog.cestForNcm('85171300');
  assert.deepEqual(list.slice(0, 2).map(x => x.formatted), ['21.053.00', '21.053.01']);
  assert.ok(list.every(x => !x.doorToDoor));
  assert.ok(catalog.cestForNcm('85171300', { includeDoorToDoor: true }).some(x => x.doorToDoor));
});
test('compatibilidade CEST x NCM por prefixo', () => {
  assert.equal(catalog.cestMatchesNcm('2105300', '85171300'), true);
  assert.equal(catalog.cestMatchesNcm('2105300', '85176100'), false);
});
test('busca por texto e por código', () => {
  assert.ok(catalog.searchNcm('smartphones').some(x => x.code === '85171300'));
  assert.ok(catalog.searchNcm('8517.13').every(x => x.code.startsWith('851713')));
});
test('leitor do Confaz pega a redação vigente e ignora revogados', () => {
  const row = (item, cest, ncm, desc) => `<tr><td>${item}</td><td>${cest}</td><td>${ncm}</td><td>${desc}</td></tr>`;
  const note = text => `<tr><td colspan="4">${text}</td></tr>`;
  const filler = Array.from({ length: 600 }, (_, i) => row(`${i}.0`, `99.${String(i).padStart(3, '0')}.00`, '9999.99.99', 'x')).join('');
  const html = note('Nova redação') + row('53.0', '21.053.00', '8517.13.00 8517.14.3', 'Smartphones atual')
    + note('Redação original, efeitos até 01.05.22') + row('53.0', '21.053.00', '8517.12.3', 'Antiga')
    + row('110.0', '01.110.00', '7314.50.00', 'REVOGADO') + row('62.0', '28.062.00', 'Capítulos 13 e 15 a 17', 'Alimentos') + filler;
  const { data } = buildCest(html);
  const smart = data.items.find(i => i[0] === '2105300');
  assert.deepEqual(smart[2], ['85171300', '8517143']); assert.equal(smart[3], 'Smartphones atual');
  assert.ok(!data.items.some(i => i[0] === '0111000'));
  assert.deepEqual(data.items.find(i => i[0] === '2806200')[2], ['13', '15', '16', '17']);
});
test('fonte e vigência ficam registradas', () => {
  const i = catalog.info();
  assert.match(i.ncm.source, /Siscomex/); assert.ok(i.ncm.count > 9000); assert.match(i.cest.source, /142\/2018/);
});
