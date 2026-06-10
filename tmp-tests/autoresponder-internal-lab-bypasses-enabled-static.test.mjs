import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = ['vps_server.js', 'vps_server.cjs'];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const webhookStart = source.indexOf("url: '/autoresponder-webhook'");
  assert(webhookStart >= 0, `${file}: webhook not found`);
  const webhook = source.slice(webhookStart);

  assert(
    webhook.includes('const isInternalLabRequest = payload.internalLab === true'),
    `${file}: webhook must identify internal lab requests`
  );
  assert(
    webhook.includes('Number(settings.enabled) !== 1 && !isInternalLabRequest'),
    `${file}: enabled=0 must block real clients but not the internal lab`
  );
  assert(
    source.includes("source: 'internal-lab'") && source.includes('internalLab: true'),
    `${file}: internal chat inject payload must mark itself as internal lab`
  );
}

console.log('Internal bot lab can test AI while real autoresponder is disabled.');
