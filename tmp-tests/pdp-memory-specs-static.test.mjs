import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/store/PublicProductPage.tsx', 'utf8');

assert.match(
  source,
  /memoria_ram_virtual:\s*'Mem[^\n']*ria RAM Virtual'/,
  'PDP specs must expose memoria_ram_virtual with a friendly public label',
);

assert.match(
  source,
  /keys:\s*\['version', 'versao', 'color', 'storage', 'ram', 'memoria_ram_virtual'\]/,
  'PDP Principal specs group must place virtual RAM immediately after RAM/internal storage',
);

assert.match(
  source,
  /specs:\s*\{\s*\.\.\.\(product\.specs \|\| \{\}\),\s*\.\.\.\(sib\.specs \|\| \{\}\)\s*\}/,
  'Variant changes must merge current model specs with selected variant specs so RAM/storage stay dynamic without losing template specs',
);

assert.match(
  source,
  /\.select\('description, template_values, brands\(name\)'\)/,
  'PDP product fetch must load model template_values so new model fields appear without re-saving each product',
);

assert.match(
  source,
  /data\.specs\s*=\s*\{\s*\.\.\.\(modelTemplateValues \|\| \{\}\),\s*\.\.\.\(parsedSpecs \|\| \{\}\)\s*\}/,
  'PDP product fetch must merge model template_values before product specs',
);

assert.match(
  source,
  /item\.key === 'memoria_ram_virtual' \? `\+ \$\{item\.strVal\}` : item\.strVal/,
  'Virtual RAM must render with a plus sign to communicate added memory',
);

console.log('pdp memory specs static checks passed');
