import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const doc = readFileSync('docs/operacional/2026-05-11-estoque-staging-validation.md', 'utf8');

for (const heading of [
  '## Preparacao',
  '## Produtos Para Teste',
  '## Fluxos Manuais',
  '## Integracoes Externas',
  '## Evidencias',
  '## Criterios De Aprovacao',
  '## Criterios De Bloqueio',
  '## Rollback / Contencao',
  '## Resultado',
]) {
  assert.match(doc, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `runbook should include ${heading}`);
}

for (const requiredItem of [
  'Criar backup do banco antes da migration',
  'supabase/migrations/20260509000001_multi_deposit_stock.sql',
  'supabase/verify_multi_deposit_stock.sql',
  'Loja Principal / Estoque Geral',
  'Venda PDV do Produto B baixa primeiro da `Loja Principal`',
  'Pedido online pendente cria reserva por prioridade',
  'Lista de impressao nao cria reserva, baixa, ajuste ou transferencia',
  'Bling continua atualizando `products.stock_quantity`',
  'VPS continua recebendo estoque total por `/products/stock`',
  'DROP VIEW IF EXISTS stock_location_divergences',
]) {
  assert.match(doc, new RegExp(requiredItem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `runbook should include: ${requiredItem}`);
}

console.log('estoque staging runbook static checks passed');
