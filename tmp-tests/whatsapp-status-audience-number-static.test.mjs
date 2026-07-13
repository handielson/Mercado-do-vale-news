import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /fetchWhatsAppStatusAudience|selectWhatsAppStatusAudience/);
  assert.doesNotMatch(source, /EVOLUTION_STATUS_(?:JID_LIST|CONTACT_LIMIT|CONTACTS_TIMEOUT_MS)/);
  assert.match(source, /\/api\/\$\{encodeURIComponent\(session\)\}\/status\/\$\{type\}/);
}

console.log('whatsapp status has no contact-audience path: ok');
