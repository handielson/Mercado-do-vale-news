import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('vps_server.cjs', 'utf8');

assert.match(
  source,
  /async function sleepAutoresponderEvolutionTypingPresence\(/,
  'server must define a helper that waits while Evolution shows typing presence'
);

assert.match(
  source,
  /async function sendAutoresponderEvolutionTypingPresence\(/,
  'server must define a helper that sends Evolution typing presence'
);

assert.match(
  source,
  /\/chat\/sendPresence\/\$\{EVOLUTION_INSTANCE_NAME\}/,
  'typing presence must use the Evolution sendPresence endpoint'
);

assert.match(
  source,
  /const EVOLUTION_INSTANCE_NAME = process\.env\.EVOLUTION_INSTANCE_NAME \|\| process\.env\.EVOLUTION_API_INSTANCE \|\| 'botmercadodovale'/,
  'legacy autoresponder Evolution fallback must use the official bot instance'
);

assert.doesNotMatch(
  source,
  /const EVOLUTION_INSTANCE_NAME = 'mercado_do_vale'/,
  'legacy autoresponder must not default to the deleted Evolution instance'
);

const repliesFunctionMatch = source.match(
  /async function sendAutoresponderEvolutionReplies\(sender, replies\) \{[\s\S]*?\n\}/
);
assert.ok(repliesFunctionMatch, 'sendAutoresponderEvolutionReplies must exist');
const repliesFunction = repliesFunctionMatch[0];

const typingIndex = repliesFunction.indexOf('await sendAutoresponderEvolutionTypingPresence(sender, text)');
const sendIndex = repliesFunction.indexOf('await sendAutoresponderEvolutionTextMessage(sender, text)');
assert.ok(typingIndex >= 0, 'automatic Evolution replies must request typing presence');
assert.ok(sendIndex >= 0, 'automatic Evolution replies must still send text messages');
assert.ok(typingIndex < sendIndex, 'typing presence must happen before the text message is sent');

const manualRouteMatch = source.match(
  /fastify\.post\('\/autoresponder\/conversations\/:sender\/manual-message'[\s\S]*?fastify\.post\('\/autoresponder\/conversations\/:sender\/tags'/
);
assert.ok(manualRouteMatch, 'manual message route must be found');
assert.ok(
  !manualRouteMatch[0].includes('sendAutoresponderEvolutionTypingPresence'),
  'manual attendant messages must not simulate bot typing presence'
);

console.log('autoresponder Evolution typing presence static checks passed');
