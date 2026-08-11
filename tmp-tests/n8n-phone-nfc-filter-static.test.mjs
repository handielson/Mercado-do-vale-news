import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  SMARTPHONES_CATEGORY_ID,
  normalizeNfcValue,
  detectPhoneNfcFilter,
  conflictingNfcKeys,
  filterRowsByNfc,
  buildFilterLabel,
  patchResolver,
  patchPrepare,
  patchContext,
  patchSalesContextState,
  patchSalesSpecialist,
} = require('./n8n-add-phone-nfc-filter.cjs');

assert.equal(normalizeNfcValue('Sim'), 'sim');
assert.equal(normalizeNfcValue('Nao'), 'nao');
assert.equal(normalizeNfcValue('Consulte'), 'consulte');
assert.equal(normalizeNfcValue(''), '');

assert.equal(detectPhoneNfcFilter('Quais celulares tem NFC?'), 'sim');
assert.equal(detectPhoneNfcFilter('qual tem NFC?'), 'sim');
assert.equal(detectPhoneNfcFilter('celular com NFC e 128GB'), 'sim');
assert.equal(detectPhoneNfcFilter('qual celular tem pagamento por aproximacao?'), 'sim');
assert.equal(detectPhoneNfcFilter('qual tem pagamento por aproximacao?', { activeCategoryId: SMARTPHONES_CATEGORY_ID }), 'sim');

assert.equal(detectPhoneNfcFilter('Voces emitem NFC-e?'), '');
assert.equal(detectPhoneNfcFilter('preciso da NFCe da compra'), '');
assert.equal(detectPhoneNfcFilter('quero a nota fiscal'), '');
assert.equal(detectPhoneNfcFilter('aceita pagamento por aproximacao?'), '');
assert.equal(detectPhoneNfcFilter('tem smartwatch com NFC?'), '');
assert.equal(detectPhoneNfcFilter('tem capa para celular com NFC?'), '');

const rows = [
  { id: '1', sku: 'OK128', status: 'active', stock_quantity: 2, specs: { nfc: 'Sim', ram: '6GB', storage: '128GB' } },
  { id: '2', sku: 'OK256', status: 'active', stock_quantity: 1, specs: { nfc: 'Sim', ram: '8GB', storage: '256GB' } },
  { id: '3', sku: 'NO128', status: 'active', stock_quantity: 1, specs: { nfc: 'Nao', ram: '6GB', storage: '128GB' } },
  { id: '4', sku: 'ASK128', status: 'active', stock_quantity: 1, specs: { nfc: 'Consulte', ram: '6GB', storage: '128GB' } },
  { id: '5', sku: 'CONFLICT', status: 'active', stock_quantity: 1, specs: { nfc: 'Sim', ram: '8GB', storage: '256GB' } },
  { id: '6', sku: 'CONFLICT', status: 'active', stock_quantity: 1, specs: { nfc: 'Consulte', ram: '8GB', storage: '256GB' } },
];

assert.deepEqual([...conflictingNfcKeys(rows)], ['sku:conflict']);
assert.deepEqual(filterRowsByNfc(rows, 'sim').map((row) => row.sku), ['OK128', 'OK256']);
assert.deepEqual(
  filterRowsByNfc(rows, 'sim')
    .filter((row) => row.specs.storage === '128GB')
    .map((row) => row.sku),
  ['OK128'],
);

assert.equal(buildFilterLabel({ requestedNfc: 'sim' }), 'NFC');
assert.equal(
  buildFilterLabel({ requestedNfc: 'sim', memoryFilterLabel: '8GB de RAM e 256GB de armazenamento' }),
  'NFC e 8GB de RAM e 256GB de armazenamento',
);

const resolverNode = { parameters: { jsCode: `
const parsed = safeJsonParse(rawOutput);
const decision = deterministicMetaSmartphonesIntroV167 || deterministicFiscalDocumentDecisionV164 || deterministicSmartwatchCatalogV162 || deterministicPhoneMemoryFilterV155 || fallbackDecision();
return [{ json: {
    requestedMemory: String(decision.memoria || ''),
} }];` } };
patchResolver(resolverNode);
assert.match(resolverNode.parameters.jsCode, /fiscalNfcGuardV228/);
assert.match(resolverNode.parameters.jsCode, /deterministicFiscalDocumentDecisionV164 \|\| deterministicPhoneNfcFilterV228/);
assert.match(resolverNode.parameters.jsCode, /requestedNfc: phoneNfcFilterIntentV228 \? 'sim' : ''/);

const prepareNode = { parameters: { jsCode: `
const phoneMemoryFilterRequest = explicitPhoneDeviceRequest && !accessoryRequest && (requestedRamGb.length > 0 || requestedStorageGb.length > 0);
const forceSmartphoneCategory = Boolean(
  source.deviceClarificationConfirmed
  || phoneMemoryFilterRequest
);
return [{ json: {
    phoneMemoryFilterRequest,
    requestedRamGb,
} }];` } };
patchPrepare(prepareNode);
assert.match(prepareNode.parameters.jsCode, /explicitPhoneDeviceRequest \|\| phoneNfcFilterRequestV228/);
assert.match(prepareNode.parameters.jsCode, /\|\| phoneNfcFilterRequestV228\n\);/);
assert.match(prepareNode.parameters.jsCode, /requestedNfc: requestedNfcV228/);

const contextNode = { parameters: { jsCode: `
const selectedCardFee = fees;
const candidateProducts = memoryFilteredRowsV155
  .filter(Boolean);
const memoryFilterTitleV155 = phoneMemoryFilterRequestV155 && base.memoryFilterLabel
  ? '📱 Celulares com ' + base.memoryFilterLabel
  : '';
staticData.salesPostList[remoteJid] = {
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + 60 * 60 * 1000,
      options: products.map((product, index) => ({ number: index + 1 })),
};
const unavailablePhoneOfferV165 = products.length === 0 && prefersSmartphones;
return [{ json: {
    productsContext: lines.join('\\n'),
} }];` } };
patchContext(contextNode);
assert.match(contextNode.parameters.jsCode, /const candidateProducts = featureFilteredRowsV228/);
assert.match(contextNode.parameters.jsCode, /for \(const product of rows\)/);
assert.match(contextNode.parameters.jsCode, /phoneFilterLabelV228/);
assert.match(contextNode.parameters.jsCode, /filters: \{/);
assert.match(contextNode.parameters.jsCode, /!phoneNfcFilterRequestV228 && !phoneMemoryFilterRequestV155/);
assert.match(contextNode.parameters.jsCode, /FILTRO_INTERNO_NFC_SEM_RESULTADO_CONFIRMADO/);

const stateNode = { parameters: { jsCode: `return [{ json: {
      pedidoEmMontagem: activeState.orderDraft || null,
      opcoes: [],
} }];` } };
patchSalesContextState(stateNode);
assert.match(stateNode.parameters.jsCode, /filtros: activeState\.filters \|\| \{\}/);
assert.match(stateNode.parameters.jsCode, /categoriaId: activeState\.categoryId \|\| ''/);

const specialistNode = { parameters: { options: { systemMessage: '- Se nao houver produtos no contexto, isso significa apenas que a busca automatica nao localizou resultado. Nao afirme que o item acabou ou esta sem estoque.' } } };
patchSalesSpecialist(specialistNode);
assert.match(specialistNode.parameters.options.systemMessage, /FILTRO_INTERNO_NFC_SEM_RESULTADO_CONFIRMADO/);
assert.match(specialistNode.parameters.options.systemMessage, /Nao copie o marcador, nao invente modelos/);

console.log('n8n phone NFC filter static checks passed');
