import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs', 'services/whatsappStatusSender.cjs']) {
  const source = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /fetchWhatsAppStatusAudience|selectWhatsAppStatusAudience/);
  assert.doesNotMatch(source, /EVOLUTION_STATUS_(?:JID_LIST|CONTACT_LIMIT|CONTACTS_TIMEOUT_MS)/);
  if (file.endsWith('Sender.cjs')) assert.match(source, /\/api\/\$\{encodeURIComponent\(session\)\}\/status\/\$\{type\}/);
  else assert.match(source, /require\('\.\/services\/whatsappStatusSender\.cjs'\)\.sendWahaStatusMedia/);
}

console.log('whatsapp status has no contact-audience path: ok');
