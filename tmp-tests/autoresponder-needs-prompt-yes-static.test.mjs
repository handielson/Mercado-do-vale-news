import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const serverFiles = ['vps_server.cjs', 'vps_server.js'];

for (const fileName of serverFiles) {
  const source = readFileSync(fileName, 'utf8');

  assert.ok(
    source.includes('async function hasRecentAutoresponderNeedsPrompt(sender'),
    `${fileName} must detect when the customer is answering the initial needs prompt`
  );

  assert.ok(
    source.includes('async function handleAutoresponderPhoneListOptIn({'),
    `${fileName} must route yes/list replies after the needs prompt to the phone catalog`
  );

  assert.ok(
    source.includes("intent: 'catalog_phone_opt_in'"),
    `${fileName} must log phone-list opt-ins distinctly`
  );

  assert.ok(
    source.includes("const matchesBuiltInConfirmation = isAutoresponderYes(message) || isAutoresponderExplicitCatalogListRequest(message);"),
    `${fileName} must treat yes or lista as confirmation after the needs prompt`
  );

  assert.ok(
    source.includes('const selectedCategory = findAutoresponderCatalogCategoryForMessage(classification.catalogQuery || message, categories);'),
    `${fileName} must use the AI-selected catalog query for opt-in replies`
  );

  assert.ok(
    source.includes('catalog_query deve ser a categoria/termo de catalogo'),
    `${fileName} must ask AI where to consult official catalog data`
  );

  assert.doesNotMatch(
    source,
    /findAutoresponderCatalogCategoryForMessage\('(celulares|smartphones)'/,
    `${fileName} must not hardcode phone category lookup for opt-in replies`
  );

  const optInRouteIndex = source.indexOf('const phoneListOptInReply = await handleAutoresponderPhoneListOptIn({');
  const deliveryAfterOptInIndex = source.indexOf('handleAutoresponderEngineDeliveryFlowV2({', optInRouteIndex);
  const contactFlowAfterOptInIndex = source.indexOf('handleAutoresponderContactNameFlow', optInRouteIndex);
  const tokenSearchAfterOptInIndex = source.indexOf(
    'const productSearchTokens = extractAutoresponderProductSearchTokens(message);',
    optInRouteIndex
  );
  assert.ok(optInRouteIndex >= 0, `${fileName} must call the opt-in handler in the main route`);
  assert.ok(
    deliveryAfterOptInIndex > optInRouteIndex,
    `${fileName} must answer yes/list after needs prompt before delivery flow`
  );
  assert.ok(
    contactFlowAfterOptInIndex > optInRouteIndex,
    `${fileName} must answer yes/list after needs prompt before contact-name flow`
  );
  assert.ok(
    tokenSearchAfterOptInIndex > optInRouteIndex,
    `${fileName} must handle opt-in replies before generic token search`
  );

  assert.doesNotMatch(
    source,
    /Encontrei \$\{total\} produtos relacionados/,
    `${fileName} must not show product total counters in list titles`
  );

  assert.doesNotMatch(
    source,
    /Mais opcoes \(\$\{firstNumber\}-\$\{lastNumber\} de \$\{total\}\)/,
    `${fileName} must not show pagination counters in list titles`
  );
}

console.log('autoresponder needs prompt yes static checks passed');
