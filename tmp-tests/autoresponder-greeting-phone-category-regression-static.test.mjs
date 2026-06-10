import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const serverFiles = ['vps_server.cjs', 'vps_server.js', 'server.js'];

for (const fileName of serverFiles) {
  const source = readFileSync(fileName, 'utf8');

  const categoryHelper = source.match(/function findAutoresponderCatalogCategoryForMessage\(message, categories\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(
    categoryHelper,
    /isAutoresponderAccessoryCategoryName/,
    `${fileName} must exclude accessory categories when resolving phone/smartphone catalog requests`
  );
  assert.match(
    categoryHelper,
    /return !isAutoresponderAccessoryCategoryName\(name\)[\s\S]*phoneCategoryHints\.some/,
    `${fileName} must not fallback to Capinha/Capa/Suporte categories for celular lists`
  );

  const webhookStart = source.indexOf("url: '/autoresponder-webhook'");
  assert.ok(webhookStart >= 0, `${fileName} must expose the autoresponder webhook`);
  const webhookGreetingIndex = source.indexOf('if (detectedIntent.greetingOnly)', webhookStart);
  const prioritySearchIndex = source.indexOf('buildAutoresponderPriorityProductSearchReplyData({', webhookStart);
  const engineSearchIndex = source.indexOf('handleAutoresponderEngineProductSearchFlowV2({', webhookStart);
  assert.ok(webhookGreetingIndex > webhookStart, `${fileName} webhook must handle pure greetings`);
  if (prioritySearchIndex >= 0) {
    assert.ok(
      webhookGreetingIndex < prioritySearchIndex,
      `${fileName} must answer pure greetings before priority product search`
    );
  }
  if (engineSearchIndex >= 0) {
    assert.ok(
      webhookGreetingIndex < engineSearchIndex,
      `${fileName} must answer pure greetings before engine product search`
    );
  }

  if (fileName.startsWith('vps_server')) {
    const explicitCatalogIndex = source.indexOf('buildAutoresponderCatalogCategoryReplyData(message, settings, shouldPrefixGreeting)', webhookStart);
    const fixedRuleIndex = source.indexOf('const matchedRule = await findAutoresponderRuleMatch(message);', webhookStart);
    assert.ok(explicitCatalogIndex > webhookStart, `${fileName} webhook must have explicit catalog handling`);
    assert.ok(fixedRuleIndex > webhookStart, `${fileName} webhook must still support fixed rules`);
    assert.ok(
      explicitCatalogIndex < fixedRuleIndex,
      `${fileName} must handle explicit catalog/list requests before predefined fixed rules`
    );
  }
}

console.log('autoresponder greeting and phone category regression static checks passed');
