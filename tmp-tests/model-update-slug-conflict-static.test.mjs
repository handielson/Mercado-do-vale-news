import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/models.ts', 'utf8');

assert.match(
  source,
  /const current = await getById\(id\)/,
  'model update must load the current row before deciding whether to regenerate slug',
);

assert.match(
  source,
  /const shouldRegenerateSlug = input\.name\.trim\(\) !== current\.name/,
  'model update must preserve the current slug when the model name did not change',
);

assert.match(
  source,
  /if \(shouldRegenerateSlug\) updatePayload\.slug = generateSlug\(input\.name\)/,
  'model update must only send slug when the name actually changes',
);

assert.match(
  source,
  /Ja existe um modelo com esse nome para esta marca\./,
  'model update must show a friendly duplicate model message instead of the raw database constraint',
);

console.log('model update slug conflict static checks passed');
