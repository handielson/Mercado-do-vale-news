import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const fileName of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(fileName, 'utf8');

  assert.match(
    source,
    /function isAutoresponderCompleteProductListKeyword\(keyword\)[\s\S]*lista completa[\s\S]*todos os/,
    `${fileName} must require an explicit complete-list request`
  );
  assert.doesNotMatch(
    source,
    /AUTORESPONDER_COMPLETE_PRODUCT_LIST_WORDS[\s\S]*'celulares'/,
    `${fileName} must not treat the category word celulares as a complete-list command`
  );
  assert.match(
    source,
    /if \(isAutoresponderCatalogRequest\(message\)\) return null;/,
    `${fileName} must route generic catalog requests before broad token search`
  );
  assert.doesNotMatch(
    source,
    /findAutoresponderCatalogCategoryForMessage\('smartphones', categories\)/,
    `${fileName} must not hardcode a Smartphones category lookup for customer phrases`
  );
  assert.match(
    source,
    /catalog_query/,
    `${fileName} must ask AI for the catalog query to consult in official data`
  );
  assert.match(
    source,
    /catalogQuery: String\(parsed\.catalog_query \|\| ''\)\.trim\(\)/,
    `${fileName} must parse the AI catalog query from structured intent JSON`
  );
  assert.match(
    source,
    /getAutoresponderAiCatalogQuery\(aiIntentPlan, message\)/,
    `${fileName} must route catalog lookup through the AI-selected catalog query`
  );
  const orderAnchor = source.indexOf('const purchaseFlow = await getAutoresponderPurchaseFlow');
  const phoneListIndex = source.indexOf('const phoneListOptInReply = await handleAutoresponderPhoneListOptIn', orderAnchor);
  const priorityIndex = source.indexOf('const priorityProductReply = await buildAutoresponderPriorityProductSearchReplyData', orderAnchor);
  assert.ok(
    orderAnchor >= 0 && phoneListIndex > orderAnchor && priorityIndex > phoneListIndex,
    `${fileName} must route smartphone list opt-in before priority product search`
  );
  assert.match(
    source,
    /const preferredPhoneCategoryNames = \['smartphones', 'smartphone', 'celulares', 'celular'\]/,
    `${fileName} must prefer the Smartphones category for phone requests`
  );
  const preferredIndex = source.indexOf("const preferredPhoneCategoryNames = ['smartphones', 'smartphone', 'celulares', 'celular']");
  const directMatchIndex = source.indexOf('const directMatch = safeCategories.find', source.indexOf('function findAutoresponderCatalogCategoryForMessage'));
  assert.ok(
    preferredIndex >= 0 && directMatchIndex >= 0 && preferredIndex < directMatchIndex,
    `${fileName} must prefer Smartphones before accepting a direct Celulares match`
  );
}

for (const fileName of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(fileName, 'utf8');
  assert.match(source, /messageId: String\(key\.id \|\| data\.messageId \|\| data\.id \|\| ''\)/, `${fileName} must preserve the Evolution message id`);
  assert.match(source, /consumeAutoresponderEvolutionWebhookEvent\(payload\.messageId\)/, `${fileName} must ignore duplicate Evolution webhook deliveries`);
  assert.match(source, /releaseAutoresponderEvolutionWebhookEvent\(req\.autoresponderMessageId\)/, `${fileName} must allow retry after a failed Evolution send`);
  assert.match(source, /sent\.every\(\(item\) => item\.ok\)/, `${fileName} must reject partial Evolution send failures`);
}

console.log('autoresponder smartphone catalog loop regression static checks passed');
