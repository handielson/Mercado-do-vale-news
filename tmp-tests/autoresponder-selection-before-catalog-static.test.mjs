import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = ['vps_server.js', 'vps_server.cjs'];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const webhookStart = source.indexOf("url: '/autoresponder-webhook'");
  assert(webhookStart >= 0, `${file}: webhook route not found`);

  const webhook = source.slice(webhookStart);
  const aiFirstIndex = webhook.indexOf('const aiFirst = await buildAutoresponderAiFirstReply');
  const aiPlanIndex = webhook.indexOf('const aiIntentPlan = await buildAutoresponderAiIntentPlan');
  const selectionIndex = webhook.indexOf('intent: \'purchase_product_selected\'');

  assert(aiFirstIndex >= 0, `${file}: AI first reply not found in webhook`);
  assert(aiPlanIndex >= 0, `${file}: AI intent plan not found in webhook`);
  assert(selectionIndex >= 0, `${file}: product selection handling not found in webhook`);
  assert(
    selectionIndex < aiFirstIndex,
    `${file}: numbered product selection must run before AI first so "quero esse 15" does not repeat the phone list`
  );
  assert(
    selectionIndex < aiPlanIndex,
    `${file}: numbered product selection must run before AI/catalog routing so "quero esse 15" does not repeat the phone list`
  );
}

console.log('Autoresponder numbered selection is routed before catalog handling.');
