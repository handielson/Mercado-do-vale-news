import fs from 'node:fs';
import assert from 'node:assert/strict';

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const source = fs.readFileSync(file, 'utf8');

  assert.match(source, /function isAutoresponderInvalidContactNameReply/, `${file} must reject ambiguous replies as contact names`);
  assert.match(
    source,
    /isAutoresponderInvalidContactNameReply\(message\) \|\| typedName\.length < 2/,
    `${file} must not save yes, no, list, delivery, or CEP replies as a contact name`
  );
}

console.log('autoresponder contact name invalid replies static checks passed');
