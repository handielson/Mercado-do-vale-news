import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const doc = readFileSync('docs/operacional/2026-05-11-estoque-commit-scope.md', 'utf8');

for (const section of [
  '## Regra',
  '## Arquivos Provaveis Desta Frente',
  '## Testes Provaveis Desta Frente',
  '## Nao Incluir Sem Pedido Explicito',
  '## Mensagem De Commit Sugerida',
  '## Verificacoes Antes Do Commit',
]) {
  assert.match(doc, new RegExp(section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `commit scope should include ${section}`);
}

for (const requiredItem of [
  '`commit.md`',
  'Stagear somente arquivos desta frente',
  'Fazer push por padrao',
  'Levar para `main` se precisar refletir na Vercel',
  'Avaliar deploy VPS apenas se o commit mexer em runtime/servicos da VPS',
  '`Estoque.md`',
  '`supabase/migrations/20260509000001_multi_deposit_stock.sql`',
  '`services/stockLocationService.ts`',
  '`services/saleService.ts`',
  '`services/orderService.ts`',
  '`tmp-tests/external-integrations-total-stock-static.test.mjs`',
  '`tmp-tests/estoque-staging-runbook-static.test.mjs`',
  '`npm.cmd run build`',
]) {
  assert.match(doc, new RegExp(requiredItem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `commit scope should include: ${requiredItem}`);
}

console.log('estoque commit scope static checks passed');
