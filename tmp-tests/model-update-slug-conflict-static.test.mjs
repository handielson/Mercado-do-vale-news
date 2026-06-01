import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/models.ts', 'utf8');
const server = readFileSync('vps_server.js', 'utf8');

assert.match(
  service,
  /async function update\(id: string, input: ModelInput\): Promise<Model> \{[\s\S]*vpsClient\.put<Model>\(`\/models\/\$\{encodeURIComponent\(id\)\}`, input\)/,
  'model update must go through PUT /models/:id on the VPS',
);

assert.match(
  server,
  /const currentRows = await vpsDbSelect\([\s\S]*select=\*&id=eq\.\$\{encodeURIComponent\(req\.params\.id\)\}/,
  'VPS model update must load the current row before deciding whether to regenerate slug',
);

assert.match(
  server,
  /if \(payload\.name !== current\.name\) payload\.slug = generateModelSlug\(payload\.name\)/,
  'VPS model update must only send slug when the name actually changes',
);

assert.match(
  server,
  /Ja existe um modelo com esse nome para esta marca\./,
  'VPS model update must return a friendly duplicate model message instead of the raw database constraint',
);

console.log('model update slug conflict static checks passed');
