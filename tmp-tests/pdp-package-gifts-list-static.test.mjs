import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pdpSource = readFileSync('pages/store/PublicProductPage.tsx', 'utf8');
const modalSource = readFileSync('components/settings/ModelModal.tsx', 'utf8');
const importSource = readFileSync('components/settings/modelJsonImport.js', 'utf8');

assert.match(
  pdpSource,
  /function normalizePdpListItems\(value: string\): string\[\]/,
  'PDP must normalize package/gift comma-separated text into list items',
);

assert.match(
  pdpSource,
  /function formatPdpListItem\(item: string\): string/,
  'PDP must format package/gift list item labels before rendering',
);

assert.match(
  pdpSource,
  /return 'Adaptador de tomada';/,
  'PDP must display a bare "adaptador" package item as "Adaptador de tomada"',
);

assert.match(
  pdpSource,
  /function isListStyleSpecItem\(item: \{ key: string, label: string \}\): boolean/,
  'PDP must detect list-style specs by key and label',
);

assert.match(
  pdpSource,
  /normalized\.includes\('itens_que_acompanham'\)/,
  'PDP must treat "itens que acompanham" as a list-style field',
);

assert.match(
  pdpSource,
  /normalized\.includes\('brindes'\)/,
  'PDP must treat model gifts as a list-style field',
);

assert.match(
  pdpSource,
  /<li key=\{line\} className="[^"]*whitespace-nowrap[^"]*">\s*1 \{line\}\s*<\/li>/,
  'PDP list rows must show quantity 1 and the package/gift item in the same unbroken row',
);

assert.match(
  pdpSource,
  /isListStyleSpecItem\(item\) \? 'col-span-2 md:col-span-3 lg:col-span-2' : ''/,
  'PDP list-style fields must span enough grid columns to avoid short unnecessary line breaks',
);

assert.match(
  modalSource,
  /handleTemplateValueChange\('brindes', e\.target\.value\)/,
  'Model modal must save gifts in models.template_values.brindes',
);

assert.match(
  modalSource,
  />\s*Brindes\s*</,
  'Model modal must expose a Brindes textarea in the model organization form',
);

assert.match(
  importSource,
  /"brindes": "1 capa protetora\\n1 capa extra\\n1 pelicula 3D aplicada"/,
  'AI import prompt must teach the model JSON to return gifts as list text',
);

assert.match(
  importSource,
  /Adaptador de tomada/,
  'AI import prompt must mention Adaptador de tomada for unit-dependent package contents',
);

console.log('PDP package/gifts list static checks passed');
