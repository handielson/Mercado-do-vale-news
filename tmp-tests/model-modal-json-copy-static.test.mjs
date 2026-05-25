import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/settings/ModelModal.tsx', 'utf8');
const jsonTabSource = source.slice(
  source.indexOf("{/* JSON Tab */}"),
  source.indexOf("{/* Template Tab */}"),
);

assert.match(
  jsonTabSource,
  /logistica, EANs e campos tecnicos/,
  'JSON tab helper text must render without mojibake',
);

assert.match(
  jsonTabSource,
  /serao preservados como valores padrao do modelo/,
  'JSON tab preservation note must render without mojibake',
);

assert.doesNotMatch(
  jsonTabSource,
  /logÃ|tÃ|serÃ|padrÃ|Ãƒ/,
  'JSON tab copy must not contain mojibake sequences',
);

console.log('model modal JSON copy static checks passed');
