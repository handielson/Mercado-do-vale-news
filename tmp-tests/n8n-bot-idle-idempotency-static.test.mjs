import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const claimFollowup = source.indexOf('SET idle_followup_sent_at = CURRENT_TIMESTAMP', source.indexOf('async function runN8nBotIdleFollowups'));
  const sendFollowup = source.indexOf('sendN8nBotEvolutionTextMessage(identity, N8N_BOT_IDLE_FOLLOWUP_MESSAGE)', claimFollowup);
  const claimClose = source.indexOf('SET idle_closed_at = CURRENT_TIMESTAMP', sendFollowup);
  const sendClose = source.indexOf('sendN8nBotEvolutionTextMessage(identity, N8N_BOT_IDLE_CLOSE_MESSAGE)', claimClose);

  assert.ok(claimFollowup > 0 && claimFollowup < sendFollowup, `${file}: follow-up must be claimed before sending`);
  assert.ok(claimClose > sendFollowup && claimClose < sendClose, `${file}: close must be claimed before sending`);
  assert.match(source, /Number\(claimResult\?\.affectedRows \|\| 0\) !== 1/, `${file}: only the claimant may send`);
  assert.match(source, /N8N_BOT_IDLE_JOB_ENABLED/, `${file}: emergency job kill switch must remain available`);
}

console.log('n8n bot idle idempotency guards: ok');
