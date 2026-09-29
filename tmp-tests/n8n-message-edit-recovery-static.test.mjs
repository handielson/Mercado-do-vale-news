import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('tmp-tests/n8n-message-edit-recovery.cjs', 'utf8');
assert.match(source, /message-edit-recovery-v1/);
assert.match(source, /MESSAGES_UPDATE/);
assert.match(source, /if \(isMessageEditV402 && !editedTextV402\) return \[\];/);
assert.match(source, /data\.message\?\.protocolMessage\?\.editedMessage/);
assert.match(source, /messageEdited: isMessageEditV402/);
assert.match(source, /ignoredStatusOnly: true/);
assert.doesNotMatch(source, /docker service scale|pm2 restart|docker service update/, 'validation helper must not restart production services');
for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const server = fs.readFileSync(file, 'utf8');
  assert.match(server, /EXPECTED_N8N_BOT_WEBHOOK_EVENTS = \['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE'\]/, `${file} must require edit events in the n8n webhook configuration`);
}
console.log('n8n message edit recovery static checks passed');
