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

assert.match(
  source,
  /models-table-scroll-top/,
  'A tabela de modelos deve expor uma rolagem horizontal superior sempre visivel perto do cabecalho.'
);

assert.match(
  source,
  /syncModelTableScroll/,
  'A rolagem horizontal superior deve ser sincronizada com o container real da tabela.'
);

assert.match(
  source,
  /ring-2 ring-blue-500/,
  'A linha selecionada deve ter contorno destacado para evitar edicao no item errado.'
);

assert.match(
  source,
  /animate-pulse/,
  'A linha selecionada deve ter animacao visual sutil.'
);

console.log('ModelsPage horizontal scroll static checks passed');
