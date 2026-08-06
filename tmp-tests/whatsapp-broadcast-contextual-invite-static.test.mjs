import assert from 'node:assert/strict';
import fs from 'node:fs';

const serverJs = fs.readFileSync('vps_server.js', 'utf8');
const serverCjs = fs.readFileSync('vps_server.cjs', 'utf8');

assert.equal(serverJs, serverCjs, 'vps_server.js and vps_server.cjs must stay synchronized');

for (const source of [serverJs, serverCjs]) {
  assert.match(source, /'Celulares', 'celulares'/);
  assert.match(source, /'Outros produtos', 'outros-produtos'/);
  assert.match(source, /SET name = 'Outros produtos', slug = 'outros-produtos'/);
  assert.match(source, /WHERE topic_id = \? AND active = 1/);
  assert.doesNotMatch(source, /SELECT UUID\(\), contact_id, \?, active, subscribed_at, unsubscribed_at/);
  assert.match(source, /pending_topic_id/);
  assert.match(source, /last_invited_topic_id/);
  assert.match(source, /last_invited_at/);
  assert.match(source, /WHATSAPP_BROADCAST_CONTEXT_INVITE_COOLDOWN_DAYS = 30/);
  assert.match(source, /WHATSAPP_BROADCAST_CONVERSATION_ENABLED \|\| 'false'/);
  assert.match(source, /if \(!isWhatsAppBroadcastConversationEnabled\(\)\) return messages;/);
  assert.match(source, /if \(!isWhatsAppBroadcastConversationEnabled\(\)\) return null;/);
  assert.match(source, /appendWhatsAppBroadcastContextInvite/);
  assert.match(source, /Responda SIM para entrar na lista/);
  assert.match(source, /contact\?\.pending_topic_id && isAffirmative/);
  assert.match(source, /contact\?\.pending_topic_id && isNegative/);
  assert.match(source, /contact\?\.pending_topic_id && !askedForLists/);
  assert.match(source, /consent_status === 'opted_out'/);
  assert.match(source, /UPDATE whatsapp_broadcast_subscriptions SET active = 0, unsubscribed_at = CURRENT_TIMESTAMP WHERE contact_id = \? AND active = 1/);
  assert.match(source, /DELETE FROM whatsapp_broadcast_contacts WHERE id = \?/);

  const phoneOptInStart = source.indexOf('async function handleAutoresponderPhoneListOptIn');
  const phoneOptInEnd = source.indexOf('async function buildAutoresponderCatalogCategoryReplyData', phoneOptInStart);
  const phoneOptInBlock = source.slice(phoneOptInStart, phoneOptInEnd);
  assert.doesNotMatch(
    phoneOptInBlock,
    /subscribeWhatsAppBroadcastContactToTopic\(/,
    'requesting the current phone catalog must not silently subscribe the customer to marketing',
  );
}

console.log('whatsapp broadcast contextual invite static regression: ok');
