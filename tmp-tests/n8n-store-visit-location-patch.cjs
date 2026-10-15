const assert = require('node:assert/strict');

const MARKER = 'store-visit-location-v638';
const VISIT_PATTERN = String.raw`/\b(?:ir|vir|passar|visitar|conferir|ver)\b.{0,50}\b(?:loja|pessoalmente|presencialmente)\b|\b(?:loja|pessoalmente|presencialmente)\b.{0,50}\b(?:ir|vir|passar|visitar|conferir|ver)\b/`;
const VISIT_EXCLUSION = String.raw`/\b(?:entreg(?:a|as|am|amos|ando|ar|ue|ues)|frete|motoboy|retirar|retirada|buscar pedido|horario|que horas)\b/`;

function replaceOnce(value, before, after, label) {
  assert.equal(value.split(before).length - 1, 1, `${label}: marcador ausente ou duplicado`);
  return value.replace(before, after);
}

function patchWorkflow(input) {
  const workflow = structuredClone(input);
  const node = (name) => {
    const found = workflow.nodes.find((entry) => entry.name === name);
    assert.ok(found, `Nó ausente: ${name}`);
    return found;
  };
  const classifier = node('Agente Inicial - Classificador');
  const parser = node('Parse Classificacao');
  const resolver = node('Resolver Acao de Conversacao');
  const location = node('Loja - Localizacao');
  assert.ok(!String(parser.parameters.jsCode).includes(MARKER), 'Patch já aplicado');

  classifier.parameters.options.systemMessage = replaceOnce(
    classifier.parameters.options.systemMessage,
    '- Perguntas sobre onde fica, endereco, localizacao, mapa ou rota da loja: localizacao_loja. Nunca classifique esse pedido como pedido_humano.',
    '- Perguntas sobre onde fica, endereco, localizacao, mapa ou rota da loja, ou sobre vir pessoalmente conferir aparelhos na loja: localizacao_loja. Perguntas sobre entrega, frete ou retirada de pedido seguem seu fluxo proprio. Nunca classifique visita à loja como pedido_humano.',
    'classificador',
  );

  parser.parameters.jsCode = replaceOnce(
    parser.parameters.jsCode,
    'const storeLocationIntentV129 = /\\b(onde fica|onde e|qual (e|eh) o endereco|me passa|manda|passa).{0,30}\\b(endereco|localizacao|mapa|rota)\\b|\\b(endereco|localizacao|mapa|rota) da loja\\b/.test(storeLocationNormalizedV129);',
    `const storeLocationIntentV129 = /\\b(onde fica|onde e|qual (e|eh) o endereco|me passa|manda|passa).{0,30}\\b(endereco|localizacao|mapa|rota)\\b|\\b(endereco|localizacao|mapa|rota) da loja\\b/.test(storeLocationNormalizedV129);\n// ${MARKER}: visita presencial usa o mesmo ramo de endereco e mapa.\nconst storeVisitIntentV638 = ${VISIT_PATTERN}.test(storeLocationNormalizedV129) && !${VISIT_EXCLUSION}.test(storeLocationNormalizedV129);`,
    'parser visit intent',
  );
  parser.parameters.jsCode = replaceOnce(
    parser.parameters.jsCode,
    ': (storeLocationIntentV129\n',
    ': (storeLocationIntentV129 || storeVisitIntentV638\n',
    'parser route',
  );

  resolver.parameters.jsCode = replaceOnce(
    resolver.parameters.jsCode,
    'const normalizedStoreLocationV129 = normalize(text);',
    `const normalizedStoreLocationV129 = normalize(text);\n// ${MARKER}: preservar visita presencial mesmo se o classificador errar.\nconst storeVisitIntentV638 = ${VISIT_PATTERN}.test(normalizedStoreLocationV129) && !${VISIT_EXCLUSION}.test(normalizedStoreLocationV129);\nconst deterministicStoreVisitV638 = storeVisitIntentV638 ? { acao: 'consultar_localizacao_loja', intencao: 'localizacao_loja', confianca: 1, motivo: 'Cliente quer visitar a loja para conferir aparelhos.' } : null;`,
    'resolver visit intent',
  );
  resolver.parameters.jsCode = replaceOnce(
    resolver.parameters.jsCode,
    'const decision = birthdayCorrectionV372 || collectionProductDecisionV1 ||',
    'const decision = birthdayCorrectionV372 || deterministicStoreVisitV638 || collectionProductDecisionV1 ||',
    'resolver priority',
  );

  location.parameters.jsCode = String.raw`const source = $('Parse Classificacao').first().json || $json || {};
const company = $json || {};
const address = String(company.address || '').trim();
const lat = company.address_lat == null ? '' : String(company.address_lat).trim();
const lng = company.address_lng == null ? '' : String(company.address_lng).trim();
const hasCoords = lat && lng && lat !== '0' && lng !== '0';
const mapsQuery = hasCoords ? (lat + ',' + lng) : address;
const mapsLink = mapsQuery ? 'https://maps.google.com/?q=' + encodeURIComponent(mapsQuery) : '';
const normalized = String(source.conversation || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const isVisit = ${VISIT_PATTERN}.test(normalized) && !${VISIT_EXCLUSION}.test(normalized);
const schedule = company.business_hours && typeof company.business_hours === 'object' ? company.business_hours : null;
const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Recife', weekday: 'long' }).format(new Date()).toLowerCase();
const today = schedule?.[weekday];
const validTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
const regularHours = today?.isOpen === true && validTime(today.openTime) && validTime(today.closeTime)
  ? '🕒 Horário regular de hoje: ' + today.openTime + ' às ' + today.closeTime + (today.hasLunchBreak && validTime(today.lunchStart) && validTime(today.lunchEnd) ? ' (pausa ' + today.lunchStart + '–' + today.lunchEnd + ')' : '') + '. Em feriados, confirme conosco.'
  : '';
if (!address || !mapsLink) {
  return [{ json: { ...source, output: 'Vou confirmar o endereco e o link do mapa com nossa equipe antes de orientar sua visita. 📍' } }];
}
const first = isVisit
  ? 'Pode sim! 😊 Você pode vir conferir os aparelhos pessoalmente.[[BR]]📍 Mercado do Vale: ' + address + (regularHours ? '[[BR]]' + regularHours : '')
  : '📍 Mercado do Vale: ' + address;
const lines = [
  first,
  '🗺️ Google Maps: ' + mapsLink,
  isVisit ? 'Se algum modelo te interessou, diga qual para eu conferir a disponibilidade antes da visita.' : 'Se precisar de ajuda para chegar, pode chamar por aqui. 😊',
];
return [{ json: { ...source, output: lines.join('||') } }];`;

  for (const current of [parser, resolver, location]) new Function('$', '$json', '$getWorkflowStaticData', current.parameters.jsCode);
  return workflow;
}

function amendLocationHours(input, originalBefore) {
  const workflow = structuredClone(input);
  const location = workflow.nodes.find((entry) => entry.name === 'Loja - Localizacao');
  assert.ok(location?.parameters?.jsCode?.includes('Pode sim! 😊 Você pode vir conferir os aparelhos pessoalmente.'), 'Primeira correção de visita ausente');
  assert.ok(!location.parameters.jsCode.includes('Horário regular de hoje'), 'Horário já publicado');
  const expected = patchWorkflow(originalBefore).nodes.find((entry) => entry.name === 'Loja - Localizacao');
  location.parameters.jsCode = expected.parameters.jsCode;
  new Function('$', '$json', location.parameters.jsCode);
  return workflow;
}

module.exports = { patchWorkflow, amendLocationHours, MARKER };
