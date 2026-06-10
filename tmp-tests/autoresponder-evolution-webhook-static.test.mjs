import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = ['vps_server.js', 'vps_server.cjs'];

for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');

  assert.match(
    source,
    /function buildAutoresponderEvolutionWebhookConfig\(\)/,
    `${file} must build the Evolution webhook config`
  );
  assert.match(
    source,
    /fastify\.post\('\/autoresponder\/whatsapp\/sync-webhook'/,
    `${file} must expose the webhook sync route`
  );
  assert.match(
    source,
    /function normalizeEvolutionWebhookPayload\(rawPayload\)/,
    `${file} must normalize Evolution webhook payloads`
  );
  assert.match(
    source,
    /extractEvolutionMessageText\(messagePayload\)/,
    `${file} must extract text from Evolution message formats`
  );
  assert.match(
    source,
    /req\.autoresponderWebhookSource === 'evolution'/,
    `${file} must detect Evolution webhook requests before formatting`
  );
  assert.match(
    source,
    /await sendAutoresponderEvolutionReplies\(req\.autoresponderSender, replies\)/,
    `${file} must send generated replies through Evolution`
  );
  assert.match(
    source,
    /payload\.source === 'evolution' && payload\.event && payload\.event !== 'MESSAGES_UPSERT'/,
    `${file} must ignore non-message Evolution events`
  );
  assert.match(
    source,
    /if \(payload\.fromMe === true\) \{\s*return \{ replies: \[\] \};\s*\}/,
    `${file} must ignore outbound Evolution messages`
  );
}

console.log('autoresponder evolution webhook static checks passed');
