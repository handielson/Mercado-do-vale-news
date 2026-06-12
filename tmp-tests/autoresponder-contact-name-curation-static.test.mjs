import fs from 'node:fs';
import assert from 'node:assert/strict';

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const source = fs.readFileSync(file, 'utf8');
  assert.match(source, /autoresponder_contact_name_curation/, `${file} must define the contact-name curation table`);
  assert.match(source, /ensureAutoresponderContactNameCurationTable/, `${file} must ensure the contact-name curation table`);
  assert.match(source, /recordAutoresponderContactNameCuration/, `${file} must record rejected contact-name replies`);
  assert.match(source, /source_type ENUM\('invalid_contact_name'\)/, `${file} queue must be scoped to contact-name issues only`);
  assert.match(source, /fastify\.get\('\/autoresponder\/contact-name-curation'/, `${file} must expose the contact-name curation list route`);
  assert.match(source, /fastify\.post\('\/autoresponder\/contact-name-curation\/:id\/ignore'/, `${file} must expose an ignore action`);
  assert.match(source, /fastify\.post\('\/autoresponder\/contact-name-curation\/:id\/resolve'/, `${file} must expose a resolve action`);
  assert.match(source, /saveAutoresponderConfirmedContactName\(sender, resolvedName/, `${file} resolve action must save the manual contact name`);
}

console.log('autoresponder contact name curation static checks passed');
