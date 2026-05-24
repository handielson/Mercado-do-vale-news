import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const filePath = path.resolve('pages/admin/settings/ModelsPage.tsx');
const source = fs.readFileSync(filePath, 'utf8');

assert.match(
  source,
  /className="[^"]*overflow-x-auto[^"]*overflow-y-auto[^"]*max-h-\[65vh\][^"]*"/,
  'A tabela de modelos deve ter rolagem horizontal e vertical explicitas no container.'
);

assert.match(
  source,
  /<table className="[^"]*min-w-\[1500px\][^"]*"/,
  'A tabela de modelos deve ter largura minima maior que o container para ativar a rolagem lateral.'
);

console.log('ModelsPage horizontal scroll static checks passed');
