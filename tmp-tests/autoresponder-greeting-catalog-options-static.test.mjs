import fs from 'node:fs';
import assert from 'node:assert/strict';

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const source = fs.readFileSync(file, 'utf8');

  assert.match(source, /async function buildAutoresponderGreetingCatalogReplyData/, `${file} must build greeting + catalog replies`);
  assert.match(source, /intent: 'greeting_catalog_category'/, `${file} must log greeting + catalog as its own intent`);
  assert.match(
    source,
    /const greetingText = getAutoresponderGreetingReply[\s\S]*replyMessages:\s*\[\s*greetingText,\s*\.\.\.catalogData\.replyMessages/s,
    `${file} must send greeting before catalog options`
  );

  const webhookIndex = source.indexOf("url: '/autoresponder-webhook'");
  const greetingCatalogIndex = source.indexOf('buildAutoresponderGreetingCatalogReplyData(message, contactFirstName, settings)', webhookIndex);
  const contactFlowIndex = source.indexOf('handleAutoresponderContactNameFlow', webhookIndex);
  const ruleIndex = source.indexOf('const matchedRule = await findAutoresponderRuleMatch(message);', webhookIndex);
  const genericIndex = source.indexOf('detectAutoresponderGenericDeviceCatalogFamily(message)', webhookIndex);

  assert(
    webhookIndex >= 0 &&
      greetingCatalogIndex > webhookIndex &&
      greetingCatalogIndex < contactFlowIndex &&
      greetingCatalogIndex < ruleIndex &&
      greetingCatalogIndex < genericIndex,
    `${file} must answer "boa noite, tem celular?" before contact-name prompts, fixed rules, and generic refinement`
  );
}

console.log('autoresponder greeting catalog options static checks passed');
