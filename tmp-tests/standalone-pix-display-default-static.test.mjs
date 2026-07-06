import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/admin/financial/StandalonePixPage.tsx', 'utf8');

assert.match(
  source,
  /const currentStillAvailable = displayOptions\.some\(\(display\) => display\.id === currentDisplayId\);/,
  'Pix avulso must verify whether the saved display is still available',
);

assert.match(
  source,
  /const nextDisplayId = displayOptions\[0\]\?\.id \|\| '';/,
  'Pix avulso must choose a default active display when none is selected',
);

assert.match(
  source,
  /const targetDisplayId = displayId\.trim\(\) \|\| displayOptions\[0\]\?\.id \|\| '';/,
  'Pix avulso creation must target the selected display or the first active display',
);

assert.match(
  source,
  /display_id: targetDisplayId \|\| null/,
  'Pix avulso creation must send the target display id to the backend',
);

console.log('standalone pix display default static checks passed');
