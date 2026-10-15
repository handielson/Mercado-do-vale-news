const test = require('node:test');
const assert = require('node:assert/strict');
const { patchWorkflow, amendLocationHours, MARKER } = require('./n8n-store-visit-location-patch.cjs');

const original = {
  nodes: [
    { name: 'Agente Inicial - Classificador', parameters: { options: { systemMessage: '- Perguntas sobre onde fica, endereco, localizacao, mapa ou rota da loja: localizacao_loja. Nunca classifique esse pedido como pedido_humano.' } } },
    { name: 'Parse Classificacao', parameters: { jsCode: `const storeLocationNormalizedV129 = String(source.conversation || '').trim();
const storeLocationIntentV129 = /\\b(onde fica|onde e|qual (e|eh) o endereco|me passa|manda|passa).{0,30}\\b(endereco|localizacao|mapa|rota)\\b|\\b(endereco|localizacao|mapa|rota) da loja\\b/.test(storeLocationNormalizedV129);
let intencao = other ? 'other' : (storeLocationIntentV129
    ? 'localizacao_loja' : 'fallback');` } },
    { name: 'Resolver Acao de Conversacao', parameters: { jsCode: `const normalizedStoreLocationV129 = normalize(text);
const decision = birthdayCorrectionV372 || collectionProductDecisionV1 || fallbackDecision();` } },
    { name: 'Loja - Localizacao', parameters: { jsCode: 'return [];' } },
  ],
  connections: { 'Loja - Localizacao': { main: [[{ node: 'Dividir mensagens', type: 'main', index: 0 }]] } },
};
const candidate = patchWorkflow(original);
const code = (name) => candidate.nodes.find((node) => node.name === name).parameters.jsCode;

function visitIntent(message) {
  const normalized = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const expression = code('Parse Classificacao').match(/const storeVisitIntentV638 = ([^;]+);/)[1];
  return new Function('storeLocationNormalizedV129', `return ${expression}`)(normalized);
}

function locationOutput(message, company) {
  const source = { conversation: message, remoteJid: 'test@s.whatsapp.net' };
  const getNode = () => ({ first: () => ({ json: source }) });
  return new Function('$', '$json', code('Loja - Localizacao'))(getNode, company)[0].json.output;
}

test('visita presencial entra no ramo de localização sem capturar entrega e retirada', () => {
  for (const message of ['Tenho que ir na loja conferir presencial', 'Posso ir pessoalmente?', 'Quero visitar a loja para ver os aparelhos']) {
    assert.equal(visitIntent(message), true, message);
  }
  for (const message of ['Vocês entregam ou tenho que ir na loja?', 'Posso retirar meu pedido na loja?', 'Que horas a loja fecha?', 'Pode ser?']) {
    assert.equal(visitIntent(message), false, message);
  }
  assert.match(code('Resolver Acao de Conversacao'), /birthdayCorrectionV372 \|\| deterministicStoreVisitV638 \|\| collectionProductDecisionV1/);
  assert.match(candidate.nodes.find((node) => node.name === 'Agente Inicial - Classificador').parameters.options.systemMessage, /vir pessoalmente conferir aparelhos na loja/);
  assert.match(code('Parse Classificacao'), new RegExp(MARKER));
});

test('visita envia endereço cadastrado e link Google em mensagens curtas', () => {
  const address = 'ABILIO MOURATO CRUZ, 5 - LOJA C - COHAB MASSANGANO - PETROLINA - PE';
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Recife', weekday: 'long' }).format(new Date()).toLowerCase();
  const parts = locationOutput('Tenho que ir na loja conferir presencial', { address, address_lat: null, address_lng: null, business_hours: { [weekday]: { isOpen: true, openTime: '08:00', closeTime: '18:00', hasLunchBreak: true, lunchStart: '12:00', lunchEnd: '14:00' } } }).split('||');
  assert.equal(parts.length, 3);
  assert.match(parts[0], /Pode sim![\s\S]*ABILIO MOURATO CRUZ, 5 - LOJA C/);
  assert.match(parts[0], /Horário regular de hoje: 08:00 às 18:00/);
  assert.equal(parts[1], '🗺️ Google Maps: https://maps.google.com/?q=' + encodeURIComponent(address));
  assert.match(parts[2], /modelo.*disponibilidade/);
});

test('pedido direto de localização usa coordenadas válidas e falha fechada sem endereço', () => {
  const direct = locationOutput('Onde fica a loja?', { address: 'Rua Teste, 1', address_lat: -9.3, address_lng: -40.5 }).split('||');
  assert.equal(direct[1], '🗺️ Google Maps: https://maps.google.com/?q=-9.3%2C-40.5');
  assert.doesNotMatch(direct[0], /Pode sim/);
  const missing = locationOutput('Posso ir pessoalmente?', { address: '' });
  assert.match(missing, /Vou confirmar o endereco/);
  assert.doesNotMatch(missing, /maps\.google/);
  const unknownSchedule = locationOutput('Posso ir pessoalmente?', { address: 'Rua Teste, 1' });
  assert.doesNotMatch(unknownSchedule, /Horário regular/);
});

test('patch mantém grafo e não aceita reaplicação silenciosa', () => {
  assert.deepEqual(candidate.connections, original.connections);
  assert.equal(candidate.nodes.length, original.nodes.length);
  assert.throws(() => patchWorkflow(candidate), /Patch já aplicado/);
});

test('complemento de horário altera somente o nó de localização', () => {
  const liveV1 = structuredClone(candidate);
  liveV1.nodes.find((node) => node.name === 'Loja - Localizacao').parameters.jsCode = "return [{json:{output:'Pode sim! 😊 Você pode vir conferir os aparelhos pessoalmente.'}}];";
  const amended = amendLocationHours(liveV1, original);
  const changed = amended.nodes.filter((node, index) => JSON.stringify(node) !== JSON.stringify(liveV1.nodes[index])).map((node) => node.name);
  assert.deepEqual(changed, ['Loja - Localizacao']);
  assert.deepEqual(amended.connections, liveV1.connections);
  assert.match(amended.nodes.find((node) => node.name === 'Loja - Localizacao').parameters.jsCode, /Horário regular de hoje/);
});
