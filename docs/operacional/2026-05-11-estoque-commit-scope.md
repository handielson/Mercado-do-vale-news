# Escopo De Commit - Estoque Multi-Depositos

Data: 11/05/2026

Objetivo: deixar pronto o escopo para quando for solicitado commit desta frente, seguindo `commit.md`.

## Regra

- [ ] Conferir `git status` antes de qualquer stage.
- [ ] Ler o diff de cada arquivo antes de stagear.
- [ ] Stagear somente arquivos desta frente.
- [ ] Nao misturar alteracoes paralelas do worktree.
- [ ] Fazer push por padrao.
- [ ] Levar para `main` se precisar refletir na Vercel.
- [ ] Verificar Vercel se houver deploy web.
- [ ] Avaliar deploy VPS apenas se o commit mexer em runtime/servicos da VPS.

## Arquivos Provaveis Desta Frente

- [ ] `Estoque.md`
- [ ] `supabase/migrations/20260509000001_multi_deposit_stock.sql`
- [ ] `supabase/verify_multi_deposit_stock.sql`
- [ ] `types/stock-location.ts`
- [ ] `services/stockLocationService.ts`
- [ ] `services/saleService.ts`
- [ ] `services/orderService.ts`
- [ ] `pages/admin/inventory/StockLocationsPage.tsx`
- [ ] `pages/admin/inventory/InventoryPrintListPage.tsx`
- [ ] `routes/index.tsx`
- [ ] `layouts/AdminLayout.tsx`
- [ ] `types/unit.ts`
- [ ] `services/units.ts`
- [ ] `vps_server.cjs`
- [ ] `vps_server.js`
- [ ] `docs/operacional/2026-05-11-estoque-staging-validation.md`

## Testes Provaveis Desta Frente

- [ ] `tmp-tests/multi-deposit-stock-migration-static.test.mjs`
- [ ] `tmp-tests/stock-location-service-static.test.mjs`
- [ ] `tmp-tests/stock-locations-page-static.test.mjs`
- [ ] `tmp-tests/stock-location-entry-static.test.mjs`
- [ ] `tmp-tests/stock-location-adjustment-static.test.mjs`
- [ ] `tmp-tests/stock-location-transfer-static.test.mjs`
- [ ] `tmp-tests/stock-location-priority-decrement-static.test.mjs`
- [ ] `tmp-tests/stock-location-divergence-validation-static.test.mjs`
- [ ] `tmp-tests/stock-location-movements-service-static.test.mjs`
- [ ] `tmp-tests/stock-locations-movements-page-static.test.mjs`
- [ ] `tmp-tests/product-stock-location-surface-static.test.mjs`
- [ ] `tmp-tests/inventory-print-list-static.test.mjs`
- [ ] `tmp-tests/sale-priority-stock-decrement-static.test.mjs`
- [ ] `tmp-tests/sale-stock-restore-by-location-static.test.mjs`
- [ ] `tmp-tests/order-priority-stock-decrement-static.test.mjs`
- [ ] `tmp-tests/order-stock-reservation-static.test.mjs`
- [ ] `tmp-tests/order-stock-restore-by-location-static.test.mjs`
- [ ] `tmp-tests/external-integrations-total-stock-static.test.mjs`
- [ ] `tmp-tests/multi-deposit-stock-verification-sql-static.test.mjs`
- [ ] `tmp-tests/vercel-deploy-readiness-static.test.mjs`
- [ ] `tmp-tests/estoque-staging-runbook-static.test.mjs`
- [ ] `tmp-tests/vps-units-location-fields-static.test.mjs`

## Nao Incluir Sem Pedido Explicito

- [ ] Logs locais `.log`.
- [ ] Pastas temporarias.
- [ ] Mudancas de marketing, autoresponder, SEO ou imagens sem relacao com estoque.
- [ ] Arquivos de outras frentes que ja estavam modificados antes.
- [ ] Deploy VPS real sem confirmacao operacional.

## Mensagem De Commit Sugerida

```text
feat(inventory): add multi-location stock workflow
```

Alternativa se for apenas documentacao/roteiro:

```text
docs(inventory): document multi-location stock validation
```

## Verificacoes Antes Do Commit

- [ ] `node tmp-tests\multi-deposit-stock-migration-static.test.mjs`
- [ ] `node tmp-tests\stock-location-service-static.test.mjs`
- [ ] `node tmp-tests\stock-locations-page-static.test.mjs`
- [ ] `node tmp-tests\stock-location-priority-decrement-static.test.mjs`
- [ ] `node tmp-tests\sale-priority-stock-decrement-static.test.mjs`
- [ ] `node tmp-tests\sale-stock-restore-by-location-static.test.mjs`
- [ ] `node tmp-tests\order-priority-stock-decrement-static.test.mjs`
- [ ] `node tmp-tests\order-stock-reservation-static.test.mjs`
- [ ] `node tmp-tests\external-integrations-total-stock-static.test.mjs`
- [ ] `node tmp-tests\multi-deposit-stock-verification-sql-static.test.mjs`
- [ ] `node tmp-tests\vercel-deploy-readiness-static.test.mjs`
- [ ] `node tmp-tests\estoque-staging-runbook-static.test.mjs`
- [ ] `npm.cmd run build`

## Observacao

Se a mudanca for publicada antes da migration real, manter claro que a migration ainda precisa ser aplicada e validada em staging/producao antes de depender do fluxo novo sem fallback.
