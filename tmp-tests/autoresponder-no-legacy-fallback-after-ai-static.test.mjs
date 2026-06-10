import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = ['vps_server.js', 'vps_server.cjs'];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const webhookStart = source.indexOf("url: '/autoresponder-webhook'");
  assert(webhookStart >= 0, `${file}: live webhook not found`);

  const webhook = source.slice(webhookStart);
  const aiBlockStart = webhook.indexOf('const aiFirst = await buildAutoresponderAiFirstReply({ message, contactFirstName, settings, sender: senderKey });');
  const noReplyIndex = webhook.indexOf("intent: 'ai_no_reply'", aiBlockStart);
  const catalogIndex = webhook.indexOf("intent: 'catalog_category'", aiBlockStart);
  const ruleIndex = webhook.indexOf('const matchedRule = await findAutoresponderRuleMatch(message);', aiBlockStart);

  assert(aiBlockStart >= 0, `${file}: AI-first block missing`);
  assert(noReplyIndex > aiBlockStart, `${file}: AI-first block must stop when AI returns no text`);
  assert(catalogIndex > noReplyIndex, `${file}: legacy catalog must not run before AI no-reply stop`);
  assert(ruleIndex > noReplyIndex, `${file}: legacy rules must not run before AI no-reply stop`);
}

console.log('AI no-reply stops before legacy autoresponder fallback.');
