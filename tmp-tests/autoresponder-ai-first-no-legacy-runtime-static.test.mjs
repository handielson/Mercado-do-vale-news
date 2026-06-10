import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const runtimeFiles = ['vps_server.cjs', 'vps_server.js', 'server.js'];
const legacyFooterPatterns = [
  /vamos ficar com qual/i,
  /Responda com o numero da opcao/i,
  /Se quiser ver mais opcoes/i,
];

for (const fileName of runtimeFiles) {
  const source = readFileSync(fileName, 'utf8');

  for (const pattern of legacyFooterPatterns) {
    assert.doesNotMatch(
      source,
      pattern,
      `${fileName} must not ship legacy AutoResponder WA footer text`
    );
  }

  assert.match(
    source,
    /function shouldUseAutoresponderPredefinedRules\(settings = null\) \{[\s\S]*predefined_rules_enabled\) === 1[\s\S]*AUTORESPONDER_PREDEFINED_RULES_ENABLED[\s\S]*=== '1'[\s\S]*\}/,
    `${fileName} must keep predefined rules behind an explicit opt-in gate that is off by default`
  );

  const webhookIndex = source.indexOf("url: '/autoresponder-webhook'");
  assert.ok(webhookIndex >= 0, `${fileName} must expose the autoresponder webhook`);

  const greetingCatalogIndex = source.indexOf(
    'buildAutoresponderGreetingCatalogReplyData(message, contactFirstName, settings',
    webhookIndex
  );
  const aiCatalogQueryIndex = source.indexOf('const catalogQuery = getAutoresponderAiCatalogQuery(aiIntentPlan, message)', webhookIndex);
  const prioritySearchIndex = source.indexOf(
    'buildAutoresponderPriorityProductSearchReplyData({',
    webhookIndex
  );
  const engineSearchIndex = source.indexOf(
    'handleAutoresponderEngineProductSearchFlowV2({',
    webhookIndex
  );
  const predefinedRuleIndex = source.indexOf(
    'shouldUseAutoresponderPredefinedRules(settings)',
    webhookIndex
  );

  assert.ok(
    greetingCatalogIndex > webhookIndex,
    `${fileName} must route "Bom dia, tem celular?" through greeting-catalog handling`
  );
  if (fileName.startsWith('vps_server')) {
    assert.ok(
      aiCatalogQueryIndex > webhookIndex && aiCatalogQueryIndex < greetingCatalogIndex,
      `${fileName} must let AI select the catalog query before greeting-catalog handling`
    );
  }
  if (prioritySearchIndex >= 0) {
    assert.ok(
      greetingCatalogIndex < prioritySearchIndex,
      `${fileName} must handle greeting catalog requests before priority/textual product search`
    );
  }
  if (engineSearchIndex >= 0) {
    assert.ok(
      greetingCatalogIndex < engineSearchIndex,
      `${fileName} must handle greeting catalog requests before engine textual product search`
    );
  }
  assert.ok(
    predefinedRuleIndex > greetingCatalogIndex,
    `${fileName} must evaluate predefined rules only after greeting-catalog routing`
  );
}

console.log('autoresponder AI-first no legacy runtime static checks passed');
