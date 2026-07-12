import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('function normalizeWhatsAppStatusContactNumber');
  const end = source.indexOf('\n}', start) + 2;
  const normalize = Function(`${source.slice(start, end)}; return normalizeWhatsAppStatusContactNumber;`)();

  assert.equal(normalize('5587999999999'), '5587999999999@s.whatsapp.net', `${file}: numbers must become WhatsApp JIDs`);
  assert.equal(normalize('5587999999999@s.whatsapp.net'), '5587999999999@s.whatsapp.net', `${file}: existing JIDs must be preserved`);
  assert.equal(normalize('12345@lid'), '', `${file}: LID cannot be used as Status audience JID`);
  assert.equal(normalize('12345@g.us'), '', `${file}: groups cannot be used as Status audience JID`);
}

console.log('whatsapp status audience JID normalization: ok');
