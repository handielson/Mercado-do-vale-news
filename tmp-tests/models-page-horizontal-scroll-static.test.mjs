import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const filePath = path.resolve('pages/admin/settings/ModelsPage.tsx');
const source = fs.readFileSync(filePath, 'utf8');

assert.match(
  source,
  /className="[^"]*overflow-y-auto[^"]*max-h-\[65vh\][^"]*"/,
  'A tabela deve manter a rolagem vertical.'
);

assert.match(
  source,
  /<table className="[^"]*w-full table-fixed[^"]*"/,
  'A tabela deve respeitar a largura disponivel sem ser alargada pelas tabelas de aparelhos.'
);

assert.doesNotMatch(
  source,
  /models-table-scroll-top|min-w-\[1500px\]/,
  'A barra horizontal superior e a largura minima que a provocava foram removidas a pedido do operador.'
);

assert.doesNotMatch(
  source,
  /syncModelTableScroll/,
  'Nao deve restar sincronizacao de uma barra removida.'
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
