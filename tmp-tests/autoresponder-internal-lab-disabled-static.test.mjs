import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const fileName of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(fileName, 'utf8');

  assert.match(
    source,
    /const isInternalLab = payload\.internalLab === true \|\| payload\.internal_lab === true;/,
    `${fileName} must detect internal lab requests`
  );

  assert.match(
    source,
    /if \(!settings \|\| \(!isInternalLab && Number\(settings\.enabled\) !== 1\)\)/,
    `${fileName} must allow the internal lab to run while the public bot is disabled`
  );

  assert.match(
    source,
    /if \(!isInternalLab && !hasActivePurchaseFlow[\s\S]*recentReplyCount >= replyLimit\)/,
    `${fileName} must bypass the short public reply limit in the internal lab`
  );

  assert.match(
    source,
    /internalLab: true/,
    `${fileName} internal chat must mark injected webhook requests as internal lab`
  );
}

console.log('autoresponder internal lab disabled static checks passed');
