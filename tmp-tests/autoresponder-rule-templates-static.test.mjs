import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/AutoResponderPage.tsx', 'utf8');
const templateBlock = page.match(/const ruleTemplates:[\s\S]*?\n\];/)?.[0] || '';

assert.ok(templateBlock, 'AutoResponderPage must define ruleTemplates');

[
  'Lista de celulares',
  'Produto por tag',
  'Busca por modelo',
  'Garantia',
  'Pagamento',
  'Entrega/retirada',
  'Horario/endereco',
  'Chamar atendente',
  'Pos-venda',
].forEach((label) => {
  assert.ok(templateBlock.includes(`label: '${label}'`), `ruleTemplates must include ${label}`);
});

assert.match(templateBlock, /label:\s*'Saud/, 'ruleTemplates must keep a greeting template');
assert.doesNotMatch(templateBlock, /Busca livre/, 'ruleTemplates must replace the old free-search template label');
assert.doesNotMatch(
  templateBlock,
  /Voce esta atras de celular novo\? Quer que eu mande a lista do que temos\? Ou deseja alguma outra coisa\?/,
  'greeting template must not restore the removed commercial follow-up message',
);
assert.match(
  templateBlock,
  /label:\s*'Lista de celulares'[\s\S]*reply_type:\s*'product_search'[\s\S]*reply_search_query:\s*'celulares'/,
  'phone list template must use product_search with a fixed celulares query',
);
assert.match(
  templateBlock,
  /label:\s*'Chamar atendente'[\s\S]*priority:\s*'1000'/,
  'human handoff template must keep high priority',
);

console.log('autoresponder rule templates static checks passed');
