import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = ['vps_server.js', 'vps_server.cjs'];

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const webhookStart = source.indexOf("url: '/autoresponder-webhook'");
  assert.notEqual(webhookStart, -1, `${file} must expose the autoresponder webhook route`);
  const aiDecisionIndex = source.indexOf('const aiToolDecision = await buildAutoresponderAiToolDecision', webhookStart);
  assert.ok(aiDecisionIndex > webhookStart, `${file} webhook must ask ChatGPT/tool planner before catalog response`);
  const preAiWebhook = source.slice(webhookStart, aiDecisionIndex);
  assert.ok(
    !preAiWebhook.includes('isAutoresponderGenericPhoneCatalogRequest(message)'),
    `${file} must not bypass ChatGPT with a predefined generic phone catalog reply before AI tool planning`
  );

  assert.match(
    source,
    /celulares[^\n]+query[^\n]+smartphones|smartphones[^\n]+query[^\n]+celulares/i,
    `${file} AI catalog tool instructions must normalize celulares/smartphones to the Smartphones catalog query`
  );

  assert.match(
    source,
    /const categorySearchText = String\(message \|\| safeQuery \|\| effectiveCategory\.name \|\| ''\)\.trim\(\);[\s\S]*?getAutoresponderInitialProductPageSize\(categorySearchText\)/,
    `${file} catalog_search category tool must size category replies from the customer message first, so generic celulares can request the complete list context`
  );

  assert.match(
    source,
    /completeList:\s*isAutoresponderCompleteProductListKeyword\(message\)\s*\|\|\s*isAutoresponderCompleteProductListKeyword\(effectiveCategory\.name\)/,
    `${file} catalog_search category tool must pass complete-list metadata from message or effective category`
  );
}

console.log('autoresponder AI-first catalog static checks passed');
