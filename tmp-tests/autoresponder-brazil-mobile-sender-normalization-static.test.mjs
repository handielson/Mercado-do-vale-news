import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = ['vps_server.js', 'vps_server.cjs'];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');

  assert(
    source.includes('function normalizeAutoresponderBrazilMobileSender'),
    `${file}: must have a dedicated Brazilian mobile sender normalizer`
  );
  assert(
    source.includes("return `${digits.slice(0, 4)}9${digits.slice(4)}`;"),
    `${file}: 12-digit BR mobile numbers like 558796246812 must canonicalize to 5587996246812`
  );
  assert(
    /function normalizeAutoresponderSender\(value\) \{[\s\S]*?normalizeAutoresponderBrazilMobileSender\(digits\)/.test(source),
    `${file}: normalizeAutoresponderSender must use the BR mobile canonical form`
  );
  assert(
    source.includes('async function canonicalizeAutoresponderBrazilMobileSenders'),
    `${file}: must migrate existing conversation/log senders to the canonical BR mobile form`
  );
  assert(
    source.includes('await canonicalizeAutoresponderBrazilMobileSenders();'),
    `${file}: BR mobile sender migration must run during server migrations`
  );
}

console.log('Autoresponder Brazilian mobile sender normalization static checks passed');
