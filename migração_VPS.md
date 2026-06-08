# Migração VPS

## 2026-05-31 - Catalogo Bling sem Supabase operacional

Mudanca: `blingService` deixou de usar `.from(...)` para `products`, `categories` e os ultimos `models`. A importacao Bling valida categorias pela VPS, grava produtos por `vpsApiService.updateProduct`/`createProduct`, resincroniza produtos por `updateProduct` e os helpers de dimensoes usam `modelService.getById`/`modelService.update`.

Escopo admin/publico:

- Admin afetado: Configuracoes > Bling, importacao de produtos, resincronizacao e push/pull de dimensoes.
- Publico afetado: direto no catalogo, porque produtos, categorias, modelos e marcas agora passam pela VPS/MySQL.

Validacao:

- RED: `node tmp-tests\bling-import-products-vps-static.test.mjs`, `node tmp-tests\bling-import-categories-vps-static.test.mjs` e `node tmp-tests\bling-model-dimensions-vps-static.test.mjs` falharam antes das trocas.
- `node tmp-tests\bling-import-products-vps-static.test.mjs`: OK.
- `node tmp-tests\bling-import-categories-vps-static.test.mjs`: OK.
- `node tmp-tests\bling-model-dimensions-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 0`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `products`, `categories`, `brands` e `models` sairam dos alvos `.from(...)`; a allowlist `products-catalog-migration-temporary` foi removida; o baseline Supabase caiu de `.from=10` para `.from=0`.

Rollback: restaurar os caminhos Supabase no `blingService` e recolocar a allowlist de catalogo; nao recomendado porque reintroduz dados operacionais de catalogo fora da VPS.

## 2026-05-31 - Modelo selecionado do Bling pela VPS

Mudanca: `importBlingProducts` deixou de consultar `models` com join em `brands` pelo Supabase para carregar o modelo escolhido na importacao. Agora usa `modelService.getById(modelId)` e `brandService.getById(modelData.brand_id)`.

Escopo admin/publico:

- Admin afetado: importacao Bling quando o usuario seleciona um modelo manualmente.
- Publico afetado: indireto, por manter descricao/modelo/marca dos produtos importados na base VPS/MySQL.

Validacao:

- RED: `node tmp-tests\bling-selected-model-vps-static.test.mjs` falhou antes da troca.
- `node tmp-tests\bling-selected-model-vps-static.test.mjs`: OK.
- `node tmp-tests\bling-brands-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 10`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `models` caiu de 4 para 3 ocorrencias restantes e o baseline Supabase caiu de `.from=11` para `.from=10`.

Rollback: restaurar a consulta direta a `supabase.from('models')` para o modelo selecionado e voltar baseline `.from=11`; nao recomendado porque reintroduz leitura de catalogo fora da VPS.

## 2026-05-31 - Marcas do Bling pela VPS

Mudanca: o helper de resolucao de marca no `blingService` deixou de consultar/criar `brands` pelo Supabase. A importacao de modelos do Bling agora resolve marcas por `brandService.list()` e cria ausentes por `brandService.create()`.

Escopo admin/publico:

- Admin afetado: importacao/sincronizacao de produtos e modelos do Bling.
- Publico afetado: indireto, porque os produtos importados passam a referenciar marcas persistidas na VPS/MySQL.

Validacao:

- RED: `node tmp-tests\bling-brands-vps-static.test.mjs` falhou antes da troca.
- `node tmp-tests\bling-brands-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 11`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `brands` saiu dos alvos restantes e o baseline Supabase caiu de `.from=15` para `.from=11`.

Rollback: restaurar o helper antigo com `supabase.from('brands')` e voltar baseline `.from=15`; nao recomendado porque recoloca criacao de marca do Bling fora da VPS.

## 2026-05-31 - Modelos da planilha pela VPS

Mudanca: `DataSyncService.generateDynamicTemplate` deixou de consultar `models` pelo Supabase para montar `template_values` e fallback de marca. A rotina agora usa `modelService.list()` e `vpsApiService.getBrands()`.

Escopo admin/publico:

- Admin afetado: geracao de template dinamico de planilha para importacao de produtos.
- Publico afetado: indireto, pela qualidade dos dados importados para o catalogo VPS/MySQL.

Validacao:

- RED: `node tmp-tests\data-sync-models-vps-static.test.mjs` falhou antes da troca.
- `node tmp-tests\data-sync-models-vps-static.test.mjs`: OK.
- `node tmp-tests\data-sync-products-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 15`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `models` caiu de 5 para 4 ocorrencias restantes e o baseline Supabase caiu de `.from=16` para `.from=15`.

Rollback: restaurar a consulta direta a `supabase.from('models')` no `DataSyncService` e voltar baseline `.from=16`; nao recomendado porque recoloca dados de template de produto fora da VPS.

## 2026-05-31 - Importacao de produtos por planilha pela VPS

Mudanca: `DataSyncService.syncGoogleSpreadsheet` deixou de gravar `products` pelo Supabase. Produtos com `system_id` agora usam `vpsApiService.updateProduct`, e novos produtos usam `vpsApiService.createProduct`.

Escopo admin/publico:

- Admin afetado: importacao/sincronizacao de planilhas em Data Import/Export.
- Publico afetado: direto no catalogo, pois os produtos criados/atualizados passam pela VPS/MySQL.

Validacao:

- RED: `node tmp-tests\data-sync-products-vps-static.test.mjs` falhou antes da troca.
- `node tmp-tests\data-sync-products-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 16`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `products` caiu de 5 para 3 ocorrencias restantes e o baseline Supabase caiu de `.from=18` para `.from=16`.

Rollback: restaurar update/insert em `supabase.from('products')` no `DataSyncService` e voltar baseline `.from=18`; nao recomendado porque recoloca importacao admin de catalogo fora da VPS.

## 2026-05-31 - Vinculo Bling ID pela VPS

Mudanca: `BlingPage.reimportProduct` deixou de atualizar `products.bling_id` diretamente no Supabase. A rotina da pagina admin agora usa `vpsApiService.updateProduct` para vincular o ID encontrado no Bling.

Escopo admin/publico:

- Admin afetado: Configuracoes > Bling, checagem e reimportacao de produtos sem `bling_id`.
- Publico afetado: indireto, pois o vinculo fica na base operacional da VPS/MySQL usada pelo catalogo.

Validacao:

- RED: `node tmp-tests\bling-page-product-link-vps-static.test.mjs` falhou antes da troca.
- `node tmp-tests\bling-page-product-link-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 18`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `products` caiu de 6 para 5 ocorrencias restantes e o baseline Supabase caiu de `.from=19` para `.from=18`.

Rollback: restaurar o update direto em `supabase.from('products')` na `BlingPage` e voltar baseline `.from=19`; nao recomendado porque recoloca um fluxo admin do Bling fora da VPS.

## 2026-05-31 - Precos de variacao pela VPS

Mudanca: `priceHistoryService.applyPricesToVariation` agora atualiza produtos pela VPS com `vpsApiService.updateProduct`, mantendo o historico em `/table-data/product_price_history`.

Escopo admin/publico:

- Admin afetado: paineis de precos por modelo/variacao.
- Publico afetado: direto, nos precos do catalogo publicados pela VPS/MySQL.

Validacao:

- RED: `node tmp-tests\price-history-vps-static.test.mjs` falhou antes da troca.
- `node tmp-tests\price-history-vps-static.test.mjs`: OK.
- `node tmp-tests\price-history-null-regression.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 19`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `products` caiu de 7 para 6 e o baseline Supabase caiu de `.from=20` para `.from=19`.

Rollback: restaurar o update Supabase de `products` em `applyPricesToVariation` e voltar baseline `.from=20`; nao recomendado porque recoloca escrita de preco fora da VPS.

## 2026-05-31 - Company context pela VPS

Mudanca: `companyContext.getCompanyId` agora resolve a empresa pela VPS em `/table-data/companies`. `LegacyMigration` e `blingService` deixaram de consultar `companies` diretamente e usam o helper compartilhado.

Escopo admin/publico:

- Admin afetado: migracao legada e integracao Bling.
- Publico afetado: indireto, por manter o tenant/catalogo amarrado na VPS/MySQL.

Validacao:

- RED: `node tmp-tests\company-context-vps-static.test.mjs` falhou antes da troca.
- `node tmp-tests\company-context-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 20`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `companies` saiu dos alvos restantes e o baseline Supabase caiu de `.from=23` para `.from=20`.

Rollback: restaurar as consultas Supabase de `companies` e voltar baseline `.from=23`; nao recomendado porque recoloca resolucao de empresa fora da VPS.

## 2026-05-31 - Gerenciamento de permissoes pela VPS

Mudanca: a tela `PermissionsManagementPage` removeu o CRUD direto de `user_permissions` no Supabase. A listagem e o salvamento agora usam `/table-data/user_permissions` na VPS, com recriacao em lote via `/bulk`.

Escopo admin/publico:

- Admin afetado: Configuracoes > Permissoes.
- Publico afetado: indireto, pelas regras persistidas na VPS/MySQL.

Validacao:

- RED: `node tmp-tests\permissions-management-vps-static.test.mjs` falhou antes da troca.
- `node tmp-tests\permissions-management-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 23`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `user_permissions` saiu dos alvos restantes e o baseline Supabase caiu de `.from=26` para `.from=23`.

Rollback: restaurar o CRUD Supabase de `user_permissions` e voltar baseline `.from=26`; nao recomendado porque recoloca permissoes admin fora da VPS.

## 2026-05-31 - Ajuste manual de estoque pela VPS

Mudanca: `inventoryService.adjustStock` deixou de gravar `products` e `stock_movements` via Supabase. A rotina agora le o produto pela VPS, atualiza `stock_quantity` com `vpsApiService.updateProduct`, registra auditoria em `/table-data/stock_movements` e consulta historico pela VPS.

Escopo admin/publico:

- Admin afetado: Inventario/Estoque, ajuste manual e historico de movimentacoes.
- Publico afetado: indireto, porque o estoque publicado continua refletindo a base da VPS/MySQL.

Validacao:

- RED: `node tmp-tests\inventory-stock-adjustment-vps-static.test.mjs` falhou antes da troca.
- `node tmp-tests\inventory-stock-adjustment-vps-static.test.mjs`: OK.
- `node tmp-tests\inventory-adjust-stock-vps-current-product-static.test.mjs`: OK.
- `node tmp-tests\inventory-vps-products-static.test.mjs`: OK.
- `node tmp-tests\inventory-service-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 27`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Extensao: a resolucao de `company_id` do usuario autenticado para auditoria do movimento tambem saiu de `supabase.from('users')` e passou a usar `/table-data/users`.

Resultado: `stock_movements` e `users` sairam dos alvos restantes, `products` caiu de 9 para 7 e o baseline Supabase caiu de `.from=31` para `.from=26`.

Rollback: restaurar as escritas Supabase de `products`/`stock_movements` e voltar baseline `.from=31`; nao recomendado porque recoloca ajustes de estoque fora da VPS.

## 2026-05-31 - Analytics de vendas pela VPS

Mudanca: os calculos do dashboard diario, digest de vendas e tags de vendas deixaram de usar `supabase.from('sales')`. `dashboardMetricsService`, `dashboardSalesDigestService` e `tagResolver` agora consultam vendas por `saleService.getSales`, mantendo a origem em `/table-data/sales` e itens via `/table-data/sale_items` na VPS/MySQL.

Escopo admin/publico:

- Admin afetado: dashboard, digest/relatorios operacionais e configuracoes de tags dinamicas.
- Publico afetado: indireto, em mensagens/automacoes que resolvem tags de vendas do dia.

Validacao:

- RED: `node tmp-tests\sales-analytics-vps-static.test.mjs` falhou antes da troca.
- `node tmp-tests\sales-analytics-vps-static.test.mjs`: OK.
- `node tmp-tests\sale-service-vps-table-data-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 31`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK fora do sandbox; dentro do sandbox o Vite segue bloqueado ao resolver `vite.config.ts`.

Resultado: `sales` saiu dos alvos restantes, a allowlist temporaria de vendas/clientes/financeiro foi removida e o baseline Supabase caiu de `.from=36` para `.from=31`.

Rollback: restaurar os acessos diretos a `sales` nesses servicos e voltar baseline `.from=36`; nao recomendado porque recoloca os indicadores fora da VPS.

## 2026-05-31 - Importacao legada de vendas pela VPS

Mudanca: `LegacySalesImportTab` removeu os acessos diretos a `sales` e `sale_items` no Supabase. O diagnostico, limpeza de importacoes, criacao de vendas/itens legados e atualizacao de `legacy_pdf_url` agora usam `vpsClient` com `/table-data/sales` e `/table-data/sale_items/bulk`.

Escopo admin/publico:

- Admin afetado: Central de Importacao & Exportacao, aba de vendas legadas.
- Publico afetado: indireto, porque as vendas importadas ficam na base operacional da VPS/MySQL usada pelo historico.

Validacao:

- RED: `node tmp-tests\legacy-sales-import-vps-sales-static.test.mjs` falhou antes da troca.
- `node tmp-tests\legacy-sales-import-vps-sales-static.test.mjs`: OK.
- `node tmp-tests\legacy-sales-import-customers-vps-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 36`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `sales` caiu de 10 para 5 ocorrencias operacionais, `sale_items` saiu dos alvos restantes e o baseline Supabase caiu de `.from=43` para `.from=36`.

Rollback: restaurar as leituras/escritas diretas de `sales`/`sale_items` na `LegacySalesImportTab` e voltar baseline `.from=43`; nao recomendado porque reintroduz vendas legadas fora da VPS.

## 2026-05-31 - Sync VPS da importacao sem Supabase

Mudanca: a aba `vps-sync` da `DataImportExportPage` deixou de buscar `products` no Supabase. Ela agora pagina produtos pela VPS (`vpsApiService.getProducts` com `offset`) e reaplica preco/estoque/status pelo `bulkSyncPricesStock`, removendo o papel do Supabase como fonte legado nessa ferramenta.

Escopo admin/publico:

- Admin afetado: Central de Importacao & Exportacao, aba de sync VPS.
- Publico afetado: indireto, mantendo catalogo publico amarrado na VPS/MySQL.

Validacao:

- RED: `node tmp-tests\data-import-export-vps-sync-static.test.mjs` falhou antes da troca.
- `node tmp-tests\data-import-export-vps-sync-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 43`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `products` caiu de 10 para 9 ocorrencias operacionais e o baseline Supabase caiu de `.from=44` para `.from=43`.

Rollback: restaurar a leitura paginada via `supabase.from('products')` nessa aba e voltar baseline `.from=44`; nao recomendado porque reativa uma fonte legada dentro da ferramenta de migracao.

## 2026-05-31 - SEO Dashboard grava catalogo pela VPS

Mudanca: `SEODashboardPage` removeu os updates diretos em `products` no Supabase. A pagina ja carregava os produtos por `seoDashboardData.js` via VPS e agora tambem grava slugs/meta tags por `vpsApiService.getProductById(..., true)` + `vpsApiService.updateProduct`.

Escopo admin/publico:

- Admin afetado: painel SEO e geracao em lote de slugs/meta tags.
- Publico afetado: indireto, porque os dados SEO continuam alimentando as paginas publicas, mas a escrita passa pela VPS/MySQL.

Validacao:

- RED: `node tmp-tests\seo-dashboard-products-vps-static.test.mjs` falhou antes da pagina usar `vpsApiService`.
- `node tmp-tests\seo-dashboard-products-vps-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 44`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `products` caiu de 12 para 10 ocorrencias operacionais e o baseline Supabase caiu de `.from=46` para `.from=44`.

Rollback: restaurar `supabase.from('products').update(...)` na `SEODashboardPage` e voltar baseline `.from=46`; nao recomendado porque reintroduz escrita de catalogo no Supabase.

## 2026-05-31 - Shopee admin usa metadados de vinculo pela VPS

Mudanca: `ShopeePage` passou a consumir `shopeeProductService` para todos os vinculos em `shopee_products`: listagem, importacao dos anuncios existentes, vinculo manual, apagar anuncio e vinculo, status, preco, rename, publicacao simples e publicacao com variacoes. O servico agora tambem expoe `upsert`, `upsertMany`, `updateByProductId`, `getByProductIds` e `deleteByShopeeItemId` sobre `/table-data/shopee_products`.

Escopo admin/publico:

- Admin afetado: pagina Shopee de configuracao/publicacao e seus fluxos de variacao.
- Publico afetado: indireto, mantendo a fonte de vinculos da Shopee unificada na VPS para os servicos compartilhados de produto.

Arquivos alterados:

- `pages/admin/settings/ShopeePage.tsx`
- `services/shopeeProducts.ts`
- `tmp-tests/shopee-page-product-links-vps-static.test.mjs`
- `tmp-tests/shopee-variation-modal-static.test.mjs`
- `tmp-tests/shopee-existing-variation-flow-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migracao_supabase.md`
- `migracao_VPS.md`

Validacao:

- RED: `node tmp-tests\shopee-page-product-links-vps-static.test.mjs` falhou antes da pagina usar `shopeeProductService`.
- `node tmp-tests\shopee-page-product-links-vps-static.test.mjs`: OK.
- `node tmp-tests\shopee-products-service-vps-static.test.mjs`: OK.
- `node tmp-tests\shopee-variation-modal-static.test.mjs`: OK.
- `node tmp-tests\shopee-existing-variation-flow-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 46`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `shopee_products` saiu do inventario operacional Supabase; o baseline caiu de `.from=57` para `.from=46` e a allowlist de catalogo nao permite mais essa tabela.

Rollback: restaurar o acesso direto a `supabase.from('shopee_products')` na `ShopeePage`, recolocar a tabela na allowlist e voltar baseline `.from=57`; nao recomendado porque desfaz a remocao do Supabase no caminho principal admin da Shopee.

## 2026-05-31 - Metadados compartilhados da Shopee pela VPS

Mudanca: criado `services/shopeeProducts.ts` para centralizar leitura/exclusao de `shopee_products` por `/table-data/shopee_products`. `useProducts`, `productService` e `ProductCard` passaram a usar esse servico para enriquecer produtos com `shopee_item_id` e limpar vinculos obsoletos.

Escopo admin/publico:

- Admin afetado: listagem/cache/busca de produtos e card de produto com estado/link Shopee.
- Publico afetado: indireto, pelo `productService` compartilhado que preserva metadados vindos da VPS.

Arquivos alterados:

- `services/shopeeProducts.ts`
- `hooks/useProducts.ts`
- `services/products.ts`
- `components/products/ProductCard.tsx`
- `tmp-tests/shopee-products-service-vps-static.test.mjs`
- `tmp-tests/use-products-shopee-link-state-static.test.mjs`
- `tmp-tests/product-list-shopee-link-state-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migracao_supabase.md`
- `migraÃ§Ã£o_VPS.md`

Validacao:

- RED: `node tmp-tests\shopee-products-service-vps-static.test.mjs` falhou antes de existir o servico VPS.
- `node tmp-tests\shopee-products-service-vps-static.test.mjs`: OK.
- `node tmp-tests\use-products-shopee-link-state-static.test.mjs`: OK.
- `node tmp-tests\product-list-shopee-link-state-static.test.mjs`: OK.
- `node tmp-tests\product-card-status-stock-vps-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 57`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `shopee_products` caiu de 15 para 11 ocorrencias operacionais no audit, o baseline caiu de `.from=61` para `.from=57` e a allowlist `shopee-products-crossmodule-temporary` saiu.

Rollback: restaurar as leituras/exclusao diretas de `shopee_products` em `useProducts`, `productService` e `ProductCard` e voltar baseline `.from=61`; nao recomendado porque desfaz o caminho compartilhado pela VPS.

## 2026-05-31 - Migracao legada de clientes pela VPS

Mudanca: `LegacyMigrationPage` removeu as leituras/escritas diretas de `customers` no Supabase. A verificacao de clientes existentes, migracao individual, migracao em lote e vinculacao de `user_id` apos criar conta Auth agora usam `customerService`.

Escopo admin/publico:

- Admin afetado: pagina/ferramenta de migracao legada de clientes.
- Publico afetado: impacto indireto nos clientes migrados, que passam a cair na fonte operacional VPS/MySQL usada por login/perfil publicos.

Arquivos alterados:

- `pages/LegacyMigration.tsx`
- `tmp-tests/legacy-migration-customers-vps-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migracao_supabase.md`
- `migraÃ§Ã£o_VPS.md`

Validacao:

- RED: `node tmp-tests\legacy-migration-customers-vps-static.test.mjs` falhou antes da troca para `customerService`.
- `node tmp-tests\legacy-migration-customers-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 61`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `customers` saiu dos alvos operacionais do auditor e o baseline Supabase caiu de `.from=73` para `.from=61`. A allowlist `customer-core-temporary` tambem foi removida.

Rollback: restaurar o acesso direto a `customers` no Supabase em `LegacyMigrationPage` e voltar baseline `.from=73`; nao recomendado porque recoloca clientes migrados fora da VPS.

## 2026-05-31 - Contexto Supabase Auth usando clientes da VPS

Mudanca: `SupabaseAuthContext` removeu o CRUD direto de `customers` pelo Supabase. O carregamento do cliente vinculado ao usuario Auth agora usa `customerService.getByUserId`; criacao por OAuth e cadastro publico usam `customerService.create`; ativacao, perfil e preview admin usam `customerService.update`.

Escopo admin/publico:

- Admin afetado: carregamento da sessao admin e persistencia do `admin_preview_type`.
- Publico afetado: criacao/ativacao de conta, criacao por OAuth e atualizacao de perfil de cliente.

Arquivos alterados:

- `contexts/SupabaseAuthContext.tsx`
- `tmp-tests/supabase-auth-customer-service-only-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migracao_supabase.md`
- `migraÃ§Ã£o_VPS.md`

Validacao:

- RED: `node tmp-tests\supabase-auth-customer-service-only-static.test.mjs` falhou antes da remocao das chamadas `.from('customers')`.
- `node tmp-tests\supabase-auth-customer-service-only-static.test.mjs`: OK.
- `node tmp-tests\supabase-auth-cpf-vps-customer-static.test.mjs`: OK.
- `node tmp-tests\auth-context-vps-customer-static.test.mjs`: OK.
- `node tmp-tests\customer-service-vps-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 73`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `customers` caiu de 19 para 12 ocorrencias operacionais no audit e o baseline Supabase caiu de `.from=80` para `.from=73`.

Rollback: restaurar o CRUD direto de `customers` em `SupabaseAuthContext` e voltar baseline `.from=80`; nao recomendado porque desfaz uma fatia compartilhada entre admin e publico.

## 2026-05-31 - Login publico por CPF pela VPS

Mudanca: `contexts/SupabaseAuthContext.tsx` passou a usar `customerService.getByCpfCnpj` para `checkCPF` e `signInWithCpf`. A busca do cliente/e-mail por CPF agora vem da VPS/MySQL, e o Supabase fica somente na etapa de Auth do login.

Escopo admin/publico:

- Publico afetado: cadastro/login de cliente, especialmente validacao de CPF e login por CPF.
- Admin afetado: nenhum fluxo admin nesta fatia.

Arquivos alterados:

- `contexts/SupabaseAuthContext.tsx`
- `services/customers.ts`
- `tmp-tests/supabase-auth-cpf-vps-customer-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migracao_supabase.md`
- `migraÃ§Ã£o_VPS.md`

Validacao:

- RED: `node tmp-tests\supabase-auth-cpf-vps-customer-static.test.mjs` falhou antes de trocar os lookups por `customerService`.
- `node tmp-tests\supabase-auth-cpf-vps-customer-static.test.mjs`: OK.
- `node tmp-tests\customer-service-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 80`, `.rpc(...) = 24`, `supabase.storage = 0`, `supabase.auth = 37`, `unclassifiedOperationalMatches = 0`.

Resultado: `customers` caiu de 21 para 19 ocorrencias operacionais no audit e o baseline Supabase caiu de `.from=82` para `.from=80`.

Rollback: restaurar as leituras diretas de `customers` em `checkCPF` e `signInWithCpf` e voltar baseline `.from=82`; nao recomendado porque desfaz mais um caminho publico ja coberto pela VPS.

## 2026-05-31 - AuthContext legado pela VPS

Mudanca: `contexts/AuthContext.tsx` deixou de buscar perfil de cliente por `supabase.from('customers')`. A busca por `user_id` agora passa por `customerService.getByUserId(userId)`, usando a camada VPS/MySQL ja criada para clientes.

Escopo admin/publico:

- Admin afetado: nenhum fluxo visual ativo; reducao preventiva de dependencia em contexto legado.
- Publico afetado: nenhum fluxo visual ativo; o provider ativo segue em `SupabaseAuthProvider`.

Arquivos alterados:

- `contexts/AuthContext.tsx`
- `tmp-tests/auth-context-vps-customer-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migracao_supabase.md`
- `migraÃ§Ã£o_VPS.md`

Validacao:

- RED: `node tmp-tests\auth-context-vps-customer-static.test.mjs` falhou antes da troca para `customerService`.
- `node tmp-tests\auth-context-vps-customer-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 82`, `.rpc(...) = 24`, `supabase.storage = 0`, `supabase.auth = 37`, `unclassifiedOperationalMatches = 0`.

Resultado: `customers` caiu de 22 para 21 ocorrencias operacionais no audit e o baseline Supabase caiu de `.from=83` para `.from=82`.

Rollback: restaurar a leitura direta de `customers` no contexto legado e voltar baseline `.from=83`; nao recomendado porque desfaz mais um caminho de cliente ja coberto pela VPS.

## 2026-05-31 - Fallback do login admin pela VPS

Mudanca: o fallback de seguranca em `AdminLoginPage` deixou de consultar `customers` pelo Supabase quando o contexto de auth demora a carregar o perfil. A tela agora usa `customerService.getByUserId(user.id)`, mantendo Supabase somente para autenticar e encerrar sessao.

Escopo admin/publico:

- Admin afetado: login administrativo, somente no fallback de timeout.
- Publico afetado: nenhum fluxo publico nesta fatia.

Arquivos alterados:

- `pages/auth/AdminLoginPage.tsx`
- `services/customers.ts`
- `tmp-tests/admin-login-vps-customer-fallback-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migracao_supabase.md`
- `migraÃ§Ã£o_VPS.md`

Validacao:

- RED: `node tmp-tests\admin-login-vps-customer-fallback-static.test.mjs` falhou antes da troca para `customerService`.
- `node tmp-tests\admin-login-vps-customer-fallback-static.test.mjs`: OK.
- `node tmp-tests\customer-service-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 83`, `.rpc(...) = 24`, `supabase.storage = 0`, `supabase.auth = 37`, `unclassifiedOperationalMatches = 0`.

Resultado: `customers` caiu de 23 para 22 ocorrencias operacionais no audit e o baseline Supabase caiu de `.from=84` para `.from=83`.

Rollback: restaurar a consulta direta de `customers` no fallback do login admin e voltar baseline `.from=84`; nao recomendado porque desfaz mais um caminho admin ja coberto pela VPS.

## 2026-05-31 - Clientes da importacao legada pela VPS

Mudanca: a analise da aba `LegacySalesImportTab` passou a carregar clientes pelo `customerService`, que usa a VPS/MySQL por `/table-data/customers`. O cruzamento de vendas antigas do MV-Gestao continua usando CPF normalizado para montar os matches, mas sem ler `customers` direto no Supabase.

Escopo admin/publico:

- Admin afetado: ferramenta de importacao legada de vendas, na fase de diagnostico/match de clientes.
- Publico afetado: nenhum fluxo publico nesta fatia.

Arquivos alterados:

- `components/import/LegacySalesImportTab.tsx`
- `tmp-tests/legacy-sales-import-customers-vps-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migracao_supabase.md`
- `migraÃ§Ã£o_VPS.md`

Validacao:

- RED: `node tmp-tests\legacy-sales-import-customers-vps-static.test.mjs` falhou antes de remover a leitura Supabase de `customers`.
- `node tmp-tests\legacy-sales-import-customers-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 84`, `.rpc(...) = 24`, `supabase.storage = 0`, `supabase.auth = 37`, `unclassifiedOperationalMatches = 0`.

Resultado: `customers` caiu de 24 para 23 ocorrencias operacionais no audit e o baseline Supabase caiu de `.from=85` para `.from=84`.

Rollback: restaurar a leitura direta de `customers` na aba de importacao legada e voltar baseline `.from=85`; nao recomendado porque desfaz mais uma leitura admin ja coberta pela VPS.

## 2026-05-31 - Codigo de indicacao cashback pela VPS

Mudanca: `validateReferralCode` em `cashbackService` passou a validar codigos de indicacao lendo `customers` pela VPS em `/table-data/customers`. A regra continua bloqueando o proprio codigo do cliente e retornando o nome do indicador, mas sem consulta direta a `supabase.from('customers')`.

Escopo admin/publico:

- Publico afetado: fluxo autenticado/publico de indicacao/cashback que valida `referral_code`.
- Admin afetado: nenhum fluxo visual novo nesta fatia; os RPCs de moedas continuam pendentes para uma etapa propria.

Arquivos alterados:

- `services/cashbackService.ts`
- `tmp-tests/cashback-referral-vps-customers-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migracao_supabase.md`
- `migraÃ§Ã£o_VPS.md`

Validacao:

- RED: `node tmp-tests\cashback-referral-vps-customers-static.test.mjs` falhou antes da troca para VPS.
- `node tmp-tests\cashback-referral-vps-customers-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 85`, `.rpc(...) = 24`, `supabase.storage = 0`, `supabase.auth = 37`, `unclassifiedOperationalMatches = 0`.

Resultado: `customers` caiu de 26 para 24 ocorrencias operacionais no audit e o baseline Supabase caiu de `.from=87` para `.from=85`.

Rollback: restaurar as consultas diretas a `customers` dentro de `validateReferralCode` e voltar baseline `.from=87`; nao recomendado porque reintroduz Supabase em um fluxo publico de cashback.

## 2026-05-31 - Busca de clientes no PDV/Frete pela VPS

Mudanca: `CustomerSection` no PDV e `FreightCalculator` passaram a buscar clientes pelo `customerService`, que ja usa a VPS/MySQL por `/table-data/customers`. A busca central agora considera nome, CPF/CNPJ, telefone e e-mail, incluindo comparacao por digitos para CPF/CNPJ e telefone com ou sem mascara.

Escopo admin/publico:

- Admin/PDV afetado: clientes recentes e busca de cliente no PDV; busca de cliente no calculador de frete para preencher destino e dados de etiqueta.
- Publico afetado: nenhum fluxo publico novo nesta fatia.

Arquivos alterados:

- `components/pdv/CustomerSection.tsx`
- `components/shipping/FreightCalculator.tsx`
- `services/customers.ts`
- `tmp-tests/customer-components-vps-service-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migracao_supabase.md`
- `migraÃ§Ã£o_VPS.md`

Validacao:

- RED: `node tmp-tests\customer-components-vps-service-static.test.mjs` falhou antes de remover as consultas diretas Supabase dos componentes.
- `node tmp-tests\customer-components-vps-service-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 87`, `.rpc(...) = 24`, `supabase.storage = 0`, `supabase.auth = 37`, `unclassifiedOperationalMatches = 0`.

Resultado: `customers` caiu de 29 para 26 ocorrencias operacionais no audit e o baseline Supabase caiu de `.from=90` para `.from=87`.

Rollback: restaurar as consultas diretas em `CustomerSection`/`FreightCalculator` e voltar baseline `.from=90`; nao recomendado porque reintroduz Supabase em fluxos de admin/PDV ja cobertos pela VPS.

## 2026-05-31 - Clientes admin/PDV pela VPS

Mudanca: `customerService` passou a usar a VPS como fonte operacional para clientes. O servico carrega `customers` por `/table-data/customers` paginado, aplica filtros por empresa/search/status/data no cliente, cria clientes com ID local e `referral_code`, atualiza por `PATCH /table-data/customers/:id?pk=id` e exclui por `DELETE /table-data/customers/:id?pk=id`. Campos JSON como `address` e `custom_data` sao serializados na escrita e normalizados na leitura.

Escopo admin/publico:

- Admin afetado: telas e componentes que usam `customerService`, incluindo cadastro/listagem de clientes, seletores de cliente em cashback/pedidos e a contagem ativa.
- PDV afetado: criacao e busca central de clientes pelo servico compartilhado.
- Publico afetado: nenhum fluxo publico novo nesta fatia; o perfil autenticado e a pagina publica de moedas continuam cobertos pelas etapas anteriores.

Arquivos alterados:

- `services/customers.ts`
- `tmp-tests/customer-service-vps-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migracao_supabase.md`
- `migraÃ§Ã£o_VPS.md`

Validacao:

- RED: `node tmp-tests\customer-service-vps-static.test.mjs` falhou antes da migracao do `customerService`.
- `node tmp-tests\customer-service-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 90`, `.rpc(...) = 24`, `supabase.storage = 0`, `supabase.auth = 37`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK fora do sandbox; avisos nao bloqueantes conhecidos permanecem.

Resultado: `customers` caiu de 36 para 29 ocorrencias operacionais no audit e o baseline Supabase caiu de `.from=97` para `.from=90`. Proxima fatia natural: remover acessos diretos restantes de `customers` em componentes legados ou atacar `shopee_products`.

Rollback: voltar o `customerService` para Supabase e restaurar baseline `.from=97`; nao recomendado porque desfaz o CRUD central de clientes pela VPS.

## 2026-05-31 - Pagina publica Moedas sem consulta direta Supabase

Mudanca: `pages/catalog/CoinsInfoPage.tsx` deixou de buscar `customers.referral_code` via Supabase. A pagina agora usa `useSupabaseAuth()` e mostra o codigo de indicacao a partir de `customer.referral_code`, que ja vem do contexto de autenticacao.

Escopo admin/publico:

- Admin afetado: nenhum.
- Publico afetado: pagina publica `/moedas`/informacoes das Moedas do Vale, removendo uma leitura direta de `customers`.

Arquivos alterados:

- `pages/catalog/CoinsInfoPage.tsx`
- `tmp-tests/coins-info-page-customer-context-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migracao_supabase.md`
- `migração_VPS.md`

Validacao:

- `node tmp-tests\coins-info-page-customer-context-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 97`, `.rpc(...) = 24`, `supabase.storage = 0`, `supabase.auth = 37`, `unclassifiedOperationalMatches = 0`.

Resultado: a dependencia operacional em `customers` caiu de 37 para 36 e o baseline do guard caiu de `.from=98` para `.from=97`.

Rollback: restaurar a consulta direta a `supabase.from('customers')` na pagina e voltar o baseline `.from=98`; nao recomendado porque recoloca Supabase no caminho publico.

## 2026-05-31 - Cliente VPS desacoplado do Supabase estatico

Mudanca: `services/vpsClient.ts` deixou de importar `services/supabase.ts` de forma estatica. O token Supabase agora e obtido via `getSupabaseClient()` somente quando a chamada precisa montar headers autenticados; se a sessao nao estiver disponivel, o cliente continua sem `Authorization` e preserva os headers da VPS.

Escopo admin/publico:

- Admin afetado: fluxos que usam `vpsClient` seguem anexando Bearer token quando existe sessao Supabase.
- Publico afetado: pagina publica e catalogo nao precisam carregar o cliente Supabase apenas para leituras pela VPS.

Arquivos alterados:

- `services/vpsClient.ts`
- `tmp-tests/vps-client-lazy-supabase-static.test.mjs`
- `migracao_supabase.md`
- `migração_VPS.md`

Validacao:

- `node tmp-tests\vps-client-lazy-supabase-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 98`, `.rpc(...) = 24`, `supabase.storage = 0`, `supabase.auth = 38`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK fora do sandbox; avisos nao bloqueantes conhecidos de chunks/imports permanecem.

Resultado: a VPS continua sendo o caminho comum de dados, mas o cliente compartilhado nao inicializa Supabase no runtime publico por padrao.

Rollback: restaurar o import estatico `import { supabase } from './supabase'` em `vpsClient.ts` e remover o teste novo; nao recomendado porque aumenta novamente o acoplamento do catalogo publico com Supabase.

Este documento define as regras para conduzir a migração do Mercado do Vale para a VPS, com foco em remover dependências da Vercel e usar a VPS como infraestrutura principal do sistema.

## 2026-05-31 - Vendas PDV pela VPS

Mudanca: o `saleService` passou a usar a VPS como fonte para criar venda, gravar itens, buscar venda por ID, listar vendas, calcular resumo, cancelar, estornar e excluir vendas PDV. `createSale` grava `sales` por `/table-data/sales`, grava itens por `/table-data/sale_items/bulk` e usa rollback por `/table-data/sales/:id`; os demais fluxos carregam `/table-data/sales`, `/table-data/sale_items`, `/table-data/customers` e `/table-data/team_members`, com filtros e hidratacao no servico. As escritas de status usam `/table-data/sales/:id`.

Pendencias preservadas: RPC de referral (`process_referral_reward`) e RPCs de estoque continuam separados para outra fatia transacional.

Escopo admin/publico: mudanca somente em fluxos administrativos/PDV. Nenhuma pagina publica foi afetada diretamente.

Arquivos alterados:

- `services/saleService.ts`
- `tmp-tests/sale-service-vps-table-data-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `docs/superpowers/plans/2026-05-31-sales-vps-table-data.md`
- `migracao_supabase.md`
- `migração_VPS.md`

Validacao:

- RED: `node tmp-tests\sale-service-vps-table-data-static.test.mjs` falhou antes da migracao dos helpers VPS e voltou a falhar enquanto `createSale` ainda nao usava `createLocalId`/`vpsClient`.
- `node tmp-tests\sale-service-vps-table-data-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 98`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK via Vite; apenas avisos nao bloqueantes de chunk/import.

Atualizacao adicional: a busca do nome do comprador no referral agora usa `/table-data/customers`, reduzindo mais uma leitura direta de `customers`.

Resultado: o PDV reduziu dependencias operacionais Supabase de `.from=112` para `.from=98`, com `sales` em 10 ocorrencias, `sale_items` em 2 e `customers` em 37. Proxima fatia natural: atacar mais chamadas de `customers` ou isolar os RPCs de estoque/cashback da venda.

Rollback: voltar `saleService` para criacao, leituras e mutacoes diretas Supabase e restaurar baseline `.from=112`; nao recomendado porque desfaz uma reducao validada da migracao VPS.

## Objetivo Principal

Usar ao máximo a VPS para hospedar, executar e controlar o sistema.

A VPS deve ser tratada como o centro da aplicação:

- frontend;
- APIs;
- webhooks;
- rotinas agendadas;
- uploads;
- arquivos públicos;
- logs;
- processos Node;
- banco operacional sempre que possível;
- deploy e rollback.

Tudo que não puder ir para a VPS deve ter justificativa clara e alternativa proposta.

## Regra Permanente - Admin e Pagina Publica

Sempre que uma mudanca da migracao afetar um fluxo usado tanto pela pagina do admin quanto pela pagina publica, a implementacao, os testes e a documentacao devem cobrir explicitamente os dois lados.

Antes de considerar a etapa concluida, verificar e registrar:

- qual tela/fluxo do admin foi afetado;
- qual tela/fluxo publico foi afetado;
- quais testes cobrem o admin;
- quais testes cobrem a pagina publica;
- se o build passou depois da mudanca;
- se a etapa foi apenas validada localmente ou tambem publicada no VPS.

Quando a mudanca afetar somente admin ou somente publico, documentar isso de forma explicita para evitar ambiguidade no historico da migracao.

## 2026-05-30 - Unidades serializadas via VPS no admin e rastreio publico

Mudanca: `units` deixou de ser lida diretamente do Supabase na tela admin `/admin/serializados` e na pagina publica `/pedido/:id`. `services/units.ts` passou a expor `listAll()` para o admin e `listByIds()` para o rastreio publico; `services/vpsApiService.ts` ganhou `getUnits()` com filtros genericos; e a rota VPS `/units` agora aceita `company_id` e `ids`, alem de hidratar `product_name`/`product_sku` via join com `products`.

Escopo admin/publico:

- Admin afetado: `/admin/serializados`, listagem e filtro de unidades serializadas por status.
- Publico afetado: `/pedido/:id`, exibicao de IMEI/serial quando os documentos serializados do pedido ja foram liberados.

Validacao:

- RED: `node tmp-tests\serialized-units-vps-only-static.test.mjs` falhou enquanto o admin ainda nao usava `unitService.listAll()` e o rastreio publico ainda nao usava `unitService.listByIds()`.
- `node tmp-tests\serialized-units-vps-only-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 121`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.
- `node tmp-tests\units-swap-logs-vps-static.test.mjs`: OK.
- `node tmp-tests\serialized-units-swap-logs-vps-static.test.mjs`: OK.
- `node tmp-tests\order-tracking-vps-products-static.test.mjs`: OK.
- `node --check vps_server.cjs`: OK.
- `node --check vps_server.js`: OK.
- `npm.cmd run build`: OK fora do sandbox; Vite manteve apenas avisos conhecidos de chunking/import dinamico misturado.

Publicacao VPS:

- API: `node deploy-vps-server-only.cjs` publicou `vps_server.js`/`server.js` em `/var/www/mdv-api` e reiniciou `mdv-api` no PM2.
- Site: `npm.cmd run deploy:vps-site` publicou a release `/var/www/mdv-site/releases/20260530-211604`.
- Verificacao online: `https://api.xiaomipetrolina.com.br/units?company_id=...&status=all` respondeu `200`; `https://www.mercadodovale.com.br/admin/serializados` respondeu `200 OK`; `https://www.mercadodovale.com.br/pedido/teste` respondeu `200 OK`.

Resultado: `units` saiu da allowlist temporaria do auditor e o baseline operacional Supabase caiu de `.from=124` para `.from=121`. A leitura de unidades serializadas agora passa pela VPS tanto no admin quanto no fluxo publico de rastreio.

Rollback: restaurar as leituras diretas de `units` em `SerializedUnitsPage` e `OrderTrackingPage`, recolocar `units` na allowlist `inventory-and-operations-temporary` e voltar o baseline `.from=124`; nao recomendado porque reintroduz Supabase em um fluxo compartilhado admin/publico.

## 2026-05-30 - Historico de movimentacoes com nome do produto

Mudanca: a tela admin `/admin/inventory/locations`, no bloco "Historico de movimentacoes", deixou de exibir o UUID cru em `Produto`. A rota VPS `/stock-locations/movements` agora hidrata cada movimento com `product.name`, `product.sku`, `product.ean` e `product.specs` via join com `products`, e a interface usa esses dados para mostrar o nome/SKU/especificacoes. Quando o produto nao puder ser encontrado, a tela mostra "Produto nao encontrado" em vez do ID tecnico.

Escopo admin/publico: mudanca somente no admin de estoque. Nenhuma pagina publica foi afetada.

Validacao:

- RED: `node tmp-tests\stock-locations-movements-page-static.test.mjs` falhou enquanto o contrato de movimentos nao aceitava `product` hidratado e a tela ainda podia retornar `movement.product_id`.
- `node tmp-tests\stock-locations-movements-page-static.test.mjs`: OK.
- `node tmp-tests\stock-location-service-static.test.mjs`: OK.
- `node tmp-tests\vps-stock-location-contract-static.test.mjs`: OK.
- `node --check vps_server.cjs`: OK.
- `node --check vps_server.js`: OK.
- `npm.cmd run build`: OK fora do sandbox; Vite manteve apenas avisos conhecidos de chunking/import dinamico misturado.

Publicacao VPS:

- API: `node deploy-vps-server-only.cjs` publicou `vps_server.js`/`server.js` em `/var/www/mdv-api` e reiniciou `mdv-api` no PM2.
- Site: `npm.cmd run deploy:vps-site` publicou a release `/var/www/mdv-site/releases/20260530-205157`.
- Verificacao online: `https://www.mercadodovale.com.br/admin/inventory/locations` respondeu `200 OK`; a API `/stock-locations/movements?limit=3` respondeu `200` com `product.name` para o produto `NV-C29`.

Resultado: o historico de estoque fica legivel para operacao e auditoria, exibindo o nome do produto em vez de IDs internos.

Rollback: restaurar o `SELECT *` anterior em `/stock-locations/movements` e o fallback antigo da coluna Produto; nao recomendado porque volta a expor UUIDs na tela admin.

## 2026-05-30 - Transferencia em lote com origem explicita

Mudanca: a tela admin `/admin/inventory/locations`, no bloco "Transferencia em lote", passou a exibir o seletor de estoque de origem mesmo quando existe apenas uma origem com saldo. A coluna de quantidade tambem ficou explicita como "Quantidade a movimentar". A lista de opcoes do seletor agora vem da distribuicao completa do item, para permitir trocar a origem depois da primeira selecao; a transferencia efetiva continua usando somente a origem escolhida.

Escopo admin/publico: mudanca somente no admin de estoque. Nenhuma pagina publica foi afetada.

Validacao:

- RED: `node tmp-tests\stock-location-batch-origin-selection-static.test.mjs` falhou enquanto a linha do lote nao tinha seletor explicito para origem unica.
- `node tmp-tests\stock-location-batch-origin-selection-static.test.mjs`: OK.
- `node tmp-tests\stock-location-batch-transfer-static.test.mjs`: OK.
- `node tmp-tests\stock-location-batch-transfer-draft-quota-static.test.mjs`: OK.
- `npm.cmd run build`: OK fora do sandbox; Vite manteve apenas avisos conhecidos de chunking/import dinamico misturado.

Resultado: o operador consegue escolher explicitamente o estoque de origem e informar a quantidade que sera movimentada antes de transferir o lote, evitando a mensagem de erro sem um controle visivel para resolver.

Complemento: quando uma das fontes do produto ja e o proprio local de destino selecionado, ela permanece visivel no seletor e no resumo, mas fica desabilitada com a indicacao "ja esta no destino". A transferencia continua permitindo apenas origens diferentes do destino.

Rollback: restaurar a renderizacao condicional anterior em `StockLocationsPage.tsx`; nao recomendado porque volta a esconder a escolha de origem quando ha apenas uma origem real.

## 2026-05-30 - Pedidos online via VPS table-data

Mudanca: `services/orderService.ts` deixou de ler/gravar `orders` e `order_items` pelo Supabase. Criacao, listagem, busca por ID, atualizacao de status, cancelamento, confirmacao de pagamento e salvamento de resultado de gateway agora passam por `/table-data/orders` e `/table-data/order_items` via `vpsClient`. A pagina publica continua usando `createOrder`/`getOrderById` em `CheckoutPage`, `OrderConfirmationPage` e `OrderTrackingPage`; o admin continua usando `getOrders`, `updateOrderStatus`, `completeOnDeliveryOrder` e `cancelOrder` em `OnlineOrdersPage`. `SerializedUnitsPage` tambem deixou de atualizar `orders.serialized_docs_released` diretamente pelo Supabase e passou pelo `orderService`.

Objetivo: remover a dependencia operacional de pedidos online do frontend sem alterar as regras de pagamento, reserva/baixa de estoque, cashback pendente, alerta Telegram, rastreamento publico e painel admin.

Validacao:

- RED: `node tmp-tests\orders-service-vps-static.test.mjs` falhou enquanto `orderService` ainda usava `supabase.from('orders')` e `supabase.from('order_items')`.
- `node tmp-tests\orders-service-vps-static.test.mjs`: OK.
- `node tmp-tests\order-stock-restore-by-location-static.test.mjs`: OK.
- `node tmp-tests\order-stock-reservation-static.test.mjs`: OK.
- `node tmp-tests\order-priority-stock-decrement-static.test.mjs`: OK.
- `node tmp-tests\order-average-vps-products-static.test.mjs`: OK.
- `node tmp-tests\order-tracking-vps-products-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 124`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `orders`, `order_items` e `order_status_history` sairam da allowlist temporaria do auditor, e o baseline operacional Supabase caiu de `.from=149` para `.from=124`. Os RPCs legados de estoque/cashback acionados pelo ciclo de pagamento continuam no backlog proprio.

Rollback: restaurar o uso direto de Supabase em `services/orderService.ts` e `SerializedUnitsPage`, recolocar `orders-temporary` na allowlist e voltar o baseline `.from=149`; nao recomendado porque reintroduz pedidos publicos/admin fora da VPS.

## 2026-05-30 - Credenciais e tokens Bling via VPS company-settings

Mudanca: `pages/admin/settings/BlingPage.tsx`, `pages/admin/settings/BlingCallbackPage.tsx` e `services/blingService.ts` deixaram de ler/gravar `company_settings` pelo Supabase para credenciais e tokens Bling. A leitura e persistencia agora passam por `companySettingsService` e pela rota VPS `/company-settings`; a troca OAuth usa a rota VPS `/api/bling?resource=exchange`.

Objetivo: remover o ultimo bloco de configuracao Bling que ainda dependia de Supabase direto para `company_settings`, mantendo o fluxo de conexao, expiracao e refresh de token.

Validacao:

- RED: `node tmp-tests\bling-company-settings-vps-static.test.mjs` falhou enquanto BlingPage, BlingCallbackPage e blingService ainda usavam `supabase.from('company_settings')`.
- `node tmp-tests\bling-company-settings-vps-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 149`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK fora do sandbox; Vite manteve apenas avisos ja conhecidos de chunking/import dinamico misturado.

Resultado: `company_settings` saiu dos alvos restantes do inventario operacional frontend, e o baseline Supabase foi reduzido de `.from=157` para `.from=149`.

Rollback: restaurar as leituras/escritas diretas em BlingPage, BlingCallbackPage e blingService e voltar o baseline `.from=157`; nao recomendado porque reintroduz credenciais/tokens Bling fora da rota central da VPS.

## 2026-05-30 - Status de conexao Shopee via dados da empresa VPS

Mudanca: `pages/admin/settings/ShopeePage.tsx` deixou de consultar `company_settings` pelo Supabase durante `loadData()`. A tela agora usa o `getCompanyData()` ja carregado da VPS para definir `shopee_access_token`/`shopee_shop_id` e marcar o status de conexao da Shopee.

Objetivo: remover uma consulta redundante de configuracao da empresa fora da VPS sem alterar os fluxos de catalogo/pedidos Shopee ainda pendentes.

Validacao:

- RED: `node tmp-tests\shopee-page-company-settings-vps-static.test.mjs` falhou enquanto a pagina ainda usava `supabase.from('company_settings')`.
- `node tmp-tests\shopee-page-company-settings-vps-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 157`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `company_settings` caiu de 9 para 8 chamadas diretas no inventario, e o baseline operacional Supabase foi reduzido para `.from=157`.

Rollback: restaurar a leitura direta anterior em `ShopeePage` e voltar o baseline `.from=158`; nao recomendado porque duplica no Supabase uma informacao ja carregada da VPS.

## 2026-05-30 - Feedbacks de cliente via VPS table-data

Mudanca: `services/feedbackService.ts` deixou de usar Supabase para `company_settings` e `customer_feedbacks`. O servico agora resolve `company_id` por `companySettingsService.get()` na rota VPS `/company-settings`, cria/lista/conta/atualiza/remove feedbacks por `/table-data/customer_feedbacks`, pagina os resultados em lotes de 200 e preserva filtros por status/tipo e ordenacao local por `created_at` desc.

Objetivo: mover o fluxo publico/admin de feedbacks para a VPS e remover mais uma leitura direta de `company_settings` no frontend.

Validacao:

- RED: `node tmp-tests\feedback-service-vps-static.test.mjs` falhou enquanto `feedbackService` importava Supabase.
- `node tmp-tests\feedback-service-vps-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 158`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `customer_feedbacks` passa pela rota generica da VPS e o inventario operacional Supabase caiu de `.from=159` para `.from=158`.

Rollback: restaurar a versao anterior de `services/feedbackService.ts` e voltar o baseline `.from=159`; nao recomendado porque reintroduz envio/listagem de feedbacks fora da VPS.

## 2026-05-30 - Dados publicos e administrativos da empresa via VPS

Mudanca: `services/companyService.ts` deixou de manter fallback Supabase para `company_settings`. Leitura, atualizacao e reset passam a usar somente a rota protegida `/company-settings` pela `vpsClient`. `services/publicCompanySettings.ts` tambem deixou de importar Supabase dinamicamente: o catalogo publico, loja, manutencao e componentes publicos agora leem apenas `/public/company-settings`, preservando cache em memoria/localStorage e sanitizacao dos campos expostos.

Objetivo: reduzir a dependencia operacional Supabase do bloco de configuracao administrativa, usando a VPS como fonte unica para dados da empresa em fluxos publicos e internos.

Validacao:

- RED: `node tmp-tests\company-service-vps-only-static.test.mjs` falhou enquanto `companyService` ainda importava Supabase e `USE_VPS.company`.
- RED: `node tmp-tests\public-company-settings-vps-only-static.test.mjs` falhou enquanto `publicCompanySettings` ainda tinha fallback Supabase.
- `node tmp-tests\company-service-vps-only-static.test.mjs`: OK.
- `node tmp-tests\public-company-settings-vps-only-static.test.mjs`: OK.
- `node tmp-tests\company-settings-service-vps-only-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 159`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: o inventario operacional Supabase caiu de `.from=165` para `.from=159`, e o baseline do auditor foi reduzido para 159.

Rollback: restaurar os fallbacks Supabase anteriores em `companyService` e `publicCompanySettings`, e voltar o baseline `.from=165`; nao recomendado porque reintroduz leitura/escrita de configuracao da empresa fora da VPS.

## 2026-05-30 - Galerias modelo/cor via VPS table-data

Mudanca: `model_color_images` deixou de ser consultada pelo Supabase nos servicos de catalogo. `services/model-color-images.ts` agora pagina `/table-data/model_color_images` pela VPS, normaliza tanto linhas antigas com `image_url/display_order` quanto o formato atual com `images[]`, e centraliza leitura, upsert e exclusao. `services/modelColorImages.ts` virou apenas uma fachada de compatibilidade para consumidores antigos. `catalogService`, `catalogSectionsService` e `modelImageCache` passaram a buscar fallback de imagens por modelo/cor pelo servico VPS.

Objetivo: manter as imagens compartilhadas de produto novo/modelo/cor na VPS/MySQL e remover mais uma fonte operacional Supabase do catalogo.

Validacao:

- RED: `node tmp-tests\model-color-images-vps-static.test.mjs` falhou enquanto os servicos ainda usavam `supabase.from('model_color_images')`.
- `node tmp-tests\model-color-images-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 175`, `.rpc(...) = 27`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK fora do sandbox, com os avisos conhecidos de chunk/dynamic import.

Resultado: `model_color_images` saiu da allowlist temporaria e o baseline caiu de `.from=193` para `.from=175`.

Rollback: restaurar os acessos Supabase nos servicos de imagens por modelo/cor, recolocar `model_color_images` na allowlist e voltar o baseline `.from=193`; nao recomendado porque reintroduz fallback de catalogo fora da VPS.

## 2026-05-30 - Servico de marcas VPS-only

Mudanca: `services/brands.ts` deixou de manter branches Supabase por `USE_VPS.brands`. Listagem, busca por ID, criacao, atualizacao, exclusao e listagem ativa agora usam somente a API da VPS (`/brands` via `vpsApiService`), preservando o fallback same-origin `/api/vps-proxy?path=/brands` para leitura no browser. A normalizacao de `active` continua tratando `null`/ausente como ativo e valores numericos `0` como inativo.

Objetivo: reduzir dependencias Supabase remanescentes no bloco de catalogo/produtos sem mexer ainda nas chamadas de marca internas do `blingService`.

Validacao:

- RED: `node tmp-tests\brand-service-vps-only-static.test.mjs` falhou enquanto `brands.ts` ainda importava Supabase e `USE_VPS`.
- `node tmp-tests\brand-service-vps-only-static.test.mjs`: OK.
- `node tmp-tests\brand-service-vps-source.test.mjs`: OK.
- `node tmp-tests\brand-list-active-null-filter.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 193`, `.rpc(...) = 27`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK fora do sandbox, com os avisos conhecidos de chunk/dynamic import.

Resultado: o baseline caiu de `.from=202` para `.from=193`. A tabela `brands` ainda fica temporariamente na allowlist porque `services/blingService.ts` tem consultas diretas remanescentes para conciliacao/importacao.

Rollback: restaurar o fallback Supabase anterior de `services/brands.ts` e voltar o baseline `.from=202`; nao recomendado porque reintroduz leitura/escrita de marca fora da VPS no servico compartilhado.

## 2026-05-30 - Biblioteca de campos customizados via VPS table-data

Mudanca: `services/custom-fields.ts` deixou de consultar/criar/atualizar/remover `custom_fields` pelo Supabase. O servico agora pagina `/table-data/custom_fields` via `vpsClient`, normaliza campos JSON (`options`, `validation`, `table_config`), filtra pelo `company_id` compartilhado e preserva cache, criacao, edicao limitada de campos de sistema, exclusao e reordenacao. A pagina `CustomFieldsLibraryPage` passou a usar o servico centralizado, e a pagina publica de produto deixou de buscar labels de campos customizados diretamente no Supabase.

Objetivo: remover `custom_fields` do bloco temporario de catalogo/produtos e manter a biblioteca global de campos na VPS/MySQL.

Validacao:

- RED: `node tmp-tests\custom-fields-service-vps-static.test.mjs` falhou enquanto o servico e as paginas ainda usavam `supabase.from('custom_fields')`.
- `node tmp-tests\custom-fields-service-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 202`, `.rpc(...) = 27`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK fora do sandbox, com os avisos conhecidos de chunk/dynamic import.

Resultado: `custom_fields` saiu da allowlist temporaria, e o baseline caiu de `.from=216` para `.from=202`.

Rollback: restaurar o uso anterior de Supabase em `services/custom-fields.ts`, `CustomFieldsLibraryPage` e `PublicProductPage`, recolocar `custom_fields` na allowlist e voltar o baseline `.from=216`; nao recomendado porque reintroduz configuracao de catalogo no Supabase.

## 2026-05-30 - Supabase Storage zerado em uploads

Mudanca: `services/uploadService.ts` deixou de manter fallback de Supabase Storage. Banners seguem pelo endpoint VPS `/banners/upload`, e avatares de clientes agora sobem para o Synology pela rota VPS `/synology/upload?folder=imagens`. `services/documentService.ts` tambem deixou de usar o bucket `company-documents`: PDFs de empresa passam por `/synology/upload?folder=arquivos`, os metadados continuam em `/table-data/company_documents`, a exclusao remove o arquivo por `/synology/file?folder=arquivos&name=...`, e URLs antigas por caminho simples ainda sao convertidas para o CDN de arquivos.

Objetivo: cumprir a regra de que novos arquivos nao entram mais no Supabase; arquivos ficam em VPS/Synology e metadados operacionais permanecem na VPS/MySQL.

Validacao:

- RED: `node tmp-tests\company-documents-vps-static.test.mjs` falhou enquanto `documentService` ainda usava `supabase.storage`.
- RED: `node tmp-tests\upload-service-vps-synology-static.test.mjs` falhou enquanto `uploadService` ainda usava `supabase.storage` e `USE_VPS` como fallback.
- `node tmp-tests\company-documents-vps-static.test.mjs`: OK.
- `node tmp-tests\upload-service-vps-synology-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 216`, `.rpc(...) = 27`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK fora do sandbox, com os avisos conhecidos de chunk/dynamic import.

Resultado: Supabase Storage ficou zerado no auditor, o baseline caiu para `.from=216`, `.rpc=27`, `storage=0`, e as allowlists `storage-temporary`/`named-storage-buckets-temporary` foram removidas para impedir regressao.

Rollback: restaurar temporariamente o uso anterior de Supabase Storage em `services/uploadService.ts` e `services/documentService.ts`, recolocar as allowlists de storage e o baseline antigo; nao recomendado porque reabre entrada de arquivos no Supabase.

## 2026-05-30 - Aposentadoria do models-new Supabase

Mudanca: removidos o servico experimental `services/models-new.ts` e a pagina nao roteada `pages/admin/debug/models.tsx`, ambos ainda dependentes de leitura direta no Supabase. A tela `pages/admin/settings/BlingPage.tsx` passou a usar `services/models.ts`, que ja consulta modelos pela rota VPS `/models`.

Objetivo: eliminar uma segunda implementacao de modelos que competia com o servico VPS atual e reduzia a clareza da migracao.

Validacao:

- RED: `node tmp-tests\retired-models-new-vps-static.test.mjs` falhou enquanto `services/models-new.ts` ainda existia.
- `node tmp-tests\retired-models-new-vps-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 327`, `.rpc(...) = 28`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.

Resultado: o inventario operacional Supabase caiu mais seis chamadas `.from(...)` (`333 -> 327`), e a tela Bling agora usa o caminho unico de modelos via VPS.

## 2026-05-30 - Aposentadoria do model-eans Supabase

Mudanca: removido `services/model-eans.ts`, que era um servico direto Supabase para a tabela `model_eans` e ficou sem consumidor ativo depois da aposentadoria do `models-new`.

Objetivo: reduzir codigo morto da arquitetura antiga de modelos e impedir que `model_eans` continue como dependencia operacional permitida sem uso real.

Validacao:

- RED: `node tmp-tests\retired-model-eans-service-static.test.mjs` falhou enquanto `services/model-eans.ts` ainda existia.
- `node tmp-tests\retired-model-eans-service-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 321`, `.rpc(...) = 28`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.

Resultado: o inventario operacional Supabase caiu mais seis chamadas `.from(...)` (`327 -> 321`) e `model_eans` saiu da allowlist temporaria do auditor.

## 2026-05-30 - Secoes do catalogo via VPS table-data

Mudanca: `services/catalogSectionsService.ts` deixou de usar `supabase.from('catalog_sections')` para listar, buscar, criar, atualizar, apagar e reordenar secoes. O CRUD agora usa `/table-data/catalog_sections` via `vpsClient`, com paginacao, ordenacao client-side por `display_order`, normalizacao defensiva de arrays vindos do MySQL e cache preservado. A busca de produtos da secao continua usando `/products` da VPS; as imagens por modelo/cor seguem como etapa separada.

Objetivo: mover a administracao das secoes da home do catalogo para a VPS/Synology sem alterar o contrato usado por `SectionsTab`, `CatalogSection` e a home publica.

Validacao:

- RED: `node tmp-tests\catalog-sections-service-vps-crud-static.test.mjs` falhou enquanto o servico ainda usava Supabase para `catalog_sections`.
- `node tmp-tests\catalog-sections-service-vps-crud-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 315`, `.rpc(...) = 28`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.

Resultado: o inventario operacional Supabase caiu mais seis chamadas `.from(...)` (`321 -> 315`), `catalog_sections` saiu da allowlist temporaria e o CRUD de secoes passou a depender da VPS.

## 2026-05-30 - Avaliacoes de produtos via VPS table-data

Mudanca: `services/reviews.ts` deixou de consultar e alterar `product_reviews` pelo Supabase. Listagem publica em lote, envio de avaliacao, moderacao, resposta admin e remocao agora usam `/table-data/product_reviews` via `vpsClient`; o enriquecimento do cliente passou a ler `customers` pela mesma camada VPS. A pagina `pages/admin/catalog/ReviewsPage.tsx` deixou de importar Supabase e usa `reviewService.deleteReview`.

Objetivo: mover avaliacoes do catalogo para a VPS/Synology preservando a moderacao admin, o fluxo publico de reviews e a recompensa por moedas ao aprovar uma avaliacao.

Validacao:

- RED: `node tmp-tests\reviews-service-vps-static.test.mjs` falhou enquanto `services/reviews.ts` ainda usava Supabase para `product_reviews`.
- `node tmp-tests\reviews-service-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 309`, `.rpc(...) = 28`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.

Resultado: o inventario operacional Supabase caiu mais seis chamadas `.from(...)` (`315 -> 309`) e `product_reviews` saiu da allowlist temporaria. O RPC de moedas acionado apos aprovacao ainda permanece no backlog de cashback.

## 2026-05-30 - Aposentadoria do gerenciador legado de variantes

Mudanca: removidos `services/model-variants.ts`, `components/settings/VariantManager.tsx`, `components/settings/VariantImageGallery.tsx` e `types/model-architecture.ts`. Esse conjunto nao era montado por nenhuma pagina ou modal ativo e ainda mantinha CRUD direto em `model_variants`, `model_variant_images` e upload/remocao em Supabase Storage.

Objetivo: cortar codigo morto da arquitetura antiga de variantes em vez de migrar uma ferramenta sem consumidor, reduzindo dependencia Supabase e simplificando o backlog real de catalogo.

Validacao:

- RED: `node tmp-tests\retired-model-variants-manager-static.test.mjs` falhou enquanto `services/model-variants.ts` ainda existia.
- `node tmp-tests\retired-model-variants-manager-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 295`, `.rpc(...) = 28`, `supabase.storage = 10`, `unclassifiedOperationalMatches = 0`.

Resultado: o inventario operacional Supabase caiu quatorze chamadas `.from(...)` (`309 -> 295`) e o uso de Storage caiu tres ocorrencias (`13 -> 10`). `model_variants` e `model_variant_images` sairam da allowlist temporaria.

## 2026-05-30 - Cores via VPS table-data

Mudanca: `services/colors.ts` deixou de usar `supabase.from('colors')` para listar, buscar, criar, atualizar, apagar e listar cores ativas. O CRUD agora usa `/table-data/colors` via `vpsClient`, com paginacao, ordenacao local por nome, normalizacao defensiva e cache preservado. Os enriquecimentos de imagens em `services/catalogService.ts`, `services/catalogSectionsService.ts` e `services/modelImageCache.ts` passaram a resolver nome de cor pelo `colorService`, mantendo `model_color_images` como pendencia separada.

Objetivo: mover a taxonomia de cores para a VPS/Synology e remover o bloco temporario `catalog-taxonomy` da allowlist do auditor.

Validacao:

- RED: `node tmp-tests\colors-service-vps-static.test.mjs` falhou enquanto `services/colors.ts` ainda usava Supabase.
- `node tmp-tests\colors-service-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 286`, `.rpc(...) = 28`, `supabase.storage = 10`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK, somente avisos Vite ja existentes sobre imports dinamicos/estaticos e tamanho de chunk.

Resultado: o inventario operacional Supabase caiu nove chamadas `.from(...)` (`295 -> 286`) e `colors`/`battery_healths` sairam da allowlist temporaria.

## 2026-05-30 - Configuracao visual de categorias via VPS table-data

Mudanca: `services/catalogConfigService.ts` deixou de usar `supabase.from('category_display_config')` para buscar, listar e salvar configuracoes visuais de categorias. A leitura agora pagina `/table-data/category_display_config` via `vpsClient`, ordena localmente por `display_order` e o salvamento faz `PATCH` quando encontra configuracao existente por `category_id` ou `POST` quando ainda nao existe.

Objetivo: remover a ultima tabela de configuracao visual de categorias do caminho Supabase e manter `catalog_settings` e `category_display_config` sob a camada VPS.

Validacao:

- RED: `node tmp-tests\catalog-category-config-vps-static.test.mjs` falhou enquanto `catalogConfigService` ainda usava Supabase para `category_display_config`.
- `node tmp-tests\catalog-category-config-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 283`, `.rpc(...) = 28`, `supabase.storage = 10`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK, somente avisos Vite ja existentes sobre imports dinamicos/estaticos e tamanho de chunk.

Resultado: o inventario operacional Supabase caiu mais tres chamadas `.from(...)` (`286 -> 283`) e `category_display_config` saiu da allowlist temporaria. O bloco restante `product-variant-taxonomy-temporary` ficou apenas com `rams` e `storages`.

## 2026-05-30 - Limpeza da allowlist de RAM e armazenamento

Mudanca: removido o bloco temporario `product-variant-taxonomy-temporary` do auditor Supabase. `services/rams.ts` e `services/storages.ts` ja estavam usando exclusivamente `vpsClient` nas rotas `/rams`, `/rams/all`, `/storages` e `/storages/all`; nao havia mais chamadas `.from('rams')` ou `.from('storages')` no runtime.

Objetivo: manter a allowlist apenas com dependencias Supabase ainda ativas, sem permissoes antigas para caminhos que ja estao na VPS.

Validacao:

- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tmp-tests\retired-supabase-taxonomy-services-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 283`, `.rpc(...) = 28`, `supabase.storage = 10`, `unclassifiedOperationalMatches = 0`.

Resultado: sem mudanca de baseline, mas a auditoria deixou de permitir `rams` e `storages` como dependencias Supabase temporarias.

## 2026-05-30 - Check-in diario via VPS table-data

Mudanca: `services/checkinService.ts` deixou de usar `supabase.from('checkin_logs')` para calcular streak, verificar check-in do dia, gravar check-in, listar historico e montar status atual. Essas operacoes agora usam `/table-data/checkin_logs` via `vpsClient`, com paginacao, filtros locais por cliente/data e ordenacao local por `checkin_date`. O credito de moedas continua usando `supabase.rpc('add_coins')`, marcado como etapa separada do backlog de cashback.

Objetivo: mover o registro operacional do check-in para a VPS/Synology sem misturar ainda a migracao dos RPCs de moedas.

Validacao:

- RED: `node tmp-tests\checkin-service-vps-static.test.mjs` falhou enquanto `checkinService` ainda usava Supabase para `checkin_logs`.
- `node tmp-tests\checkin-service-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 278`, `.rpc(...) = 28`, `supabase.storage = 10`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: primeiro acusou bytes nulos no fim de `services/checkinService.ts`; arquivo limpo e build repetido com OK, mantendo apenas avisos Vite ja existentes.

Resultado: o inventario operacional Supabase caiu mais cinco chamadas `.from(...)` (`283 -> 278`) e `checkin_logs` saiu da allowlist temporaria.

## 2026-05-30 - Transacoes de moedas via VPS table-data

Mudanca: `services/cashbackService.ts` deixou de usar `supabase.from('coin_transactions')` para listar historico do cliente, montar a listagem admin e buscar moedas ganhas por venda nos recibos. Essas leituras agora usam `/table-data/coin_transactions` via `vpsClient`, com paginacao e ordenacao local. Os recibos em `SaleDetailsModal`, `CustomerDetailsPage` e `PurchaseHistoryTab`, alem do dashboard de cashback, passaram a usar o servico centralizado.

Objetivo: mover o historico operacional de moedas para a VPS/Synology sem alterar ainda `coin_balances`, `cashback_settings` e os RPCs de credito/resgate, que seguem como etapa separada do backlog de cashback.

Validacao:

- RED: `node tmp-tests\coin-transactions-vps-static.test.mjs` falhou enquanto `cashbackService` ainda usava Supabase para `coin_transactions`.
- `node tmp-tests\coin-transactions-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 272`, `.rpc(...) = 28`, `supabase.storage = 10`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK, somente avisos Vite ja existentes sobre imports dinamicos/estaticos e tamanho de chunk.

Resultado: o inventario operacional Supabase caiu mais seis chamadas `.from(...)` (`278 -> 272`) e `coin_transactions` saiu da allowlist temporaria.

## 2026-05-30 - Saldos de moedas via VPS table-data

Mudanca: `services/cashbackService.ts` deixou de usar `supabase.from('coin_balances')` para buscar/criar saldo de cliente e passou a usar `/table-data/coin_balances` via `vpsClient`, com paginacao para leituras e `POST` para criacao inicial. O dashboard de cashback em `pages/admin/CashbackPage.tsx` passou a calcular o total em circulacao pela nova funcao centralizada `listCoinBalances`.

Objetivo: mover as leituras operacionais de saldo de moedas para a VPS/Synology mantendo os RPCs de credito, resgate, estorno e pendencias no backlog separado de cashback.

Validacao:

- RED: `node tmp-tests\coin-balances-vps-static.test.mjs` falhou enquanto `cashbackService` e o dashboard ainda usavam Supabase para `coin_balances`.
- `node tmp-tests\coin-balances-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 269`, `.rpc(...) = 28`, `supabase.storage = 10`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK, somente avisos Vite ja existentes sobre imports dinamicos/estaticos e tamanho de chunk.

Resultado: o inventario operacional Supabase caiu mais tres chamadas `.from(...)` (`272 -> 269`) e `coin_balances` saiu da allowlist temporaria.

## 2026-05-30 - Configuracao de cashback via VPS table-data

Mudanca: `services/cashbackService.ts` deixou de usar `supabase.from('cashback_settings')` para buscar e salvar a configuracao de moedas. A leitura agora pagina `/table-data/cashback_settings` via `vpsClient`, e o salvamento usa `PATCH /table-data/cashback_settings/:id` preservando o contrato de `getCashbackSettings` e `updateCashbackSettings`.

Objetivo: mover a configuracao administrativa do cashback para a VPS/Synology sem misturar ainda a migracao dos RPCs de credito/resgate.

Validacao:

- RED: `node tmp-tests\cashback-settings-vps-static.test.mjs` falhou enquanto `cashbackService` ainda usava Supabase para `cashback_settings`.
- `node tmp-tests\cashback-settings-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 267`, `.rpc(...) = 28`, `supabase.storage = 10`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK, somente avisos Vite ja existentes sobre imports dinamicos/estaticos e tamanho de chunk.

Resultado: o inventario operacional Supabase caiu mais duas chamadas `.from(...)` (`269 -> 267`) e `cashback_settings` saiu da allowlist temporaria.

## 2026-05-30 - Beneficios de cliente via VPS table-data

Mudanca: `services/benefitService.ts` deixou de usar `supabase.from('customer_benefits')` para conceder beneficio de pelicula e listar beneficios do cliente. A criacao agora usa `POST /table-data/customer_benefits`, e a listagem pagina `/table-data/customer_benefits` via `vpsClient`, filtrando por cliente/tipo e ordenando localmente por `granted_at`. `benefit_redemptions` permanece no Supabase nesta etapa por ainda concentrar o fluxo de resgate mensal e o join com cliente.

Objetivo: encerrar o bloco temporario `customer-benefits-temporary` e deixar apenas a parte de resgate de beneficio para o backlog posterior de cashback/RPC.

Validacao:

- RED: `node tmp-tests\customer-benefits-vps-static.test.mjs` falhou enquanto `benefitService` ainda usava Supabase para `customer_benefits`.
- `node tmp-tests\customer-benefits-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 265`, `.rpc(...) = 28`, `supabase.storage = 10`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK, somente avisos Vite ja existentes sobre imports dinamicos/estaticos e tamanho de chunk.

Resultado: o inventario operacional Supabase caiu mais duas chamadas `.from(...)` (`267 -> 265`) e o bloco `customer-benefits-temporary` foi removido da allowlist.

## 2026-05-30 - Templates de garantia via VPS table-data

Mudanca: `services/warrantyTemplates.ts` deixou de usar Supabase para listar, buscar, criar, atualizar e remover `warranty_templates`. O CRUD agora usa `/table-data/warranty_templates` via `vpsClient`, com filtro local por `company_id` e ordenacao por nome. Os pontos que buscavam `duration_days` diretamente (`SaleDetailsModal`, `ProductDetailsModal`, `CartPage`, `PDVPage` e `CustomerDetailsPage`) passaram a usar `warrantyTemplateService.getById`.

Objetivo: mover os templates reutilizaveis de garantia para a VPS/Synology e deixar no bloco de garantia apenas `warranty_documents`, que sera migrado separadamente.

Validacao:

- RED: `node tmp-tests\warranty-templates-vps-static.test.mjs` falhou enquanto o servico e os fallbacks ainda consultavam `warranty_templates` pelo Supabase.
- `node tmp-tests\warranty-templates-vps-static.test.mjs`: OK.
- `node tmp-tests\product-details-modal-vps-warranty-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 255`, `.rpc(...) = 28`, `supabase.storage = 10`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK, somente avisos Vite ja existentes sobre imports dinamicos/estaticos e tamanho de chunk.

Resultado: o inventario operacional Supabase caiu mais dez chamadas `.from(...)` (`265 -> 255`) e `warranty_templates` saiu da allowlist temporaria.

## 2026-05-30 - Documentos de garantia via VPS table-data

Mudanca: `services/warrantyDocumentService.ts` deixou de usar `supabase.from('warranty_documents')` para criar, listar, buscar, atualizar e excluir termos de garantia. O CRUD agora usa `/table-data/warranty_documents` via `vpsClient`, com leitura paginada, filtro local por `company_id` e ordenacao local por `created_at` para preservar os fluxos de PDV, pedido online e historico do cliente.

Objetivo: encerrar o bloco temporario de garantia no auditor Supabase, deixando templates e documentos de garantia fora do Supabase operacional.

Validacao:

- RED: `node tmp-tests\warranty-documents-vps-static.test.mjs` falhou enquanto `warrantyDocumentService` ainda importava Supabase e consultava `warranty_documents`.
- `node tmp-tests\warranty-documents-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 247`, `.rpc(...) = 28`, `supabase.storage = 10`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK, somente avisos Vite ja existentes sobre imports dinamicos/estaticos e tamanho de chunk.

Resultado: o inventario operacional Supabase caiu mais oito chamadas `.from(...)` (`255 -> 247`) e o bloco `warranty-temporary` foi removido da allowlist.

## 2026-05-30 - Creditos de entrega via VPS table-data

Mudanca: criado `services/deliveryCreditService.ts` para centralizar `delivery_credits` na VPS. A criacao de credito no fechamento de venda e o cancelamento em cancelamento/estorno agora usam esse servico. A aba `TeamDeliveryHistoryTab` tambem deixou de usar o join Supabase com `sales/customers`; ela lista creditos pela VPS, enriquece nomes de cliente via `sales`/`customers` em table-data e marca pagamentos com `PATCH /table-data/delivery_credits/:id`.

Objetivo: remover `delivery_credits` do bloco temporario de frete, mantendo apenas configuracoes de zonas/faixas para etapa separada.

Validacao:

- RED: `node tmp-tests\delivery-credits-vps-static.test.mjs` falhou enquanto o servico VPS ainda nao existia e os consumidores consultavam `delivery_credits` no Supabase.
- `node tmp-tests\delivery-credits-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 242`, `.rpc(...) = 28`, `supabase.storage = 10`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK, somente avisos Vite ja existentes sobre imports dinamicos/estaticos e tamanho de chunk.

Resultado: o inventario operacional Supabase caiu mais cinco chamadas `.from(...)` (`247 -> 242`) e `delivery_credits` saiu da allowlist temporaria.

## 2026-05-30 - Metadados de documentos da empresa via VPS table-data

Mudanca: `services/documentService.ts` deixou de usar `supabase.from('company_documents')` para contar, criar, listar, buscar e excluir metadados de documentos. As operacoes de tabela agora usam `/table-data/company_documents` via `vpsClient`, com filtro local por `user_id` e ordenacao por `uploaded_at`. O Storage Supabase permanece explicito nesta etapa para upload, remocao e URL assinada dos PDFs, ficando para a frente separada de Storage/Synology.

Objetivo: reduzir o bloco `admin-team-temporary` sem misturar metadados de tabela com a migracao de arquivos.

Validacao:

- RED: `node tmp-tests\company-documents-vps-static.test.mjs` falhou enquanto `documentService` ainda consultava `company_documents` pelo Supabase.
- `node tmp-tests\company-documents-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 237`, `.rpc(...) = 28`, `supabase.storage = 10`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK, somente avisos Vite ja existentes sobre imports dinamicos/estaticos e tamanho de chunk.

Resultado: o inventario operacional Supabase caiu mais cinco chamadas `.from(...)` (`242 -> 237`) e `company_documents` saiu da allowlist temporaria. O bloco `admin-team-temporary` agora fica restrito a `team_members`.

## 2026-05-30 - Time administrativo via VPS table-data

Mudanca: `services/team.ts` deixou de importar Supabase e passou a carregar `team_members` por `/table-data/team_members` via `vpsClient`, com cache preservado e filtros locais para busca, cargo, tipo de contrato, status e periodo de criacao. Criacao, atualizacao, exclusao logica e exclusao definitiva tambem foram movidas para a VPS; o caminho especial `createDeliveryFromPdv` continuou usando `/team/delivery`.

Objetivo: encerrar o bloco temporario `admin-team-temporary`, deixando o cadastro operacional de equipe fora do Supabase.

Validacao:

- RED: `node tmp-tests\team-members-vps-static.test.mjs` falhou enquanto `teamService` ainda usava `supabase.from('team_members')`.
- `node tmp-tests\team-members-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 230`, `.rpc(...) = 28`, `supabase.storage = 10`, `unclassifiedOperationalMatches = 0`.
- `npx.cmd tsc --noEmit --pretty false`: falhou em erros antigos de tipagem espalhados no projeto, sem apontar erro novo em `services/team.ts`.
- `npm.cmd run build`: OK, somente avisos Vite ja existentes sobre imports dinamicos/estaticos e tamanho de chunk.

Resultado: o inventario operacional Supabase caiu mais sete chamadas `.from(...)` (`237 -> 230`) e `admin-team-temporary` foi removido da allowlist.

## 2026-05-30 - Historico de precos via VPS table-data

Mudanca: `services/priceHistoryService.ts` deixou de usar `supabase.from('product_price_history')` para registrar e consultar snapshots de preco. `logPriceChange`, `getPriceHistory` e a gravacao em lote de `applyPricesToVariation` agora usam `/table-data/product_price_history` via `vpsClient`, preservando a normalizacao que impede `price_cost` nulo. A atualizacao de `products` dentro de `applyPricesToVariation` permanece no trilho de migracao de produtos.

Objetivo: remover o historico de precos do bloco temporario de catalogo sem misturar com o corte maior de `products`.

Validacao:

- RED: `node tmp-tests\price-history-vps-static.test.mjs` falhou enquanto `priceHistoryService` ainda usava `supabase.from('product_price_history')`.
- `node tmp-tests\price-history-vps-static.test.mjs`: OK.
- `node tmp-tests\price-history-null-regression.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 227`, `.rpc(...) = 28`, `supabase.storage = 10`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK, somente avisos Vite ja existentes sobre imports dinamicos/estaticos e tamanho de chunk.

Resultado: o inventario operacional Supabase caiu mais tres chamadas `.from(...)` (`230 -> 227`) e `product_price_history` saiu da allowlist temporaria.

## 2026-05-30 - Promocoes via VPS table-data

Mudanca: `services/promotionService.ts` deixou de usar `supabase.from('promotions')`. Listagem, consulta de status e atualizacao agora passam por `/table-data/promotions` via `vpsClient`, preservando a avaliacao local de promocoes ativas, inativas e agendadas.

Objetivo: remover `promotions` do bloco temporario de cashback/promocoes sem mexer ainda no ledger de moedas e nos RPCs de cashback.

Validacao:

- RED: `node tmp-tests\promotions-vps-static.test.mjs` falhou enquanto `promotionService` ainda importava Supabase e consultava `promotions` diretamente.
- `node tmp-tests\promotions-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 224`, `.rpc(...) = 28`, `supabase.storage = 10`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK, somente avisos Vite ja existentes sobre imports dinamicos/estaticos e tamanho de chunk.

Resultado: o inventario operacional Supabase caiu mais tres chamadas `.from(...)` (`227 -> 224`) e `promotions` saiu da allowlist temporaria.

## 2026-05-30 - Analytics de visualizacao de produto via VPS

Mudanca: `catalogService.recordProductView` deixou de inserir em `product_views` e chamar o RPC `increment_product_views` no Supabase. O front agora envia a visualizacao para `POST /products/:id/view` na VPS; a API VPS cria a tabela `product_views` quando necessario, grava `product_id`, `customer_id` e `session_id`, e incrementa `products.view_count` diretamente no MySQL.

Objetivo: remover a dependencia de analytics publico do catalogo no Supabase, incluindo a tabela `product_views` e o RPC `increment_product_views`.

Validacao:

- RED: `node tmp-tests\catalog-product-views-vps-static.test.mjs` falhou enquanto `recordProductView` ainda usava `supabase.from('product_views')` e `supabase.rpc('increment_product_views')`.
- `node tmp-tests\catalog-product-views-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node --check vps_server.js`: OK.
- `node --check vps_server.cjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 223`, `.rpc(...) = 27`, `supabase.storage = 10`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK, somente avisos Vite ja existentes sobre imports dinamicos/estaticos e tamanho de chunk.

Resultado: o inventario operacional Supabase caiu uma chamada `.from(...)` e uma chamada `.rpc(...)` (`224 -> 223`, `28 -> 27`). As allowlists `catalog-analytics-rpc-temporary` e `catalog-analytics-tables-temporary` foram removidas.

## 2026-05-30 - Divergencias de estoque via VPS

Mudanca: `stockLocationService.getStockDivergences` deixou de consultar a view Supabase `stock_location_divergences`. A leitura agora usa `GET /stock-locations/divergences` na VPS; a rota calcula em MySQL a diferenca entre `products.stock_quantity` e a soma de `product_stock_locations.quantity`, retorna apenas divergencias diferentes de zero e ordena por nome do produto.

Objetivo: remover a ultima dependencia da view Supabase de auditoria de estoque, sem misturar com o bloco maior de deposito/local/movimentacoes e RPCs de estoque.

Validacao:

- RED: `node tmp-tests\stock-location-divergences-vps-static.test.mjs` falhou enquanto `getStockDivergences` ainda consultava `supabase.from('stock_location_divergences')`.
- `node tmp-tests\stock-location-divergences-vps-static.test.mjs`: OK.
- `node tmp-tests\stock-location-divergence-validation-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node --check vps_server.js`: OK.
- `node --check vps_server.cjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 222`, `.rpc(...) = 27`, `supabase.storage = 10`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK, somente avisos Vite ja existentes sobre imports dinamicos/estaticos e tamanho de chunk.

Resultado: o inventario operacional Supabase caiu mais uma chamada `.from(...)` (`223 -> 222`) e `inventory-audit-temporary` saiu da allowlist.

Interrupcao no deploy:

- `node deploy-vps-server-only.cjs`: OK, API `mdv-api` reiniciada na VPS.
- `curl https://api.xiaomipetrolina.com.br/health`: `200`.
- `curl https://api.xiaomipetrolina.com.br/stock-locations/divergences` com `x-sync-key`: `500`.
- Corpo retornado: `ER_NO_SUCH_TABLE`, tabela `mercadodovale.product_stock_locations` nao existe na VPS.

Resultado do deploy: site nao publicado nesta etapa. A rota de divergencias precisa aguardar a migracao/criacao da tabela `product_stock_locations` na VPS, ou voltar temporariamente para uma estrategia que nao dependa dessa tabela.

## 2026-05-30 - Transporte direto para visualizacao de produto na VPS

Mudanca: `services/vpsTransport.js` passou a tratar `POST /products/:id/view` como escrita direta permitida para a API VPS em build de producao. Antes, esse write montava `/api/vps-proxy?path=...`, mantendo dependencia do proxy da Vercel para a captura de visualizacoes do catalogo.

Objetivo: permitir que o site estatico servido pela VPS registre visualizacoes diretamente em `https://api.xiaomipetrolina.com.br/products/:id/view`.

Validacao:

- RED: `node tmp-tests\vps-product-view-direct-transport.test.mjs` falhou retornando `/api/vps-proxy?path=%2Fproducts%2Fprod-123%2Fview`.
- `node tmp-tests\vps-product-view-direct-transport.test.mjs`: OK.
- `node tmp-tests\catalog-product-views-vps-static.test.mjs`: OK.
- `npm.cmd run build`: OK, somente avisos Vite ja existentes sobre imports dinamicos/estaticos e tamanho de chunk.

Resultado: a correcao local esta pronta, mas o site ainda nao foi publicado por causa do erro `ER_NO_SUCH_TABLE` na rota de divergencias de estoque descrito acima.

## 2026-05-30 - Limpeza da allowlist de frete ja migrado

Mudanca: removida a allowlist temporaria `shipping-config-temporary` do auditor Supabase. `shippingService` ja estava usando os endpoints VPS (`/shipping/settings`, `/shipping/zones`, `/shipping/price-ranges`), entao a permissao para `shipping_zones` e `shipping_price_ranges` estava sem ocorrencias reais e podia mascarar regressao futura.

Objetivo: manter o auditor alinhado com o estado real da migracao de frete.

Validacao:

- RED: `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs` falhou enquanto `shipping-config-temporary` ainda existia.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tmp-tests\shipping-service-vps-only-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 222`, `.rpc(...) = 27`, `supabase.storage = 10`, `unclassifiedOperationalMatches = 0`.

Resultado: nenhuma queda de baseline era esperada porque nao havia ocorrencia operacional ativa de frete no Supabase; a protecao agora fica explicita no guard.

## 2026-05-30 - Labels de versoes do catalogo via VPS

Mudanca: `CompareModal` e `ProductDetailsModal` deixaram de consultar `supabase.from('versions')` para montar os nomes de versao exibidos em especificacoes. Ambos agora usam `versionService.list()` da VPS. Tambem foram removidas allowlists temporarias vazias de integracoes, observabilidade e versionamento (`integration-settings-temporary`, `operations-observability-temporary`, `app-versioning-temporary`).

Objetivo: eliminar as ultimas leituras ativas de `versions` pelo Supabase e manter o auditor sem permissoes temporarias mortas.

Validacao:

- RED: `node tmp-tests\catalog-version-labels-vps-static.test.mjs` falhou enquanto os modais ainda usavam `supabase.from('versions')`.
- RED: `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs` falhou enquanto o baseline antigo e as allowlists vazias ainda existiam.
- `node tmp-tests\catalog-version-labels-vps-static.test.mjs`: OK.
- `node tmp-tests\version-service-vps-imports-static.test.mjs`: OK.
- `node tmp-tests\version-service-retired-local-alias-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 220`, `.rpc(...) = 27`, `supabase.storage = 10`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK, somente avisos Vite ja existentes sobre imports dinamicos/estaticos e tamanho de chunk.

Resultado: o inventario operacional Supabase caiu mais duas chamadas `.from(...)` (`222 -> 220`) e as allowlists temporarias vazias foram removidas.

## 2026-05-30 - Resgates de beneficios via VPS table-data

Mudanca: `benefitService` deixou de consultar e inserir `benefit_redemptions` pelo Supabase. A listagem agora usa `/table-data/benefit_redemptions` com paginacao, enriquece `redeemed_by_user` consultando `customers` via VPS e o resgate mensal passa a criar o registro por `/table-data/benefit_redemptions`.

Objetivo: remover `benefit_redemptions` do bloco temporario de cashback/beneficios, mantendo apenas os RPCs de moedas para uma etapa separada.

Validacao:

- RED: `node tmp-tests\customer-benefits-vps-static.test.mjs` falhou enquanto `benefitService` ainda usava `supabase.from('benefit_redemptions')`.
- `node tmp-tests\customer-benefits-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 218`, `.rpc(...) = 27`, `supabase.storage = 10`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK, somente avisos Vite ja existentes sobre imports dinamicos/estaticos e tamanho de chunk.

Resultado: o inventario operacional Supabase caiu mais duas chamadas `.from(...)` (`220 -> 218`) e `benefit_redemptions` saiu da allowlist temporaria.

## 2026-05-30 - Remocao de scripts Supabase e Shopee auto-print via VPS

Mudanca: removidos artefatos de teste e scripts manuais que ainda dependiam diretamente do Supabase (`public/catalog-test.html`, criadores de produtos de teste, migradores avulsos e diagnosticos/sincronizadores manuais). O `scripts/shopee-auto-print.cjs` deixou de criar cliente Supabase local e agora le tokens Shopee e impressoras pelo endpoint protegido `/company-settings` da VPS com `x-sync-key`.

Objetivo: cortar dependencias operacionais locais de Supabase sem perder a rotina de impressao local da Shopee, mantendo a VPS como fonte unica para credenciais e configuracoes.

Validacao:

- RED: `node tmp-tests\retired-supabase-test-product-artifacts-static.test.mjs` falhou enquanto `public/catalog-test.html` e scripts de produto de teste ainda existiam.
- RED: `node tmp-tests\retired-supabase-manual-scripts-static.test.mjs` falhou enquanto scripts manuais Supabase ainda existiam.
- RED: `node tmp-tests\shopee-auto-print-vps-settings-static.test.mjs` falhou enquanto `scripts/shopee-auto-print.cjs` importava `@supabase/supabase-js`.
- `node tmp-tests\retired-supabase-test-product-artifacts-static.test.mjs`: OK.
- `node tmp-tests\retired-supabase-manual-scripts-static.test.mjs`: OK.
- `node tmp-tests\shopee-auto-print-vps-settings-static.test.mjs`: OK.
- `node --check scripts\shopee-auto-print.cjs`: OK.

Resultado: scripts locais obsoletos sairam do repositorio e a impressao Shopee passou a depender da VPS protegida por chave de sincronizacao, nao de cliente Supabase embarcado.

## 2026-05-30 - Backfills administrativos via VPS table-data

Mudanca: os backfills `tools/backfill-brand-tags.cjs`, `tools/backfill-product-descriptions.cjs` e `tools/backfill-smartphone-model-virtual-ram.cjs` deixaram de carregar `@supabase/supabase-js` e passaram a ler/escrever tabelas auxiliares por `/table-data/*` na VPS, sempre com `x-sync-key`. Os PATCHes de produtos continuam indo para endpoints VPS existentes.

Objetivo: manter ferramentas administrativas de correcao de dados sem exigir credenciais Supabase no ambiente local.

Validacao:

- RED: `node tmp-tests\smartphone-model-virtual-ram-backfill-static.test.mjs` falhou enquanto o backfill de RAM virtual usava `supabase.from`.
- RED: `node tmp-tests\vps-backfill-tools-static.test.mjs` falhou enquanto os backfills de marca/descricao ainda usavam `@supabase/supabase-js`.
- `node tmp-tests\smartphone-model-virtual-ram-backfill-static.test.mjs`: OK.
- `node tmp-tests\vps-backfill-tools-static.test.mjs`: OK.
- `node --check tools\backfill-brand-tags.cjs`: OK.
- `node --check tools\backfill-product-descriptions.cjs`: OK.
- `node --check tools\backfill-smartphone-model-virtual-ram.cjs`: OK.

Resultado: os backfills administrativos agora dependem da VPS/MySQL e nao precisam mais de URL/chave Supabase.

## 2026-05-30 - Auditoria de midia lendo VPS

Mudanca: `tools/audit-media-origins.mjs` deixou de criar cliente Supabase para ler `model_color_images`, `company_settings` e `catalog_banners`. A auditoria agora usa `/products`, `/company-settings` e `/table-data/*` na VPS com `x-sync-key`, e o relatorio Markdown passou a rotular essas fontes como VPS.

Objetivo: manter a auditoria de origem de imagens/videos alinhada ao corte VPS/Synology, sem exigir credenciais Supabase para verificar midias.

Validacao:

- RED: `node tmp-tests\media-origin-audit-vps-only-static.test.mjs` falhou enquanto a auditoria importava `@supabase/supabase-js`.
- `node tmp-tests\media-origin-audit-vps-only-static.test.mjs`: OK.
- `node --check tools\audit-media-origins.mjs`: OK.

Resultado: a auditoria de midia agora compara produtos, banners, configuracoes e imagens por dados vindos da VPS.

## 2026-05-30 - Table data service via VPS

Mudanca: `services/table-data.ts` deixou de usar `supabase.from(...)` para carregar opcoes de campos relacionais e agora pagina `/table-data/:name` via `vpsClient`, ordenando no cliente quando necessario.

Objetivo: remover mais um ponto generico de leitura Supabase do frontend/admin e reaproveitar o endpoint protegido da VPS.

Validacao:

- RED: `node tmp-tests\table-data-service-vps-static.test.mjs` falhou enquanto `services/table-data.ts` importava `./supabase`.
- `node tmp-tests\table-data-service-vps-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 393`, `.rpc(...) = 29`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.

Observacao: `npx tsc --noEmit --pretty false` ainda falha por `test-synology-auth.cjs`/`.js` terem `#!` no meio do arquivo, problema legado fora desta troca.

Resultado: campos relacionais carregados por `tableDataService` passam pela VPS.

## 2026-05-30 - Verificacao TypeScript e WhatsApp sem import Supabase morto

Mudanca: `tsconfig.json` passou a excluir os scripts manuais `test-synology-auth.cjs` e `test-synology-auth.js`, que estavam sendo analisados por causa de `allowJs` e possuem um segundo shebang no meio do arquivo. Tambem removido de `pages/admin/settings/WhatsAppPage.tsx` o import morto `../../../lib/supabase`, mantendo a tela apoiada apenas em `whatsappSettingsService`.

Objetivo: destravar a verificacao de parse inicial do TypeScript e remover mais um import direto/legado de Supabase do runtime admin.

Validacao:

- RED: `npx.cmd tsc --noEmit --pretty false` falhou primeiro nos shebangs duplicados dos scripts Synology.
- RED: `node tmp-tests\whatsapp-page-no-lib-supabase-static.test.mjs` falhou enquanto `WhatsAppPage` importava `../../../lib/supabase`.
- `node tmp-tests\whatsapp-page-no-lib-supabase-static.test.mjs`: OK.
- `node tmp-tests\table-data-service-vps-static.test.mjs`: OK.

Observacao: apos excluir os scripts Synology, `tsc --noEmit` avancou e revelou erros legados amplos de tipos em componentes/servicos que nao foram criados nesta etapa. O build Vite segue como validacao principal da migracao incremental.

Resultado: a tela de WhatsApp nao depende mais de import Supabase quebrado, e a falha inicial de parse dos scripts Synology deixou de bloquear a auditoria TypeScript.

## 2026-05-30 - Limpeza de paginas e diagnosticos legados Supabase/Vercel

Mudanca: removida a pagina experimental `pages/test/catalog-test.tsx`, que ainda lia `catalog_banners` no Supabase, e retirados os diagnosticos avulsos `check-product-supabase.cjs`, `check_supabase.cjs`, `check_supabase_cols.mts`, `diagnose_supabase.js`, `test_supa_prods.mjs`, `test_cat_supa.mjs` e `check-stock-sync.mjs`. A tela de importacao de modelos deixou de prometer Supabase Storage e passou a apontar template futuro para Synology via VPS. O gerador `backup-synology.cjs` foi atualizado para documentar producao, rollback e dependencias em VPS/Synology, sem instrucoes de deploy Vercel ou Supabase.

Objetivo: reduzir codigo morto e orientacoes operacionais antigas, mantendo a documentacao gerada pelo backup alinhada ao corte VPS/Synology.

Validacao:

- RED: `node tmp-tests\model-import-page-vps-synology-static.test.mjs` falhou enquanto `ModelImportPage` ainda mencionava Supabase Storage.
- RED: `node tmp-tests\retired-catalog-test-page-static.test.mjs` falhou enquanto `pages/test/catalog-test.tsx` ainda existia.
- RED: `node tmp-tests\retired-root-supabase-diagnostics-static.test.mjs` falhou enquanto os diagnosticos Supabase avulsos ainda existiam.
- RED: `node tmp-tests\synology-backup-runbook-vps-static.test.mjs` falhou enquanto `backup-synology.cjs` ainda apontava URLs/deploy/rollback para Vercel e dependencias Supabase.
- RED: `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs` falhou ao baixar o baseline `.from` para `393` antes do auditor ser ajustado.
- `node tmp-tests\model-import-page-vps-synology-static.test.mjs`: OK.
- `node tmp-tests\retired-catalog-test-page-static.test.mjs`: OK.
- `node tmp-tests\vps-products-read-batch-static.test.mjs`: OK.
- `node tmp-tests\retired-root-supabase-diagnostics-static.test.mjs`: OK.
- `node tmp-tests\synology-backup-runbook-vps-static.test.mjs`: OK.
- `node --check backup-synology.cjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 393`, `.rpc(...) = 29`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.

Resultado: o inventario operacional Supabase caiu mais uma chamada `.from(...)` (`394 -> 393`), diagnosticos soltos antigos foram removidos e o runbook de backup Synology agora orienta VPS/Synology como caminho operacional.

## 2026-05-30 - Remocao de backups e monitoramento Supabase legado

Mudanca: removidos `services/versions.ts`, `services/models-new-backup.ts`, `services/monitoringService.ts` e `types/systemStatus.ts`. O modal de versoes agora importa `services/versions-vps.ts` diretamente. Tambem removidos os literais `vercel` restantes do runtime, mantendo apenas a deteccao generica de checkpoint/HTML anti-bot.

Objetivo: eliminar codigo morto que ainda entrava nos scans de runtime, reduzir o inventario Supabase e impedir retorno de referencias Vercel em `components/`, `pages/`, `services/`, `hooks/`, `contexts/`, `utils/`, `routes/` e `config/`.

Validacao:

- RED: `node tmp-tests\version-service-retired-local-alias-static.test.mjs` falhou enquanto `components/settings/VersionModal.tsx` ainda importava `services/versions.ts`.
- RED: `node tmp-tests\retired-supabase-model-backup-static.test.mjs` falhou enquanto `services/models-new-backup.ts` ainda existia.
- RED: `node tmp-tests\digest-monitoring-vps-products-static.test.mjs` falhou enquanto `services/monitoringService.ts` ainda existia.
- RED: `node tmp-tests\no-vercel-runtime-literals-static.test.mjs` falhou enquanto `pages/admin/settings/ShopeePage.tsx` e `services/vpsClient.ts` ainda continham literal `vercel`.
- RED: `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs` falhou ao baixar o baseline `.from` para `394` antes do auditor ser ajustado.
- `node tmp-tests\version-service-retired-local-alias-static.test.mjs`: OK.
- `node tmp-tests\retired-supabase-model-backup-static.test.mjs`: OK.
- `node tmp-tests\digest-monitoring-vps-products-static.test.mjs`: OK.
- `node tmp-tests\no-vercel-runtime-literals-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 394`, `.rpc(...) = 29`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.

Resultado: mais dezesseis chamadas `.from(...)` sairam do inventario operacional desde o baseline anterior (`410 -> 394`), o alias local de versoes saiu do runtime e nao ha mais literais Vercel em codigo runtime escaneado.

## 2026-05-30 - Remocao de aliases e servicos Supabase mortos

Mudanca: removidos os aliases/servicos legados `services/versions-supabase.ts`, `services/batteryHealths-supabase.ts`, `services/rams-supabase.ts` e `services/storages-supabase.ts`. Os consumidores de versoes agora importam `services/versions-vps.ts` diretamente, e os tres servicos de taxonomia sem chamadores deixaram de entrar no inventario operacional Supabase.

Objetivo: continuar a remocao gradual de Supabase do codigo versionado, sem criar recurso novo na Vercel ou no Supabase e mantendo a VPS como fonte operacional.

Validacao:

- RED: `node tmp-tests\version-service-vps-imports-static.test.mjs` falhou enquanto os imports ainda apontavam para `versions-supabase`.
- RED: `node tmp-tests\retired-supabase-taxonomy-services-static.test.mjs` falhou enquanto os servicos mortos ainda existiam.
- RED: `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs` falhou ao baixar o baseline `.from` para `410` antes do auditor ser ajustado.
- `node tmp-tests\version-service-vps-imports-static.test.mjs`: OK.
- `node tmp-tests\retired-supabase-taxonomy-services-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 410`, `.rpc(...) = 29`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.

Resultado: quinze chamadas `.from(...)` de servicos Supabase sem uso sairam do inventario operacional, e o guard agora impede regressao acima do baseline `.from=410`.

## 2026-05-28 - Historico de baixas no financeiro Bling

Mudanca: adicionada a acao de leitura `get-bordero` em `/api/bling?resource=finance`, usando o endpoint oficial do Bling `/borderos/{id}`. A tela financeira passa a buscar os `borderos` associados ao detalhe da conta antes de imprimir comprovantes.

Objetivo: preencher o Historico Detalhado do comprovante de Conta a Pagar/Receber com as baixas/pagamentos reais, em vez de mostrar apenas o `historico` curto da conta.

Escopo e seguranca:

- somente leitura, sem criacao, baixa, cancelamento ou atualizacao de contas;
- reutiliza a autenticacao existente do recurso financeiro;
- nao altera webhooks, `reconcile` ou `sync-prices-vps`;
- respostas de validacao continuam sanitizadas, sem imprimir nomes, documentos, valores brutos, tokens ou corpos completos.

Validacao:

- `node tmp-tests/finance-receipt-print-static.test.mjs`
- `node tmp-tests/vps-bling-finance-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-finance-live-read-check-static.test.mjs`
- `node tmp-tests/vps-bling-finance-live-read-check.cjs`: OK, incluindo `receber_bordero_get` e `pagar_bordero_get`.
- `npm.cmd run deploy:vps-site`: OK, release `/var/www/mdv-site/releases/20260528-064351`.

## Regra 1 - VPS Primeiro

Antes de escolher qualquer serviço externo, perguntar:

> Isso pode rodar de forma segura, estável e sustentável na VPS?

Se a resposta for sim, a preferência é VPS.

Exemplos que devem ir para VPS:

- site React/Vite servido por Nginx;
- rotas `/api/*` em Fastify/Node;
- webhooks Bling, Shopee, Mercado Pago e Telegram;
- cron jobs;
- geração de sitemap;
- HTML SEO de produto;
- proxy seguro para operações administrativas;
- uploads e arquivos públicos;
- logs da aplicação;
- deploy com PM2/Nginx.

## Regra 2 - Exceções Precisam de Alternativa

Se algo não for para a VPS, deve ser registrado com:

1. motivo técnico;
2. risco de manter fora;
3. alternativa principal;
4. alternativa de contingência;
5. plano futuro para reduzir dependência, se fizer sentido.

Modelo:

```text
Item:
Por que não vai para VPS agora:
Risco:
Alternativa escolhida:
Alternativa reserva:
Plano futuro:
```

Exemplo:

```text
Item: CDN global
Por que não vai para VPS agora: CDN exige presença em múltiplas regiões.
Risco: dependência externa para cache e proteção.
Alternativa escolhida: Cloudflare.
Alternativa reserva: Nginx direto sem CDN, com cache local.
Plano futuro: manter Cloudflare apenas como borda, sem lógica de aplicação.
```

## Regra 3 - Cloudflare é Borda, Não Aplicação

Cloudflare pode ser usado para:

- DNS;
- CDN;
- cache de assets estáticos;
- WAF/proteção;
- SSL/proxy;
- túnel para Synology quando necessário.

Cloudflare não deve virar substituto da aplicação.

Evitar colocar lógica de negócio em Workers ou regras complexas se a VPS puder resolver.

## Regra 4 - Vercel Deve Sair do Caminho Crítico

A migração só será considerada concluída quando:

- `mercadodovale.com.br` não depender da Vercel;
- `www.mercadodovale.com.br` não depender da Vercel;
- nenhum webhook externo apontar para Vercel;
- nenhum OAuth callback apontar para Vercel;
- nenhum cron depender de Vercel;
- deploy não usar `npx vercel`;
- logs e rollback existirem fora da Vercel.

Enquanto isso não acontecer, Vercel ainda é dependência ativa.

## Regra 5 - Migrar em Segundo Plano e Trocar no Final

A migração deve ser feita por partes pequenas, mas sem trocar o domínio principal antes da validação completa.

Fluxo recomendado:

1. criar staging na VPS;
2. subir frontend na VPS;
3. migrar APIs por bloco;
4. rodar testes de regressão;
5. validar webhooks e OAuth;
6. validar SEO e sitemap;
7. baixar TTL do DNS;
8. trocar domínio principal;
9. monitorar;
10. manter rollback temporário.

## Regra 6 - Regressão Antes de Trocar

Cada bloco migrado deve ter comparação entre produção atual e staging VPS.

Testar no mínimo:

- status HTTP;
- corpo principal da resposta;
- redirects;
- headers importantes;
- autenticação;
- permissão admin/customer;
- payloads de webhook;
- SEO;
- sitemap;
- comportamento no navegador.

Nenhuma troca definitiva deve acontecer sem checklist de regressão.

## Regra 7 - Manter Caminhos Públicos Sempre que Possível

Para reduzir risco com integrações externas, preservar os caminhos atuais:

- `/api/bling`;
- `/api/bling-webhook`;
- `/api/auth/callback/bling`;
- `/api/shopee`;
- `/api/shopee-catalog`;
- `/api/shopee-actions`;
- `/api/shopee-webhook`;
- `/api/mercadopago-webhook`;
- `/api/vps-proxy`;
- `/sitemap.xml`;
- `/produto/:slug`.

Se algum caminho precisar mudar, documentar:

- onde ele é usado;
- quem precisa ser atualizado;
- como validar;
- como reverter.

## Regra 8 - Nginx na Frente, Fastify Atrás

Arquitetura preferida:

- Nginx serve `dist/`;
- Nginx faz fallback SPA para `index.html`;
- Nginx proxya `/api/*` para Fastify;
- Fastify executa APIs, webhooks e jobs;
- PM2 mantém Fastify vivo;
- Certbot ou Cloudflare cuidam de SSL;
- Cloudflare fica na borda.

Evitar expor Node diretamente na internet sem proxy reverso.

## Regra 9 - PM2 Para Processos Node

Todo processo Node permanente na VPS deve rodar sob PM2 ou equivalente.

Requisitos:

- nome claro do processo;
- diretório documentado;
- `.env` documentado;
- logs acessíveis;
- comando de restart;
- comando de rollback;
- healthcheck.

## Regra 10 - Deploy Com Rollback

Deploy na VPS deve permitir voltar versão.

Preferência:

- releases com pasta versionada;
- symlink `current`;
- symlink/pasta `previous`;
- rollback sem rebuild;
- logs preservados.

Evitar sobrescrever produção sem caminho simples de volta.

## Regra 11 - Segredos Fora do Código

Nenhum segredo real deve ser colocado em arquivos versionados.

Usar:

- `.env` na VPS;
- secrets do GitHub Actions;
- `.env.example` ou `.env.vps.example` apenas com nomes e placeholders.

Segredos incluem:

- chaves Supabase;
- `SYNC_SECRET`;
- `VPS_SYNC_KEY`;
- credenciais Bling;
- credenciais Shopee;
- Mercado Pago;
- Telegram;
- Synology;
- Google Contacts;
- senhas SSH/MySQL.

## Regra 12 - Banco na VPS Sempre que Viável

Para dados operacionais novos, preferir MySQL na VPS.

Supabase pode permanecer quando:

- ainda for necessário para autenticação;
- a migração do módulo ainda não existir;
- houver risco alto em migrar junto com a saída da Vercel.

Mas cada permanência no Supabase deve ser marcada como dependência externa e entrar no plano futuro de redução.

## Regra 13 - Logs e Diagnóstico na VPS

Todo bloco migrado deve ter forma clara de diagnóstico:

- PM2 logs;
- Nginx access/error logs;
- logs de cron;
- logs de webhook;
- healthcheck;
- mensagens de erro copiáveis quando houver UI.

Se a Vercel deixar de existir, a VPS precisa mostrar o que está acontecendo.

## Regra 14 - Sem Big Bang Sem Staging

Não trocar DNS direto para uma implementação não testada.

Obrigatório antes do DNS:

- domínio ou subdomínio staging;
- frontend abrindo;
- APIs críticas funcionando;
- regressão mínima rodada;
- plano de rollback definido.

## Regra 15 - Ordem de Prioridade

Prioridade da migração:

1. frontend na VPS em staging;
2. Nginx/SSL/staging;
3. `/api/vps-proxy`;
4. SEO e sitemap;
5. Bling;
6. Shopee;
7. shipping;
8. Telegram;
9. cron;
10. DNS final;
11. monitoramento pós-troca;
12. limpeza de Vercel.

## Regra 16 - Documentar ao Fim de Cada Mudança

Ao finalizar qualquer mudança da migração, documentar o que foi feito antes de seguir para a próxima etapa.

A documentação deve registrar:

- data da mudança;
- objetivo;
- arquivos alterados;
- rotas/domínios afetados;
- variáveis de ambiente envolvidas;
- comandos executados;
- testes/regressões realizados;
- resultado da validação;
- pendências;
- riscos restantes;
- rollback disponível;
- decisão para o próximo passo.

Modelo mínimo:

```text
Data:
Mudança:
Objetivo:
Arquivos/infra alterados:
Rotas afetadas:
Validação:
Resultado:
Pendências:
Rollback:
Próximo passo:
```

Se a mudança for commitada, informar também o hash do commit.

Essa regra vale para alterações pequenas e grandes. Nenhuma etapa da migração deve ficar apenas "na memória".

## Regra 17 - Debug Copiável Rico em Detalhes

Todo processo crítico migrado deve oferecer debug copiável quando falhar.

O objetivo é conseguir identificar processos defeituosos sem depender apenas de mensagem genérica na tela ou de tentativa e erro.

Aplicar especialmente em:

- importação Bling;
- sincronização Shopee;
- webhooks;
- OAuth callbacks;
- cron jobs;
- `/api/vps-proxy`;
- uploads;
- geração de sitemap;
- SEO de produto;
- operações administrativas que gravam dados;
- comunicação VPS, Supabase, Synology ou APIs externas.

O debug copiável deve conter, quando aplicável:

- timestamp;
- ambiente;
- rota ou operação;
- método HTTP;
- status HTTP;
- mensagem bruta do erro;
- etapa onde falhou;
- IDs envolvidos;
- SKU/produto/pedido, quando houver;
- payload resumido;
- resposta resumida da API externa;
- configuração relevante sem segredo;
- origem/destino da chamada;
- usuário/admin/customer envolvido, se seguro;
- tentativa atual e total de tentativas;
- instrução curta do que copiar para análise.

Nunca incluir no debug:

- tokens;
- senhas;
- service role key;
- access token;
- refresh token;
- `SYNC_SECRET`;
- `VPS_SYNC_KEY`;
- dados sensíveis completos de cliente;
- cartões ou dados de pagamento.

Quando houver risco de segredo, mascarar:

```text
abcd1234...wxyz7890
```

Formato recomendado:

```json
{
  "timestamp": "2026-05-20T00:00:00.000Z",
  "environment": "production",
  "operation": "bling-import",
  "stage": "create-model",
  "rawMessage": "mensagem original do erro",
  "http": {
    "method": "POST",
    "route": "/api/bling",
    "status": 500
  },
  "context": {
    "productId": "id",
    "sku": "sku",
    "externalId": "id externo"
  },
  "safeConfig": {
    "usesVps": true,
    "hasSupabaseUrl": true,
    "hasSyncKey": true
  }
}
```

Sempre que uma falha nova for descoberta por debug copiável, avaliar se o debug precisa ser enriquecido para a próxima investigação.

## Regra 18 - Alimentar o Documento com Rotas

Este documento deve funcionar como inventário vivo das rotas durante a migração.

Ao criar, migrar, alterar, remover ou validar qualquer rota, atualizar a seção "Mapa de Rotas" deste documento.

Cada rota deve registrar:

- caminho público;
- origem atual;
- destino planejado;
- status da migração;
- tipo da rota;
- responsável técnico;
- autenticação exigida;
- dependências externas;
- variáveis de ambiente envolvidas;
- regra de Nginx, se houver;
- teste/regressão associado;
- data da última validação;
- observações e riscos.

Status permitidos:

- `vercel`;
- `vps-staging`;
- `vps-produção`;
- `migrada`;
- `pendente`;
- `bloqueada`;
- `desativada`.

Tipos sugeridos:

- `frontend`;
- `api`;
- `webhook`;
- `oauth`;
- `seo`;
- `sitemap`;
- `cron`;
- `proxy`;
- `arquivo`;
- `admin`;
- `publica`.

Modelo:

```text
Rota:
Origem atual:
Destino planejado:
Status:
Tipo:
Auth:
Dependências:
Env vars:
Nginx:
Teste:
Última validação:
Observações:
```

Nenhuma rota crítica deve ser migrada sem atualizar o mapa.

## Matriz de Decisão

| Item | Preferência | Alternativa Permitida |
| --- | --- | --- |
| Frontend | VPS + Nginx | Cloudflare cache |
| APIs | VPS + Fastify | Nenhuma sem justificativa |
| Webhooks | VPS + Fastify | Nenhuma sem justificativa |
| Cron | VPS crontab/systemd/PM2 | Serviço externo só com justificativa |
| SSL | Certbot ou Cloudflare Origin Cert | Cloudflare Flexible não recomendado |
| CDN | Cloudflare | Nginx direto temporariamente |
| Banco operacional | MySQL VPS | Supabase temporário por módulo |
| Auth | VPS futuro | Supabase temporário |
| Logs | PM2/Nginx/arquivos | Serviço externo complementar |
| Deploy | GitHub Actions para VPS | manual temporário |
| Rollback | symlink release | restaurar backup manual temporário |

## Decisão SSL/TLS - Cloudflare Origin Certificate

Para o site principal atrás da Cloudflare, a preferência é usar **Cloudflare Origin Certificate** no Nginx da VPS para proteger o trecho `Cloudflare -> VPS`.

Decisão:

- custo: `R$ 0`; o Cloudflare Origin Certificate está incluído no plano Free da Cloudflare;
- escopo recomendado: `mercadodovale.com.br` e `*.mercadodovale.com.br`;
- uso correto: somente em registros proxied pela Cloudflare, com nuvem laranja ativa;
- caminho protegido: navegador usa o certificado público da Cloudflare na borda, e a Cloudflare usa o Origin Certificate ao falar com a VPS;
- não usar como certificado público direto: se o domínio for desproxied ou se alguém acessar a VPS diretamente sem Cloudflare, o navegador pode exibir erro de certificado não confiável;
- SSL mode desejado na Cloudflare: `Full (strict)`, depois que o Origin Certificate dedicado estiver instalado;
- alternativa gratuita: Let's Encrypt/Certbot para `mercadodovale.com.br` e `www.mercadodovale.com.br`, especialmente se algum dia o site precisar funcionar sem proxy Cloudflare;
- estado temporário atual: Nginx de produção usa o certificado existente de `api.xiaomipetrolina.com.br` para atender HTTPS de origem aceito pela Cloudflare; isso funciona, mas deve ser substituído por Origin Certificate dedicado do Mercado do Vale.

Plano de instalação:

1. Gerar no painel Cloudflare um Origin Certificate para `mercadodovale.com.br` e `*.mercadodovale.com.br`.
2. Salvar certificado e chave privada na VPS, por exemplo:

```text
/etc/ssl/cloudflare/mercadodovale.com.br.pem
/etc/ssl/cloudflare/mercadodovale.com.br.key
```

3. Ajustar `infra/nginx/mdv-site-production.conf`:

```nginx
ssl_certificate /etc/ssl/cloudflare/mercadodovale.com.br.pem;
ssl_certificate_key /etc/ssl/cloudflare/mercadodovale.com.br.key;
```

4. Rodar `nginx -t`, recarregar Nginx e validar:

- `https://www.mercadodovale.com.br/`;
- `https://www.mercadodovale.com.br/sitemap.xml`;
- `https://www.mercadodovale.com.br/api/status`;
- `https://mercadodovale.com.br/sitemap.xml` redirecionando para `www`.

Rollback: voltar temporariamente para o certificado anterior no arquivo Nginx, rodar `nginx -t` e recarregar Nginx.

## Fluxo de Deploy do Site na VPS

Este é o fluxo operacional para publicar o frontend sem Vercel.

1. Gerar build do site:

```bash
npm run build
```

2. Enviar o build para a VPS:

```bash
npm run deploy:vps-site
```

O script deve publicar a pasta `dist/` em um release versionado dentro de:

```text
/var/www/mdv-site/releases
```

Cada deploy cria uma pasta própria, por exemplo:

```text
/var/www/mdv-site/releases/20260520-180705
```

3. Trocar o release ativo por symlink:

```text
/var/www/mdv-site/current
```

Antes da troca, o release anterior deve ficar preservado em:

```text
/var/www/mdv-site/previous
```

4. Servir o site pelo Nginx:

- `root` aponta para `/var/www/mdv-site/current`;
- assets versionados de `/assets/*` usam cache longo;
- rotas SPA como `/admin/*` caem no `index.html`;
- `/api/*` é proxy reverso para o Fastify/PM2;
- `/sitemap.xml` e `/produto/:slug` ficam reservadas antes do fallback SPA porque precisam de SEO/HTML próprio.

5. Validar após o deploy:

- `curl -I` no domínio ou staging;
- abrir `/`;
- abrir `/admin/products`;
- validar assets `/assets/*`;
- validar `/api/status`;
- validar `/api/vps-proxy?path=/status`;
- checar logs do Nginx e PM2.

6. Rollback:

Se o deploy falhar, voltar o symlink `current` para `previous`:

```bash
ln -sfn /var/www/mdv-site/previous /var/www/mdv-site/current
```

Depois validar novamente `GET /`, `/admin/products` e `/api/status`.

7. Produção e fallback:

- enquanto a regressão completa não terminar, Vercel fica como fallback temporário;
- a VPS staging deve provar site, API, login, admin, pagamento, webhooks, SEO e sitemap antes da troca DNS;
- no corte final, Cloudflare/DNS aponta `mercadodovale.com.br` e `www.mercadodovale.com.br` para a VPS;
- se a troca final apresentar falha, reverter DNS/Cloudflare para o fallback temporário ou voltar `current` para `previous`, conforme a origem do problema.

## Checklist de Cada Bloco

Antes de considerar um bloco migrado:

- [ ] roda na VPS;
- [ ] não depende da Vercel;
- [ ] tem env documentado;
- [ ] tem log;
- [ ] tem teste/regressão;
- [ ] tem rollback;
- [ ] tem impacto conhecido;
- [ ] foi validado em staging;
- [ ] não quebrou produção atual.

Antes de commit/deploy de um bloco que altere runtime da VPS:

- [ ] revisar o diff completo dos arquivos da VPS antes de stagear, principalmente `vps_server.cjs`, `vps_server.js`, `api/vps-proxy.ts`, `infra/nginx/*.conf` e `vercel.json`;
- [ ] confirmar se o diff grande de `vps_server.cjs` e `vps_server.js` pertence ao mesmo bloco ou se precisa ser dividido em commits menores;
- [ ] rodar os testes estaticos `tmp-tests/vps-*` diretamente relacionados ao bloco alterado;
- [ ] rodar validacoes de sintaxe/build aplicaveis, como `node --check vps_server.js`, `node --check vps_server.cjs` e `npm.cmd run build` quando houver impacto no frontend/proxy;
- [ ] stagear somente os arquivos do bloco da VPS, deixando fora alteracoes paralelas, reports e testes nao relacionados;
- [ ] criar commit separado para a VPS com mensagem objetiva;
- [ ] fazer `push` para `origin/main`;
- [ ] executar o deploy operacional na VPS quando o commit alterar `vps_server.*`, Nginx, cron, PM2 ou scripts executados no servidor;
- [ ] validar pos-deploy com status HTTP, logs e/ou PM2 antes de considerar o bloco publicado;
- [ ] registrar no diario da migracao o hash do commit, comandos de validacao, resultado do deploy e pendencias restantes.

## Definição de Pronto

A migração para VPS estará pronta quando:

- o domínio principal apontar para a VPS;
- o site abrir pela VPS;
- `/api/*` rodar na VPS;
- webhooks chegarem na VPS;
- OAuth callbacks funcionarem na VPS;
- cron rodar na VPS;
- SEO e sitemap funcionarem na VPS;
- logs e rollback estiverem operacionais;
- Vercel puder ser desligada sem impacto.

## Mapa de Rotas

Esta seção deve ser alimentada ao longo da migração.

| Rota | Origem Atual | Destino Planejado | Status | Tipo | Auth | Teste/Validação | Observações |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | Vercel static | VPS Nginx `dist/` | vps-producao-validado-http | frontend | pública | `curl -H "Host: staging.mercadodovale.com.br" http://76.13.232.162/`; `curl https://www.mercadodovale.com.br/`; `node tmp-tests/vps-staging-frontend-proxy-check-static.test.mjs`; `STAGING_FRONTEND_PROXY_LIVE=true node tmp-tests/vps-staging-frontend-proxy-check.cjs`; `node tmp-tests/vps-site-deploy-script-static.test.mjs`; `node tmp-tests/vps-nginx-staging-config-static.test.mjs`; `npm run build` | deploy executado na VPS em `/var/www/mdv-site/releases/20260520-180705`; Nginx staging e produção instalados; raiz pública validada com HTTP 200 via Cloudflare em 2026-05-27; falta validação browser/login real |
| `/admin/*` | Vercel static | VPS Nginx `dist/` | vps-staging-validado-http | frontend/admin | Supabase auth no app | `curl -I -H "Host: staging.mercadodovale.com.br" http://76.13.232.162/admin/products`; `STAGING_FRONTEND_PROXY_LIVE=true node tmp-tests/vps-staging-frontend-proxy-check.cjs`; login + refresh direto em staging após DNS | fallback SPA `/admin/products` validado via HTTP 200; falta validação no navegador com DNS ou hosts local e sessão admin real |
| `/api/vps-proxy` | Vercel Function | VPS Fastify | vps-producao-validado-http | proxy/api | Supabase admin/customer + sync key | `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`; `node tmp-tests/vps-staging-frontend-proxy-check-static.test.mjs`; `STAGING_FRONTEND_PROXY_LIVE=true node tmp-tests/vps-staging-frontend-proxy-check.cjs`; `node --check vps_server.js`; `node --check vps_server.cjs`; `curl /api/vps-proxy?path=/status`; `curl /vps-proxy?path=/status`; `curl /api/vps-proxy?path=/products?limit=1`; `curl /api/vps-proxy?path=/company-settings` sem token | rota compatível criada, deployada e validada no staging e no domínio público para leitura de status; status/produtos públicos OK e `/company-settings` sem sessão bloqueado; falta regressão com sessão admin real |
| `/api/bling` | Vercel Function | VPS Fastify | vps-staging-validado-http | api/oauth | conforme `resource` | `node tmp-tests/vps-bling-resource-parity-static.test.mjs`; `node tmp-tests/vps-bling-oauth-fastify-static.test.mjs`; `node tmp-tests/vps-bling-products-fastify-static.test.mjs`; `node tmp-tests/vps-bling-product-detail-fastify-static.test.mjs`; `node tmp-tests/vps-bling-product-update-fastify-static.test.mjs`; `node tmp-tests/vps-bling-diagnostics-fastify-static.test.mjs`; `node tmp-tests/vps-bling-admin-helpers-fastify-static.test.mjs`; `node tmp-tests/vps-bling-webhook-fastify-static.test.mjs`; `node tmp-tests/vps-bling-stock-fastify-static.test.mjs`; `node tmp-tests/vps-bling-stock-sync-guarded-check-static.test.mjs`; `node tmp-tests/vps-bling-stock-sync-guarded-check.cjs`; `node tmp-tests/vps-bling-product-update-guarded-check-static.test.mjs`; `node tmp-tests/vps-bling-product-update-guarded-check.cjs`; `node tmp-tests/vps-bling-finance-mutation-guarded-check-static.test.mjs`; `node tmp-tests/vps-bling-finance-mutation-guarded-check.cjs`; `node tmp-tests/vps-bling-sync-prices-fastify-static.test.mjs`; `node tmp-tests/vps-bling-reconcile-fastify-static.test.mjs`; `node tmp-tests/vps-bling-finance-fastify-static.test.mjs`; `node tmp-tests/vps-bling-nf-fastify-static.test.mjs`; `curl /api/bling?resource=oauth-callback&error=access_denied`; `curl POST /api/bling?resource=exchange` sem credenciais; `curl /api/bling?resource=categories` sem Authorization; `curl /api/bling?resource=products` sem Authorization; `curl /api/bling?resource=product-detail`; `curl /api/bling?resource=product-detail&id=0`; `curl /api/bling?resource=stock` sem Authorization; `curl POST /api/bling?resource=stock-sync` sem body; `curl GET /api/bling?resource=sync-prices-vps`; `curl /api/bling?resource=reconcile&dryRun=true` sem auth; `curl /api/bling?resource=finance&resourceType=pagar&action=list` sem Authorization; `curl /api/bling?resource=nf-detail` sem tipo; `curl POST /api/bling?resource=product-update-fiscal` sem body; `curl POST /api/bling?resource=product-update-dimensions` sem body; `curl GET /api/bling?resource=webhook`; `curl GET /api/bling?resource=image-proxy`; `curl GET /api/bling?resource=debug-product`; `curl GET /api/bling?resource=debug-diagnostic`; `curl POST /api/bling?resource=fix-profile`; `curl POST /api/bling?resource=sync-model-brand`; `curl POST /api/bling?resource=fix-bling-id` | inventário de recursos do `api/bling.ts` coberto no Fastify da VPS; guards de `stock-sync`, atualização fiscal/dimensões e financeiro preparados sem execução real; validações reais controladas ainda pendentes antes do corte final |
| `/api/auth/callback/bling` | Vercel rewrite | VPS Fastify | vps-staging-validado-http | oauth | callback externo | `node tmp-tests/vps-bling-oauth-fastify-static.test.mjs`; `node tmp-tests/vps-oauth-preflight-check-static.test.mjs`; `OAUTH_PREFLIGHT_LIVE=true node tmp-tests/vps-oauth-preflight-check.cjs`; `curl /api/auth/callback/bling` sem code | callback preservado na VPS; preflight OAuth sanitizado validado; falta reconexão real com código OAuth válido do Bling |
| `/api/bling-webhook` | Vercel Function | VPS Fastify | vps-staging-validado-http | webhook | segredo/validação quando disponível | `node tmp-tests/vps-bling-webhook-fastify-static.test.mjs`; `node tmp-tests/vps-bling-webhook-simulation-static.test.mjs`; `node --check tmp-tests/vps-bling-webhook-simulation.cjs`; `node tmp-tests/vps-bling-webhook-simulation.cjs`; `curl GET /api/bling-webhook`; `curl GET /api/bling?resource=webhook` | handler Fastify deployado; guard de payload Bling preparado e validado sem envio; POST real/simulado fica para janela controlada por gravar logs/estoque/preço |
| `/api/mercadopago-webhook` | Vercel rewrite | VPS Fastify | vps-staging-validado-http | webhook | validação Mercado Pago | `node tmp-tests/mercadopago-webhook-fastify-static.test.mjs`; `node tmp-tests/vps-mercadopago-webhook-simulation-static.test.mjs`; `node --check tmp-tests/vps-mercadopago-webhook-simulation.cjs`; `node tmp-tests/vps-mercadopago-webhook-simulation.cjs`; `node --check vps_server.js`; `node --check vps_server.cjs`; `curl --resolve ... GET /api/mercadopago-webhook`; `curl --resolve ... POST payload não-MP`; `curl --resolve ... POST payment id=0` | rota Fastify deployada no staging; guard de payload Mercado Pago preparado e validado sem envio; confirma pagamento real no Mercado Pago antes de atualizar pedido; debug copiável validado sem segredos |
| `/api/shopee` | Vercel Function | VPS Fastify | vps-staging-validado-http | oauth/api | Shopee assinatura | `node tmp-tests/vps-shopee-oauth-fastify-static.test.mjs`; `node tmp-tests/vps-oauth-preflight-check-static.test.mjs`; `OAUTH_PREFLIGHT_LIVE=true node tmp-tests/vps-oauth-preflight-check.cjs`; `curl /api/shopee?action=callback` sem parâmetros; `curl /api/shopee` sem action | OAuth `auth`/`callback` migrado; preflight sanitizado validou URL Shopee; falta reconexão real com código Shopee válido antes de atualizar callback definitivo |
| `/api/shopee-catalog` | Vercel Function | VPS Fastify | vps-staging-validado-http | api | admin | `node tmp-tests/vps-shopee-catalog-read-fastify-static.test.mjs`; `node tmp-tests/vps-shopee-catalog-mutations-fastify-static.test.mjs`; `node tmp-tests/vps-shopee-catalog-media-full-fastify-static.test.mjs`; `node tmp-tests/vps-shopee-add-item-media-guarded-check-static.test.mjs`; `node tmp-tests/vps-shopee-add-item-media-guarded-check.cjs`; `curl /api/shopee-catalog?action=attributes`; `curl /api/shopee-catalog?action=search_attribute_values`; `curl /api/shopee-catalog?action=get_item_base_info`; `curl GET /api/shopee-catalog?action=update_stock`; `curl GET /api/shopee-catalog?action=upload_image`; `curl GET /api/shopee-catalog?action=upload_video` | ações de leitura, mutações diretas, upload de imagem/vídeo e `get_full_catalog` migrados; guard de upload de mídia preparado sem execução real; falta validação real controlada antes do corte final |
| `/api/shopee-actions` | Vercel Function | VPS Fastify | vps-staging-validado-http | api | admin | `node tmp-tests/vps-shopee-actions-read-fastify-static.test.mjs`; `node tmp-tests/vps-shopee-actions-refresh-fastify-static.test.mjs`; `node tmp-tests/vps-shopee-actions-mutations-fastify-static.test.mjs`; `node tmp-tests/vps-shopee-actions-add-item-fastify-static.test.mjs`; `node tmp-tests/vps-shopee-mutation-guarded-check-static.test.mjs`; `node tmp-tests/vps-shopee-mutation-guarded-check.cjs`; `node tmp-tests/vps-shopee-ship-order-guarded-check-static.test.mjs`; `node tmp-tests/vps-shopee-ship-order-guarded-check.cjs`; `node tmp-tests/vps-shopee-add-item-media-guarded-check-static.test.mjs`; `node tmp-tests/vps-shopee-add-item-media-guarded-check.cjs`; `curl /api/shopee-actions`; `curl /api/shopee-actions?action=get_order_detail`; `curl /api/shopee-actions?action=get_tracking_info`; `curl GET /api/shopee-actions?action=update_stock&product_id=test&stock=1`; `curl GET /api/shopee-actions?action=ship_order&order_sn=TEST`; `curl GET /api/shopee-actions?action=add_item&product_id=test` | ações de leitura, `refresh_token`, `ship_order`, `update_stock`, `update_price` e `add_item` migrados; guards de escrita preparados sem execução real; falta validação real controlada antes do corte final |
| `/api/shopee-webhook` | Vercel Function | VPS Fastify | vps-staging-validado-http | webhook | assinatura Shopee | `node tmp-tests/vps-shopee-webhook-fastify-static.test.mjs`; `node tmp-tests/vps-shopee-webhook-order-simulation-static.test.mjs`; `node --check tmp-tests/vps-shopee-webhook-order-simulation.cjs`; `node tmp-tests/vps-shopee-webhook-order-simulation.cjs`; `curl GET /api/shopee-webhook`; `curl POST /api/shopee-webhook {}` | handler deployado; POST vazio retorna sucesso sem relay externo; guard de payload `code=3` preparado e validado sem envio; falta payload real/simulado de pedido em janela controlada |
| `/api/shipping` | Vercel Function | VPS Fastify | vps-staging-validado-http | api | admin/public conforme uso | `node tmp-tests/vps-shipping-fastify-static.test.mjs`; `node tmp-tests/vps-shipping-quote-guarded-simulation-static.test.mjs`; `node --check tmp-tests/vps-shipping-quote-guarded-simulation.cjs`; `node tmp-tests/vps-shipping-quote-guarded-simulation.cjs`; `node tmp-tests/vps-melhor-envio-label-guarded-simulation-static.test.mjs`; `node --check tmp-tests/vps-melhor-envio-label-guarded-simulation.cjs`; `node tmp-tests/vps-melhor-envio-label-guarded-simulation.cjs`; `node --check vps_server.js`; `node --check vps_server.cjs`; `curl POST /api/shipping?provider=frenet&action=calculate`; `curl POST /api/shipping?provider=melhor-envio&action=calculate` sem token | rota compatível deployada no staging para Frenet e Melhor Envio; guards de cotacao e etiqueta preparados e validados sem envio; validação real com token/pedido fica para regressão controlada |
| `/api/telegram-webhook` | Vercel Function | VPS Fastify | vps-staging-validado-http | webhook | `TELEGRAM_WEBHOOK_SECRET` configurado na VPS | `node tmp-tests/vps-telegram-webhook-fastify-static.test.mjs`; `node tmp-tests/vps-telegram-set-webhook-static.test.mjs`; `node tmp-tests/vps-telegram-webhook-ping-static.test.mjs`; `node tmp-tests/vps-telegram-webhook-command-static.test.mjs`; `curl GET /api/telegram-webhook`; `curl POST {}`; `curl POST payload /ping sem segredo`; `node tmp-tests/vps-telegram-set-webhook.cjs`; `node tmp-tests/vps-telegram-webhook-ping.cjs`; `node tmp-tests/vps-telegram-webhook-command.cjs /vendas`; `node tmp-tests/vps-telegram-webhook-command.cjs /estoque`; `node tmp-tests/vps-telegram-webhook-command.cjs /relatorio`; `node tmp-tests/vps-telegram-webhook-command.cjs /top10`; `node tmp-tests/vps-telegram-webhook-command.cjs /pedidos`; `node tmp-tests/vps-telegram-webhook-command.cjs /clientes`; `node tmp-tests/vps-telegram-webhook-command.cjs "/modelo iphone"`; `node tmp-tests/vps-telegram-webhook-command.cjs "/categoria celulares"` | handler Fastify publicado; comandos migrados; webhook real do Telegram aponta para `api.xiaomipetrolina.com.br`; comandos principais reais controlados validados via chat configurado |
| `/api/cron-dispatcher` | Vercel Cron/Function | VPS cron + Fastify/script | vps-staging-validado-http | cron | `CRON_SECRET` configurado na VPS | `node tmp-tests/vps-cron-dispatcher-fastify-static.test.mjs`; `node tmp-tests/vps-migration-secrets-set-static.test.mjs`; `node tmp-tests/vps-cron-dispatcher-install-static.test.mjs`; `curl /api/cron-dispatcher` sem segredo; `crontab -l` | handler Fastify publicado; chamada pública sem segredo retorna `401`; cron instalado na VPS em `0 22 * * *`; entradas antigas para `www.mercadodovale.com.br/api/cron-dispatcher` removidas |
| `/sitemap.xml` | Vercel rewrite/function | VPS Fastify via Nginx | vps-producao-validado-http | sitemap/seo | pública | `node tmp-tests/vps-sitemap-fastify-static.test.mjs`; `node tmp-tests/vps-sitemap-dedup-slugs-static.test.mjs`; `node tmp-tests/vps-seo-special-slugs-check-static.test.mjs`; `SEO_SPECIAL_SLUGS_LIVE=true node tmp-tests/vps-seo-special-slugs-check.cjs`; `node tmp-tests/vps-seo-production-host-check-static.test.mjs`; `SEO_PRODUCTION_HOST_LIVE=true node tmp-tests/vps-seo-production-host-check.cjs`; `SEO_PRODUCTION_HOST_LIVE=true SEO_PRODUCTION_HOST=www.mercadodovale.com.br node tmp-tests/vps-seo-production-host-check.cjs`; `node tmp-tests/vps-nginx-production-config-static.test.mjs`; `node tmp-tests/vps-nginx-staging-config-static.test.mjs`; `node tmp-tests/vps-nginx-production-config-install-static.test.mjs`; `node --check vps_server.js`; `node --check vps_server.cjs`; `curl /api/sitemap`; `curl /sitemap.xml` | API VPS publicada em 2026-05-27; Nginx produção reinstalado pela VPS com backup remoto; `www` serve sitemap `200` com `1844` URLs e `1841` produtos únicos por slug; `poco-c85` revalidado com 1 ocorrência em 2026-05-27 |
| `/produto/:slug` | Vercel rewrite/function | VPS Fastify via Nginx | vps-producao-validado-http | seo | pública | `node tmp-tests/vps-seo-produto-fastify-static.test.mjs`; `node tmp-tests/vps-seo-special-slugs-check-static.test.mjs`; `SEO_SPECIAL_SLUGS_LIVE=true node tmp-tests/vps-seo-special-slugs-check.cjs`; `SEO_SPECIAL_SLUGS_LIVE=true SEO_SPECIAL_SLUGS_HOST=www.mercadodovale.com.br SEO_SPECIAL_SLUGS_SITEMAP_URL=http://76.13.232.162/sitemap.xml node tmp-tests/vps-seo-special-slugs-check.cjs`; `node tmp-tests/vps-seo-production-host-check-static.test.mjs`; `SEO_PRODUCTION_HOST_LIVE=true node tmp-tests/vps-seo-production-host-check.cjs`; `SEO_PRODUCTION_HOST_LIVE=true SEO_PRODUCTION_HOST=www.mercadodovale.com.br node tmp-tests/vps-seo-production-host-check.cjs`; `node --check vps_server.js`; `node --check vps_server.cjs`; `curl /api/seo-produto?slug=abracadeira-nylon-enforca-gato-300x36mm-bom-5495`; `curl /produto/abracadeira-nylon-enforca-gato-300x36mm-bom-5495` | rota Fastify deployada e validada no staging e no host `www` da config produção; slugs especiais retornam `200`, canonical `www.mercadodovale.com.br`, `og:type=product` e `2` JSON-LD |
| `/api/brasilapi-ncm` | Vercel rewrite/proxy | VPS Fastify | vps-staging-validado-http | api/proxy | pública | `curl /api/brasilapi-ncm?search=8517`; `node tmp-tests/vps-proxy-fastify-route-static.test.mjs` | rota direta criada no Fastify, deployada e validada com cache |

Nota atualizada do mapa Shopee em 2026-05-21: `/api/shopee-catalog` teve leitura real de loja, categorias, logística, itens e modelos validada por `tmp-tests/vps-shopee-live-read-check.cjs`; `/api/shopee-actions` teve leitura real de pedidos, rastreio e pagamento validada por `tmp-tests/vps-shopee-order-live-read-check.cjs`. Mutações reais (`update_stock`, `update_price`, `ship_order`) permanecem bloqueadas por guard scripts até existir produto/pedido explicitamente controlado para teste.

### Checklist ativo antes do corte final

Este é o checklist operacional atual. Entradas antigas no histórico abaixo continuam como trilha de auditoria, mas os itens marcados como leitura real Bling/Shopee já foram cobertos pelos validadores sanitizados.

Concluído em leitura real pela VPS:

- Bling: categorias, produtos, detalhe de produto, NFe/NFCe, detalhe de NFe, financeiro receber/pagar e estoque filtrado por produto descoberto.
- Shopee: loja, categorias, logística, lista de itens, detalhe de item, modelos, pedidos, detalhe de pedido, rastreio e pagamento/escrow.
- Telegram: webhook real apontando para `api.xiaomipetrolina.com.br` e comandos principais validados no chat configurado.
- Cron dispatcher: rota protegida por segredo, cron instalado na VPS para `0 22 * * *` e primeira execução real observada com sucesso no log.
- Guardas Vercel/Supabase: revalidados em 2026-05-29 sem criar recurso novo; deploy legado segue sem blockers versionados e o inventario Supabase segue no baseline `.from=491`, `.rpc=31`, `storage=13`, com `0` dependencias operacionais nao classificadas.
- SEO: comparação pública de sitemap feita; produção atual redireciona para `www.mercadodovale.com.br` com 3 URLs, VPS staging retorna milhares de URLs de produtos; 8 slugs especiais do sitemap staging revalidados com canonical, OG product e JSON-LD.
- Bling reconcile: apply real controlado executado para o plano revisado de `7` estoques e `57` nomes. A conferência pós-apply revelou que o dry-run ainda lia Supabase antigo; o reconciliador foi corrigido para montar o plano a partir do MySQL da VPS. Em 2026-05-27, o reconcile tambem foi ajustado para nao planejar nem aplicar `nameChanges`, preservando nomes locais quando o produto foi apenas vinculado ao Bling.
- Bling diagnostics: `debug-product` e `debug-diagnostic` validados com `blingId` real pela VPS, com saída sanitizada.
- Bling image proxy: `image-proxy` validado com imagem real de produto Bling pela VPS, com saída sanitizada.
- Bling sync-prices-vps: `dryRun=true` real validado na VPS nas páginas `0`, `1` e `48`; aplicação real controlada da página `0` sincronizou `50` itens em `/products/batch` com HTTP `200`.
- Staging frontend/proxy: revalidado live pela VPS com host `staging.mercadodovale.com.br`; raiz e `/admin/products` retornam HTML `200`, `/api/vps-proxy?path=/status` e leitura pública de produtos retornam JSON `200`, e `/company-settings` sem sessão continua bloqueado com `403`.
- Admin real no domínio público: sessão admin existente validada via Chrome DevTools; `/admin/products` abriu autenticado, carregou filtros/listagem e `Status VPS` mostrou API online, MySQL OK e `/api/vps-proxy` de Synology com HTTP `200`, sem erros de console.
- Checklist seguro read-only: revalidado em 2026-05-27 14:49 BRT; guardas de mutação retornaram `ok=true`, `checked=28`, `failed=0`, `mutation_executed=false`; produção SEO `www` retornou sitemap `200` com `1836` URLs e `1833` produtos; staging/proxy retornou raiz/admin/status/produtos `200` e `/company-settings` sem sessão `403`; build Vite passou fora do sandbox.
- Staging Locais de Estoque: correção do botão `Transferir` dentro do conteúdo de caixa commitada e publicada na VPS; asset novo da tela retornou `200` no staging. Falta apenas o reteste manual do usuário na Caixa 20/SKU `CTRN115G`.
- OAuth preflight: revalidado live pela VPS; callback Bling sem code redireciona para `/admin/settings/bling`, exchange Bling sem credenciais retorna `400`, callback Shopee sem parâmetros retorna `400` e geração de URL Shopee retorna host oficial com redirect para `www.mercadodovale.com.br`.
- Bling financeiro: proxy da VPS corrigido para listar contas com filtros nativos do Bling (`dataVencimentoInicial`, `dataVencimentoFinal` e `situacao` singular), evitando `404` ao buscar contas por vencimento.
- Limpeza de Vercel no app: textos e comentarios operacionais que ainda orientavam uso de Vercel foram atualizados para VPS; o teste de NCM agora valida o proxy Fastify e confirma ausencia de `vercel.json`/`api`.
- Corte externo read-only: verificador versionado cobre GET de webhooks Bling/Mercado Pago/Shopee e callbacks OAuth sem codigo real; guard principal subiu para `30` checks sem executar payload nem mutacao.
- Plano de conferencia dos paineis externos: auditor de readiness agora imprime as URLs esperadas para Bling, Shopee e Mercado Pago, marcando a etapa como `manual_panel_read_only` porque os provedores documentam essa configuracao no painel do aplicativo, nao como leitura automatica segura.
- Checklist seguro read-only: revalidado em 2026-05-29 com `30` checks, `failed=0`, `mutation_executed=false`; auditor Vercel sem blockers; inventario Supabase em `.from=478`, `.rpc=29`, `storage=13`, com `0` dependencias operacionais nao classificadas; SEO publico `www` com sitemap `200`, `1843` URLs e `1840` produtos.
- Checkpoint de consolidacao read-only: revalidado em 2026-05-30 antes de novos cortes; `node tmp-tests\vps-migration-guard-regression.cjs` retornou `checked=30`, `failed=0`, `mutation_executed=false`; `node tools\audit-supabase-operational-dependencies.mjs` retornou `.from=446`, `.rpc=29`, `storage=13`, `unclassifiedOperationalMatches=0`; `npm.cmd run build` passou fora do sandbox; `node tools\audit-legacy-deploy-removal-readiness.mjs` retornou `ready_to_remove_legacy_deploy=true` e `blockers=[]`; probes read-only de webhooks/callbacks em `https://www.mercadodovale.com.br` passaram; SEO publico `www` retornou sitemap `200`, `1843` URLs e `1840` produtos.
- Paineis externos: conferencia visual/read-only confirmada pelo usuario em 2026-05-30 para Bling, Shopee e Mercado Pago contra as URLs finais `www.mercadodovale.com.br`, sem registrar criacao ou salvamento de configuracao durante este checkpoint.
- Banners: CRUD do `bannerService`, telemetria `click`/`view` e reordenacao `display_order` migrados para endpoints da VPS.
- Garantia no detalhe de produto: `ProductDetailsModal` deixou de consultar `brands` e `categories` diretamente no Supabase para dias de garantia, usando `brandService`/`categoryService` pela VPS.
- Validação de SKU serializado: `services/products.ts` deixou de consultar `categories` diretamente no Supabase para detectar categorias serializadas, usando `categoryService.getById()` pela VPS.
- Preço médio por variação: `averagePriceService` já lia produtos pela VPS e agora também propaga os preços médios por `vpsApiService.updateProduct()`, sem escrita direta em `products` no Supabase.
- Template do modelo no detalhe de produto: `ProductDetailsModal` deixou de consultar `models` diretamente no Supabase para `template_values` e descricao herdada, usando `modelService.getById()` pela VPS.
- Template do modelo na comparacao: `CompareModal` deixou de consultar `models` diretamente no Supabase para `template_values`, usando `modelService.getById()` pela VPS.
- Template do modelo na PDP publica: `PublicProductPage` deixou de consultar `models` diretamente no Supabase para `template_values`, descricao herdada e marca de fallback, usando `modelService.getById()` pela VPS.
- Dimensoes de modelo no frete: `FreightCalculator` deixou de consultar `models` diretamente no Supabase para `template_values`, usando `modelService.getById()` pela VPS; auditor Supabase travado em `.from=447`, `.rpc=29`, `storage=13`.
- Nome do modelo no servico de produtos: `productService.getById` deixou de consultar `models` diretamente no Supabase para enriquecer `product.model`, usando `modelService.getById()` pela VPS; auditor Supabase travado em `.from=446`, `.rpc=29`, `storage=13`.
- Modelo em criacao/edicao de produtos: `productService.create` e `productService.update` deixaram de consultar `models` diretamente no Supabase para `template_values`, categoria e marca, usando `modelService.getById()` pela VPS e `brandService.getById()` como fallback de nome; auditor Supabase travado em `.from=444`, `.rpc=29`, `storage=13`.
- Configuracao de frete: `shippingService` deixou de usar Supabase para `shipping_settings`, `shipping_zones` e `shipping_price_ranges`; settings, zonas e faixas agora passam pelos endpoints VPS, incluindo CRUD de `/shipping/price-ranges`; auditor Supabase travado em `.from=433`, `.rpc=29`, `storage=13`.
- Configuracoes da empresa: `companySettingsService` deixou de manter fallback Supabase para `company_settings`; leitura e escrita agora sao VPS-only via `/company-settings`, preservando cache local e defaults de templates; auditor Supabase travado em `.from=430`, `.rpc=29`, `storage=13`.
- Configuracao do catalogo: `catalogConfigService.getSettings/saveSettings` deixou de usar Supabase para `catalog_settings`; leitura e escrita agora passam pela VPS em `/catalog-settings`, com PATCH protegido por sync key e filtro dinamico de colunas no MySQL; auditor Supabase travado em `.from=428`, `.rpc=29`, `storage=13`.
- Template de boas-vindas: `welcomeMessageService` deixou de usar Supabase para `catalog_settings/welcome_message_template`; leitura e escrita reutilizam `/catalog-settings` na VPS; auditor Supabase travado em `.from=426`, `.rpc=29`, `storage=13`.
- Telefone do WhatsApp em orcamentos: `whatsappMessageGenerator.generateWhatsAppLink` deixou de consultar `company_settings` no Supabase; agora usa `publicCompanySettingsService` e a rota publica da VPS quando `USE_VPS.company` esta ativo; auditor Supabase travado em `.from=425`, `.rpc=29`, `storage=13`.

Pendente para corte final:

- Regressão segura: antes de qualquer execução controlada, rodar `node tmp-tests/vps-migration-guard-regression.cjs` para confirmar que os guards continuam em modo não-mutante por padrão.
- Bling escrita: `stock-sync`, atualização fiscal/dimensões e mutações financeiras guardados e prontos para caso controlado; `sync-prices-vps` e próxima aplicação do `reconcile` somente após revisar os estoques restantes do plano atual. Renomes pelo reconcile ficam desativados para preservar produtos apenas vinculados.
- Shopee escrita: `update_stock`, `update_price`, `add_item`, upload de mídia e `ship_order` guardados; execução real somente com produto/pedido/mídia explicitamente controlados.
- Webhooks: validar payload Bling, Shopee e Mercado Pago em janela controlada antes de trocar callbacks definitivos.
- OAuth: reconectar Bling e Shopee com código real válido pela VPS.
- Staging/frontend: login/admin real read-only validado no domínio público; falta apenas teste administrativo autenticado com escrita pequena/reversível, se aprovado em janela controlada.
- Shipping: cotação Frenet/Melhor Envio e etiqueta Melhor Envio com pedido de teste.
- SEO: config Nginx de produção reinstalada na VPS; `mercadodovale.com.br` redireciona para `https://www.mercadodovale.com.br`, `www` serve `/sitemap.xml` com `1844` URLs e `1841` produtos únicos por slug; falta validar login/admin real no browser.
- API/catalogo: `/products/by-ids` criado no Fastify da VPS e validado direto em `api.xiaomipetrolina.com.br` e via `/api/vps-proxy`, retornando `200` e preservando a ordem dos IDs enviados.
- Operacao: cron da Vercel removido do `vercel.json`; conferencia visual/read-only dos paineis Bling, Shopee e Mercado Pago marcada como concluida em 2026-05-30 por confirmacao do usuario.

## Registro de Mudanças

### 2026-05-30 - telefone WhatsApp de orcamento via settings publicas

Mudanca: `utils/whatsappMessageGenerator.ts` deixou de importar Supabase e de consultar `company_settings` para buscar o telefone usado em links de WhatsApp. `generateWhatsAppLink` agora usa `publicCompanySettingsService.get()`, que prioriza `/public/company-settings` na VPS quando `USE_VPS.company` esta ativo.

Objetivo: remover uma dependencia Supabase simples do fluxo publico de orcamento/WhatsApp, sem mexer no restante da formatacao da mensagem.

Arquivos alterados:

- `utils/whatsappMessageGenerator.ts`
- `tmp-tests/whatsapp-message-generator-vps-company-phone-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `migração_VPS.md`

Validacao:

- RED: `node tmp-tests\whatsapp-message-generator-vps-company-phone-static.test.mjs` falhou enquanto o util ainda importava Supabase.
- GREEN: `node tmp-tests\whatsapp-message-generator-vps-company-phone-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 425`, `.rpc(...) = 29`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.

Resultado: `company_settings` caiu de `17` para `16` chamadas diretas no auditor, e `utils/` nao precisa mais de Supabase para gerar o link de WhatsApp de orcamento.

Pendencias:

- migrar `feedbackService.getDefaultCompanyId` para obter company id por rota VPS antes de mexer no CRUD de feedbacks;
- reduzir os usos restantes de `company_settings` em telas/configuracoes Bling/Shopee.

Rollback: restaurar a consulta direta de `company_settings` em `whatsappMessageGenerator` e voltar `MAX_BASELINE_FROM_CALLS` para `426`; nao recomendado porque a rota publica da VPS ja fornece o telefone.

### 2026-05-30 - welcomeMessageService via VPS-only

Mudanca: `welcomeMessageService` deixou de importar Supabase, de exigir `supabase.auth.getUser()` e de consultar/gravar `catalog_settings` diretamente. O template `welcome_message_template` agora e lido por `vpsApiService.getCatalogSettings()` e salvo por `vpsApiService.syncCatalogSettings({ welcome_message_template: template })`.

Objetivo: remover o Supabase do fluxo de mensagem inicial enviada ao cliente, reaproveitando o endpoint global de configuracao do catalogo na VPS.

Arquivos alterados:

- `services/welcomeMessageService.ts`
- `tmp-tests/welcome-message-service-vps-only-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `migração_VPS.md`

Validacao:

- RED: `node tmp-tests\welcome-message-service-vps-only-static.test.mjs` falhou enquanto o servico ainda importava Supabase.
- GREEN: `node tmp-tests\welcome-message-service-vps-only-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 426`, `.rpc(...) = 29`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.

Resultado: as duas ultimas chamadas diretas a `catalog_settings` dentro de `services/` foram removidas, ficando `catalog_settings` pendente apenas em outras superficies administrativas/legadas se aparecerem no auditor.

Pendencias:

- migrar `category_display_config` em corte separado;
- revalidar no navegador a tela que edita o template quando houver janela de teste admin real.

Rollback: restaurar o branch Supabase de `welcomeMessageService` e voltar `MAX_BASELINE_FROM_CALLS` para `428`; nao recomendado porque reintroduz auth/tabela Supabase no fluxo de mensagem do cliente.

### 2026-05-30 - catalogConfigService via VPS-only para catalog_settings

Mudanca: `catalogConfigService.getSettings` e `catalogConfigService.saveSettings` deixaram de consultar/gravar `catalog_settings` pelo Supabase. A leitura usa `vpsApiService.getCatalogSettings()` e a escrita usa `vpsApiService.syncCatalogSettings()` contra `PATCH /catalog-settings` no Fastify da VPS.

Objetivo: remover o Supabase do caminho operacional de configuracao visual/publica do catalogo, mantendo a VPS/MySQL como origem das regras globais de exibicao.

Arquivos alterados:

- `services/catalogConfigService.ts`
- `services/vpsApiService.ts`
- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/catalog-config-service-vps-only-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `migração_VPS.md`

Validacao:

- RED: `node tmp-tests\catalog-config-service-vps-only-static.test.mjs` falhou enquanto `catalogConfigService` ainda usava `supabase.from('catalog_settings')`.
- GREEN: `node tmp-tests\catalog-config-service-vps-only-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 428`, `.rpc(...) = 29`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.

Resultado: duas chamadas diretas Supabase em `catalog_settings` foram removidas. O endpoint de escrita na VPS descobre colunas reais com `DESCRIBE catalog_settings`, ignora campos bloqueados (`id`, `created_at`, `user_id`) e atualiza/cria a linha global de configuracao.

Pendencias:

- `welcomeMessageService` ja migrado em corte seguinte;
- migrar `category_display_config` em corte separado para evitar misturar configuracao global com taxonomia visual de categorias.

Rollback: restaurar temporariamente o fallback Supabase de `catalogConfigService` e voltar `MAX_BASELINE_FROM_CALLS` para `430`; nao recomendado porque reintroduz Supabase na configuracao global do catalogo.

### 2026-05-30 - companySettingsService via VPS-only

Mudanca: `companySettingsService` deixou de importar Supabase e de manter branch fallback para `company_settings`. A leitura usa `vpsClient.get('/company-settings')` e a escrita usa `vpsClient.patch('/company-settings')`; o cache em memoria/localStorage foi preservado e a normalizacao de endereco/templates padrao passou a ser aplicada sobre a resposta da VPS.

Objetivo: remover o Supabase do caminho operacional central de configuracoes da empresa, que alimenta recibos, documentos, PDV, garantias e paineis administrativos.

Arquivos alterados:

- `services/companySettingsService.ts`
- `tmp-tests/company-settings-service-vps-only-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migração_VPS.md`

Validacao:

- RED: `node tmp-tests\company-settings-service-vps-only-static.test.mjs` falhou enquanto `companySettingsService` ainda importava Supabase.
- GREEN: `node tmp-tests\company-settings-service-vps-only-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 430`, `.rpc(...) = 29`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tmp-tests\vps-migration-guard-regression.cjs`: `checked=30`, `failed=0`, `mutation_executed=false`.
- `npm.cmd run build`: OK fora do sandbox; a primeira tentativa no sandbox falhou por `Access is denied` do Vite/esbuild ao carregar `vite.config.ts`.

Resultado: tres chamadas `.from('company_settings')` foram removidas do servico central de configuracoes da empresa, reduzindo o baseline do auditor de `433` para `430`.

Pendencias:

- migrar os acessos diretos restantes a `company_settings` em telas/servicos especificos de Bling, Shopee, feedback e utilitarios.

Rollback: restaurar o branch Supabase de `companySettingsService` e voltar temporariamente `MAX_BASELINE_FROM_CALLS` para `433`; nao recomendado porque reintroduz dependencia Supabase em configuracoes centrais.

### 2026-05-30 - Configuracao de frete via VPS

Mudanca: `shippingService` deixou de importar Supabase e de consultar/escrever diretamente `shipping_settings`, `shipping_zones` e `shipping_price_ranges`. As operacoes de settings, zonas e faixas de preco agora usam `vpsApiService`; o Fastify da VPS passou a expor CRUD para `/shipping/price-ranges` e a retornar `price_ranges` de `/shipping/zones` com o contrato atual por `min_km`/`max_km`.

Objetivo: remover o Supabase do caminho operacional de configuracao de frete, mantendo a VPS/MySQL como fonte principal para regras locais de entrega.

Arquivos alterados:

- `services/shippingService.ts`
- `services/vpsApiService.ts`
- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/shipping-service-vps-only-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migração_VPS.md`

Validacao:

- RED: `node tmp-tests\shipping-service-vps-only-static.test.mjs` falhou enquanto `shippingService` ainda importava Supabase.
- GREEN: `node tmp-tests\shipping-service-vps-only-static.test.mjs`: OK.
- `node --check vps_server.js`: OK.
- `node --check vps_server.cjs`: OK.
- `node tmp-tests\vps-shipping-fastify-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 433`, `.rpc(...) = 29`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.
- `node tmp-tests\vps-migration-guard-regression.cjs`: `checked=30`, `failed=0`, `mutation_executed=false`.
- `npm.cmd run build`: OK fora do sandbox; a primeira tentativa no sandbox falhou por `Access is denied` do Vite/esbuild ao carregar `vite.config.ts`.

Resultado: onze chamadas `.from(...)` de frete sairam do inventario operacional Supabase, reduzindo o baseline de `444` para `433`.

Pendencias:

- validar em janela controlada um fluxo administrativo real de criar/editar/remover zona/faixa de frete na VPS;
- manter a validacao real de cotacao Frenet/Melhor Envio e etiqueta Melhor Envio como etapa separada do checklist.

Rollback: restaurar o fallback Supabase de `shippingService` e remover temporariamente as rotas `/shipping/price-ranges`; nao recomendado porque reintroduz Supabase no CRUD de configuracao de frete.

### 2026-05-30 - Modelo em productService.create/update via VPS

Mudanca: `productService.create` e `productService.update` deixaram de consultar `models` diretamente no Supabase para buscar `template_values`, categoria, dimensoes, peso e marca do modelo. A leitura agora usa `modelService.getById()` pela VPS; quando a resposta da VPS nao traz o nome da marca embutido, `brandService.getById()` resolve o nome pela rota atual de marcas na VPS.

Objetivo: remover duas dependencias operacionais Supabase do fluxo central de cadastro/edicao de produtos, mantendo VPS/MySQL como fonte principal para dados de modelo.

Arquivos alterados:

- `services/products.ts`
- `tmp-tests/product-service-model-write-vps-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migração_VPS.md`

Rotas afetadas:

- `GET /models/:id`, via `modelService.getById()`.
- `GET /brands`, via `brandService.getById()` quando a marca nao vem embutida no modelo.
- `POST /products` e `PUT/PATCH /products/:id`, via `vpsApiService`.

Validacao:

- RED: `node tmp-tests\product-service-model-write-vps-static.test.mjs` falhou enquanto `productService.create` ainda lia `supabase.from('models')`.
- GREEN: `node tmp-tests\product-service-model-write-vps-static.test.mjs`: OK.
- `node tmp-tests\product-service-getbyid-model-name-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: OK, `.from(...) = 444`, `.rpc(...) = 29`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.

Resultado: duas leituras diretas Supabase em `models` foram removidas de `services/products.ts`, e o baseline do auditor foi reduzido de `446` para `444`.

Pendencias:

- migrar leituras/escritas restantes de `products`, `models` e `shopee_products` em `blingService`, `dataSyncService`, `ShopeePage`, SEO e banco de imagens;
- avaliar expor `brand_name` diretamente em `GET /models/:id` para evitar a chamada adicional de fallback em telas de alto volume.

Rollback: restaurar as consultas diretas a `supabase.from('models')` em `create`/`update` e voltar temporariamente `MAX_BASELINE_FROM_CALLS` para `446`; nao recomendado porque reintroduz dependencia Supabase no cadastro de produtos.

### 2026-05-29 - Nome do modelo em productService.getById via VPS

Mudanca: `productService.getById` deixou de consultar `models` diretamente no Supabase para preencher o nome do modelo quando o produto vindo da VPS nao possui `model`. A leitura agora usa `modelService.getById()` pela VPS.

Objetivo: remover mais uma dependencia operacional Supabase do servico central de produtos, mantendo a VPS/MySQL como origem para produto e enriquecimento de modelo.

Arquivos alterados:

- `services/products.ts`
- `tmp-tests/product-service-getbyid-model-name-vps-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migracao_VPS.md`

Rotas afetadas:

- `GET /products/:id`, via `vpsApiService.getProductById()`.
- `GET /models/:id`, via `modelService.getById()`.

Validacao:

- `node tmp-tests\product-service-getbyid-model-name-vps-static.test.mjs`: primeiro falhou por falta de `modelService`; depois passou.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: primeiro falhou com baseline `.from=447`; depois passou com `.from=446`.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 446`, `.rpc(...) = 29`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.

Resultado: uma leitura direta Supabase em `models` foi removida de `productService.getById` e o baseline do auditor foi reduzido de `447` para `446`.

Pendencias:

- migrar as leituras restantes de `models` em `services/products.ts` nos fluxos de criacao/atualizacao, `blingService`, `dataSyncService` e utilitarios legados;
- avaliar reaproveitamento de dados de modelo ja retornados pela VPS para reduzir chamadas adicionais em telas de alto volume.

Rollback: restaurar a consulta direta a `supabase.from('models')` no `productService.getById` e voltar temporariamente `MAX_BASELINE_FROM_CALLS` para `447`; nao recomendado como estado final.

### 2026-05-29 - Dimensoes de modelo no frete via VPS

Mudanca: `FreightCalculator` deixou de consultar `models` diretamente no Supabase para carregar `template_values` com peso e dimensoes usadas no calculo de frete. A leitura agora usa `modelService.getById()` pela VPS.

Objetivo: remover mais uma dependencia operacional Supabase do fluxo de frete, mantendo VPS/MySQL como fonte principal de produto, preco e dimensoes herdadas do modelo.

Arquivos alterados:

- `components/shipping/FreightCalculator.tsx`
- `tmp-tests/freight-calculator-model-dimensions-vps-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migracao_VPS.md`

Rotas afetadas:

- `GET /models/:id`, via `modelService.getById()`.

Validacao:

- `node tmp-tests\freight-calculator-model-dimensions-vps-static.test.mjs`: primeiro falhou por falta de `modelService`; depois passou.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: primeiro falhou com baseline `.from=448`; depois passou com `.from=447`.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 447`, `.rpc(...) = 29`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.

Resultado: uma leitura direta Supabase em `models` foi removida do calculador de frete e o baseline do auditor foi reduzido de `448` para `447`.

Pendencias:

- migrar as leituras restantes de `models` em `services/products.ts`, `blingService`, `dataSyncService` e utilitarios legados;
- avaliar otimizacao futura para buscar modelos em lote pela VPS caso o frete carregue muitos produtos.

Rollback: restaurar a consulta direta a `supabase.from('models')` no `FreightCalculator` e voltar temporariamente `MAX_BASELINE_FROM_CALLS` para `448`; nao recomendado como estado final.

### 2026-05-29 - Template do modelo na PDP publica via VPS

Mudanca: `PublicProductPage` deixou de consultar `models` diretamente no Supabase para carregar `template_values`, descricao herdada e marca de fallback. A leitura agora usa `modelService.getById()` pela VPS.

Objetivo: remover mais uma dependencia operacional Supabase da PDP publica e manter a VPS/MySQL como fonte principal de dados de modelo.

Arquivos alterados:

- `pages/store/PublicProductPage.tsx`
- `tmp-tests/pdp-memory-specs-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migracao_VPS.md`

Rotas afetadas:

- `GET /models/:id`, via `modelService.getById()`.

Validacao:

- `node tmp-tests\pdp-memory-specs-static.test.mjs`: primeiro falhou por falta de `modelService`; depois passou.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: primeiro falhou com baseline `.from=449`; depois passou com `.from=448`.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 448`, `.rpc(...) = 29`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.

Resultado: uma leitura direta Supabase em `models` foi removida da PDP publica e o baseline do auditor foi reduzido de `449` para `448`.

Pendencias:

- migrar as leituras restantes de `models` em frete e servicos de produto/Bling/dataSync;
- validar se a resposta VPS de `GET /models/:id` deve expor formalmente `brand`/`brand_name` no tipo `Model`, ou se a marca deve sempre vir do produto.

Rollback: restaurar a consulta direta a `supabase.from('models')` no `PublicProductPage` e voltar temporariamente `MAX_BASELINE_FROM_CALLS` para `449`; nao recomendado como estado final.

### 2026-05-29 - Template do modelo na comparacao via VPS

Mudanca: `CompareModal` deixou de consultar `models` diretamente no Supabase para carregar `template_values` dos produtos comparados. A leitura agora usa `modelService.getById()` pela VPS.

Objetivo: reduzir mais uma dependencia operacional Supabase no catalogo publico/admin e manter a VPS/MySQL como fonte principal de dados de modelo.

Arquivos alterados:

- `components/catalog/CompareModal.tsx`
- `tmp-tests/compare-modal-model-template-vps-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migracao_VPS.md`

Rotas afetadas:

- `GET /models/:id`, via `modelService.getById()`.

Validacao:

- `node tmp-tests\compare-modal-model-template-vps-static.test.mjs`: primeiro falhou por falta de `modelService`; depois passou.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: primeiro falhou com baseline `.from=450`; depois passou com `.from=449`.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 449`, `.rpc(...) = 29`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.

Resultado: uma leitura direta Supabase em `models` foi removida do comparador e o baseline do auditor foi reduzido de `450` para `449`.

Pendencias:

- migrar as leituras restantes de `models` em PDP publica, frete e servicos de produto/Bling;
- avaliar a leitura de `versions` do comparador em bloco separado, porque ainda pertence ao grupo de versionamento temporario.

Rollback: restaurar a consulta direta a `supabase.from('models')` no `CompareModal` e voltar temporariamente `MAX_BASELINE_FROM_CALLS` para `450`; nao recomendado como estado final.

### 2026-05-29 - Template do modelo no detalhe via VPS

Mudanca: `ProductDetailsModal` deixou de consultar `models` diretamente no Supabase para carregar `template_values` e descricao herdada do modelo. A leitura agora usa `modelService.getById()` pela VPS.

Objetivo: reduzir mais uma dependencia operacional Supabase no catalogo publico/admin, mantendo a VPS/MySQL como fonte principal de dados de modelo.

Arquivos alterados:

- `components/catalog/ProductDetailsModal.tsx`
- `tmp-tests/product-details-modal-warranty-vps-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migracao_VPS.md`

Rotas afetadas:

- `GET /models/:id`, via `modelService.getById()`.

Validacao:

- `node tmp-tests\product-details-modal-warranty-vps-static.test.mjs`: primeiro falhou por falta de `modelService`; depois passou.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: primeiro falhou com baseline `.from=451`; depois passou com `.from=450`.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 450`, `.rpc(...) = 29`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.

Resultado: uma leitura direta Supabase em `models` foi removida do modal e o baseline do auditor foi reduzido de `451` para `450`.

Pendencias:

- migrar as leituras restantes de `models` em comparacao, PDP publica, frete e servicos de produto/Bling;
- avaliar a leitura de `versions` do proprio modal em bloco separado, porque ainda pertence ao grupo de versionamento temporario.

Rollback: restaurar a consulta direta a `supabase.from('models')` no `ProductDetailsModal` e voltar temporariamente `MAX_BASELINE_FROM_CALLS` para `451`; nao recomendado como estado final.

### 2026-05-29 - Propagacao de preco medio via VPS

Mudanca: `averagePriceService.updateAveragePrices()` deixou de escrever diretamente em `products` no Supabase para propagar preco medio por variacao. A leitura de produtos da variacao ja era pela VPS; agora a escrita tambem usa `vpsApiService.updateProduct()` para cada produto afetado.

Objetivo: remover mais uma dependencia operacional Supabase do modulo de produto, mantendo a VPS/MySQL como fonte principal de preco/estoque.

Arquivos alterados:

- `services/averagePriceService.ts`
- `tmp-tests/order-average-vps-products-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migracao_VPS.md`

Rotas afetadas:

- `PUT /products/:id`, via `vpsApiService.updateProduct()`.

Validacao:

- `node tmp-tests\order-average-vps-products-static.test.mjs`: primeiro falhou por ainda haver `supabase.from('products')`; depois passou.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 451`, `.rpc(...) = 29`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.

Resultado: a escrita de preco medio saiu do Supabase e o baseline do auditor foi reduzido de `452` para `451`.

Pendencias:

- validar em janela controlada um cadastro de produto novo com variacao para confirmar a propagacao real pela VPS;
- continuar migrando escritas restantes em `products` nos fluxos de planilha, imagem, SEO e Bling.

Rollback: restaurar a escrita direta em `supabase.from('products')` no `averagePriceService` e voltar temporariamente `MAX_BASELINE_FROM_CALLS` para `452`; nao recomendado como estado final.

### 2026-05-29 - Categoria serializada do produto via VPS

Mudanca: `services/products.ts` deixou de consultar `categories` diretamente no Supabase durante `create` e `update` para decidir se uma categoria permite SKUs repetidos por produto serializado. A regra foi centralizada em `isSerializedProductCategory()` e agora usa `categoryService.getById()` pela VPS.

Objetivo: reduzir dependencias operacionais Supabase no servico de produtos sem mudar a regra de negocio de categorias serializadas (`CELULAR`, `SMARTPHONE`, `TABLET`, `RECEPTOR`).

Arquivos alterados:

- `services/products.ts`
- `tmp-tests/product-service-serialized-category-vps-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migracao_VPS.md`

Rotas afetadas:

- nenhuma rota nova; impacto indireto em criacao/atualizacao de produto ao validar conflito de SKU.

Validacao:

- `node tmp-tests\product-service-serialized-category-vps-static.test.mjs`: primeiro falhou por falta de `categoryService`; depois passou.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 452`, `.rpc(...) = 29`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.

Resultado: duas leituras diretas Supabase em `categories` foram removidas de `services/products.ts`, e o baseline do auditor foi reduzido de `454` para `452`.

Pendencias:

- migrar leituras restantes de `models` usadas para enriquecer produto no create/update;
- continuar cortes de `brands`, `categories`, `models` e `products` nos fluxos Bling/produtos.

Rollback: restaurar as consultas diretas a `categories` no servico de produtos e voltar temporariamente `MAX_BASELINE_FROM_CALLS` para `454`; nao recomendado como estado final.

### 2026-05-29 - Garantia do modal de produto via VPS

Mudanca: `ProductDetailsModal` deixou de consultar `brands` e `categories` diretamente no Supabase para resolver dias de garantia por marca ou categoria, usando `brandService.listActive()` e `categoryService.getById()` como fontes VPS.

Objetivo: reduzir dependencias operacionais Supabase no catalogo publico/admin e manter a VPS como fonte principal de taxonomia de produto.

Arquivos alterados:

- `components/catalog/ProductDetailsModal.tsx`
- `tmp-tests/product-details-modal-warranty-vps-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migracao_VPS.md`

Rotas afetadas:

- nenhuma rota nova; impacto no modal de detalhe de produto ao calcular garantia por marca/categoria.

Validacao:

- `node tmp-tests\product-details-modal-warranty-vps-static.test.mjs`: primeiro falhou por falta de `brandService`/`categoryService`; depois passou.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: passou.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 454`, `.rpc(...) = 29`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.

Resultado: duas leituras diretas Supabase foram removidas do modal e o baseline do auditor foi reduzido de `456` para `454`.

Pendencias:

- migrar a garantia por template customizado (`warranty_templates`) para VPS em bloco separado;
- continuar cortes de `brands`, `categories`, `models` e `products` nos servicos de produto/Bling.

Rollback: restaurar as leituras diretas de `brands`/`categories` no modal e voltar temporariamente `MAX_BASELINE_FROM_CALLS` para `456`; nao recomendado como estado final.

### 2026-05-29 - Remocao de automacao externa do projeto

Mudanca: removido do projeto o relay externo do webhook Shopee, os artefatos soltos de bot/fluxo e a view SQL dedicada a esse caminho. Tambem foi adicionado um guard global para impedir retorno dessas referencias no codigo, testes e documentacao ativa.

Objetivo: alinhar o projeto com a regra de manter a migracao concentrada em VPS/Synology e excluir dependencias de automacao externa que nao fazem mais parte do alvo operacional.

Arquivos alterados/removidos:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-shopee-webhook-fastify-static.test.mjs`
- `tmp-tests/vps-shopee-webhook-order-simulation-static.test.mjs`
- `tmp-tests/forbidden-automation-static.test.mjs`
- `supabase/create_ai_catalog_view.sql`
- `whatsapp-ai-bot-guide.md`
- `whatsapp-sales-agent.json`
- `migracao_VPS.md`

Rotas afetadas:

- `POST /api/shopee-webhook`

Validacao:

- RED: `node tmp-tests\forbidden-automation-static.test.mjs` falhou listando as referencias restantes no runtime, testes, SQL, docs e diario.
- GREEN: `node tmp-tests\forbidden-automation-static.test.mjs`: OK.

Resultado: o webhook Shopee continua respondendo `{ "message": "success" }` para evitar retries, mas nao tenta mais buscar URL externa nem encaminhar evento de pedido para ferramenta fora da VPS. Os artefatos soltos foram removidos do repositorio ativo.

Rollback: restaurar o relay externo, os tres artefatos removidos e retirar o guard global; nao recomendado porque contraria a regra atual da migracao.

Proximo passo: seguir removendo dependencias operacionais Supabase por modulo ou migrar o editor legado de catalogo.

### 2026-05-29 - Editor legado de catalogo aposentado

Mudanca: removida a rota `/admin/catalog-editor`, o servico `catalogEditorService.ts` e o componente `BannerEditor.tsx`, que mantinham fluxo draft/publicacao direto em `catalog_banners` e `catalog_settings` no Supabase. O atalho em Configuracoes do Catalogo agora abre `/admin/settings/banners`, que usa o fluxo atual de banners pela VPS.

Objetivo: eliminar o caminho legado em vez de criar contrato novo de draft/publicacao, reduzindo dependencias operacionais Supabase e evitando divergencia entre Supabase e MySQL/VPS.

Arquivos alterados:

- `routes/index.tsx`
- `pages/admin/settings/CatalogSettingsPage.tsx`
- `services/catalogEditorService.ts`
- `pages/admin/catalog-editor.tsx`
- `components/admin/BannerEditor.tsx`
- `tmp-tests/catalog-editor-legacy-retirement-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migração_VPS.md`

Validacao:

- RED: `node tmp-tests\catalog-editor-legacy-retirement-static.test.mjs` falhou enquanto o servico legado ainda existia.
- RED: `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs` falhou ao baixar o baseline `.from` para `456` antes do auditor ser ajustado.
- GREEN: `node tmp-tests\catalog-editor-legacy-retirement-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: OK, `.from=456`, `.rpc=29`, `storage=13`, `unclassifiedOperationalMatches=0`.
- `rg -n "catalog-editor|catalogEditorService|BannerEditor" routes pages components services -S`: OK, sem ocorrencias ativas.
- `npm.cmd run build`: OK fora do sandbox; a primeira tentativa dentro do sandbox falhou por bloqueio de leitura do `vite.config.ts`.

Resultado: o editor legado saiu do bundle ativo, o botao de edicao do catalogo agora aponta para a gestao de banners atual e o baseline operacional Supabase ficou 22 chamadas `.from(...)` menor.

Rollback: restaurar a rota, o servico e o componente removidos; nao recomendado porque reintroduz escrita/leitura direta de draft/publicacao no Supabase.

### 2026-05-29 - CRUD de banners sem fallback Supabase

Mudanca: `bannerService.ts` deixou de manter fallback direto em `catalog_banners` e passou a usar somente a VPS para listar, buscar por ID, criar, atualizar, duplicar, excluir, reordenar e registrar telemetria de banners.

Objetivo: continuar a reducao de dependencias Supabase no modulo de banners e corrigir o contrato da VPS antes de remover o fallback, garantindo que o backend responda o mesmo formato esperado pelo frontend.

Arquivos alterados:

- `services/bannerService.ts`
- `vps_server.js`
- `vps_server.cjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/banner-vps-crud-contract-static.test.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migracao_VPS.md`

Rotas afetadas:

- `GET /banners`
- `GET /banners/:id`
- `POST /banners`
- `PATCH /banners/:id`
- `DELETE /banners/:id`

Validacao:

- RED: `node tmp-tests\banner-vps-crud-contract-static.test.mjs` falhou enquanto a VPS nao expunha `GET /banners/:id` e ainda fazia PATCH destrutivo em campos ausentes.
- RED: `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs` falhou ao baixar o alvo `.from` para `478` antes do auditor ser ajustado.
- GREEN: `node tmp-tests\banner-vps-crud-contract-static.test.mjs`: OK.
- `node tmp-tests\banner-telemetry-vps-only-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: OK, `.from=478`, `.rpc=29`, `storage=13`, `unclassifiedOperationalMatches=0`; `catalog_banners` caiu de `18` para `12` ocorrencias.
- `node --check vps_server.js`: OK.
- `node --check vps_server.cjs`: OK.

Resultado: a API de banners da VPS agora tem leitura por ID, retorna a linha salva em `POST`/`PATCH`, normaliza contadores `clicks_count`/`views_count`, e `PATCH /banners/:id` passou a ser parcial para nao apagar `title`, `image_url`, `active` ou datas quando o frontend envia apenas `display_order`. Nenhuma chamada real de escrita foi executada durante a mudanca.

Rollback: restaurar os fallbacks Supabase em `bannerService.ts`, remover `GET /banners/:id`/PATCH parcial da VPS e voltar temporariamente o baseline `.from` para `484`; nao recomendado porque reintroduz risco de divergencia entre Supabase e MySQL.

Proximo passo: continuar removendo dependencias operacionais Supabase por modulo.

### 2026-05-29 - Banner telemetry e reordenacao somente pela VPS

Mudanca: removido o fallback Supabase RPC da telemetria de banners (`click`/`view`), migrada a reordenacao `display_order` para `PATCH /banners/:id` na VPS e fixado o auditor Supabase nos novos baselines reduzidos.

Objetivo: continuar a reducao de dependencias Supabase ja que `USE_VPS.banners=true` e os endpoints da VPS `/banners/:id/click`, `/banners/:id/view` e `PATCH /banners/:id` ja existem no Fastify.

Arquivos alterados:

- `services/bannerService.ts`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/banner-telemetry-vps-only-static.test.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migracao_VPS.md`

Rotas afetadas:

- `POST /banners/:id/click`
- `POST /banners/:id/view`
- `PATCH /banners/:id`

Validacao:

- RED: `node tmp-tests\banner-telemetry-vps-only-static.test.mjs` falhou enquanto `services/bannerService.ts` ainda continha `increment_banner_clicks`/`increment_banner_views`.
- RED: `node tmp-tests\banner-telemetry-vps-only-static.test.mjs` falhou enquanto `reorderBanners` ainda escrevia em `supabase.from('catalog_banners')`.
- RED: `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs` falhou ao baixar o alvo `.from` para `484` antes do auditor ser ajustado.
- GREEN: `node tmp-tests\banner-telemetry-vps-only-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: OK, `.from=484`, `.rpc=29`, `storage=13`, `unclassifiedOperationalMatches=0`.
- `npm.cmd run build`: OK fora do sandbox; a primeira tentativa dentro do sandbox falhou por bloqueio de leitura do `vite.config.ts`.

Resultado: a telemetria publica e a reordenacao de banners passam a usar somente VPS, e o baseline do auditor impede retorno dos dois RPCs Supabase removidos ou crescimento do `.from(...)`. Nenhuma chamada real de clique/view/reordenacao foi executada durante a mudanca.

Pendencias:

- O editor legado de catalogo ainda usa `catalog_banners` direto no Supabase e deve virar pacote separado, porque exige confirmar todos os contratos de publicacao/CRUD no backend VPS.

Rollback: restaurar o fallback RPC/reorder Supabase em `bannerService.ts`, recolocar `increment_banner_clicks`/`increment_banner_views` na allowlist, subir o baseline RPC para `31` e o `.from` para `485`; nao recomendado salvo falha confirmada nos endpoints VPS de banner.

Proximo passo: migrar publicacao/CRUD restante de banners para endpoints VPS ou continuar reduzindo Supabase em outro modulo pequeno.

### 2026-05-29 - Rodada tecnica do checklist sem paineis externos

Mudanca: reexecutada a parte tecnica segura do checklist de corte Vercel/VPS, sem abrir paineis externos e sem executar payloads reais ou escritas.

Objetivo: continuar o checklist da migracao pela trilha automatizada/read-only, confirmando que os guardas continuam bloqueando mutacoes por padrao, que nao ha retorno de artefatos Vercel versionados e que producao publica segue respondendo pela VPS.

Arquivos/infra alterados:

- `migracao_VPS.md`

Validacao:

- `node tmp-tests\vps-migration-guard-regression.cjs`: OK, `checked=30`, `failed=0`, `mutation_executed=false`.
- `node tmp-tests\legacy-deploy-removal-static.test.mjs`: OK.
- `node tmp-tests\legacy-deploy-removal-readiness-static.test.mjs`: OK.
- `node tools\audit-legacy-deploy-removal-readiness.mjs`: `ready_to_remove_legacy_deploy=true`, `blockers=[]`, `legacy_config_present=false`, `legacy_api_files_count=0`, `legacy_crons_disabled=true`, `cors_allows_legacy_fallback=false`, `legacy_cron_user_agent_allowed=false`; DNS retornou `dns_timeout` no sandbox local.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: OK, `.from=485`, `.rpc=31`, `storage=13`, `unclassifiedOperationalMatches=0`.
- Busca textual por `vercel`, `@vercel`, `pages/api`, host legado e comandos `npx vercel` fora de `node_modules`, `dist` e deste diario: sem ocorrencias operacionais.
- `VPS_EXTERNAL_CUTOVER_LIVE=true node tmp-tests\vps-external-cutover-read-only-check.cjs`: OK; Bling webhook `200`, Mercado Pago webhook `200`, Shopee webhook GET `405`, Bling callback sem code `302`, Shopee callback sem parametros `400`.
- `SEO_PRODUCTION_HOST_LIVE=true node tmp-tests\vps-seo-production-host-check.cjs`: OK; apex redireciona `301` para `www`, sitemap `200` com `1843` URLs e `1840` URLs de produto, produtos amostrados com canonical `www`, `og:type=product` e `2` JSON-LD.
- `OAUTH_PREFLIGHT_LIVE=true node tmp-tests\vps-oauth-preflight-check.cjs`: OK; Bling callback sem code `302`, exchange Bling sem credenciais `400`, Shopee callback sem parametros `400`, URL de autorizacao Shopee com `auth_host=partner.shopeemobile.com` e `redirect_host=www.mercadodovale.com.br`.

Resultado: a trilha tecnica do checklist continua verde e nao-mutante. O dominio publico responde pela Cloudflare + VPS nos endpoints seguros testados, o SEO publico segue consistente e a auditoria do repositorio nao encontrou retorno de dependencia operacional da Vercel. Nenhum recurso foi criado ou alterado na Vercel, Supabase, Bling, Shopee, Mercado Pago, VPS, Nginx, PM2 ou DNS.

Pendencias:

- paineis Bling/Shopee/Mercado Pago ainda precisam ser conferidos por sessao autenticada, sem salvar alteracoes;
- escritas Bling/Shopee/shipping, payloads reais/simulados de webhooks e reconexao OAuth real continuam restritos a janela controlada com alvo e confirmacao explicitos.

Rollback: remover esta entrada do diario; nao houve mudanca de runtime ou infraestrutura.

Proximo passo: escolher uma janela controlada e um alvo explicito para o proximo item mutante do checklist, ou continuar reduzindo dependencias Supabase por modulo em pacote separado.

### 2026-05-29 - Revalidacao read-only das rotas externas finais

Mudanca: reexecutados os guards de remocao do deploy legado e a sonda HTTP read-only das rotas externas que precisam estar fora da Vercel.

Objetivo: continuar a retirada da Vercel confirmando que o codigo versionado continua sem runtime/rotas serverless legadas e que as URLs finais da VPS respondem com contratos seguros antes da conferencia visual nos paineis oficiais.

Arquivos/infra alterados:

- `migracao_VPS.md`

Rotas afetadas:

- `GET /api/bling-webhook`
- `GET /api/mercadopago-webhook`
- `GET /api/shopee-webhook`
- `GET /api/auth/callback/bling`
- `GET /api/shopee?action=callback`

Validacao:

- `node tmp-tests\legacy-deploy-removal-static.test.mjs`: OK.
- `node tmp-tests\legacy-deploy-removal-readiness-static.test.mjs`: OK.
- `node tmp-tests\vps-external-cutover-read-only-check-static.test.mjs`: OK.
- `node tmp-tests\vps-migration-guard-regression-static.test.mjs`: OK.
- `node tools\audit-legacy-deploy-removal-readiness.mjs`: `ready_to_remove_legacy_deploy=true`, `blockers=[]`, `legacy_config_present=false`, `legacy_api_files_count=0`; DNS retornou `dns_timeout` no sandbox local.
- `node tmp-tests\vps-external-cutover-read-only-check.cjs`: OK em modo guard, `route_probe_sent=false`.
- `node tmp-tests\vps-migration-guard-regression.cjs`: OK, `checked=30`, `failed=0`, `mutation_executed=false`.
- `VPS_EXTERNAL_CUTOVER_LIVE=true node tmp-tests\vps-external-cutover-read-only-check.cjs`: OK fora do sandbox; Bling webhook `200`, Mercado Pago webhook `200`, Shopee webhook GET `405`, Bling callback sem code `302`, Shopee callback sem parametros `400`.

Resultado: as rotas externas finais responderam pela producao publica Cloudflare + VPS com os status esperados e nenhum payload real foi enviado. O repositorio continua sem `vercel.json`, sem `pages/api`, sem runtime `@vercel/node`, sem fallback CORS para host Vercel legado e sem autorizacao por `vercel-cron/1.0`.

Pendencias:

- conferir visualmente, em modo somente leitura, os paineis Bling, Shopee e Mercado Pago contra as URLs finais da VPS;
- executar reconexao OAuth real e payloads reais/simulados apenas em janela controlada com confirmacao explicita.

Rollback: remover esta entrada do diario; nao houve mudanca de runtime, DNS, Vercel, Supabase, VPS, Nginx ou PM2.

Proximo passo: conferir os paineis oficiais somente com sessao/autorizacao explicita; enquanto isso, seguir pela trilha tecnica read-only ou por reducao de dependencias Supabase por modulo.

### 2026-05-29 - Trava read-only para paineis externos

Mudanca: o auditor `tools/audit-legacy-deploy-removal-readiness.mjs` passou a listar a conferencia manual/read-only dos paineis Bling, Shopee e Mercado Pago com as URLs finais da VPS.

Objetivo: continuar o checklist de retirada da Vercel sem criar nem alterar recursos na Vercel, Supabase ou provedores externos, deixando explicito o que precisa ser visto nos paineis antes do corte final.

Arquivos alterados:

- `tools/audit-legacy-deploy-removal-readiness.mjs`
- `tmp-tests/legacy-deploy-removal-readiness-static.test.mjs`
- `migracao_VPS.md`

URLs esperadas:

- Bling OAuth: `https://www.mercadodovale.com.br/api/auth/callback/bling`
- Bling webhook: `https://www.mercadodovale.com.br/api/bling-webhook`
- Shopee OAuth: `https://www.mercadodovale.com.br/api/shopee?action=callback`
- Shopee webhook: `https://www.mercadodovale.com.br/api/shopee-webhook`
- Mercado Pago webhook: `https://www.mercadodovale.com.br/api/mercadopago-webhook`

Validacao:

- `node tmp-tests\legacy-deploy-removal-readiness-static.test.mjs`
- `node tools\audit-legacy-deploy-removal-readiness.mjs`

Resultado: o checklist agora separa o que ja foi validado por rota publica da VPS do que so pode ser confirmado no painel oficial. Nenhum recurso externo foi criado, salvo ou alterado.

Pendencias:

- abrir Bling, Shopee e Mercado Pago em modo somente leitura e comparar os campos do painel com as URLs esperadas;
- reconectar OAuth real e testar payloads reais/simulados somente em janela controlada com confirmacao explicita.

Rollback: remover a secao `external_panel_confirmation` do auditor e esta entrada do diario; nao ha mudanca de runtime.

Proximo passo: conferencia visual dos paineis externos, sem salvar alteracoes, ou janela controlada para OAuth real se os paineis ja estiverem corretos.

### 2026-05-29 - Remocao dos handlers Next/Vercel restantes

Mudanca: removidos os handlers legados em `pages/api`, que pertenciam ao modelo Next/Vercel e nao eram referenciados pelo app Vite/Fastify.

Objetivo: continuar a limpeza de Vercel no codigo versionado, evitando que rotas serverless antigas voltem a parecer parte do caminho operacional.

Arquivos alterados:

- `pages/api/ai/generate-seo.ts`
- `pages/api/patch.ts`
- `tmp-tests/legacy-deploy-removal-static.test.mjs`
- `migracao_VPS.md`

Validacao:

- `node tmp-tests\legacy-deploy-removal-static.test.mjs`
- `node tmp-tests\legacy-deploy-removal-readiness-static.test.mjs`
- `node tools\audit-legacy-deploy-removal-readiness.mjs`
- `npm.cmd run build`

Resultado: o guard de remocao do deploy legado agora tambem falha se `pages/api` voltar a existir. As rotas removidas nao tinham chamadas internas encontradas por busca textual e a geracao SEO operacional segue pelo backend VPS/Fastify. O auditor retornou `ready_to_remove_legacy_deploy=true`, `blockers=[]`, `legacy_config_present=false`, `legacy_api_files_count=0`, `legacy_crons_disabled=true`, `cors_allows_legacy_fallback=false` e `legacy_cron_user_agent_allowed=false`; DNS retornou `dns_timeout` no ambiente local. O build Vite passou apos reparar dependencias opcionais do Rollup com `npm.cmd install`.

Pendencias:

- conferencia visual read-only dos paineis externos antes de salvar/trocar qualquer callback.

Rollback: restaurar os dois arquivos removidos e retirar a assercao de `pages/api` do teste; nao recomendado porque reintroduz artefato de runtime Next/Vercel.

Proximo passo: conferencia visual read-only dos paineis Bling, Shopee e Mercado Pago contra as URLs finais da VPS.

### 2026-05-29 - Limpeza da referencia Next/Vercel no TypeScript

Mudanca: removida do `tsconfig.json` a referencia morta a `pages/api/ai/generate-seo.ts`, arquivo ja removido na limpeza dos handlers Next/Vercel.

Objetivo: evitar que o projeto mantenha no TypeScript qualquer trilha operacional ou documental de rotas `pages/api` apos a retirada do runtime Next/Vercel.

Arquivos alterados:

- `tsconfig.json`
- `tmp-tests/legacy-deploy-removal-static.test.mjs`
- `migracao_VPS.md`

Validacao:

- `node tmp-tests\legacy-deploy-removal-static.test.mjs`
- `npm.cmd run build`

Resultado: o guard de remocao do deploy legado agora tambem falha se `tsconfig.json` voltar a referenciar `pages/api`. O build Vite passou; a primeira tentativa no sandbox falhou por bloqueio de acesso do esbuild ao carregar `vite.config.ts`, e a repeticao autorizada fora do sandbox concluiu com sucesso. Nenhum recurso externo foi criado ou alterado.

Pendencias:

- conferencia visual read-only dos paineis Bling, Shopee e Mercado Pago contra as URLs finais da VPS.

Rollback: recolocar a entrada removida no `tsconfig.json` e retirar a assercao do teste; nao recomendado porque reintroduz referencia a um handler Next/Vercel inexistente.

Proximo passo: conferencia visual read-only dos paineis Bling, Shopee e Mercado Pago contra as URLs finais da VPS.

### 2026-05-29 - Limpeza operacional de referencias Vercel no app

Mudanca: atualizados textos/comentarios de fluxo atual que ainda mencionavam Vercel em telas, servicos e testes, e modernizado o teste NCM para validar a rota Fastify da VPS em vez de `vercel.json`/`api`.

Objetivo: continuar o checklist de retirada da Vercel sem criar nem alterar recursos na Vercel ou Supabase, mantendo o repositorio e o painel alinhados com o caminho VPS-first.

Arquivos alterados:

- `components/products/ProductCard.tsx`
- `components/products/sections/ShopeeLinkSection.tsx`
- `pages/admin/settings/BlingPage.tsx`
- `pages/admin/settings/RoadmapPage.tsx`
- `pages/admin/settings/ShopeePage.tsx`
- `pages/admin/settings/TelegramPage.tsx`
- `pages/admin/settings/components/ShopeePrintersTab.tsx`
- `routes/index.tsx`
- `scripts/shopee-auto-print.cjs`
- `services/shopeeAuthUrlService.test.mjs`
- `services/shopeeService.ts`
- `services/vpsClient.ts`
- `tmp-tests/brand-service-vps-source.test.mjs`
- `tmp-tests/ncm-brasilapi-proxy-regression.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests\legacy-deploy-removal-static.test.mjs`: OK.
- `node tmp-tests\ncm-brasilapi-proxy-regression.test.mjs`: OK.
- `node services\shopeeAuthUrlService.test.mjs`: OK.
- `node tmp-tests\brand-service-vps-source.test.mjs`: OK.
- `node tools\audit-legacy-deploy-removal-readiness.mjs`: `ready_to_remove_legacy_deploy=true`, `blockers=[]`; DNS retornou `dns_timeout` dentro do sandbox.
- `npm.cmd run build`: OK fora do sandbox; apenas avisos existentes de chunk/import dinamico.
- `curl -I https://www.mercadodovale.com.br/`: `200 OK`, `Server: cloudflare`.
- `curl -I https://www.mercadodovale.com.br/sitemap.xml`: `200 OK`, `application/xml`, `Content-Length: 441156`.
- `curl -i "https://www.mercadodovale.com.br/api/vps-proxy?path=/status"`: `200 OK`, JSON com `mysql.ok=true`, `products.active=2466`.

Resultado: o codigo versionado permanece sem `vercel.json`, sem diretorio `api`, sem runtime `@vercel/node`, sem fallback CORS para host legado e sem autorizacao por `vercel-cron/1.0`. A producao publica respondeu pelo caminho Cloudflare + VPS nos endpoints essenciais testados. Nenhum recurso foi criado ou alterado na Vercel ou Supabase.

Pendencias:

- conferir nos paineis externos os callbacks OAuth e webhooks de Bling, Shopee e Mercado Pago;
- manter validacoes com escrita real apenas em janela controlada e explicitamente aprovada.

Rollback: restaurar os arquivos alterados neste pacote e executar novo build/deploy VPS do frontend, se algum texto/fluxo precisar voltar temporariamente.

### 2026-05-29 - Guard read-only para rotas externas do corte Vercel

Mudanca: criado o verificador `tmp-tests/vps-external-cutover-read-only-check.cjs` e conectado ao guard principal `tmp-tests/vps-migration-guard-regression.cjs`.

Objetivo: transformar os curls soltos de callbacks/webhooks em uma validacao repetivel do checklist de remocao da Vercel, sem enviar payload real e sem alterar Bling, Shopee, Mercado Pago, Vercel ou Supabase.

Arquivos alterados:

- `tmp-tests/vps-external-cutover-read-only-check.cjs`
- `tmp-tests/vps-external-cutover-read-only-check-static.test.mjs`
- `tmp-tests/vps-migration-guard-regression.cjs`
- `tmp-tests/vps-migration-guard-regression-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests\vps-external-cutover-read-only-check-static.test.mjs`: OK.
- `node tmp-tests\vps-external-cutover-read-only-check.cjs`: OK, `route_probe_sent=false` sem flag live.
- `VPS_EXTERNAL_CUTOVER_LIVE=true node tmp-tests\vps-external-cutover-read-only-check.cjs`: OK; Bling webhook `200`, Mercado Pago webhook `200`, Shopee webhook GET `405`, Bling callback sem code `302`, Shopee callback sem parametros `400`.
- `node tmp-tests\vps-migration-guard-regression-static.test.mjs`: OK.
- `node tmp-tests\vps-migration-guard-regression.cjs`: `ok=true`, `checked=30`, `failed=0`, `mutation_executed=false`.

Resultado: o checklist agora possui uma prova versionada para as rotas externas que precisam sair da Vercel. A parte ainda pendente continua sendo conferir nos paineis oficiais se os webhooks/callbacks cadastrados apontam para `www.mercadodovale.com.br` ou `api.xiaomipetrolina.com.br`, porque isso depende de acesso aos paineis externos.

Rollback: remover os dois novos testes e retirar suas entradas do guard principal.

### 2026-05-27 - Filtros nativos no Bling financeiro da VPS

Mudança: ajustado o recurso `/api/bling?resource=finance` da VPS para encaminhar filtros de listagem com os nomes nativos da API Bling: `dataVencimentoInicial`, `dataVencimentoFinal` e `situacao`.

Objetivo: corrigir erro `404` ao buscar contas financeiras do Bling com intervalo de vencimento, mantendo o frontend chamando o proxy local com `dataVencimentoInicio/Fim`.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-finance-fastify-static.test.mjs`
- `migração_VPS.md`

Rotas afetadas:

- `/api/bling?resource=finance&resourceType=pagar&action=list`
- `/api/bling?resource=finance&resourceType=receber&action=list`

Validação:

- RED esperado: `node tmp-tests\vps-bling-finance-fastify-static.test.mjs` falhou antes da correção exigindo `dataVencimentoInicial`.
- `node tmp-tests\vps-bling-finance-fastify-static.test.mjs`: OK.
- `node tmp-tests\bling-finance-service-url-static.test.mjs`: OK.
- `node tmp-tests\bling-finance-copy-debug-static.test.mjs`: OK.
- `node --check vps_server.js`: OK.
- `node --check vps_server.cjs`: OK.

Resultado: a API da VPS volta a montar URLs compatíveis com a listagem de contas do Bling v3. A publicação em produção deve reiniciar `mdv-api` após o commit.

### 2026-05-27 - Reconcile Bling preserva nomes de produtos apenas vinculados

Mudanca: removido do `reconcile` da VPS o planejamento e a aplicacao de alteracoes em `products.name` vindas do Bling. O plano continua reportando `nameChanges`, mas agora como lista vazia por padrao, e a aplicacao real atualiza somente estoque/fluxos permitidos.

Objetivo: corrigir o comportamento em que produtos locais apenas vinculados por `bling_id` herdavam o nome do Bling sem terem sido importados explicitamente.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-reconcile-fastify-static.test.mjs`
- `tmp-tests/vps-bling-reconcile-preserve-linked-name-static.test.mjs`
- `bling.md`
- `migração_VPS.md`

Rotas afetadas:

- `/api/bling?resource=reconcile`

Validacao:

- RED esperado: `node tmp-tests\vps-bling-reconcile-preserve-linked-name-static.test.mjs` falhou antes da correcao porque `buildBlingReconcilePlanVps` ainda continha `nameChanges.push`.
- `node tmp-tests\vps-bling-reconcile-preserve-linked-name-static.test.mjs`: OK.
- `node tmp-tests\vps-bling-reconcile-fastify-static.test.mjs`: OK.
- `node tmp-tests\vps-bling-reconcile-dry-run-details-static.test.mjs`: OK.
- `node tmp-tests\vps-bling-reconcile-apply-guarded-static.test.mjs`: OK.
- `node tmp-tests\vps-bling-reconcile-apply-guarded-preflight.test.mjs`: OK.
- `node --check vps_server.js`: OK.
- `node --check vps_server.cjs`: OK.
- `node tmp-tests\vps-migration-guard-regression.cjs`: `ok=true`, `checked=28`, `failed=0`, `mutation_executed=false`.

Resultado: o reconcile nao herda mais nomes do Bling para produtos apenas vinculados. Estoque continua protegido pelo fluxo existente e os guards de mutacao permanecem bloqueados por padrao.

Commit: `b4ecbb1` (`fix(bling): stop reconcile name inheritance`), enviado para `origin/main`.

Deploy/pos-deploy:

- `node tmp-tests\autoresponder-vps-server-deploy.cjs`: `ok=true`; API publicada em `/var/www/mdv-api`, PM2 `mdv-api` reiniciado e backups remotos criados com sufixo `20260527183707`.
- `curl https://www.mercadodovale.com.br/api/status`: `200 OK`, MySQL `ok=true`, produtos `2464`, ativos `2453`.
- `curl https://www.mercadodovale.com.br/api/vps-proxy?path=%2Fstatus`: `200 OK`, MySQL `ok=true`.
- `node tmp-tests\vps-bling-reconcile-dry-run-check.cjs`: `ok=true`, `dryRun=true`, `planned.stockChanges=19`, `planned.nameChanges=0`, `mutation_executed` ausente/nenhuma aplicacao real.

Resultado pos-deploy: a API publica segue saudavel e o dry-run real do reconcile na VPS confirmou que nao ha mais planejamento de renomeacao pelo Bling.

Pendencias:

- produtos ja renomeados por apply anterior precisam de correcao pontual/manual ou script controlado separado, se desejado.

Rollback: restaurar commit anterior ou backup remoto da API VPS e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-27 - Revalidacao segura do checklist VPS antes de novas janelas controladas

Mudanca: reexecutada a bateria segura do checklist VPS, sem executar OAuth real, webhooks reais, escrita comercial, deploy, restart de servico ou alteracao de infraestrutura.

Objetivo: garantir que os guards continuam bloqueando mutacoes por padrao e que producao/staging seguem saudaveis antes de qualquer proxima janela controlada de Bling, Shopee, shipping, OAuth ou webhooks.

Arquivos/infra alterados:

- `migração_VPS.md`

Rotas/servicos afetados:

- `/`
- `/admin/products`
- `/api/vps-proxy?path=/status`
- `/api/vps-proxy?path=/products&limit=1`
- `/api/vps-proxy?path=/company-settings`
- `/sitemap.xml`
- `/produto/:slug`

Validacao:

- `git status --short --branch`: `## main...origin/main` antes da rodada.
- `node tmp-tests\vps-migration-guard-regression.cjs`: `ok=true`, `checked=28`, `failed=0`, `mutation_executed=false`.
- `node tmp-tests\vps-nginx-production-config-static.test.mjs`: OK.
- `node tmp-tests\vps-nginx-staging-config-static.test.mjs`: OK.
- `node tmp-tests\legacy-deploy-removal-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 491`, `.rpc(...) = 31`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.
- `node tools\audit-legacy-deploy-removal-readiness.mjs`: `ready_to_remove_legacy_deploy=true`, `legacy_config_present=false`, `legacy_api_files_count=0`, `legacy_crons_disabled=true`, `cors_allows_legacy_fallback=false`, `legacy_cron_user_agent_allowed=false`, `blockers=[]`; DNS retornou `dns_timeout` no sandbox local.
- `SEO_PRODUCTION_HOST_LIVE=true SEO_PRODUCTION_HOST=www.mercadodovale.com.br node tmp-tests\vps-seo-production-host-check.cjs`: primeira tentativa bloqueada pelo sandbox com `connect EACCES 76.13.232.162:80`; repetida fora do sandbox e retornou `ok=true`, sitemap `200`, `1836` URLs, `1833` produtos e 3 PDPs SEO `200`.
- `STAGING_FRONTEND_PROXY_LIVE=true node tmp-tests\vps-staging-frontend-proxy-check.cjs`: primeira tentativa bloqueada pelo sandbox com `connect EACCES 76.13.232.162:80`; repetida fora do sandbox e retornou `ok=true`, raiz `200`, `/admin/products` `200`, status/produtos via proxy `200`, `/company-settings` sem sessao `403`.
- `npm.cmd run build`: primeira tentativa bloqueada pelo sandbox ao resolver `vite.config.ts`; repetida fora do sandbox e concluida com sucesso em `10.06s`, com avisos Vite conhecidos de chunk/import dinamico.

Resultado: os caminhos seguros de producao e staging continuam respondendo pela VPS, a auditoria nao encontrou retorno de dependencia versionada da Vercel, o inventario Supabase segue dentro do baseline classificado e os guards confirmaram que nenhuma mutacao foi executada por padrao.

Pendencias:

- executar escritas Bling/Shopee/shipping somente com alvo controlado e confirmacao explicita;
- validar payloads reais/simulados de webhooks em janela controlada antes de trocar callbacks definitivos;
- reconectar Bling e Shopee por OAuth real com codigo valido pela VPS;
- seguir reduzindo dependencias operacionais Supabase por modulo, preferindo VPS/MySQL.

Rollback: nao aplicavel; rodada apenas read-only e documentacao.

### 2026-05-27 - Validacao admin autenticada e Status VPS no browser

Mudanca: validada sessao admin real pelo Chrome DevTools no dominio publico da VPS, sem digitar credenciais e sem executar acoes de escrita.

Objetivo: fechar a pendencia de login/admin real no navegador para leitura, confirmando que o app admin publicado pela VPS abre autenticado e que uma pagina administrativa read-only consegue consultar a API/proxy da VPS.

Arquivos/infra alterados:

- `migração_VPS.md`

Rotas afetadas:

- `/admin`
- `/admin/products`
- `/admin/settings/vps-status`
- `/api/vps-proxy?path=/synology/status`
- `/api/vps-proxy?path=/synology/command-status`

Validacao:

- `git status --short --branch`: `## main...origin/main` antes da rodada.
- `node tmp-tests\vps-migration-guard-regression.cjs`: `ok=true`, `checked=28`, `failed=0`, `mutation_executed=false`.
- `node tmp-tests\vps-nginx-production-config-static.test.mjs`: OK.
- `node tmp-tests\vps-nginx-staging-config-static.test.mjs`: OK.
- Chrome DevTools em `https://www.mercadodovale.com.br/admin`: dashboard carregou autenticado com usuario `Handielson Amorim` e painel `ADMIN`.
- Chrome DevTools em `https://www.mercadodovale.com.br/admin/products`: titulo `Mercado do Vale - Produtos`, pagina autenticada carregou cabecalho `Produtos`, filtros, marcas/categorias e acoes administrativas visiveis; nenhuma acao foi clicada.
- Chrome DevTools em `https://www.mercadodovale.com.br/admin/settings/vps-status`: `Status da VPS` carregou `API online`, `MySQL OK`, produtos `2464`, ativos `2453`, imagens `9496`, disco VPS `18.5 GB / 95.8 GB`.
- Console DevTools: sem mensagens `error` ou `warn`.
- Network DevTools em `Status VPS`: `GET https://api.xiaomipetrolina.com.br/status` `200`, `GET https://www.mercadodovale.com.br/api/vps-proxy?path=%2Fsynology%2Fstatus` `200`, `GET https://www.mercadodovale.com.br/api/vps-proxy?path=%2Fsynology%2Fcommand-status` `200`.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 491`, `.rpc(...) = 31`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tmp-tests\legacy-deploy-removal-static.test.mjs`: OK.

Resultado: login/admin real no dominio publico ficou validado para leitura. A VPS serve o admin autenticado, `/admin/products` abre com dados/filtros, `Status VPS` confirma API/MySQL/Synology via proxy e nao houve erro de console. Nenhuma credencial foi impressa, nenhuma escrita foi executada e nada foi criado ou alterado na Vercel, Supabase, VPS, Nginx, PM2 ou DNS. O Network ainda mostra leituras Supabase temporarias esperadas pelo inventario atual, classificadas pelo guard operacional.

Pendencias:

- se necessario, executar uma escrita administrativa pequena e reversivel somente em janela controlada;
- seguir reduzindo leituras operacionais Supabase detectadas no admin por modulo, preferindo VPS/MySQL;
- manter OAuth real, webhooks reais/simulados e escritas Bling/Shopee/shipping para confirmacao explicita.

Rollback: nao aplicavel; rodada apenas read-only e documentacao.

### 2026-05-27 - Tentativa read-only de validacao admin no browser publico

Mudanca: reexecutada a validacao de navegador no dominio publico da VPS para `/admin/products`, sem inserir credenciais e sem executar acao administrativa.

Objetivo: avancar a pendencia de validacao browser/admin real dentro do limite seguro permitido pelas regras atuais, confirmando o comportamento do gate de login quando nao ha sessao admin disponivel no navegador do agente.

Arquivos/infra alterados:

- `migração_VPS.md`

Rotas afetadas:

- `/admin/products`
- `/admin/login`
- `/api/vps-proxy` no staging
- `/sitemap.xml`
- `/produto/:slug`

Validacao:

- `git status --short --branch`: `## main...origin/main` antes da rodada.
- `node tmp-tests\vps-migration-guard-regression.cjs`: `ok=true`, `checked=28`, `failed=0`, `mutation_executed=false`.
- `node tmp-tests\vps-nginx-production-config-static.test.mjs`: OK.
- `node tmp-tests\vps-nginx-staging-config-static.test.mjs`: OK.
- Browser via `agent-browser` em `https://www.mercadodovale.com.br/admin/products`: URL final `https://www.mercadodovale.com.br/admin/login`, titulo `Mercado do Vale - Sistema de Gestao`.
- Leitura textual da pagina: exibiu `Área Administrativa`, `Acesso restrito a administradores`, campos de e-mail/senha e botao `Acessar Painel Admin`.
- `agent-browser errors`: sem erros de pagina reportados.
- `SEO_PRODUCTION_HOST_LIVE=true SEO_PRODUCTION_HOST=www.mercadodovale.com.br node tmp-tests\vps-seo-production-host-check.cjs`: `ok=true`, sitemap `200`, `1836` URLs, `1833` produtos, 3 PDPs SEO `200`.
- `STAGING_FRONTEND_PROXY_LIVE=true node tmp-tests\vps-staging-frontend-proxy-check.cjs`: `ok=true`, raiz/admin `200`, status/produtos `200`, `/company-settings` sem sessao `403`.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 491`, `.rpc(...) = 31`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.
- `node tmp-tests\legacy-deploy-removal-static.test.mjs`: OK.

Resultado: a producao publica continua servindo o app admin pela VPS e protege `/admin/products` redirecionando para `/admin/login` quando nao existe sessao admin. Nao houve criacao ou alteracao de recursos na Vercel ou Supabase, nem mudanca em endpoint/runtime/Nginx/PM2/DNS/deploy. A validacao autenticada permanece pendente porque nenhuma credencial foi fornecida e o navegador do agente nao tinha sessao admin.

Pendencias:

- validar `/admin/products` autenticado com sessao admin real;
- executar leitura administrativa pequena e read-only via `/api/vps-proxy` com sessao;
- manter qualquer escrita administrativa ou integracao comercial para janela controlada com confirmacao explicita.

Rollback: nao aplicavel; rodada apenas read-only e documentacao.

### 2026-05-27 - Revalidacao live read-only do checklist VPS

Mudanca: reexecutada a parte segura do checklist VPS com validacoes locais, staging e producao publica, sem executar OAuth real, webhooks reais, escrita comercial, deploy ou alteracao de infraestrutura.

Objetivo: confirmar que os guardas continuam bloqueando mutacoes por padrao e que os caminhos essenciais da producao Cloudflare + VPS seguem saudaveis antes de qualquer janela controlada.

Arquivos/infra alterados:

- `migração_VPS.md`

Rotas/servicos afetados:

- `/`
- `/api/status`
- `/sitemap.xml`
- `/produto/:slug`
- `/admin/products` no staging
- `/api/vps-proxy` no staging

Validacao:

- `git status --short --branch`: `## main...origin/main` antes da rodada.
- `node tmp-tests\vps-migration-guard-regression.cjs`: `ok=true`, `checked=28`, `failed=0`, `mutation_executed=false`.
- `node tmp-tests\vps-nginx-production-config-static.test.mjs`: OK.
- `node tmp-tests\vps-nginx-staging-config-static.test.mjs`: OK.
- `SEO_PRODUCTION_HOST_LIVE=true SEO_PRODUCTION_HOST=www.mercadodovale.com.br node tmp-tests\vps-seo-production-host-check.cjs`: `ok=true`, sitemap `200`, `1836` URLs, `1833` produtos, 3 PDPs SEO `200` com canonical `www`, `og:type=product` e `2` JSON-LD.
- `STAGING_FRONTEND_PROXY_LIVE=true node tmp-tests\vps-staging-frontend-proxy-check.cjs`: `ok=true`, raiz `200`, `/admin/products` `200`, status/produtos via proxy `200`, `/company-settings` sem sessao `403`.
- `curl https://www.mercadodovale.com.br/`: `200`, `text/html`.
- `curl https://www.mercadodovale.com.br/api/status`: `200`, `application/json; charset=utf-8`.
- `curl https://www.mercadodovale.com.br/sitemap.xml`: `200`, `application/xml; charset=utf-8`.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 491`, `.rpc(...) = 31`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tmp-tests\legacy-deploy-removal-static.test.mjs`: OK.

Resultado: producao publica e staging seguem respondendo pela VPS nos caminhos essenciais, o sitemap e os HTMLs SEO continuam validos no host `www`, e os guardas permanecem impedindo mutacoes por padrao. Nada foi criado ou alterado na Vercel ou Supabase, e nenhum endpoint/runtime/Nginx/PM2/DNS/deploy foi modificado.

Pendencias:

- validar login/admin real no dominio publico com sessao existente ou credenciais fornecidas pelo usuario;
- executar OAuth real, webhooks reais/simulados e escritas Bling/Shopee/shipping apenas em janela controlada com confirmacao explicita;
- seguir removendo dependencias operacionais Supabase por modulo, preferindo VPS/MySQL.

Rollback: nao aplicavel; rodada apenas read-only e documentacao.

### 2026-05-27 - Revalidacao dos guardas Vercel/Supabase sem criar recursos

Mudanca: reexecutada a parte segura do checklist voltada a impedir retorno de dependencia operacional na Vercel e crescimento nao controlado de dependencias Supabase.

Objetivo: atender a regra operacional de nao criar mais nada na Vercel ou no Supabase, mantendo a VPS como caminho principal e registrando que a rodada foi apenas read-only.

Arquivos/infra alterados:

- `migração_VPS.md`

Rotas/servicos afetados:

- Nenhum endpoint, runtime, Nginx, PM2, DNS, Vercel ou Supabase foi alterado.

Validacao:

- `git status --short --branch`: `## main...origin/main` antes da documentacao.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 491`, `.rpc(...) = 31`, `supabase.storage = 13`, `allowedOperationalMatches = 535`, `unclassifiedOperationalMatches = 0`.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tmp-tests\legacy-deploy-removal-static.test.mjs`: OK.
- `node tools\audit-legacy-deploy-removal-readiness.mjs`: `ready_to_remove_legacy_deploy=true`, `legacy_config_present=false`, `legacy_api_files_count=0`, `legacy_crons_disabled=true`, `cors_allows_legacy_fallback=false`, `legacy_cron_user_agent_allowed=false`, `blockers=[]`; DNS retornou `dns_timeout` no ambiente local, sem blocker de codigo.

Resultado: nao houve criacao ou alteracao de recursos na Vercel ou Supabase. O codigo versionado continua sem configuracao legada da Vercel, sem `api/` serverless legado, sem runtime `@vercel/node` e sem fallback CORS/user-agent para a Vercel. O inventario Supabase permanece travado no baseline atual e sem dependencia operacional nova nao classificada.

Pendencias:

- validar callbacks OAuth e webhooks remanescentes nos paineis externos apenas em janela controlada;
- seguir removendo leituras/escritas operacionais do Supabase por modulo, preferindo VPS/MySQL;
- manter Supabase apenas onde ainda estiver explicitamente classificado como temporario ou auth.

Rollback: nao aplicavel; rodada apenas read-only e documentacao.

### 2026-05-27 - Limpeza final de fallbacks Vercel no runtime VPS

Mudanca: removido o origin legado `https://mercado-do-vale-news.vercel.app` das listas CORS do servidor standalone e da API VPS, removida a autorizacao por user-agent `vercel-cron/1.0` do reconcile Bling na VPS e restaurado o auditor read-only de remocao do deploy legado.

Objetivo: fechar blockers tecnicos restantes da limpeza de Vercel no codigo versionado, garantindo que CORS e reconcile nao mantenham fallback operacional para a plataforma antiga.

Arquivos/infra alterados:

- `server.js`
- `vps_server.js`
- `vps_server.cjs`
- `tools/audit-legacy-deploy-removal-readiness.mjs`
- `tmp-tests/legacy-deploy-removal-readiness-static.test.mjs`
- `migração_VPS.md`

Rotas/processos afetados:

- CORS da API/servidor
- `/api/bling?resource=reconcile`
- auditoria local de remocao do deploy legado

Validacao:

- RED antes da correcao: `node tmp-tests\legacy-deploy-removal-readiness-static.test.mjs` falhou por ausencia de `tools/audit-legacy-deploy-removal-readiness.mjs`.
- RED antes da correcao: `node tmp-tests\legacy-deploy-removal-static.test.mjs` falhou porque `server.js` ainda permitia `mercado-do-vale-news.vercel.app`.
- `node tmp-tests\legacy-deploy-removal-readiness-static.test.mjs`: OK.
- `node tmp-tests\legacy-deploy-removal-static.test.mjs`: OK.
- `node --check server.js`: OK.
- `node --check vps_server.js`: OK.
- `node --check vps_server.cjs`: OK.
- `node --check tools\audit-legacy-deploy-removal-readiness.mjs`: OK.
- `node tools\audit-legacy-deploy-removal-readiness.mjs`: `ready_to_remove_legacy_deploy=true`, `legacy_config_present=false`, `legacy_api_files_count=0`, `legacy_crons_disabled=true`, `cors_allows_legacy_fallback=false`, `legacy_cron_user_agent_allowed=false`, `blockers=[]`; dentro do sandbox, DNS retorna `dns_timeout` controlado sem travar o checklist.
- `node tools\audit-legacy-deploy-removal-readiness.mjs` fora do sandbox: `ready_to_remove_legacy_deploy=true`, apex e `www` resolvem via Cloudflare para `104.21.42.27` e `172.67.199.67`; `www` sem CNAME direto (`ENODATA`), consistente com DNS proxied.
- `node tmp-tests\vps-migration-guard-regression.cjs`: `ok=true`, `28` checks, `0` falhas, `mutation_executed=false`.
- `node tmp-tests\vps-cron-dispatcher-fastify-static.test.mjs`: OK.
- `node tmp-tests\vps-cron-dispatcher-log-check-static.test.mjs`: OK.

Resultado: o codigo versionado nao aceita mais o host antigo da Vercel por CORS e o reconcile Bling nao aceita mais autorizacao implicita pelo user-agent do Vercel Cron. O auditor de readiness voltou a existir, e agora possui timeout/saida controlada para DNS bloqueado em sandbox.

Commit: `c878b89` (`chore(vps): remove legacy deploy fallbacks`), enviado para `origin/main`.

Deploy/pos-deploy:

- `node tmp-tests\autoresponder-vps-server-deploy.cjs`: `ok=true`; API publicada em `/var/www/mdv-api`, PM2 `mdv-api` reiniciado e backups remotos criados com sufixo `20260527142626`.
- `curl https://www.mercadodovale.com.br/api/status`: `200`, `application/json; charset=utf-8`.
- `curl https://www.mercadodovale.com.br/api/vps-proxy?path=%2Fstatus`: `200`, `application/json; charset=utf-8`.
- Preflight CORS com `Origin: https://mercado-do-vale-news.vercel.app`: `500 Not allowed`, sem `access-control-allow-origin` para o origin legado.
- Preflight CORS com `Origin: https://www.mercadodovale.com.br`: `204 No Content`, com `access-control-allow-origin: https://www.mercadodovale.com.br`.

Pendencias:

- conferir em paineis externos os callbacks OAuth e webhooks remanescentes.

Rollback: restaurar o commit anterior ou restaurar backups do deploy da API VPS e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-27 - Tentativa de validacao admin real no dominio publico

Mudanca: testado o acesso browser read-only a `/admin/products` no dominio publico da VPS, sem inserir credenciais e sem executar acao administrativa.

Objetivo: avancar a pendencia de validacao de login/admin real apos o corte para Cloudflare + VPS, confirmando pelo menos o comportamento do gate de autenticacao no host final.

Arquivos/infra alterados:

- `migração_VPS.md`

Rotas afetadas:

- `/admin/products`
- `/admin/login`

Validacao:

- `node tmp-tests\vps-migration-guard-regression.cjs`: `ok=true`, `28` checks, `0` falhas, `mutation_executed=false`.
- Browser via `agent-browser` em `https://www.mercadodovale.com.br/admin/products`: URL final `https://www.mercadodovale.com.br/admin/login`, titulo `Mercado do Vale - Sistema de Gestao`.
- Leitura visual/textual da pagina: exibiu `Área Administrativa`, `Acesso restrito a administradores`, campo de senha e botao `Acessar Painel Admin`.
- `agent-browser errors`: sem erros de pagina reportados.
- Screenshot salvo localmente em `C:\tmp\mdv-admin-login-gate-20260527.png`.

Resultado: o host publico final serve o app admin pela VPS e protege `/admin/products` redirecionando para `/admin/login` quando nao existe sessao admin. A validacao autenticada da tela de produtos ainda nao foi feita porque a sessao do navegador usada pelo agente nao estava logada e nenhuma credencial foi fornecida ou digitada.

Pendencias:

- validar `/admin/products` com sessao admin real;
- executar uma leitura administrativa pequena e read-only pelo `/api/vps-proxy` com sessao;
- manter qualquer escrita administrativa para janela controlada e reversivel.

Rollback: nao aplicavel; rodada apenas read-only e documentacao.

### 2026-05-27 - Revalidacao segura do checklist VPS

Mudanca: reexecutado o checklist seguro da migracao VPS em modo read-only, incluindo guards anti-mutacao, preflight do reconcile Bling, endpoints publicos/staging e browser da producao.

Objetivo: confirmar que a producao Cloudflare + VPS e o staging continuam saudaveis antes de qualquer janela controlada de escrita, OAuth real ou webhook real.

Arquivos/infra alterados:

- `migração_VPS.md`

Rotas afetadas:

- `/`
- `/api/status`
- `/api/vps-proxy`
- `/sitemap.xml`
- `/produto/:slug`
- `/admin/products` no staging

Validacao:

- `node tmp-tests\vps-migration-guard-regression.cjs`: `ok=true`, `28` checks, `0` falhas, `mutation_executed=false`.
- `node tmp-tests\bling-reconcile-plan-review.test.mjs`: OK.
- `node tmp-tests\bling-reconcile-apply-readiness-cli.test.mjs`: OK.
- `node tmp-tests\vps-bling-reconcile-apply-guarded-preflight.test.mjs`: OK.
- `node --check vps_server.js`: OK.
- `node --check vps_server.cjs`: OK.
- `node tmp-tests\vps-nginx-production-config-static.test.mjs`: OK.
- `node tmp-tests\vps-nginx-staging-config-static.test.mjs`: OK.
- `node tools\check-bling-reconcile-apply-readiness.mjs`: `ok=true`, `applied=false`, `reason=preflight_only`; plano segue com `4` estoques, `6` nomes, `1` zeragem (`PI153D`) e `2` renomes que exigem revisao explicita (`PX7P5GNFC8256A`, `X7P8256P`).
- `SEO_PRODUCTION_HOST_LIVE=true SEO_PRODUCTION_HOST=www.mercadodovale.com.br node tmp-tests\vps-seo-production-host-check.cjs`: `ok=true`, sitemap `200`, `1834` URLs, `1831` produtos, 3 PDPs SEO `200` com canonical `www`, `og:type=product` e `2` JSON-LD.
- `STAGING_FRONTEND_PROXY_LIVE=true node tmp-tests\vps-staging-frontend-proxy-check.cjs`: `ok=true`, raiz `200`, `/admin/products` `200`, `/api/vps-proxy?path=/status` `200`, produtos `200`, `/company-settings` sem sessao `403`.
- `curl https://www.mercadodovale.com.br/`: `200`, `text/html`.
- `curl https://www.mercadodovale.com.br/api/status`: `200`, `application/json; charset=utf-8`.
- `curl https://www.mercadodovale.com.br/sitemap.xml`: `200`, `application/xml; charset=utf-8`.
- Browser via `agent-browser` em `https://www.mercadodovale.com.br/`: titulo `Mercado do Vale | Smartphones e Eletronicos em Petrolina-PE`, URL final `https://www.mercadodovale.com.br/`, `bodyLength=5968`, `hasMercado=true`, `imageCount=38`, `loadedImages=11`, console sem erros; screenshot salvo localmente em `C:\tmp\mdv-vps-check-20260527.png`.

Resultado: checklist seguro passou. Producao e staging continuam respondendo pela VPS, os guards permanecem bloqueando mutacoes por padrao e o browser carregou a vitrine publica sem erros de console. Nenhuma alteracao de runtime, Nginx, PM2, DNS ou deploy foi executada nesta rodada.

Pendencias:

- validar login/admin real com sessao no dominio publico;
- revisar manualmente `reports/bling-reconcile-review.md` antes de qualquer apply real;
- executar OAuth real, webhooks reais/simulados e escritas Bling/Shopee/shipping somente em janela controlada com confirmacoes explicitas.

Rollback: nao aplicavel; rodada apenas read-only e documentacao.

### 2026-05-27 - Rodada de checklist VPS local e live read-only

Mudanca: reexecutado o checklist seguro do bloco VPS sem stagear, commitar ou fazer deploy novo.

Objetivo: confirmar o estado atual antes de seguir para commit/deploy ou validacoes reais com sessao/admin.

Arquivos/infra alterados:

- `migração_VPS.md`

Rotas afetadas:

- `/`
- `/admin/products`
- `/api/status`
- `/api/vps-proxy`
- `/sitemap.xml`
- `/produto/:slug`

Validacao:

- `node tmp-tests/vps-migration-guard-regression.cjs`: `ok=true`, `28` checks, `0` falhas, sem mutacao real.
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/vps-nginx-production-config-static.test.mjs`
- `node tmp-tests/vps-nginx-staging-config-static.test.mjs`
- rodada dos testes `tmp-tests/*` modificados/novos do bloco: todos passaram.
- `npm.cmd run build`: primeira execucao bloqueada pelo sandbox ao ler `vite.config.ts`; repetida fora do sandbox e concluida com sucesso.
- `SEO_PRODUCTION_HOST_LIVE=true node tmp-tests/vps-seo-production-host-check.cjs`: `ok=true`, raiz `301` para `https://www.mercadodovale.com.br/sitemap.xml`, sitemap `200`, `1845` URLs, `1842` produtos e 3 produtos SEO `200`.
- `SEO_PRODUCTION_HOST_LIVE=true SEO_PRODUCTION_HOST=www.mercadodovale.com.br node tmp-tests/vps-seo-production-host-check.cjs`: `ok=true` direto no host `www`.
- `STAGING_FRONTEND_PROXY_LIVE=true node tmp-tests/vps-staging-frontend-proxy-check.cjs`: `ok=true`, raiz `200`, `/admin/products` `200`, status/produtos `200`, `/company-settings` sem sessao `403`.
- `curl https://www.mercadodovale.com.br/`: `200`, `text/html`.
- `curl https://www.mercadodovale.com.br/api/status`: `200`, `application/json; charset=utf-8`.
- `curl https://www.mercadodovale.com.br/sitemap.xml`: `200`, `application/xml; charset=utf-8`.

Resultado: checklist local e live read-only passou. Producao publica e staging continuam respondendo pelos caminhos essenciais da VPS, e os guards permanecem bloqueando execucoes mutantes por padrao.

Commit: `0718653 chore(vps): reduce supabase product reads`.

Push/deploy:

- `git push origin main`: remoto atualizado ate `ecdf77af3a0ed0677b530bb23947f0cc2c4c3a8b` antes do pacote de validacao/deploy final desta rodada.
- Vercel nao foi verificada nesta rodada porque o objetivo da migracao e remover a Vercel do caminho critico; a regra aplicada foi VPS-first.
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`: `ok=true`; API publicada em `/var/www/mdv-api`, backups remotos criados com sufixo `20260527115806`.
- `npm.cmd run deploy:vps-site` com credenciais existentes do sistema/`deploy.cjs` e `VPS_SITE_SKIP_BUILD=1`: site publicado, release ativa `/var/www/mdv-site/releases/20260527-120851`.
- `DRY_RUN=false CONFIRM_NGINX_PRODUCTION_INSTALL=I_UNDERSTAND_NGINX_PRODUCTION_INSTALL node tmp-tests/vps-nginx-production-config-install.cjs` com credenciais existentes do sistema/`deploy.cjs`: `ok=true`, `installed=true`, backup remoto criado.
- `curl https://www.mercadodovale.com.br/api/status`: `200`, `application/json; charset=utf-8`.
- `curl https://www.mercadodovale.com.br/api/vps-proxy?path=%2Fstatus`: `200`, `application/json; charset=utf-8`.
- `curl https://www.mercadodovale.com.br/sitemap.xml`: `200`, `application/xml; charset=utf-8`.
- `SEO_PRODUCTION_HOST_LIVE=true SEO_PRODUCTION_HOST=www.mercadodovale.com.br node tmp-tests/vps-seo-production-host-check.cjs`: `ok=true`, sitemap `1844` URLs, `1841` produtos, 3 produtos SEO `200`.
- `STAGING_FRONTEND_PROXY_LIVE=true node tmp-tests/vps-staging-frontend-proxy-check.cjs`: `ok=true`, raiz/admin `200`, status/produtos `200`, `/company-settings` sem sessao `403`.

Pendencias:

- browser in-app nao foi concluido porque o runtime do plugin falhou no setup e o DevTools estava bloqueado por perfil Chrome ja em uso;
- validar login/admin real no dominio publico;
- normalizar as credenciais VPS em `.env.vps.local` ou no ambiente persistente para nao depender do `deploy.cjs` legado;
- definir o proximo pacote sem voltar a depender da Vercel.

Rollback: nenhuma alteracao de runtime/infra foi aplicada nesta rodada; rollback nao necessario.

### 2026-05-27 - Normalizacao local das credenciais VPS

Mudanca: criado `.env.vps.local` local e ignorado pelo Git com as chaves `VPS_SITE_HOST`, `VPS_SITE_USER`, `VPS_SITE_PASSWORD` e `VPS_SITE_ROOT`, reaproveitando as credenciais ja existentes no sistema sem imprimir valores.

Objetivo: permitir deploy do frontend pela VPS sem depender de extracao manual do `deploy.cjs` legado e remover credenciais hardcoded do arquivo versionado.

Arquivos/infra alterados:

- `.env.vps.local` local, ignorado por `.gitignore`
- `deploy.cjs`
- `tmp-tests/vps-ssh-config.cjs`
- scripts VPS em `tmp-tests/` que ainda usavam `readConst('VpsHost'|'VpsUser'|'VpsPass')`
- `tmp-tests/vps-ssh-config-static.test.mjs`
- `/var/www/mdv-site/releases/20260527-123046`

Validacao:

- `git check-ignore -v .env.vps.local`: arquivo ignorado por `.gitignore`.
- `Select-String .env.vps.local`: chaves presentes sem imprimir valores.
- `node tmp-tests/vps-migration-guard-regression.cjs`: `ok=true`, `28` checks, `0` falhas, `mutation_executed=false`.
- `VPS_SITE_SKIP_BUILD=1 npm.cmd run deploy:vps-site`: carregou `4` variaveis de `.env.vps.local` e publicou a release `/var/www/mdv-site/releases/20260527-123046`.
- `curl https://www.mercadodovale.com.br/`: `200`, `text/html`.
- `curl https://www.mercadodovale.com.br/api/status`: `200`, `application/json; charset=utf-8`.
- `curl https://www.mercadodovale.com.br/sitemap.xml`: `200`, `application/xml; charset=utf-8`.
- `STAGING_FRONTEND_PROXY_LIVE=true node tmp-tests/vps-staging-frontend-proxy-check.cjs`: `ok=true`, raiz/admin `200`, status/produtos `200`, `/company-settings` sem sessao `403`.
- `node --check` nos `.cjs` alterados: `25` arquivos OK.
- `node tmp-tests/vps-ssh-config-static.test.mjs`: OK.
- `node tmp-tests/vps-site-deploy-script-static.test.mjs`: OK.
- `node -e "require('./tmp-tests/vps-ssh-config.cjs').getVpsSshConfig()"`: carregou host/user/password sem imprimir valores.
- `node tmp-tests/autoresponder-vps-recent-logs.cjs`: conexao SSH somente leitura OK via `.env.vps.local`; conteudo dos logs nao foi documentado por conter dados operacionais de clientes.
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`: `ok=true`, API publicada em `/var/www/mdv-api`, backups remotos criados com sufixo `20260527124213`.
- `curl https://www.mercadodovale.com.br/api/status`: `200`, `application/json; charset=utf-8` apos deploy da API.
- `curl https://www.mercadodovale.com.br/api/vps-proxy?path=%2Fstatus`: `200`, `application/json; charset=utf-8` apos deploy da API.

Resultado: deploy do frontend agora pode ser executado via `.env.vps.local` local ignorado, sem passar variaveis temporarias derivadas de `deploy.cjs`; `deploy.cjs` e os scripts VPS antigos deixaram de depender de credenciais hardcoded versionadas. Browser/login real ainda nao foi fechado porque o Browser plugin falhou no runtime e o DevTools MCP esta bloqueado por perfil Chrome ja em uso.

Pendencias:

- validar login/admin real no browser com sessao admin;
- seguir com OAuth real e execucoes controladas restantes antes do corte definitivo.

Rollback: para frontend, usar o comando indicado pelo deploy para reaponter `/var/www/mdv-site/current` para `/var/www/mdv-site/previous`; para credenciais locais, remover `.env.vps.local`.

### 2026-05-27 - Leituras live Bling/Shopee pela VPS

Mudanca: executadas leituras reais sanitizadas de Bling e Shopee pela API da VPS, sem chamadas de escrita e sem imprimir tokens ou payloads completos.

Objetivo: reduzir risco antes das execucoes controladas restantes, comprovando que os recursos de leitura principais continuam respondendo pela VPS.

Arquivos/infra alterados:

- `migração_VPS.md`

Rotas afetadas:

- `/api/bling`
- `/api/shopee-actions`
- `/api/shopee-catalog`
- `/api/auth/callback/bling`
- `/api/shopee`

Validacao:

- `node tmp-tests/vps-bling-live-read-check-static.test.mjs`: OK.
- `node tmp-tests/vps-shopee-live-read-check-static.test.mjs`: OK.
- `node tmp-tests/vps-shopee-order-live-read-check-static.test.mjs`: OK.
- `node tmp-tests/vps-bling-detail-live-read-check-static.test.mjs`: OK.
- `node tmp-tests/vps-bling-stock-live-read-check-static.test.mjs`: OK.
- `node tmp-tests/vps-bling-finance-live-read-check-static.test.mjs`: OK.
- `node tmp-tests/vps-migration-guard-regression.cjs`: `ok=true`, `28` checks, `0` falhas, `mutation_executed=false`.
- `node tmp-tests/vps-bling-live-read-check.cjs`: `ok=true`; categorias `71`, produtos `100`, NFe `100`, NFCe `35`.
- `node tmp-tests/vps-shopee-live-read-check.cjs`: `ok=true`, item descoberto; categorias `2038`, canais logisticos `2`, lista de itens `5`, detalhe `1`, modelos `7`; aviso esperado de `estimated_shipping_fee` em canais `90022` e `90006`.
- `node tmp-tests/vps-shopee-order-live-read-check.cjs`: `ok=true`, pedido descoberto; lista `5`, detalhe `1`, tracking `0`, escrow OK.
- `node tmp-tests/vps-bling-detail-live-read-check.cjs`: `ok=true`, produto descoberto e detalhe `200`; detalhe NFe pulado por nao descobrir id de NFe nessa leitura.
- `node tmp-tests/vps-bling-stock-live-read-check.cjs`: `ok=true`, estoque geral `0`, estoque filtrado por produto descoberto `1`.
- `node tmp-tests/vps-bling-finance-live-read-check.cjs`: `ok=true`, receber `100` e pagar `10`, detalhes `receber/get` e `pagar/get` `200`.
- `OAUTH_PREFLIGHT_LIVE=true node tmp-tests/vps-oauth-preflight-check.cjs`: `ok=true`; callback Bling sem code `302` para `/admin/settings/bling`; exchange sem credenciais `400`; callback Shopee sem parametros `400`; URL Shopee gerada com `auth_host=partner.shopeemobile.com` e `redirect_host=www.mercadodovale.com.br`.

Resultado: leituras Bling/Shopee e preflight OAuth continuam operacionais pela VPS. Nao houve chamada mutante; execucoes de escrita, reconexao OAuth real e webhooks reais seguem para janela controlada.

Pendencias:

- revisar o plano atual de `reconcile` antes de nova aplicacao real;
- validar escrita Bling/Shopee somente com produto/pedido explicitamente controlados;
- reconectar OAuth Bling/Shopee com codigo real valido;
- validar webhooks reais/simulados em janela controlada.

Rollback: nao aplicavel; rodada apenas de leitura.

### 2026-05-27 - Reconcile dry-run com retry para rate limit Bling

Mudanca: adicionado retry/backoff no fetch de detalhe de venda usado pelo reconcile/serial-sales, para tratar `429 TOO_MANY_REQUESTS` do Bling sem abortar o dry-run inteiro.

Objetivo: revisar o plano atual de reconcile com segurança, sem aplicar mudanças reais, e reduzir falhas transitórias por limite de `3` requisicoes por segundo do Bling.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-reconcile-sale-detail-rate-limit-static.test.mjs`
- `.gitignore`
- `migração_VPS.md`

Validacao:

- primeira tentativa de `node tmp-tests/vps-bling-reconcile-dry-run-check.cjs`: falhou com `429 TOO_MANY_REQUESTS` no detalhe de venda do Bling; nenhuma mutacao executada.
- primeira tentativa de `node tmp-tests/vps-bling-reconcile-dry-run-details-check.cjs`: falhou com o mesmo `429`; nenhuma mutacao executada.
- `node tmp-tests/vps-bling-reconcile-sale-detail-rate-limit-static.test.mjs`: falhou antes do ajuste e passou depois.
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/vps-bling-reconcile-fastify-static.test.mjs`
- `node tmp-tests/vps-migration-guard-regression.cjs`: `ok=true`, `28` checks, `0` falhas, `mutation_executed=false`.
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`: `ok=true`, API publicada em `/var/www/mdv-api`, backups remotos criados com sufixo `20260527132129`.
- `node tmp-tests/vps-bling-reconcile-dry-run-check.cjs`: `ok=true`, `dryRun=true`, plano atual `4` estoques e `6` nomes; totais `2455` produtos locais, `2447` mapeados, `6108` produtos Bling e `2447` estoques remotos.
- `node tmp-tests/vps-bling-reconcile-dry-run-details-check.cjs`: `ok=true`, `dryRun=true`, detalhes salvos localmente em `tmp-tests/vps-bling-reconcile-dry-run-details-output.json`.
- resumo local do artefato: `stockChanges=4`, `nameChanges=6`; o arquivo foi ignorado no Git para evitar versionar dados operacionais de produto.
- `curl https://www.mercadodovale.com.br/api/status`: `200`, `application/json; charset=utf-8`.

Resultado: plano atual de reconcile revisado sem aplicacao real. A pendencia de reconcile ficou reduzida para revisar `4` estoques e `6` nomes antes de qualquer apply controlado.

Pendencias:

- revisar manualmente a revisao local em `reports/bling-reconcile-review.md`;
- executar apply somente em janela controlada.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260527132129.bak` e `/var/www/mdv-api/.codex-backups/vps_server.js.20260527132129.bak`, depois reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-27 - Revisao local e preflight do reconcile Bling

Mudanca: restaurado o fluxo local de revisao/readiness do reconcile para gerar `reports/bling-reconcile-review.md` e `reports/bling-reconcile-review.json` a partir do dry-run atual, com hash SHA-256 do artefato revisado.

Objetivo: manter a aplicacao real bloqueada por padrao, mas deixar claro quais confirmacoes exatas seriam necessarias em uma janela controlada.

Arquivos alterados:

- `tools/review-bling-reconcile-plan.mjs`
- `tools/check-bling-reconcile-apply-readiness.mjs`
- `tmp-tests/bling-reconcile-plan-review.test.mjs`
- `tmp-tests/bling-reconcile-plan-review-cli-static.test.mjs`
- `tmp-tests/bling-reconcile-apply-readiness-cli-static.test.mjs`
- `tmp-tests/bling-reconcile-apply-readiness-cli.test.mjs`
- `tmp-tests/bling-reconcile-apply-readiness-cli-refuses-apply.test.mjs`
- `tmp-tests/vps-bling-reconcile-apply-guarded-preflight.test.mjs`
- `tmp-tests/vps-bling-reconcile-apply-guarded-hash-mismatch.test.mjs`
- `.gitignore`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/bling-reconcile-plan-review.test.mjs`
- `node tmp-tests/bling-reconcile-plan-review-cli-static.test.mjs`
- `node --check tools/review-bling-reconcile-plan.mjs`
- `node tools/review-bling-reconcile-plan.mjs`
- `node tmp-tests/bling-reconcile-apply-readiness-cli-static.test.mjs`
- `node tmp-tests/bling-reconcile-apply-readiness-cli.test.mjs`
- `node tmp-tests/bling-reconcile-apply-readiness-cli-refuses-apply.test.mjs`
- `node tmp-tests/vps-bling-reconcile-apply-guarded-static.test.mjs`
- `node tmp-tests/vps-bling-reconcile-apply-guarded-preflight.test.mjs`
- `node tmp-tests/vps-bling-reconcile-apply-guarded-hash-mismatch.test.mjs`
- `node --check tools/check-bling-reconcile-apply-readiness.mjs`
- `node tools/check-bling-reconcile-apply-readiness.mjs`

Resultado local do plano atual:

- Estoque: `4` mudancas, `2` aumentos, `2` reducoes, `1` zeragem (`PI153D`), delta total `0`, delta maximo absoluto `3`.
- Nomes: `6` mudancas, `4` classificadas como expansao segura de variante/cor e `2` marcadas para revisao explicita (`PX7P5GNFC8256A`, `X7P8256P`).
- Source SHA-256 atual: `f49c009136459ff0f83212d38e8e869aa3e9f2f2355e0cfc44697db1962221a7`.
- Readiness retornou `ok=true`, `applied=false`, `reason=preflight_only`, `localGuardsPassed=true`.
- O comando de readiness recusa `--apply`; ele apenas regenera a revisao e roda o preflight local sem abrir SSH.
- Nenhuma mutacao real foi executada.

Confirmacoes que seriam exigidas pelo apply guardado, se aprovado em janela controlada:

- `DRY_RUN=false`
- `CONFIRM_BLING_RECONCILE_APPLY=I_UNDERSTAND_BLING_RECONCILE_APPLY`
- `CONFIRM_BLING_RECONCILE_SOURCE_SHA256=f49c009136459ff0f83212d38e8e869aa3e9f2f2355e0cfc44697db1962221a7`
- `CONFIRM_BLING_RECONCILE_ZEROING=I_REVIEWED_STOCK_ZEROING`
- `CONFIRM_BLING_RECONCILE_ZEROING_SKUS=PI153D`
- `CONFIRM_BLING_RECONCILE_UNSAFE_RENAMES=I_REVIEWED_UNSAFE_RENAMES`
- `CONFIRM_BLING_RECONCILE_UNSAFE_RENAME_SKUS=PX7P5GNFC8256A,X7P8256P`

Pendencias:

- revisar manualmente as mudancas listadas em `reports/bling-reconcile-review.md`;
- aplicar somente se houver aprovacao explicita para janela controlada;
- depois de eventual apply, revalidar Bling/Supabase e registrar resultado no checklist.

### 2026-05-27 - Revalidacao Nginx producao no IP da VPS

Mudanca: reinstalada/confirmada a config `infra/nginx/mdv-site-production.conf` na VPS usando o instalador guardado, adicionados blocos `443 ssl` para o site e uma regra de compatibilidade `/api/status -> /status`, e revalidados os hosts de producao contra o IP da VPS e pela Cloudflare publica.

Objetivo: garantir que o bloqueador antigo de `404` nos hosts `mercadodovale.com.br` e `www.mercadodovale.com.br` continua resolvido antes do corte DNS final.

Arquivos/infra alterados:

- `/etc/nginx/sites-available/mdv-site-production.conf`
- `/etc/nginx/sites-enabled/mdv-site-production.conf`
- `infra/nginx/mdv-site-production.conf`
- `infra/nginx/mdv-site-staging.conf`
- `tmp-tests/vps-nginx-production-config-static.test.mjs`
- `tmp-tests/vps-nginx-staging-config-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-nginx-production-config-static.test.mjs`
- `node tmp-tests/vps-nginx-staging-config-static.test.mjs`
- `node tmp-tests/vps-nginx-production-config-install-static.test.mjs`
- `node tmp-tests/vps-seo-production-host-check-static.test.mjs`
- `node --check tmp-tests/vps-nginx-production-config-install.cjs`
- `node --check tmp-tests/vps-seo-production-host-check.cjs`
- `node tmp-tests/vps-nginx-production-config-install.cjs`: dry-run com credenciais encontradas e `reason=dry_run_enabled`.
- `DRY_RUN=false CONFIRM_NGINX_PRODUCTION_INSTALL=I_UNDERSTAND_NGINX_PRODUCTION_INSTALL node tmp-tests/vps-nginx-production-config-install.cjs`: `installed=true`, backup remoto criado, `nginx -t` e reload executados.
- `SEO_PRODUCTION_HOST_LIVE=true node tmp-tests/vps-seo-production-host-check.cjs`: `ok=true`, raiz `301` para `https://www.mercadodovale.com.br/sitemap.xml`, sitemap `200`, `2148` URLs, `2145` produtos e 3 produtos SEO `200`.
- `SEO_PRODUCTION_HOST_LIVE=true SEO_PRODUCTION_HOST=www.mercadodovale.com.br node tmp-tests/vps-seo-production-host-check.cjs`: `ok=true` direto no host `www`.
- Antes da correção 443, `curl https://www.mercadodovale.com.br/`, `/sitemap.xml` e `/api/status` retornavam `404` JSON do Fastify, confirmando que o HTTPS público caía no bloco SSL da API.
- Depois da correção 443, `curl https://www.mercadodovale.com.br/`: `200 OK`, `Content-Type: text/html`.
- `curl -I https://www.mercadodovale.com.br/sitemap.xml`: `200 OK`, `Content-Type: application/xml; charset=utf-8`.
- `curl https://www.mercadodovale.com.br/api/status`: `200 OK`, JSON com `mysql.ok=true`.
- `curl -I https://www.mercadodovale.com.br/produto/xiaomi-redmi-pad-2`: `200 OK`, `Content-Type: text/html; charset=utf-8`.
- `curl -I https://mercadodovale.com.br/sitemap.xml`: `301`, `Location: https://www.mercadodovale.com.br/sitemap.xml`.
- `curl -I https://www.mercadodovale.com.br/assets/index-BliW-PDw.js`: `200 OK`, `Cache-Control: public, max-age=31536000, immutable`.
- `curl "https://www.mercadodovale.com.br/api/vps-proxy?path=%2Fstatus"`: `200 OK`.
- `curl "https://www.mercadodovale.com.br/vps-proxy?path=%2Fstatus"`: `200 OK`.
- Browser em `https://www.mercadodovale.com.br/`: carregou a vitrine com titulo `Mercado do Vale | Smartphones e Eletronicos em Petrolina-PE`, produtos e imagens visiveis.

Resultado: Nginx de producao segue ativo na VPS e agora tambem atende o HTTPS que chega pela Cloudflare. O host raiz redireciona para `www`, o host canonico serve o frontend, sitemap, assets, HTML SEO e proxy/status pelo Nginx correto em vez de cair diretamente no Fastify da API.

Pendencias:

- validar browser/login/admin real no dominio publico;
- instalar certificado/origin cert dedicado para `mercadodovale.com.br`/`www.mercadodovale.com.br` e remover o uso temporario do certificado de `api.xiaomipetrolina.com.br`;
- investigar erro residual do navegador nao bloqueante: refresh token Supabase invalido do perfil local;
- manter acompanhamento de slugs compartilhados no banco; o sitemap já deduplica URLs por slug.
- seguir com login/admin real, OAuth real e execucoes controladas restantes antes do corte definitivo.

Rollback: restaurar backup remoto em `/etc/nginx/sites-available/mdv-site-production.conf.backup.*`, rodar `nginx -t` e recarregar Nginx.

### 2026-05-27 - Deduplicacao de slugs no sitemap

Mudanca: ajustada a rota `/api/sitemap` no Fastify da VPS para emitir apenas uma URL por slug de produto, usando `GROUP BY slug` e `MAX(updated_at)` para preservar o `lastmod` mais recente.

Objetivo: corrigir duplicidade SEO no sitemap publico, inicialmente observada em `/produto/poco-c85`, sem alterar os produtos/variacoes que compartilham slug no banco.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-sitemap-dedup-slugs-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260527113450.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260527113450.bak`

Investigacao:

- `curl https://www.mercadodovale.com.br/sitemap.xml | Select-String poco-c85`: antes da correcao, `/produto/poco-c85` aparecia 3 vezes.
- Consulta read-only no MySQL da VPS confirmou 3 produtos ativos/indexaveis com `slug='poco-c85'`: dois registros com SKU `PC858256V` e um com SKU `PC858256R`.
- A mesma consulta mostrou outros slugs compartilhados por variacoes/capas; portanto, a causa raiz do sitemap duplicado era a query emitir uma URL por linha de produto, enquanto a URL publica canonica usa o slug.
- O teste `tmp-tests/public-product-route-target.test.mjs` ja documentava que variacoes podem compartilhar slug e, nesse caso, a navegacao usa ID para distinguir variante. Por isso a correcao do sitemap foi deduplicar por slug, nao renomear produtos automaticamente.

Validacao:

- `node tmp-tests/vps-sitemap-dedup-slugs-static.test.mjs`
- `node tmp-tests/vps-sitemap-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`: deploy OK, `mdv-api` reiniciado, backups remotos criados.
- `curl https://www.mercadodovale.com.br/sitemap.xml`: `poco-c85` passou a aparecer 1 vez; sitemap ficou com `1844` URLs totais e `1841` URLs de produto.
- `curl https://www.mercadodovale.com.br/api/status`: `200 OK`, `mysql.ok=true` apos restart.
- `curl -I https://www.mercadodovale.com.br/produto/poco-c85`: `200 OK`, `Content-Type: text/html; charset=utf-8`.
- `SEO_PRODUCTION_HOST_LIVE=true SEO_PRODUCTION_HOST=www.mercadodovale.com.br node tmp-tests/vps-seo-production-host-check.cjs`: `ok=true`, sitemap `200`, `1844` URLs, `1841` produtos, `poco-c85` validado com canonical/OG/JSON-LD.

Resultado: sitemap publico nao repete mais `/produto/poco-c85` nem outros slugs compartilhados; produtos/variacoes continuam intactos no banco.

Pendencias:

- avaliar depois, como limpeza de dados separada, se existem duplicidades reais indesejadas de produto/SKU, especialmente os dois registros `PC858256V` com slug `poco-c85`;
- manter o teste de deduplicacao para impedir regressao na rota `/api/sitemap`.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260527113450.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-27 - Rota `/products/by-ids` na API da VPS

Mudanca: criada a rota Fastify `GET /products/by-ids` na API da VPS, com deduplicacao de IDs, limite de 100 itens, estoque calculado por `comboStockSql('products')` e retorno na mesma ordem dos IDs recebidos.

Objetivo: corrigir o `404` observado no browser da producao em `GET /products/by-ids`, usado por telas que precisam reidratar produtos por lista de IDs, como historico de compras, detalhes de venda, pedidos e servicos de catalogo/pedido.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-products-by-ids-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260527114029.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260527114029.bak`

Investigacao:

- `curl https://api.xiaomipetrolina.com.br/products/by-ids?ids=...`: antes da correcao retornava `404 {"error":"Not found"}`.
- `curl https://www.mercadodovale.com.br/api/vps-proxy?path=/products/by-ids?...`: antes da correcao tambem retornava `404`.
- `services/vpsApiService.ts` ja chamava `/products/by-ids?ids=...`, mas o Fastify da VPS nao tinha essa rota.
- Como `/products/by-ids` nao existia, o request caia na rota generica `/products/:id` com `id='by-ids'`, resultando em `404`.

Validacao:

- `node tmp-tests/vps-products-by-ids-fastify-static.test.mjs`
- `node tmp-tests/vps-products-read-batch-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`: deploy OK, `mdv-api` reiniciado, backups remotos criados.
- `curl https://api.xiaomipetrolina.com.br/products/by-ids?ids=f16a3c14-194f-44c6-944c-d96910d4b8e1,4b7a285e-058f-4b35-bbad-ccb08f86c32a`: `200 OK`, `Count=2`, SKUs `CPARN13AZPS` e `CCRC562`.
- `curl https://www.mercadodovale.com.br/api/vps-proxy?path=/products/by-ids?...`: `200 OK`, `Count=2`, mesma ordem dos IDs, SKUs `CPARN13AZPS` e `CCRC562`.
- `curl https://www.mercadodovale.com.br/api/status`: `200 OK`, `mysql.ok=true` apos restart.

Resultado: `/products/by-ids` deixou de retornar `404` na API direta e pelo proxy publico; as telas que usam `vpsApiService.getProductsByIds()` agora tem endpoint compativel na VPS.

Pendencias:

- observar em browser se desaparece o erro residual de console em producao;
- avaliar depois se vale reduzir o payload da rota para evitar imagens grandes/base64 quando a tela so precisar de campos resumidos.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260527114029.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-27 - Decisao sobre Cloudflare Origin Certificate

Mudanca: documentada a decisao de usar Cloudflare Origin Certificate dedicado para `mercadodovale.com.br` e `*.mercadodovale.com.br`.

Objetivo: deixar claro que o certificado de origem nao gera custo adicional, esta incluido no plano Free da Cloudflare, e deve substituir o uso temporario do certificado de `api.xiaomipetrolina.com.br` no Nginx de producao.

Arquivos alterados:

- `migração_VPS.md`

Validacao:

- pesquisa em documentacao oficial da Cloudflare confirmou que Origin CA esta disponivel nos planos Free, Pro, Business e Enterprise, e que o apex e wildcard de primeiro nivel sao incluidos por padrao.

Resultado: a politica SSL/TLS ficou registrada: usar Cloudflare Origin Certificate apenas atras da Cloudflare, manter o modo `Full (strict)` apos instalacao, e usar Let's Encrypt como alternativa caso o site precise operar sem proxy Cloudflare.

Pendencias:

- gerar o Origin Certificate no painel Cloudflare;
- instalar certificado e chave na VPS;
- trocar `ssl_certificate`/`ssl_certificate_key` em `infra/nginx/mdv-site-production.conf`;
- validar Nginx e rotas publicas.

Rollback: manter temporariamente o certificado atual de `api.xiaomipetrolina.com.br` ate o certificado dedicado estar instalado e validado.

### 2026-05-27 - PDP publica usa config de categoria da VPS

Mudanca: `PublicProductPage` deixou de consultar `categories` diretamente no Supabase para carregar nome/config da categoria e passou a usar o retorno de `vpsApiService.getCategories()`.

Objetivo: reduzir mais uma dependencia operacional Supabase no catalogo publico, mantendo a VPS/MySQL como fonte da categoria usada na PDP.

Arquivos alterados:

- `pages/store/PublicProductPage.tsx`
- `tmp-tests/public-product-category-config-vps-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migração_VPS.md`
- `migracao_supabase.md`

Validacao:

- `node tmp-tests\public-product-category-config-vps-static.test.mjs`: primeiro falhou por ainda existir `supabase.from('categories')`; depois passou.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 492`, `.rpc(...) = 31`, `supabase.storage = 13`, `supabase.auth = 48`, `allowedOperationalMatches = 536`, `unclassifiedOperationalMatches = 0`.

Resultado: baseline do guard travado em `492`; `categories` caiu de `9` para `8` usos diretos.

Pendencias:

- continuar removendo leituras diretas de `models`, `products`, `brands`, `custom_fields` e demais grupos do bloco produtos/catalogo.

Rollback: restaurar o fallback Supabase de categoria na PDP e voltar temporariamente `MAX_BASELINE_FROM_CALLS` para `493`; nao recomendado como estado final.

### 2026-05-27 - Margens de preco por categoria via VPS

Mudanca: `ProductPricing` deixou de consultar `categories` diretamente no Supabase para carregar `margin_wholesale` e `margin_reseller`, usando `vpsApiService.getCategories()`.

Objetivo: reduzir mais uma dependencia operacional Supabase no formulario de produto, mantendo as margens de precificacao vindas da VPS/MySQL.

Arquivos alterados:

- `components/products/sections/ProductPricing.tsx`
- `tmp-tests/product-pricing-category-margins-vps-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migração_VPS.md`
- `migracao_supabase.md`

Validacao:

- `node tmp-tests\product-pricing-category-margins-vps-static.test.mjs`: primeiro falhou por ainda existir `supabase.from('categories')`; depois passou.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 491`, `.rpc(...) = 31`, `supabase.storage = 13`, `supabase.auth = 48`, `allowedOperationalMatches = 535`, `unclassifiedOperationalMatches = 0`.

Resultado: baseline do guard travado em `491`; `categories` caiu de `8` para `7` usos diretos e arquivos com `.from(...)` cairam de `97` para `96`.

Pendencias:

- continuar removendo leituras diretas em `categories`, `models`, `products`, `brands` e `custom_fields`.

Rollback: restaurar a leitura Supabase de margens no `ProductPricing` e voltar temporariamente `MAX_BASELINE_FROM_CALLS` para `492`; nao recomendado como estado final.

### 2026-05-27 - Allowlist operacional do guard Supabase

Mudança: o auditor `tools/audit-supabase-operational-dependencies.mjs` passou a separar chamadas `supabase.auth` das dependências operacionais e ganhou uma allowlist temporária por módulo ainda não migrado.

Atualização no mesmo bloco: a allowlist foi refinada para classificar também `orders`, garantias, taxonomia de catálogo, engajamento do cliente, time/admin e Storage temporário.

Atualização final do bloco: todas as dependências operacionais detectadas ficaram classificadas e o auditor passou a falhar quando surgir qualquer nova ocorrência sem classificação explícita.

Objetivo: deixar o inventário Supabase mais acionável para a migração VPS, distinguindo autenticação permitida de leituras/escritas operacionais que ainda precisam sair do Supabase.

Arquivos alterados:

- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migracao_supabase.md`
- `migração_VPS.md`

Validação:

- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 498`, `.rpc(...) = 31`, `supabase.storage = 13`, `supabase.auth = 48`, `allowedOperationalMatches = 267`, `unclassifiedOperationalMatches = 275`.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs` após refino da allowlist.
- `node tools\audit-supabase-operational-dependencies.mjs` após refino: `ok=true`, `.from(...) = 498`, `.rpc(...) = 31`, `supabase.storage = 13`, `supabase.auth = 48`, `allowedOperationalMatches = 417`, `unclassifiedOperationalMatches = 125`.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs` após fechamento do inventário.
- `node tools\audit-supabase-operational-dependencies.mjs` após fechamento: `ok=true`, `.from(...) = 498`, `.rpc(...) = 31`, `supabase.storage = 13`, `supabase.auth = 48`, `allowedOperationalMatches = 542`, `unclassifiedOperationalMatches = 0`.
- `node tmp-tests\cashback-categories-vps-static.test.mjs`
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs` após reduzir leitura de categorias no Cashback.
- `node tools\audit-supabase-operational-dependencies.mjs` após reduzir leitura de categorias no Cashback: `ok=true`, `.from(...) = 497`, `.rpc(...) = 31`, `supabase.storage = 13`, `supabase.auth = 48`, `allowedOperationalMatches = 541`, `unclassifiedOperationalMatches = 0`.
- `node tmp-tests\catalog-service-categories-vps-static.test.mjs`
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs` após reduzir leitura de categorias no catalogService.
- `node tools\audit-supabase-operational-dependencies.mjs` após reduzir leitura de categorias no catalogService: `ok=true`, `.from(...) = 496`, `.rpc(...) = 31`, `supabase.storage = 13`, `supabase.auth = 48`, `allowedOperationalMatches = 540`, `unclassifiedOperationalMatches = 0`.
- `node tmp-tests\data-sync-import-brands-vps-static.test.mjs`
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs` após reduzir leitura de marcas no importador de planilha.
- `node tools\audit-supabase-operational-dependencies.mjs` após reduzir leitura de marcas no importador de planilha: `ok=true`, `.from(...) = 495`, `.rpc(...) = 31`, `supabase.storage = 13`, `supabase.auth = 48`, `allowedOperationalMatches = 539`, `unclassifiedOperationalMatches = 0`.
- `node tmp-tests\catalog-sections-category-expansion-vps-static.test.mjs`
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs` após reduzir leitura de categorias nas seções de catálogo.
- `node tools\audit-supabase-operational-dependencies.mjs` após reduzir leitura de categorias nas seções de catálogo: `ok=true`, `.from(...) = 494`, `.rpc(...) = 31`, `supabase.storage = 13`, `supabase.auth = 48`, `allowedOperationalMatches = 538`, `unclassifiedOperationalMatches = 0`.
- `node tmp-tests\cart-brand-warranty-vps-static.test.mjs`
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs` após reduzir leitura de marcas no carrinho.
- `node tools\audit-supabase-operational-dependencies.mjs` após reduzir leitura de marcas no carrinho: `ok=true`, `.from(...) = 493`, `.rpc(...) = 31`, `supabase.storage = 13`, `supabase.auth = 48`, `allowedOperationalMatches = 537`, `unclassifiedOperationalMatches = 0`.

Resultado: o guard continua travando crescimento do baseline e agora informa quais dependências operacionais estão temporariamente permitidas por módulo. O bloco não classificado chegou a `0`, com `MAX_UNCLASSIFIED_OPERATIONAL_MATCHES = 0`, então qualquer nova dependência Supabase operacional sem classificação explícita falha a auditoria. Depois dos primeiros cortes guiados por esse inventário, `pages/admin/CashbackPage.tsx` passou a carregar categorias de promoções por `vpsApiService.getCategories(true)`, `catalogService.getCategoriesWithNames` passou a carregar categorias por `vpsApiService.getCategories()`, `DataSyncService.syncGoogleSpreadsheet` passou a validar marcas por `vpsApiService.getBrands()`, `catalogSectionsService` passou a expandir categorias de seções por `vpsApiService.getCategories()`, `CartPage` passou a buscar garantia de marca por `brandService.listActive()`, e o baseline de `.from(...)` foi reduzido para `493`.

Pendências:

- iniciar cortes por módulo a partir dos maiores grupos classificados: produtos/catálogo, configurações admin, vendas/clientes/financeiro, taxonomia de catálogo, engajamento do cliente, pedidos, cashback/RPCs, variações/modelos e garantias;
- transformar a allowlist temporária em bloqueios mais específicos conforme cada módulo for migrado para VPS/MySQL/Synology.

Rollback: remover a allowlist/relatórios extras do auditor e voltar ao contador bruto anterior; não recomendado porque reduz a qualidade do inventário.

### 2026-05-26 - Leitura de template dinâmico por VPS e aperto do guard Supabase

Mudança: `DataSyncService.generateDynamicTemplate` passou a buscar os produtos da categoria pela VPS/MySQL em vez de ler `products` diretamente no Supabase, e o guard `tools/audit-supabase-operational-dependencies.mjs` foi ajustado para travar o baseline atual de `.from(...)` em `498`.

Atualização no mesmo bloco: `ProductListPage` passou a listar pela VPS os produtos candidatos à geração automática de `video_url`, mantendo a escrita temporária do campo no Supabase para um bloco separado.

Atualização adicional: `SEODashboardPage` deixou de consultar `products` no Supabase para validar unicidade de slug; agora usa o estado de produtos já carregado pela VPS e preserva apenas a escrita temporária do slug no Supabase.

Atualização adicional: `inventory.adjustStock` passou a ler o estoque atual do produto pela VPS antes de calcular o ajuste, mantendo as escritas temporárias de estoque e rollback no Supabase.

Atualização adicional: `ProductForm` passou a validar duplicidade de IMEI/serial pela VPS tanto na entrada em massa quanto no cadastro unitário, preservando a exclusão do próprio produto em modo edição.

Atualização adicional: `BlingService.importBlingProducts` passou a verificar duplicidade por `bling_id` usando produtos carregados da VPS, mantendo os updates/inserts temporários no Supabase.

Objetivo: impedir regressão durante a migração VPS/Supabase, garantindo que novas dependências operacionais diretas no Supabase não entrem sem serem percebidas.

Arquivos alterados:

- `services/dataSyncService.ts`
- `services/blingService.ts`
- `services/inventory.ts`
- `components/products/ProductForm.tsx`
- `pages/admin/products/ProductListPage.tsx`
- `pages/admin/settings/SEODashboardPage.tsx`
- `tmp-tests/data-sync-template-vps-products-static.test.mjs`
- `tmp-tests/product-list-video-vps-read-static.test.mjs`
- `tmp-tests/seo-dashboard-vps-slug-uniqueness-static.test.mjs`
- `tmp-tests/inventory-adjust-stock-vps-current-product-static.test.mjs`
- `tmp-tests/inventory-vps-products-static.test.mjs`
- `tmp-tests/product-form-unique-validation-vps-static.test.mjs`
- `tmp-tests/unique-validation-vps-products-static.test.mjs`
- `tmp-tests/bling-import-duplicate-vps-products-static.test.mjs`
- `tmp-tests/bling-vps-products-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migracao_supabase.md`
- `migração_VPS.md`

Validação:

- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`
- `node tmp-tests\data-sync-template-vps-products-static.test.mjs`
- `node tmp-tests\product-list-video-vps-read-static.test.mjs`
- `node tmp-tests\seo-dashboard-vps-slug-uniqueness-static.test.mjs`
- `node tmp-tests\inventory-adjust-stock-vps-current-product-static.test.mjs`
- `node tmp-tests\inventory-vps-products-static.test.mjs`
- `node tmp-tests\product-form-unique-validation-vps-static.test.mjs`
- `node tmp-tests\unique-validation-vps-products-static.test.mjs`
- `node tmp-tests\bling-import-duplicate-vps-products-static.test.mjs`
- `node tmp-tests\bling-vps-products-static.test.mjs`
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 498`, `.rpc(...) = 31`, `supabase.storage = 13`.
- bateria estática do bloco de leituras VPS de produtos/catálogo/estoque/PDV/carrinho/admin passou.
- `node tmp-tests\vps-migration-guard-regression.cjs`: `ok=true`, `checked=28`, `failed=0`, `mutation_executed=false`.
- `npm.cmd run build`: passou fora do sandbox depois de bloqueio de leitura do `vite.config.ts` dentro do sandbox.

Resultado: a exportação do template dinâmico, a listagem de candidatos a vídeo, a validação de unicidade de slug no SEO, a leitura de estoque atual no ajuste de inventário, as validações de IMEI/serial no formulário de produto e a duplicidade de importação Bling já usam a VPS/estado carregado da VPS para leituras de produtos. A parte de modelos e as escritas de `products` continuam temporariamente no Supabase. A proteção da migração agora acompanha o estado atual do código.

Pendências:

- seguir removendo dependências diretas restantes em `products`, depois avançar para `models`, `customers`, `company_settings` e demais tabelas operacionais.

Rollback: voltar `MAX_BASELINE_FROM_CALLS` para o valor anterior apenas se for necessário investigar uma regressão temporária; não recomendado como estado final.

### 2026-05-22 - Correção do Transferir em conteúdo de caixa

Mudança: corrigido o fluxo do botão `Transferir` dentro do modal de conteúdo de caixa em `Locais de Estoque`.

Objetivo: impedir que, ao clicar em `Transferir` em um item da caixa, o modal fechasse antes de preparar a transferência e desse a impressão de voltar para a página inicial/por trás. O caso reportado foi a Caixa 20 com o SKU `CTRN115G`.

Arquivos/infra alterados:

- `pages/admin/inventory/StockLocationsPage.tsx`
- `tmp-tests/stock-location-content-actions-static.test.mjs`
- release VPS frontend `/var/www/mdv-site/releases/20260522-175355`

Validação:

- `node tmp-tests\stock-location-content-actions-static.test.mjs`
- `node tmp-tests\stock-location-transfer-static.test.mjs`
- `node tmp-tests\stock-locations-page-static.test.mjs`
- `node tmp-tests\stock-location-batch-transfer-static.test.mjs`
- `npm.cmd run build`
- commit `183238e fix(stock): keep transfer modal flow visible`
- `git push origin main`
- `npm.cmd run deploy:vps-site`
- Vercel: deploy `mercado-do-vale-news-wakgzvzam.vercel.app` ficou `Ready`.
- Staging VPS: `http://staging.mercadodovale.com.br/assets/StockLocationsPage-CQ9oaUWs.js` retornou `200`.

Resultado: o clique em `Transferir` agora mantém o fluxo visível, mostra estado `Abrindo...`, prepara a distribuição do item da própria linha da caixa e só fecha o modal de conteúdo depois que a transferência está pronta para abrir. Se a leitura ao vivo da distribuição falhar, o item da caixa continua como fallback para não perder o contexto.

Pendência:

- reteste manual no staging: abrir `http://staging.mercadodovale.com.br/admin/inventory/locations`, entrar na Caixa 20 e clicar em `Transferir` no SKU `CTRN115G`; o esperado é abrir o modal de transferência em vez de voltar para a tela por trás.

Rollback:

- reverter o commit `183238e` e publicar novamente; na VPS, também é possível voltar o symlink para `/var/www/mdv-site/previous` conforme script de deploy.

### 2026-05-22 - Validacao manual inicial do staging admin

Mudanca: validacao manual do staging no navegador apos criacao do DNS `staging.mercadodovale.com.br`.

Objetivo: confirmar que o frontend/admin abre pela VPS com sessao real e validar o caso de estoque citado antes do corte final.

Arquivos/infra alterados:

- `migração_VPS.md`

Validacao manual:

- `http://staging.mercadodovale.com.br`: home abriu no navegador pela VPS.
- `http://staging.mercadodovale.com.br/admin/products`: admin abriu com sessao real e lista de produtos carregada.
- Produto aberto a partir da vitrine carregou imagem, preco e opcoes, mas foi observado que um clique anterior caiu no dominio publico `mercadodovale.com.br`; precisa repetir navegacao de produto mantendo host `staging`.
- Em `Locais de Estoque`, pesquisa por SKU `CCSAM3PRO5GCR`: nenhum resultado encontrado.
- Em `Locais de Estoque`, teste manual com SKU `CTRN115G`: resultado informado como `tudo ok`.

Resultado: staging/admin com sessao real iniciou corretamente. O SKU `CCSAM3PRO5GCR`, citado como produto excluido do Bling que permanecia em caixa, nao aparece na busca de locais de estoque, indicando que nao esta mais preso em caixa/local no teste manual. O SKU `CTRN115G` tambem foi testado manualmente em Locais de Estoque e informado como OK.

Pendencias:

- testar transferencia entre caixas com um produto seguro que apareca em local/caixa;
- testar "voltar para loja" com um item seguro;
- repetir abertura de produto a partir da home staging confirmando que a URL permanece em `staging.mercadodovale.com.br`;
- registrar prints/resultado antes do corte DNS final.

Rollback: nenhuma mudanca de runtime foi feita nesta etapa.

### 2026-05-22 - Rodada de testes seguros antes do teste manual

Mudanca: executada nova bateria de testes live/read-only e guards antes de avancar para navegador com login ou mutacoes reais.

Objetivo: confirmar que a VPS continua saudavel e que nao ha regressao automatica antes dos testes manuais/controlados.

Arquivos/infra alterados:

- `migração_VPS.md`

Validacao:

- `STAGING_FRONTEND_PROXY_LIVE=true node tmp-tests/vps-staging-frontend-proxy-check.cjs`: `ok=true`; `/`, `/admin/products`, `/api/vps-proxy?path=/status` e produtos retornaram `200`; `/company-settings` sem sessao retornou `403`.
- `SEO_PRODUCTION_HOST_LIVE=true node tmp-tests/vps-seo-production-host-check.cjs`: `ok=true`; raiz redireciona `301` para `www`, sitemap `200`, `2136` URLs e `2133` produtos.
- `OAUTH_PREFLIGHT_LIVE=true node tmp-tests/vps-oauth-preflight-check.cjs`: `ok=true`; Bling sem code redireciona para settings, exchange sem credenciais retorna `400`, Shopee callback sem parametros retorna `400`, URL de auth Shopee aponta para host oficial e redirect `www`.
- `node tmp-tests/vps-migration-guard-regression.cjs`: `ok=true`, `checked=28`, `failed=0`, `mutation_executed=false`.
- `node tmp-tests/vps-shopee-live-read-check.cjs`: `ok=true`, loja/categorias/logistica/itens/detalhe/modelos `200`.
- `node tmp-tests/vps-shopee-order-live-read-check.cjs`: `ok=true`, pedidos/detalhe/rastreio/escrow `200`.
- `node tmp-tests/vps-bling-live-read-check.cjs`: `ok=true`, categorias `71`, produtos `100`, NFe `100`, NFCe `34`.
- `node tmp-tests/vps-cron-dispatcher-log-check.cjs`: `ok=true`, crontab ativo e ultimo log real com `Cron ran successfully. Dispatched 1 templates.`
- `node tmp-tests/vps-bling-detail-live-read-check.cjs`: `ok=true`, detalhe de produto e detalhe de NFe `200`.
- `node tmp-tests/vps-bling-stock-live-read-check.cjs`: `ok=true`, estoque filtrado `200`.
- `node tmp-tests/vps-bling-finance-live-read-check.cjs`: `ok=true`, contas a receber/pagar lista e detalhe `200`.
- `node tmp-tests/vps-sitemap-public-compare.cjs`: `ok=true`; sitemap publico atual na Vercel tem `3` URLs, sitemap VPS staging tem `2136` URLs, delta `2133`.

Resultado: todos os testes seguros passaram. A diferenca do sitemap confirma que a VPS ja esta pronta para entregar o SEO completo, enquanto o dominio publico atual ainda depende da Vercel e entrega sitemap pequeno.

Pendencias:

- validar navegador real com `staging.mercadodovale.com.br` apontando para a VPS ou `hosts` local com permissao admin;
- validar login/admin com sessao real;
- executar mutacoes apenas com produto/pedido/pagamento/evento de teste explicitamente escolhido;
- so depois preparar corte DNS do dominio principal.

Rollback: nenhuma mudanca de runtime foi feita nesta etapa.

### 2026-05-22 - Preparacao de testes controlados Shopee/shipping/webhooks

Mudanca: executadas validacoes seguras para preparar os proximos testes controlados de escrita, sem alterar estoque, preco, pedidos, etiquetas ou webhooks reais.

Objetivo: avancar o checklist enquanto o DNS de staging ainda nao esta disponivel publicamente, separando o que ja pode ser validado em modo seguro do que exige escolha explicita de produto/pedido/midia de teste.

Arquivos/infra alterados:

- `migração_VPS.md`

Validacao:

- tentativa de adicionar `76.13.232.162 staging.mercadodovale.com.br` no `hosts` local: negada pelo Windows com `Access denied`; nenhuma entrada foi aplicada.
- `node tmp-tests/vps-shopee-test-candidate-discovery-static.test.mjs`: `ok`.
- `node tmp-tests/vps-shopee-test-candidate-discovery.cjs`: `ok=true`, `candidate_count=50`, `test_like_count=0`; candidatos sanitizados indicam produtos vinculados e ativos, mas nenhum claramente marcado como teste.
- `node tmp-tests/vps-shopee-full-catalog-guarded-check.cjs`: dry-run padrao `ok=true`, `full_catalog_executed=false`, `reason=dry_run_enabled`.
- `DRY_RUN=false CONFIRM_SHOPEE_FULL_CATALOG_READ=I_UNDERSTAND_SHOPEE_FULL_CATALOG_READ SHOPEE_FULL_CATALOG_MAX_PAGES=1 SHOPEE_FULL_CATALOG_MAX_ITEMS=5 SHOPEE_FULL_CATALOG_PAGE_SIZE=5 node tmp-tests/vps-shopee-full-catalog-guarded-check.cjs`: `ok=true`, leitura real pequena executada, `status=200`, `item_count=5`, sem mutacao.
- `node tmp-tests/vps-shipping-quote-guarded-simulation.cjs`: `ok=true`, `quote_sent=false`, `mutation_executed=false`, `reason=missing_SHIPPING_TEST_PROVIDER`.
- `node tmp-tests/vps-melhor-envio-label-guarded-simulation.cjs`: `ok=true`, `label_requested=false`, `mutation_executed=false`, `reason=missing_MELHOR_ENVIO_TEST_CARRIER_ID`.
- `node tmp-tests/vps-mercadopago-webhook-simulation.cjs`: `ok=true`, `webhook_sent=false`, `reason=missing_MERCADOPAGO_TEST_PAYMENT_ID`.
- `node tmp-tests/vps-bling-webhook-simulation.cjs`: `ok=true`, `webhook_sent=false`, `reason=missing_BLING_TEST_WEBHOOK_EVENT`.
- `node tmp-tests/vps-shopee-webhook-order-simulation.cjs`: `ok=true`, `webhook_sent=false`, `reason=missing_SHOPEE_TEST_WEBHOOK_ORDER_SN`.

Resultado: leitura real pequena do catalogo completo Shopee passou pela VPS; os guards de shipping, etiqueta e webhooks continuam sem executar nada por padrao. Ainda nao existe candidato Shopee claramente marcado como teste, entao mutacoes reais seguem bloqueadas ate escolher/criar um item controlado.

Pendencias:

- escolher ou criar produto Shopee de teste para `update_stock`, `update_price`, `add_item` e upload de midia;
- escolher pedido Shopee controlado para `ship_order` e simulacao de webhook;
- escolher pagamento Mercado Pago de teste para simulacao real controlada;
- escolher evento Bling controlado para validar webhook com efeito esperado;
- obter permissao/admin local ou configurar DNS publico para validar `staging.mercadodovale.com.br` no navegador real.

Rollback: nenhuma mudanca de runtime foi feita nesta etapa.

### 2026-05-22 - Checagem DNS para proximo passo de navegador/login

Mudanca: conferido o estado publico dos dominios antes de tentar a validacao real de navegador, login/admin e corte final.

Objetivo: identificar se o bloqueio atual esta em codigo/VPS ou em DNS antes de avancar para testes autenticados.

Arquivos/infra alterados:

- `migração_VPS.md`

Validacao:

- `Resolve-DnsName mercadodovale.com.br`: resolve para `76.76.21.21`, IP da Vercel.
- `Resolve-DnsName www.mercadodovale.com.br`: resolve como `CNAME cname.vercel-dns.com`, com IPs Vercel.
- `Resolve-DnsName staging.mercadodovale.com.br`: sem resposta publica.
- `curl -I https://www.mercadodovale.com.br/sitemap.xml`: `405 Method Not Allowed` pela Vercel em `HEAD`.
- `curl GET https://www.mercadodovale.com.br/sitemap.xml`: `200`, `text/xml`, `644` bytes, indicando sitemap publico atual pequeno na Vercel.
- `curl GET -H "Host: www.mercadodovale.com.br" http://76.13.232.162/sitemap.xml`: `200`, `application/xml`, `511078` bytes, confirmando sitemap completo servido pela VPS com host de producao.
- `curl GET -H "Host: staging.mercadodovale.com.br" http://76.13.232.162/admin/products`: `200`, `text/html`, confirmando fallback SPA staging direto na VPS.

Resultado: o proximo bloqueio nao e codigo da VPS; e DNS/hosts para validar navegador real e sessao admin. O site publico principal ainda depende da Vercel, enquanto a VPS ja responde corretamente quando recebe o `Host` esperado.

Pendencias:

- criar/apontar `staging.mercadodovale.com.br` para `76.13.232.162` ou validar via arquivo `hosts`;
- apos DNS/hosts, abrir staging no navegador real e validar login/admin com sessao;
- depois da regressao autenticada, preparar corte de `mercadodovale.com.br` e `www.mercadodovale.com.br` para a VPS.

Rollback: nenhuma mudanca de runtime foi feita nesta etapa.

### 2026-05-22 - Revalidacao live read-only Bling/Shopee, cron e guards

Mudanca: executada nova rodada do checklist ativo com validacoes read-only pela VPS, conferindo integracoes externas sem mutacao real.

Objetivo: avancar os proximos passos antes do corte final, confirmando que as rotas migradas continuam respondendo e que os guards de escrita permanecem bloqueando execucoes acidentais.

Arquivos/infra alterados:

- `migração_VPS.md`

Rotas afetadas:

- `/api/bling`
- `/api/shopee-actions`
- `/api/shopee-catalog`
- `/api/cron-dispatcher`
- `/sitemap.xml`
- `/produto/:slug`

Validacao:

- `Resolve-DnsName staging.mercadodovale.com.br`: sem resposta publica no momento da checagem.
- `curl https://staging.mercadodovale.com.br/` e `curl http://staging.mercadodovale.com.br/`: sem resposta publica por ausencia de DNS/host acessivel.
- `node tmp-tests/vps-migration-guard-regression.cjs`: `ok=true`, `checked=28`, `failed=0`, `mutation_executed=false`.
- `node tmp-tests/vps-shopee-live-read-check.cjs`: `ok=true`, loja/categorias/logistica/lista de itens/detalhe/modelos `200`; `catalog_categories` retornou `2038` categorias e lista de itens retornou `5` itens.
- `node tmp-tests/vps-shopee-order-live-read-check.cjs`: `ok=true`, pedidos/detalhe/rastreio/escrow `200`, com pedido descoberto automaticamente.
- `node tmp-tests/vps-cron-dispatcher-log-check.cjs`: `ok=true`, crontab com entrada ativa, log existente e ultima execucao real `Cron ran successfully. Dispatched 1 templates.`
- `node tmp-tests/vps-bling-live-read-check.cjs`: `ok=true`, categorias `71`, produtos `100`, NFe `100`, NFCe `34`.
- `node tmp-tests/vps-bling-stock-live-read-check.cjs`: `ok=true`, produto descoberto e estoque filtrado `200`.
- `node tmp-tests/vps-bling-finance-live-read-check.cjs`: `ok=true`, receber lista/detalhe e pagar lista/detalhe `200`.
- `SEO_SPECIAL_SLUGS_LIVE=true node tmp-tests/vps-seo-special-slugs-check.cjs`: `ok=true`, sitemap `200`, `2133` URLs de produto e `8` slugs inspecionados com canonical, OG product e JSON-LD.
- `node tmp-tests/vps-bling-detail-live-read-check.cjs`: primeira tentativa retornou `429` no detalhe de produto Bling e `200` no detalhe de NFe; apos aguardar a janela de rate limit e repetir somente o teste, retornou `ok=true` com detalhe de produto e NFe `200`.
- `node tmp-tests/vps-bling-diagnostics-live-read-check.cjs`: `ok=true`, `debug-product` e `debug-diagnostic` responderam com saida sanitizada.
- `node tmp-tests/vps-bling-image-proxy-live-check.cjs`: `ok=true`, imagem real retornou `200`, `image/png`.
- `node tmp-tests/vps-bling-sync-prices-dry-run-check.cjs`: `ok=true`, `dryRun=true`, `wouldSync=50`, `total=2443`, sem executar `/products/batch`.

Resultado: as leituras reais Bling/Shopee e SEO continuam funcionando pela VPS; o cron esta instalado e com log real de sucesso; as mutacoes seguem bloqueadas por padrao. O unico incidente foi `429` temporario do Bling no detalhe de produto, resolvido com retry apos pausa, indicando limite externo e nao regressao da rota.

Pendencias:

- apontar/validar DNS publico de `staging.mercadodovale.com.br` ou usar `hosts` local definitivo para validar navegador sem proxy;
- validar login/admin real com sessao autenticada e `/api/vps-proxy` protegido;
- executar somente em janela controlada as mutacoes guardadas de Bling, Shopee, webhooks e shipping;
- validar DNS final/browser apos apontamento publico.

Rollback: nenhuma mudanca de runtime foi feita nesta etapa; se alguma regressao aparecer, usar os backups de runtime/Nginx registrados nas entradas anteriores.

### 2026-05-22 - Instalação e validação do Nginx de produção na VPS

Mudanca: instalada a config `infra/nginx/mdv-site-production.conf` na VPS e ajustado o validador SEO para tratar `mercadodovale.com.br` como host raiz que redireciona para o canonical `www`.

Objetivo: remover o bloqueador de `404` em `/sitemap.xml` no host de producao antes do corte de DNS, preservando a regra de canonical em `www.mercadodovale.com.br`.

Arquivos/infra alterados:

- `infra/nginx/mdv-site-production.conf`
- `tmp-tests/vps-seo-production-host-check.cjs`
- `tmp-tests/vps-seo-production-host-check-static.test.mjs`
- `migração_VPS.md`
- `/etc/nginx/sites-available/mdv-site-production.conf`
- `/etc/nginx/sites-enabled/mdv-site-production.conf`

Validacao:

- `node tmp-tests/vps-migration-guard-regression-static.test.mjs`
- `node tmp-tests/vps-migration-guard-regression.cjs`: `ok=true`, `checked=28`, `failed=0`, `mutation_executed=false`.
- `node tmp-tests/vps-seo-production-host-check-static.test.mjs`: falhou antes do ajuste por falta de `redirect_ok`; passou depois.
- `node tmp-tests/vps-nginx-production-config-static.test.mjs`
- `node tmp-tests/vps-nginx-production-config-install-static.test.mjs`
- `node tmp-tests/vps-nginx-production-config-install.cjs`: dry-run com `reason=dry_run_enabled`.
- `DRY_RUN=false CONFIRM_NGINX_PRODUCTION_INSTALL=I_UNDERSTAND_NGINX_PRODUCTION_INSTALL node tmp-tests/vps-nginx-production-config-install.cjs`: `installed=true`, backup remoto criado, `nginx -t` e reload executados.
- `curl -I -H "Host: mercadodovale.com.br" http://76.13.232.162/sitemap.xml`: `301`, `Location: https://www.mercadodovale.com.br/sitemap.xml`.
- `curl -I -H "Host: www.mercadodovale.com.br" http://76.13.232.162/sitemap.xml`: `200`, `Content-Type: application/xml; charset=utf-8`.
- `SEO_PRODUCTION_HOST_LIVE=true node tmp-tests/vps-seo-production-host-check.cjs`: `ok=true`, redirect raiz `301`, sitemap `200`, `2136` URLs, `2133` URLs de produto, 3 produtos `200` com canonical/OG/JSON-LD.
- `SEO_PRODUCTION_HOST_LIVE=true SEO_PRODUCTION_HOST=www.mercadodovale.com.br node tmp-tests/vps-seo-production-host-check.cjs`: `ok=true`.
- `SEO_SPECIAL_SLUGS_LIVE=true SEO_SPECIAL_SLUGS_LIMIT=5 SEO_SPECIAL_SLUGS_HOST=www.mercadodovale.com.br SEO_SPECIAL_SLUGS_SITEMAP_URL=http://76.13.232.162/sitemap.xml node tmp-tests/vps-seo-special-slugs-check.cjs`: `ok=true`, 5 slugs especiais com `200`, canonical `www.mercadodovale.com.br`, `og:type=product`, `2` JSON-LD e sem canonical da home.

Resultado: o host de producao no IP da VPS deixou de retornar `404`; a config Nginx de producao serve sitemap/produtos no `www` e redireciona o dominio raiz para o canonical.

Pendencias:

- validar DNS final/browser apos apontamento publico;
- manter rollback via backup remoto do arquivo em `/etc/nginx/sites-available/mdv-site-production.conf.backup.*` se houver regressao;
- seguir com validacao de navegador/login/admin real e execucoes controladas restantes.

Rollback: restaurar backup remoto da config anterior em `/etc/nginx/sites-available/mdv-site-production.conf.backup.*`, rodar `nginx -t` e recarregar Nginx.

### 2026-05-22 - Validacao browser do staging e ajuste /vps-proxy

Mudanca: corrigido o caminho legado `/vps-proxy` no Nginx staging/producao para encaminhar ao Fastify, liberado tracking publico de banners no guard do `/api/vps-proxy` sem abrir rotas protegidas, e adicionada a origem `https://staging.mercadodovale.com.br` no CORS da VPS.

Objetivo: validar a vitrine no navegador contra a VPS antes do DNS publico, mantendo protecoes de admin e testes sem mutacao real para writes sensiveis.

Arquivos alterados:

- `infra/nginx/mdv-site-staging.conf`
- `infra/nginx/mdv-site-production.conf`
- `vps_server.js`
- `vps_server.cjs`
- `api/vps-proxy.ts`
- `tmp-tests/vps-nginx-staging-config-static.test.mjs`
- `tmp-tests/vps-nginx-production-config-static.test.mjs`
- `tmp-tests/vps-proxy-fastify-route-static.test.mjs`
- `tmp-tests/vps-cors-origins-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-nginx-staging-config-static.test.mjs`: ok.
- `node tmp-tests/vps-nginx-production-config-static.test.mjs`: ok.
- `node tmp-tests/vps-nginx-production-config-install-static.test.mjs`: ok.
- instalacao Nginx staging/producao na VPS com `nginx -t` e reload: ok, backups remotos criados.
- `node tmp-tests/vps-cors-origins-static.test.mjs`: ok.
- `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`: ok.
- `npx tsx tmp-tests/vps-proxy-target.test.ts`: ok.
- `node --check vps_server.js`: ok.
- `node --check vps_server.cjs`: ok.
- deploy do `vps_server.js` para `/var/www/mdv-api/server.js` e `/var/www/mdv-api/vps_server.js` com backup e `pm2 restart mdv-api`: ok, ultimo backup `20260522142638`.
- `curl POST /vps-proxy?path=/banners/00000000-0000-4000-8000-000000000000/view` com `Origin: https://staging.mercadodovale.com.br`: `200`, `{"ok":true}`, sem alterar banner real.
- `curl POST /vps-proxy?path=/banners/00000000-0000-4000-8000-000000000000/view` com `Origin: https://www.mercadodovale.com.br`: `200`, `{"ok":true}`.
- `curl /vps-proxy?path=/company-settings` sem sessao: `403`, `{"error":"Admin required"}`.
- `STAGING_FRONTEND_PROXY_LIVE=true node tmp-tests/vps-staging-frontend-proxy-check.cjs`: `ok=true`; `/`, `/admin/products`, status e produtos `200`; `/company-settings` sem sessao `403`.
- browser via proxy local simulando Origin real de staging: vitrine renderizou produtos, tracking de banner `200`, console sem erros de rede/JSON; screenshot `reports/vps-staging-browser-origin-proxy-home.png`.
- `node tmp-tests/vps-migration-guard-regression.cjs`: `ok=true`, `checked=28`, `failed=0`, `mutation_executed=false`.
- `npm run build`: primeira execucao bloqueada pelo sandbox ao ler `vite.config.ts`; repetida fora do sandbox e concluida com sucesso.

Resultado: a vitrine staging na VPS foi validada em navegador com o mesmo perfil de Origin esperado para o dominio real; o fallback SPA e os dados publicos passam pelo Nginx/Fastify sem HTML sendo interpretado como JSON; tracking publico de banner funciona sem credencial e rotas protegidas continuam bloqueadas.

Pendencias:

- apontar/validar DNS publico de `staging.mercadodovale.com.br` ou usar hosts local definitivo;
- validar login/admin real com sessao autenticada;
- manter observacao sobre chamadas diretas restantes ao Supabase, que ainda existem em partes da vitrine, mas nao bloquearam a renderizacao no teste atual.

Rollback: restaurar backups remotos do Nginx em `/etc/nginx/sites-available/*.backup.*` e do servidor em `/var/www/mdv-api/.codex-backups/*20260522142638.bak`, depois rodar `nginx -t`, recarregar Nginx e `pm2 restart mdv-api --update-env`.

### 2026-05-22 - Revalidacao local do checklist frontend VPS

Mudanca: reexecutadas as validacoes locais do bloco de deploy estatico do frontend VPS e alinhado o plano `2026-05-20-vps-staging-frontend.md` com os passos ja concluidos.

Objetivo: manter o checklist testado antes de avancar para etapas com credencial/VPS real, sem trocar DNS nem redeployar producao.

Arquivos alterados:

- `docs/superpowers/plans/2026-05-20-vps-staging-frontend.md`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-site-deploy-script-static.test.mjs`: ok.
- `node tmp-tests/vps-migration-guard-regression-static.test.mjs`: ok.
- `node tmp-tests/vps-migration-guard-regression.cjs`: `ok=true`, `checked=28`, `failed=0`, `mutation_executed=false`.
- `npm run build`: primeira execucao bloqueada pelo sandbox ao ler `vite.config.ts`; repetida fora do sandbox e concluida com sucesso.

Resultado: o bloco de frontend VPS segue valido localmente e os guards continuam impedindo mutacoes por padrao.

Pendencias:

- instalar/ativar Nginx de producao na VPS para `mercadodovale.com.br` e `www.mercadodovale.com.br`;
- repetir validacao SEO do host de producao no IP da VPS;
- validar navegador/login/admin real no staging quando DNS/hosts estiver disponivel.

Rollback: nenhum; validacao e registro documental apenas.

### 2026-05-22 - Revalidacao SEO de slugs especiais no staging

Mudanca: reexecutada a validacao read-only de slugs especiais do sitemap staging antes de avançar no checklist.

Objetivo: confirmar novamente que a rota SEO de produto na VPS segue gerando HTML valido para slugs longos/especiais enquanto o host de producao ainda depende da instalacao Nginx.

Arquivos alterados:

- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-migration-guard-regression-static.test.mjs`
- `node tmp-tests/vps-migration-guard-regression.cjs`: `checked=28`, `failed=0`, `mutation_executed=false`.
- `node tmp-tests/vps-seo-special-slugs-check-static.test.mjs`
- `node --check tmp-tests/vps-seo-special-slugs-check.cjs`
- `node tmp-tests/vps-seo-special-slugs-check.cjs`: `live_read=false`, `reason=missing_SEO_SPECIAL_SLUGS_LIVE_true`.
- `SEO_SPECIAL_SLUGS_LIVE=true SEO_SPECIAL_SLUGS_LIMIT=8 node tmp-tests/vps-seo-special-slugs-check.cjs`: `ok=true`, sitemap staging `200`, `2133` URLs de produto, `8` slugs inspecionados, todos com HTTP `200`, canonical para `staging.mercadodovale.com.br`, `og:type=product`, `2` JSON-LD e sem canonical da home.

Resultado: SEO de produto no staging segue consistente para slugs especiais. O bloqueador restante de SEO continua restrito ao host de producao/Nginx.

Pendencias:

- instalar config Nginx de producao;
- repetir validacao do host `www.mercadodovale.com.br` no IP da VPS;
- depois disso, validar DNS final.

Rollback: nenhum; registro documental apenas.

### 2026-05-22 - Revalidacao live OAuth e SEO producao

Mudanca: reexecutados preflight OAuth live e leitura SEO do host de producao no IP da VPS, sem trocar codigo OAuth nem instalar Nginx.

Objetivo: manter o checklist testado antes das etapas que exigem acao externa real, separando rotas OAuth funcionais do bloqueador atual de Nginx producao.

Arquivos alterados:

- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-oauth-preflight-check-static.test.mjs`
- `node --check tmp-tests/vps-oauth-preflight-check.cjs`
- `node tmp-tests/vps-oauth-preflight-check.cjs`: `live_read=false`, `reason=missing_OAUTH_PREFLIGHT_LIVE_true`.
- `OAUTH_PREFLIGHT_LIVE=true node tmp-tests/vps-oauth-preflight-check.cjs`: `ok=true`, Bling callback sem code `302`, Bling exchange sem credenciais `400`, Shopee callback sem parametros `400`, Shopee auth `200` com `auth_host=partner.shopeemobile.com` e `redirect_host=www.mercadodovale.com.br`.
- `node tmp-tests/vps-seo-production-host-check-static.test.mjs`
- `node --check tmp-tests/vps-seo-production-host-check.cjs`
- `node tmp-tests/vps-seo-production-host-check.cjs`: `live_read=false`, `reason=missing_SEO_PRODUCTION_HOST_LIVE_true`.
- `SEO_PRODUCTION_HOST_LIVE=true node tmp-tests/vps-seo-production-host-check.cjs`: `ok=false`, `/sitemap.xml` `404` para `mercadodovale.com.br`.
- `SEO_PRODUCTION_HOST_LIVE=true SEO_PRODUCTION_HOST=www.mercadodovale.com.br node tmp-tests/vps-seo-production-host-check.cjs`: `ok=false`, `/sitemap.xml` `404` para `www.mercadodovale.com.br`.
- `node tmp-tests/vps-nginx-production-config-static.test.mjs`
- `node tmp-tests/vps-nginx-production-config-install-static.test.mjs`
- `node tmp-tests/vps-nginx-production-config-install.cjs`: `installed=false`, `dry_run=true`, `reason=missing_VPS_SITE_HOST`.

Resultado: OAuth preflight segue consistente e sanitizado. SEO producao continua bloqueado ate instalar/ativar a config Nginx de producao na VPS.

Pendencias:

- reconectar Bling e Shopee com codigo real valido em janela controlada;
- fornecer host/credencial de instalacao Nginx ou executar o instalador guardado na janela de corte;
- repetir `SEO_PRODUCTION_HOST_LIVE=true SEO_PRODUCTION_HOST=www.mercadodovale.com.br node tmp-tests/vps-seo-production-host-check.cjs` apos instalar a config.

Rollback: nenhum; registro documental apenas.

### 2026-05-22 - Revalidacao live do staging frontend/proxy

Mudanca: reexecutada a validacao live do staging frontend e do proxy VPS em modo somente leitura.

Objetivo: confirmar que o site estatico servido pela VPS, o fallback SPA de admin e o proxy publico continuam respondendo antes de avançar para testes com sessao real.

Arquivos alterados:

- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-staging-frontend-proxy-check-static.test.mjs`
- `STAGING_FRONTEND_PROXY_LIVE=true node tmp-tests/vps-staging-frontend-proxy-check.cjs`: `ok=true`, `live_read=true`, raiz `200`, `/admin/products` `200`, `/api/vps-proxy?path=/status` `200`, `/api/vps-proxy?path=/products?limit=1` `200`, `/api/vps-proxy?path=/company-settings` `403`.

Resultado: staging publico e proxy VPS seguem respondendo conforme esperado; a rota sensivel de configuracoes continua bloqueada sem sessao.

Pendencias:

- validar no navegador com DNS/hosts local;
- fazer login admin real e repetir `/api/vps-proxy` com sessao autenticada.

Rollback: nenhum; registro documental apenas.

### 2026-05-22 - Regressão agregada dos guards da migração

Mudanca: criado runner local para executar os guards e testes estaticos principais da migração VPS em modo seguro, sem configurar confirmações nem desativar dry-run.

Objetivo: ter um comando único de regressão antes de qualquer execução controlada, cobrindo escrita Bling, escrita Shopee, webhooks, shipping, OAuth, SEO de produção e instalação Nginx guardada.

Arquivos alterados:

- `tmp-tests/vps-migration-guard-regression.cjs`
- `tmp-tests/vps-migration-guard-regression-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-migration-guard-regression-static.test.mjs`
- `node --check tmp-tests/vps-migration-guard-regression.cjs`
- `node tmp-tests/vps-migration-guard-regression.cjs`: `checked=28`, `failed=0`, `mutation_executed=false`.

Resultado: os guards principais continuam seguros por padrão. O runner falha se algum script sair com erro ou se aparecer marcador de execução real como `mutation_executed=true`, `quote_sent=true`, `label_requested=true`, `webhook_sent=true`, `live_read=true` ou `install_executed=true`.

Pendencias:

- rodar este comando antes de cada janela real de OAuth, webhook, shipping, Bling/Shopee escrita ou instalação Nginx;
- expandir o runner se novos guards forem adicionados ao checklist.

Rollback: remover os dois arquivos `tmp-tests/vps-migration-guard-regression*`; nenhuma infra foi alterada.

### 2026-05-22 - Guard para Shopee add_item e mídia controlados

Mudanca: criado runner guardado para validar `add_item`, `upload_image` e `upload_video` pela VPS sem publicar produto nem enviar mídia para a Shopee por acidente.

Objetivo: completar a cobertura de escrita Shopee pendente no checklist, separando publicação de item e upload de mídia em modos explícitos, sempre com dry-run por padrão.

Arquivos alterados:

- `tmp-tests/vps-shopee-add-item-media-guarded-check.cjs`
- `tmp-tests/vps-shopee-add-item-media-guarded-check-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-shopee-add-item-media-guarded-check-static.test.mjs`
- `node --check tmp-tests/vps-shopee-add-item-media-guarded-check.cjs`
- `node tmp-tests/vps-shopee-add-item-media-guarded-check.cjs`: `mutation_executed=false`, `reason=missing_SHOPEE_TEST_WRITE_KIND`.
- `SHOPEE_TEST_WRITE_KIND=add_item SHOPEE_TEST_ADD_ITEM_PRODUCT_ID=product-test node tmp-tests/vps-shopee-add-item-media-guarded-check.cjs`: `mutation_executed=false`, `reason=dry_run_enabled`.
- `SHOPEE_TEST_WRITE_KIND=upload_image SHOPEE_TEST_MEDIA_DATA_URL=not-data-url node tmp-tests/vps-shopee-add-item-media-guarded-check.cjs`: `mutation_executed=false`, `reason=missing_or_invalid_SHOPEE_TEST_MEDIA_DATA_URL`.
- `SHOPEE_TEST_WRITE_KIND=add_item SHOPEE_TEST_ADD_ITEM_PRODUCT_ID=product-test DRY_RUN=false node tmp-tests/vps-shopee-add-item-media-guarded-check.cjs`: `mutation_executed=false`, `reason=missing_explicit_confirmation`.

Resultado: `add_item`, `upload_image` e `upload_video` ficaram preparados para janela controlada, mas nenhuma mutacao real foi executada. O envio so ocorre com `DRY_RUN=false`, `CONFIRM_SHOPEE_TEST_ADD_ITEM_MEDIA=I_UNDERSTAND_SHOPEE_TEST_ADD_ITEM_MEDIA` e dados explícitos para o modo escolhido.

Pendencias:

- selecionar produto local sem vínculo Shopee para `add_item`;
- selecionar imagem/vídeo de teste explicitamente autorizado para upload;
- conferir no painel Shopee e no vínculo local antes de considerar a escrita Shopee validada.

Rollback: remover os dois arquivos `tmp-tests/vps-shopee-add-item-media-guarded-check*`; nenhuma infra foi alterada.

### 2026-05-22 - Guard para Bling financeiro controlado

Mudanca: criado runner guardado para validar mutacoes financeiras Bling via `/api/bling?resource=finance` sem executar criacao, atualizacao, baixa ou cancelamento por acidente.

Objetivo: preparar a validacao controlada de `create`, `update`, `baixar` e `cancelar` para `pagar|receber`, mantendo Authorization e corpo financeiro apenas em variaveis de ambiente e imprimindo somente metadados sanitizados.

Arquivos alterados:

- `tmp-tests/vps-bling-finance-mutation-guarded-check.cjs`
- `tmp-tests/vps-bling-finance-mutation-guarded-check-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-bling-finance-mutation-guarded-check-static.test.mjs`
- `node --check tmp-tests/vps-bling-finance-mutation-guarded-check.cjs`
- `node tmp-tests/vps-bling-finance-mutation-guarded-check.cjs`: `mutation_executed=false`, `reason=missing_BLING_FINANCE_TEST_ACTION`.
- `BLING_FINANCE_TEST_ACTION=create BLING_FINANCE_TEST_RESOURCE_TYPE=receber BLING_FINANCE_TEST_AUTHORIZATION="Bearer TEST" BLING_FINANCE_TEST_BODY_JSON='{"descricao":"teste"}' node tmp-tests/vps-bling-finance-mutation-guarded-check.cjs`: `mutation_executed=false`, `reason=dry_run_enabled`.
- `BLING_FINANCE_TEST_ACTION=create BLING_FINANCE_TEST_RESOURCE_TYPE=receber BLING_FINANCE_TEST_AUTHORIZATION="Bearer TEST" BLING_FINANCE_TEST_BODY_JSON='{"descricao":"teste"}' DRY_RUN=false node tmp-tests/vps-bling-finance-mutation-guarded-check.cjs`: `mutation_executed=false`, `reason=missing_explicit_confirmation`.
- `BLING_FINANCE_TEST_ACTION=cancelar BLING_FINANCE_TEST_RESOURCE_TYPE=pagar BLING_FINANCE_TEST_AUTHORIZATION="Bearer TEST" node tmp-tests/vps-bling-finance-mutation-guarded-check.cjs`: `mutation_executed=false`, `reason=missing_BLING_FINANCE_TEST_ID`.
- `node tmp-tests/vps-bling-finance-fastify-static.test.mjs`

Resultado: mutacoes financeiras Bling ficaram preparadas para janela controlada, mas nenhuma mutacao real foi executada. O envio so ocorre com `DRY_RUN=false`, `CONFIRM_BLING_FINANCE_MUTATION=I_UNDERSTAND_BLING_FINANCE_MUTATION`, Authorization explicita, `resourceType` valido e payload/id conforme a acao.

Pendencias:

- definir uma conta financeira de teste para `update`, `baixar` ou `cancelar`;
- definir payload minimo seguro para `create` em `pagar` ou `receber`;
- conferir no Bling e na VPS o efeito financeiro antes de liberar callbacks/corte final.

Rollback: remover os dois arquivos `tmp-tests/vps-bling-finance-mutation-guarded-check*`; nenhuma infra foi alterada.

### 2026-05-22 - Guard para Bling fiscal/dimensões controlado

Mudanca: criado runner guardado para validar `/api/bling?resource=product-update-fiscal` e `/api/bling?resource=product-update-dimensions` sem executar mutacao real por acidente.

Objetivo: preparar a validacao controlada de atualizacoes fiscais e logisticas de produto no Bling, mantendo dupla trava antes de qualquer POST real.

Arquivos alterados:

- `tmp-tests/vps-bling-product-update-guarded-check.cjs`
- `tmp-tests/vps-bling-product-update-guarded-check-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-bling-product-update-guarded-check-static.test.mjs`
- `node --check tmp-tests/vps-bling-product-update-guarded-check.cjs`
- `node tmp-tests/vps-bling-product-update-guarded-check.cjs`: `mutation_executed=false`, `reason=missing_BLING_TEST_PRODUCT_UPDATE_BLING_ID`.
- `BLING_TEST_PRODUCT_UPDATE_BLING_ID=123456 BLING_TEST_PRODUCT_UPDATE_NCM=12345678 node tmp-tests/vps-bling-product-update-guarded-check.cjs`: `mutation_executed=false`, `reason=dry_run_enabled`.
- `BLING_PRODUCT_UPDATE_KIND=dimensions BLING_TEST_PRODUCT_UPDATE_BLING_IDS=1,2,3,4 BLING_TEST_PRODUCT_UPDATE_PESO_BRUTO=1 node tmp-tests/vps-bling-product-update-guarded-check.cjs`: `mutation_executed=false`, `reason=too_many_bling_ids`.
- `BLING_TEST_PRODUCT_UPDATE_BLING_ID=123456 BLING_TEST_PRODUCT_UPDATE_NCM=12345678 DRY_RUN=false node tmp-tests/vps-bling-product-update-guarded-check.cjs`: `mutation_executed=false`, `reason=missing_explicit_confirmation`.

Resultado: atualizacao fiscal/dimensoes ficou preparada para janela controlada, mas nenhuma mutacao real foi executada. O envio so ocorre com `DRY_RUN=false` e `CONFIRM_BLING_PRODUCT_UPDATE=I_UNDERSTAND_BLING_PRODUCT_UPDATE`, alem de IDs e campos explicitamente informados.

Pendencias:

- selecionar produto Bling explicitamente controlado para teste fiscal;
- selecionar ate `3` produtos Bling controlados para teste de dimensoes/peso;
- conferir no Bling e na VPS se a atualizacao preserva estoque e demais campos do cadastro.

Rollback: remover os dois arquivos `tmp-tests/vps-bling-product-update-guarded-check*`; nenhuma infra foi alterada.

### 2026-05-22 - Guard para Bling stock-sync controlado

Mudanca: criado runner guardado para validar baixa de estoque Bling via `/api/bling?resource=stock-sync` sem executar mutacao real por acidente.

Objetivo: preparar a validacao controlada de `stock-sync`, que grava movimento de saida no Bling, mantendo dupla trava antes de qualquer POST real.

Arquivos alterados:

- `tmp-tests/vps-bling-stock-sync-guarded-check.cjs`
- `tmp-tests/vps-bling-stock-sync-guarded-check-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-bling-stock-sync-guarded-check-static.test.mjs`
- `node --check tmp-tests/vps-bling-stock-sync-guarded-check.cjs`
- `node tmp-tests/vps-bling-stock-sync-guarded-check.cjs`: `mutation_executed=false`, `reason=missing_BLING_TEST_STOCK_SYNC_BLING_ID`.
- `BLING_TEST_STOCK_SYNC_BLING_ID=123456 BLING_TEST_STOCK_SYNC_QUANTITY=1 node tmp-tests/vps-bling-stock-sync-guarded-check.cjs`: `mutation_executed=false`, `reason=dry_run_enabled`.
- `BLING_TEST_STOCK_SYNC_BLING_ID=123456 BLING_TEST_STOCK_SYNC_QUANTITY=6 node tmp-tests/vps-bling-stock-sync-guarded-check.cjs`: `mutation_executed=false`, `reason=quantity_above_guard_limit`.
- `BLING_TEST_STOCK_SYNC_BLING_ID=123456 BLING_TEST_STOCK_SYNC_QUANTITY=1 DRY_RUN=false node tmp-tests/vps-bling-stock-sync-guarded-check.cjs`: `mutation_executed=false`, `reason=missing_explicit_confirmation`.
- `node tmp-tests/vps-bling-stock-fastify-static.test.mjs`

Resultado: a baixa de estoque Bling ficou preparada para janela controlada, mas nenhuma mutacao real foi executada. O envio so ocorre com `BLING_TEST_STOCK_SYNC_BLING_ID`, `BLING_TEST_STOCK_SYNC_QUANTITY` entre `1` e `5`, `DRY_RUN=false` e `CONFIRM_BLING_STOCK_SYNC=I_UNDERSTAND_BLING_STOCK_SYNC`.

Pendencias:

- selecionar produto Bling explicitamente controlado para teste;
- executar uma baixa pequena e conferir movimento/estoque no Bling e na VPS;
- decidir se o limite operacional do guard deve continuar em `5` unidades para testes futuros.

Rollback: remover os dois arquivos `tmp-tests/vps-bling-stock-sync-guarded-check*`; nenhuma infra foi alterada.

### 2026-05-22 - Preflight OAuth Bling/Shopee pela VPS

Mudanca: criado runner sanitizado para validar rotas OAuth da VPS sem trocar codigo real nem imprimir URL assinada completa.

Objetivo: reduzir risco antes da reconexao real de Bling e Shopee, comprovando callbacks/validacoes e geracao da URL de autorizacao Shopee.

Arquivos alterados:

- `tmp-tests/vps-oauth-preflight-check.cjs`
- `tmp-tests/vps-oauth-preflight-check-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-oauth-preflight-check-static.test.mjs`
- `node --check tmp-tests/vps-oauth-preflight-check.cjs`
- `node tmp-tests/vps-oauth-preflight-check.cjs`: `live_read=false`, `reason=missing_OAUTH_PREFLIGHT_LIVE_true`.
- `OAUTH_PREFLIGHT_LIVE=true node tmp-tests/vps-oauth-preflight-check.cjs`: Bling callback sem code retornou `302` para `/admin/settings/bling`; Bling exchange vazio retornou `400 Missing client_id or client_secret`; Shopee callback sem parametros retornou `400`; Shopee auth retornou `200`, `auth_host=partner.shopeemobile.com`, `auth_path=/api/v2/shop/auth_partner`, `redirect_host=www.mercadodovale.com.br`.
- `node tmp-tests/vps-bling-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-oauth-fastify-static.test.mjs`

Resultado: preflight OAuth da VPS passou sem troca de token real. A URL assinada/partner id/signature nao foram impressos; apenas host/path e host de redirect foram registrados.

Pendencias:

- reconectar Bling com codigo OAuth valido gerado no provedor;
- reconectar Shopee com codigo/shop_id validos;
- decidir se `SHOPEE_REDIRECT_BASE_URL` deve continuar em `www.mercadodovale.com.br` ou apontar temporariamente para dominio/API da VPS enquanto o DNS principal nao corta.

Rollback: remover os dois arquivos `tmp-tests/vps-oauth-preflight-check*`; nenhuma infra foi alterada.

### 2026-05-22 - Validação pública de staging frontend e vps-proxy

Mudanca: criado runner read-only para validar a superficie publica do staging pela VPS antes da validacao de navegador com sessao real.

Objetivo: isolar a pendencia de login/admin real comprovando que Nginx staging, fallback SPA e `/api/vps-proxy` respondem corretamente sem credenciais.

Arquivos alterados:

- `tmp-tests/vps-staging-frontend-proxy-check.cjs`
- `tmp-tests/vps-staging-frontend-proxy-check-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-staging-frontend-proxy-check-static.test.mjs`
- `node --check tmp-tests/vps-staging-frontend-proxy-check.cjs`
- `node tmp-tests/vps-staging-frontend-proxy-check.cjs`: `live_read=false`, `reason=missing_STAGING_FRONTEND_PROXY_LIVE_true`.
- `STAGING_FRONTEND_PROXY_LIVE=true node tmp-tests/vps-staging-frontend-proxy-check.cjs`: `/` HTTP `200` HTML, `/admin/products` HTTP `200` HTML, `/api/vps-proxy?path=/status` HTTP `200`, `/api/vps-proxy?path=/products?limit=1` HTTP `200`, `/api/vps-proxy?path=/company-settings` HTTP `403` sem sessao.
- `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`

Resultado: a parte publica do staging e o contrato sem sessao do `/api/vps-proxy` estao validados. A pendencia restante permanece limitada a DNS/hosts local, navegador e login/admin real com sessao.

Pendencias:

- configurar DNS/hosts para `staging.mercadodovale.com.br` abrir no navegador;
- validar login/admin real e chamadas protegidas de `/api/vps-proxy` com sessao;
- repetir fluxo no host de producao apos instalar Nginx de producao.

Rollback: remover os dois arquivos `tmp-tests/vps-staging-frontend-proxy-check*`; nenhuma infra foi alterada.

### 2026-05-22 - Preparação do host SEO de produção

Mudanca: criados validador read-only do host de produção, config Nginx de produção e instalador guardado para publicar a config na VPS.

Objetivo: fechar a etapa "validar host de produção antes do DNS final" sem depender da Vercel, comprovando `/sitemap.xml` e `/produto/:slug` com `Host: mercadodovale.com.br`/`www.mercadodovale.com.br`.

Arquivos alterados:

- `infra/nginx/mdv-site-production.conf`
- `tmp-tests/vps-nginx-production-config-static.test.mjs`
- `tmp-tests/vps-nginx-production-config-install.cjs`
- `tmp-tests/vps-nginx-production-config-install-static.test.mjs`
- `tmp-tests/vps-seo-production-host-check.cjs`
- `tmp-tests/vps-seo-production-host-check-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-seo-production-host-check-static.test.mjs`
- `node --check tmp-tests/vps-seo-production-host-check.cjs`
- `node tmp-tests/vps-seo-production-host-check.cjs`: `live_read=false`, `reason=missing_SEO_PRODUCTION_HOST_LIVE_true`.
- `SEO_PRODUCTION_HOST_LIVE=true node tmp-tests/vps-seo-production-host-check.cjs`: com `Host: mercadodovale.com.br`, `/sitemap.xml` retornou `404` no IP da VPS.
- `SEO_PRODUCTION_HOST_LIVE=true SEO_PRODUCTION_HOST=www.mercadodovale.com.br node tmp-tests/vps-seo-production-host-check.cjs`: com `Host: www.mercadodovale.com.br`, `/sitemap.xml` retornou `404` no IP da VPS.
- `node tmp-tests/vps-nginx-production-config-static.test.mjs`
- `node tmp-tests/vps-nginx-production-config-install-static.test.mjs`
- `node --check tmp-tests/vps-nginx-production-config-install.cjs`
- `node tmp-tests/vps-nginx-production-config-install.cjs`: `installed=false`, `reason=missing_VPS_SITE_HOST`.

Resultado: o checklist achou uma pendencia real antes do DNS: a VPS ainda nao responde pelos hosts de producao no Nginx. A config local foi preparada para redirecionar `mercadodovale.com.br` para `https://www.mercadodovale.com.br$request_uri` e servir site/API/SEO no `www`; a instalacao ficou bloqueada porque o ambiente local nao tem `VPS_SITE_HOST`/`VPS_SITE_USER`/credencial SSH disponiveis para este instalador.

Pendencias:

- fornecer `VPS_SITE_HOST`, `VPS_SITE_USER` e `VPS_SITE_PASSWORD` ou `VPS_SITE_PRIVATE_KEY`, ou aprovar outro mecanismo de acesso existente;
- executar `DRY_RUN=false CONFIRM_NGINX_PRODUCTION_INSTALL=I_UNDERSTAND_NGINX_PRODUCTION_INSTALL node tmp-tests/vps-nginx-production-config-install.cjs`;
- repetir `SEO_PRODUCTION_HOST_LIVE=true SEO_PRODUCTION_HOST=www.mercadodovale.com.br node tmp-tests/vps-seo-production-host-check.cjs`;
- decidir se o host raiz deve apenas redirecionar para `www` ou tambem servir canonical sem `www`.

Rollback: remover `infra/nginx/mdv-site-production.conf` e os arquivos `tmp-tests/vps-nginx-production-config-*`/`tmp-tests/vps-seo-production-host-check*`; nenhuma infra foi alterada nesta etapa.

### 2026-05-22 - Validação SEO de slugs especiais no staging

Mudanca: criado verificador read-only para selecionar slugs especiais do sitemap staging e validar HTML SEO de produto pela VPS.

Objetivo: fechar a pendencia de revisao de slugs especiais antes do DNS final, garantindo canonical, Open Graph de produto e JSON-LD sem depender da Vercel.

Arquivos alterados:

- `tmp-tests/vps-seo-special-slugs-check.cjs`
- `tmp-tests/vps-seo-special-slugs-check-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-seo-special-slugs-check-static.test.mjs`
- `node --check tmp-tests/vps-seo-special-slugs-check.cjs`
- `node tmp-tests/vps-seo-special-slugs-check.cjs`: `live_read=false`, `reason=missing_SEO_SPECIAL_SLUGS_LIVE_true`.
- `SEO_SPECIAL_SLUGS_LIVE=true SEO_SPECIAL_SLUGS_LIMIT=8 node tmp-tests/vps-seo-special-slugs-check.cjs`: sitemap staging HTTP `200`, `2133` URLs de produto, `8` slugs inspecionados com HTTP `200`, `text/html`, canonical para `staging.mercadodovale.com.br`, `og:type=product`, `2` blocos JSON-LD e sem canonical da home.

Resultado: slugs longos, numericos e com muitos segmentos retornaram HTML SEO correto via VPS staging. Nenhum endpoint mutante foi chamado; o script usa apenas GET publico.

Pendencias:

- repetir com host de producao apontando para a VPS antes do corte DNS final;
- revisar se a queda de `2136` para `2133` URLs entre validacoes de sitemap era esperada por alteracao de catalogo/SEO.

Rollback: remover os dois arquivos `tmp-tests/vps-seo-special-slugs-check*`; nenhuma infra foi alterada.

### 2026-05-22 - Guard para simulacao de etiqueta Melhor Envio

Mudanca: criado runner guardado para validar o fluxo de etiqueta Melhor Envio no `/api/shipping?provider=melhor-envio&action=label` sem criar carrinho, checkout ou etiqueta por acidente.

Objetivo: preparar a validacao controlada da parte mais sensivel do shipping migrado para a VPS, separando etiqueta do guard de cotacao.

Arquivos alterados:

- `tmp-tests/vps-melhor-envio-label-guarded-simulation.cjs`
- `tmp-tests/vps-melhor-envio-label-guarded-simulation-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-melhor-envio-label-guarded-simulation-static.test.mjs`
- `node --check tmp-tests/vps-melhor-envio-label-guarded-simulation.cjs`
- `node tmp-tests/vps-melhor-envio-label-guarded-simulation.cjs`: `label_requested=false`, `reason=missing_MELHOR_ENVIO_TEST_CARRIER_ID`.
- `MELHOR_ENVIO_TEST_CARRIER_ID=1 MELHOR_ENVIO_TEST_FROM_CEP=56300000 MELHOR_ENVIO_TEST_TO_NAME="Cliente Teste" MELHOR_ENVIO_TEST_TO_DOCUMENT=00000000000 MELHOR_ENVIO_TEST_TO_ADDRESS="Rua Teste" MELHOR_ENVIO_TEST_TO_CITY=Petrolina MELHOR_ENVIO_TEST_TO_DISTRICT=Centro MELHOR_ENVIO_TEST_TO_STATE=PE MELHOR_ENVIO_TEST_TO_POSTAL_CODE=56300000 MELHOR_ENVIO_TEST_TO_NUMBER=1 node tmp-tests/vps-melhor-envio-label-guarded-simulation.cjs`: `label_requested=false`, `reason=dry_run_enabled`.
- `MELHOR_ENVIO_TEST_TOKEN=TEST_TOKEN MELHOR_ENVIO_TEST_CARRIER_ID=1 MELHOR_ENVIO_TEST_FROM_CEP=56300000 MELHOR_ENVIO_TEST_TO_NAME="Cliente Teste" MELHOR_ENVIO_TEST_TO_DOCUMENT=00000000000 MELHOR_ENVIO_TEST_TO_ADDRESS="Rua Teste" MELHOR_ENVIO_TEST_TO_CITY=Petrolina MELHOR_ENVIO_TEST_TO_DISTRICT=Centro MELHOR_ENVIO_TEST_TO_STATE=PE MELHOR_ENVIO_TEST_TO_POSTAL_CODE=56300000 MELHOR_ENVIO_TEST_TO_NUMBER=1 DRY_RUN=false node tmp-tests/vps-melhor-envio-label-guarded-simulation.cjs`: `label_requested=false`, `reason=missing_explicit_confirmation`.
- `node tmp-tests/vps-shipping-fastify-static.test.mjs`

Resultado: a simulacao de etiqueta Melhor Envio ficou preparada, mas nenhuma etiqueta foi solicitada. O envio so ocorre com dados completos do destinatario/produto, `MELHOR_ENVIO_TEST_TOKEN`, `DRY_RUN=false` e `CONFIRM_MELHOR_ENVIO_LABEL_SIMULATION=I_UNDERSTAND_MELHOR_ENVIO_LABEL_SIMULATION`.

Pendencias:

- executar etiqueta em janela controlada com token sandbox/producao e pedido de teste explicitamente aprovado;
- validar que o retorno sanitizado confirma `order_id`/URL sem imprimir token ou dados pessoais;
- confirmar no Melhor Envio se a etiqueta gerada e cancelavel/reversivel antes de qualquer teste em producao.

Rollback: remover os dois arquivos `tmp-tests/vps-melhor-envio-label-guarded-simulation*`; nenhuma infra foi alterada.

### 2026-05-22 - Guard para simulacao de cotacao shipping

Mudanca: criado runner guardado para validar cotacao Frenet/Melhor Envio no `/api/shipping` sem disparar chamada real por acidente.

Objetivo: preparar a validacao controlada do frete migrado para a VPS, cobrindo apenas `action=calculate`; geracao de etiqueta Melhor Envio permanece fora deste runner.

Arquivos alterados:

- `tmp-tests/vps-shipping-quote-guarded-simulation.cjs`
- `tmp-tests/vps-shipping-quote-guarded-simulation-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-shipping-quote-guarded-simulation-static.test.mjs`
- `node --check tmp-tests/vps-shipping-quote-guarded-simulation.cjs`
- `node tmp-tests/vps-shipping-quote-guarded-simulation.cjs`: `quote_sent=false`, `reason=missing_SHIPPING_TEST_PROVIDER`.
- `SHIPPING_TEST_PROVIDER=frenet SHIPPING_TEST_FROM_CEP=56300000 SHIPPING_TEST_TO_CEP=01001000 node tmp-tests/vps-shipping-quote-guarded-simulation.cjs`: `quote_sent=false`, `reason=dry_run_enabled`.
- `SHIPPING_TEST_PROVIDER=melhor-envio SHIPPING_TEST_FROM_CEP=56300000 SHIPPING_TEST_TO_CEP=01001000 node tmp-tests/vps-shipping-quote-guarded-simulation.cjs`: `quote_sent=false`, `reason=dry_run_enabled`.
- `SHIPPING_TEST_PROVIDER=frenet SHIPPING_TEST_FROM_CEP=56300000 SHIPPING_TEST_TO_CEP=01001000 SHIPPING_TEST_TOKEN=TEST_TOKEN DRY_RUN=false node tmp-tests/vps-shipping-quote-guarded-simulation.cjs`: `quote_sent=false`, `reason=missing_explicit_confirmation`.

Resultado: a simulacao de cotacao Frenet/Melhor Envio ficou preparada, mas nenhuma cotacao real foi enviada. O envio so ocorre com `SHIPPING_TEST_PROVIDER`, `SHIPPING_TEST_FROM_CEP`, `SHIPPING_TEST_TO_CEP`, `SHIPPING_TEST_TOKEN`, `DRY_RUN=false` e `CONFIRM_SHIPPING_QUOTE_SIMULATION=I_UNDERSTAND_SHIPPING_QUOTE_SIMULATION`.

Pendencias:

- executar cotacao real em janela controlada com token e CEPs de teste explicitamente aprovados;
- validar retorno sanitizado para Frenet e Melhor Envio;
- preparar validacao separada para etiqueta Melhor Envio com pedido de teste.

Rollback: remover os dois arquivos `tmp-tests/vps-shipping-quote-guarded-simulation*`; nenhuma infra foi alterada.

### 2026-05-22 - Guard para simulacao de payload Mercado Pago webhook

Mudanca: criado runner guardado para validar payload simulado no `/api/mercadopago-webhook` sem consultar pagamento real ou atualizar pedido por acidente.

Objetivo: preparar a validacao controlada do webhook Mercado Pago migrado para a VPS antes de trocar callbacks definitivos.

Arquivos alterados:

- `tmp-tests/vps-mercadopago-webhook-simulation.cjs`
- `tmp-tests/vps-mercadopago-webhook-simulation-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-mercadopago-webhook-simulation-static.test.mjs`
- `node --check tmp-tests/vps-mercadopago-webhook-simulation.cjs`
- `node tmp-tests/vps-mercadopago-webhook-simulation.cjs`: `webhook_sent=false`, `reason=missing_MERCADOPAGO_TEST_PAYMENT_ID`.
- `MERCADOPAGO_TEST_PAYMENT_ID=0 node tmp-tests/vps-mercadopago-webhook-simulation.cjs`: `webhook_sent=false`, `reason=dry_run_enabled`.
- `MERCADOPAGO_TEST_PAYMENT_ID=0 DRY_RUN=false node tmp-tests/vps-mercadopago-webhook-simulation.cjs`: `webhook_sent=false`, `reason=missing_explicit_confirmation`.

Resultado: a simulacao de payload Mercado Pago ficou preparada, mas nenhum webhook foi enviado. O envio so ocorre com `MERCADOPAGO_TEST_PAYMENT_ID`, `DRY_RUN=false` e `CONFIRM_MERCADOPAGO_WEBHOOK_SIMULATION=I_UNDERSTAND_MERCADOPAGO_WEBHOOK_SIMULATION`.

Pendencias:

- executar simulacao em janela controlada com pagamento/pedido de teste explicitamente aprovado;
- validar debug de lookup e ausencia de atualizacao indevida quando o pagamento nao for aprovado;
- depois validar recebimento real do Mercado Pago antes de apontar webhook definitivo.

Rollback: remover os dois arquivos `tmp-tests/vps-mercadopago-webhook-simulation*`; nenhuma infra foi alterada.

### 2026-05-22 - Guard para simulacao de payload Bling webhook

Mudanca: criado runner guardado para validar payload simulado no `/api/bling-webhook` sem acionar atualizacao de estoque/preco/nome por acidente.

Objetivo: preparar a validacao controlada dos webhooks Bling migrados para a VPS, cobrindo eventos de estoque/produto antes de trocar callbacks definitivos.

Arquivos alterados:

- `tmp-tests/vps-bling-webhook-simulation.cjs`
- `tmp-tests/vps-bling-webhook-simulation-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-bling-webhook-simulation-static.test.mjs`
- `node --check tmp-tests/vps-bling-webhook-simulation.cjs`
- `node tmp-tests/vps-bling-webhook-simulation.cjs`: `webhook_sent=false`, `reason=missing_BLING_TEST_WEBHOOK_EVENT`.
- `BLING_TEST_WEBHOOK_EVENT=estoque BLING_TEST_WEBHOOK_SKU=TEST-SKU BLING_TEST_WEBHOOK_STOCK=1 node tmp-tests/vps-bling-webhook-simulation.cjs`: `webhook_sent=false`, `reason=dry_run_enabled`.
- `BLING_TEST_WEBHOOK_EVENT=estoque BLING_TEST_WEBHOOK_SKU=TEST-SKU BLING_TEST_WEBHOOK_STOCK=1 DRY_RUN=false node tmp-tests/vps-bling-webhook-simulation.cjs`: `webhook_sent=false`, `reason=missing_explicit_confirmation`.

Resultado: a simulacao de payload Bling ficou preparada, mas nenhum webhook foi enviado. O envio so ocorre com `BLING_TEST_WEBHOOK_EVENT`, `BLING_TEST_WEBHOOK_SKU` ou `BLING_TEST_WEBHOOK_BLING_ID`, `DRY_RUN=false` e `CONFIRM_BLING_WEBHOOK_SIMULATION=I_UNDERSTAND_BLING_WEBHOOK_SIMULATION`.

Pendencias:

- executar simulacao em janela controlada com SKU/produto explicitamente aprovado;
- validar registro em `webhook_logs` e efeito esperado em estoque/preco/nome;
- depois validar recebimento real do Bling antes de apontar webhook definitivo.

Rollback: remover os dois arquivos `tmp-tests/vps-bling-webhook-simulation*`; nenhuma infra foi alterada.

### 2026-05-22 - Guard para simulacao de payload Shopee webhook

Mudanca: criado runner guardado para validar payload simulado de pedido no `/api/shopee-webhook` sem acionar relay externo por acidente.

Objetivo: preparar a validacao controlada do Push Mechanism da Shopee (`code=3`, status de pedido) antes de trocar callbacks definitivos, mantendo dupla trava para qualquer envio real de simulacao.

Arquivos alterados:

- `tmp-tests/vps-shopee-webhook-order-simulation.cjs`
- `tmp-tests/vps-shopee-webhook-order-simulation-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vps-shopee-webhook-order-simulation-static.test.mjs`
- `node --check tmp-tests/vps-shopee-webhook-order-simulation.cjs`
- `node tmp-tests/vps-shopee-webhook-order-simulation.cjs`: `webhook_sent=false`, `reason=missing_SHOPEE_TEST_WEBHOOK_ORDER_SN`.
- `SHOPEE_TEST_WEBHOOK_ORDER_SN=TEST-ORDER SHOPEE_TEST_WEBHOOK_STATUS=READY_TO_SHIP node tmp-tests/vps-shopee-webhook-order-simulation.cjs`: `webhook_sent=false`, `reason=dry_run_enabled`.
- `SHOPEE_TEST_WEBHOOK_ORDER_SN=TEST-ORDER SHOPEE_TEST_WEBHOOK_STATUS=READY_TO_SHIP DRY_RUN=false node tmp-tests/vps-shopee-webhook-order-simulation.cjs`: `webhook_sent=false`, `reason=missing_explicit_confirmation`.

Resultado: a simulacao de payload Shopee ficou preparada, mas nenhum webhook `code=3` foi enviado. O envio so ocorre com `SHOPEE_TEST_WEBHOOK_ORDER_SN`, `SHOPEE_TEST_WEBHOOK_STATUS`, `DRY_RUN=false` e `CONFIRM_SHOPEE_WEBHOOK_ORDER_SIMULATION=I_UNDERSTAND_SHOPEE_WEBHOOK_ORDER_SIMULATION`.

Pendencias:

- executar a simulacao em janela controlada com pedido/loja de teste explicitamente aprovados;
- validar logs da VPS apos a simulacao;
- depois validar recebimento real da Shopee antes de apontar webhook definitivo.

Rollback: remover os dois arquivos `tmp-tests/vps-shopee-webhook-order-simulation*`; nenhuma infra foi alterada.

### 2026-05-22 - Bling reconcile pos-apply usando MySQL da VPS

Mudança: após o apply real controlado do plano revisado, o dry-run pós-apply ainda retornou o plano antigo. A investigação mostrou que a aplicação atualizou a VPS/MySQL, mas o planejador do reconcile ainda montava o plano lendo produtos do Supabase, que ficou como fonte antiga durante a migração. O planejador agora busca os produtos mapeados diretamente em `products` no MySQL da VPS.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-reconcile-fastify-static.test.mjs`
- `tmp-tests/vps-bling-reconcile-apply-guarded.cjs`
- `tmp-tests/vps-bling-reconcile-apply-guarded-static.test.mjs`
- `tools/check-bling-reconcile-apply-readiness.mjs`
- `tmp-tests/bling-reconcile-apply-readiness-cli-static.test.mjs`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260522005919.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260522005919.bak`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-bling-reconcile-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-reconcile-stock-fallback-static.test.mjs`
- `node tmp-tests/vps-bling-reconcile-dry-run-details-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `node tmp-tests/vps-bling-reconcile-dry-run-check.cjs`
- `node tmp-tests/vps-bling-reconcile-dry-run-details-check.cjs`
- `node tools/review-bling-reconcile-plan.mjs`
- `node tmp-tests/vps-bling-reconcile-apply-guarded-static.test.mjs`
- `node tmp-tests/bling-reconcile-apply-readiness-cli-static.test.mjs`
- `node tmp-tests/bling-reconcile-apply-readiness-cli.test.mjs`
- `node tmp-tests/bling-reconcile-apply-readiness-cli-fails-on-guard.test.mjs`
- `node tmp-tests/bling-reconcile-apply-readiness-cli-fails-on-guard-result.test.mjs`
- `node --check tmp-tests/vps-bling-reconcile-apply-guarded.cjs`
- `node --check tools/check-bling-reconcile-apply-readiness.mjs`
- `node tools/check-bling-reconcile-apply-readiness.mjs`

Resultado sanitizado:

- Apply real anterior: `applied.stockChanges=7`, `applied.nameChanges=57`, `failed_count=0`.
- Antes da correção de fonte, o dry-run pós-apply ainda retornava `7` estoques e `57` nomes por ler Supabase antigo.
- Após trocar a fonte local para MySQL da VPS e redeployar, o dry-run real retornou `planned.stockChanges=8`, `planned.nameChanges=20`, `totals.localProducts=2437`, `totals.localMappedProducts=2435`, `totals.remoteProducts=6107`, `totals.remoteStocks=2435`.
- Detalhes atuais salvos em `tmp-tests/vps-bling-reconcile-dry-run-details-output.json`.
- Revisão local atual: estoque com `8` mudanças, `1` aumento, `7` reduções, `1` zeragem, delta total `-11`; nomes com `20` mudanças, `5` apenas sufixo de cor e `15` renomes fora desse padrão. Flags: `stock_zeroing_present`, `name_changes_not_limited_to_color_suffix`, `duplicate_previous_names_split_by_color`.
- Readiness atual passou apenas em preflight local (`applied=false`, `reason=preflight_only`) e agora exige confirmação explícita também para renomes fora do padrão: `CONFIRM_BLING_RECONCILE_UNSAFE_RENAMES=I_REVIEWED_UNSAFE_RENAMES` e lista exata em `CONFIRM_BLING_RECONCILE_UNSAFE_RENAME_SKUS`.
- Hash atual do artefato revisado: `9d17d0158c4965217bc4b4921e48b5c934427f8ae81b596c21ece9af7c4d74e9`.

Resultado: o bug de conferência foi isolado e corrigido. O reconcile não está zerado ainda; os `8` estoques e `20` nomes restantes são o novo plano real contra MySQL da VPS e precisam de revisão antes de novo apply.

### 2026-05-21 - Remocao local do cron da Vercel apos cron VPS validado

Mudanca: removido o bloco `crons` do `vercel.json` depois de validar que `/api/cron-dispatcher` roda no Fastify da VPS, que o wrapper da VPS preserva o agendamento `0 22 * * *` e que o log real da VPS ja mostrou execucao bem-sucedida.

Arquivos/infra alterados:

- `vercel.json`
- `tmp-tests/vercel-cron-disabled-static.test.mjs`
- `migração_VPS.md`

Validacao:

- `node tmp-tests/vercel-cron-disabled-static.test.mjs`
- `node tmp-tests/vps-cron-dispatcher-fastify-static.test.mjs`
- `node tmp-tests/vps-cron-dispatcher-install-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`

Resultado: a configuracao versionada da Vercel nao agenda mais `/api/cron-dispatcher`; a rota e o instalador da VPS seguem cobertos por testes estaticos, e a checagem de sintaxe dos artefatos da VPS passou. Antes do desligamento final da Vercel, ainda falta revisar callbacks/OAuth e webhooks externos.

### 2026-05-21 - Bling reconcile real em dry-run pela VPS com saldos filtrados

Mudança: criado executor guardado para chamar `/api/bling?resource=reconcile&dryRun=true` localmente na VPS, usando `CRON_SECRET` apenas no shell remoto e imprimindo só contagens. Depois do primeiro dry-run, corrigido o reconciliador para buscar saldos filtrados por `idsProdutos[]` quando a listagem geral de saldos do Bling vier vazia, com throttle/retry para respeitar o limite de `3` requisições por segundo do Bling.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-reconcile-dry-run-check.cjs`
- `tmp-tests/vps-bling-reconcile-dry-run-check-static.test.mjs`
- `tmp-tests/vps-bling-reconcile-stock-fallback-static.test.mjs`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521233240.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521233240.bak`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-bling-reconcile-dry-run-check-static.test.mjs`
- `node tmp-tests/vps-bling-reconcile-stock-fallback-static.test.mjs`
- `node tmp-tests/vps-bling-reconcile-fastify-static.test.mjs`
- `node --check tmp-tests/vps-bling-reconcile-dry-run-check.cjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `node tmp-tests/vps-bling-reconcile-dry-run-check.cjs`

Resultado sanitizado:

- `dryRun`: `true`.
- `planned.stockChanges`: `7`.
- `planned.nameChanges`: `57`.
- `totals.localProducts`: `2435`.
- `totals.localMappedProducts`: `2435`.
- `totals.remoteProducts`: `6107`.
- `totals.remoteStocks`: `2435`.

Resultado: o caminho real de reconciliação pela VPS funciona em modo planejamento e não aplicou nenhuma alteração. A causa do `remoteStocks: 0` era a listagem geral de saldos do Bling vindo vazia; a consulta filtrada por IDs mapeados retorna os saldos necessários. Antes de executar aplicação real, revisar os `7` estoques e `57` nomes planejados.

### 2026-05-21 - Detalhamento do plano Bling reconcile dry-run

Mudança: adicionado modo protegido `details=true` ao `dryRun` do Bling reconcile e executor local para salvar o plano detalhado em JSON, sem aplicar mudanças.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-reconcile-dry-run-details-static.test.mjs`
- `tmp-tests/vps-bling-reconcile-dry-run-details-check.cjs`
- `tmp-tests/vps-bling-reconcile-dry-run-details-check-static.test.mjs`
- `tmp-tests/vps-bling-reconcile-dry-run-details-output.json`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521234002.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521234002.bak`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-bling-reconcile-dry-run-details-static.test.mjs`
- `node tmp-tests/vps-bling-reconcile-dry-run-details-check-static.test.mjs`
- `node --check tmp-tests/vps-bling-reconcile-dry-run-details-check.cjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `node tmp-tests/vps-bling-reconcile-dry-run-details-check.cjs`

Resultado:

- `planned.stockChanges`: `7`.
- `planned.nameChanges`: `57`.
- Estoques: `2` reduções de `-1` (`SGB400`, `EP-743-BRA`) e `5` aumentos de `+1` (`LJH074`, `CCSRMN70PRE`, `P3DRN504G`, `P3DI13PM`, `CCSIP1212PBG`).
- Nomes: `57/57` adicionam sufixo `Cor:...` e `57/57` mantêm o nome anterior como prefixo.

Resultado: plano detalhado pronto para revisão antes de aplicação real. Nenhuma alteração foi aplicada.

Preparação guardada para aplicação:

- `tmp-tests/vps-bling-reconcile-apply-guarded.cjs`
- `tmp-tests/vps-bling-reconcile-apply-guarded-static.test.mjs`
- `services/blingReconcilePlanReview.js`
- `tools/review-bling-reconcile-plan.mjs`
- `tmp-tests/bling-reconcile-plan-review.test.mjs`
- `tmp-tests/bling-reconcile-plan-review-cli-static.test.mjs`

Validação:

- `node tmp-tests/vps-bling-reconcile-apply-guarded-static.test.mjs`
- `node --check tmp-tests/vps-bling-reconcile-apply-guarded.cjs`
- `node tmp-tests/vps-bling-reconcile-apply-guarded.cjs`
- `node tmp-tests/bling-reconcile-plan-review.test.mjs`
- `node tmp-tests/bling-reconcile-plan-review-cli-static.test.mjs`
- `node --check tools/review-bling-reconcile-plan.mjs`
- `node tools/review-bling-reconcile-plan.mjs`
- `DRY_RUN=false CONFIRM_BLING_RECONCILE_APPLY=I_UNDERSTAND_BLING_RECONCILE_APPLY node tmp-tests/vps-bling-reconcile-apply-guarded.cjs` sem `CONFIRM_BLING_RECONCILE_ZEROING`
- `BLING_RECONCILE_MAX_REVIEW_AGE_MS=0 DRY_RUN=false CONFIRM_BLING_RECONCILE_APPLY=I_UNDERSTAND_BLING_RECONCILE_APPLY node tmp-tests/vps-bling-reconcile-apply-guarded.cjs`
- `DRY_RUN=false CONFIRM_BLING_RECONCILE_APPLY=I_UNDERSTAND_BLING_RECONCILE_APPLY CONFIRM_BLING_RECONCILE_ZEROING=I_REVIEWED_STOCK_ZEROING node tmp-tests/vps-bling-reconcile-apply-guarded.cjs` sem `CONFIRM_BLING_RECONCILE_ZEROING_SKUS`
- `node tmp-tests/vps-bling-reconcile-apply-guarded-hash-mismatch.test.mjs`
- `node tmp-tests/vps-bling-reconcile-apply-guarded-preflight.test.mjs`
- `BLING_RECONCILE_PREFLIGHT_ONLY=1 DRY_RUN=false CONFIRM_BLING_RECONCILE_APPLY=I_UNDERSTAND_BLING_RECONCILE_APPLY CONFIRM_BLING_RECONCILE_ZEROING=I_REVIEWED_STOCK_ZEROING CONFIRM_BLING_RECONCILE_ZEROING_SKUS=EP-743-BRA,SGB400 CONFIRM_BLING_RECONCILE_SOURCE_SHA256=0f7cc05fb14ac84e8027fe437a485ee8eedbbda86902d634974d54c19c8f0dfd node tmp-tests/vps-bling-reconcile-apply-guarded.cjs`
- `node tmp-tests/bling-reconcile-apply-readiness-cli-static.test.mjs`
- `node tmp-tests/bling-reconcile-apply-readiness-cli.test.mjs`
- `node tmp-tests/bling-reconcile-apply-readiness-cli-refuses-apply.test.mjs`
- `node tmp-tests/bling-reconcile-apply-readiness-cli-fails-on-guard.test.mjs`
- `node tmp-tests/bling-reconcile-apply-readiness-cli-fails-on-guard-result.test.mjs`
- `node tools/check-bling-reconcile-apply-readiness.mjs`

Resultado: executor não aplica nada por padrão. Para aplicação real, exige `DRY_RUN=false` e `CONFIRM_BLING_RECONCILE_APPLY=I_UNDERSTAND_BLING_RECONCILE_APPLY`.

Revisão local do plano:

- Estoque: `7` mudanças, `5` aumentos, `2` reduções, `2` zeragens (`SGB400`, `EP-743-BRA`), delta máximo absoluto `1`, delta total `+3`.
- Nomes: `57` mudanças, `57/57` limitadas a sufixo de cor (`Cor:`/`COR:`), `0` renomes fora desse padrão.
- Riscos restantes: revisar as `2` zeragens de estoque e aceitar explicitamente que `11` grupos de nomes iguais serão separados por cor.
- Relatórios locais gerados e ignorados pelo Git: `reports/bling-reconcile-review.md` e `reports/bling-reconcile-review.json`.

Trava adicional antes de aplicar:

- O executor agora lê `reports/bling-reconcile-review.json` antes de abrir SSH.
- A revisão inclui SHA-256 do artefato `tmp-tests/vps-bling-reconcile-dry-run-details-output.json`; se o hash atual divergir, o apply bloqueia como `review_source_hash_mismatch`.
- O bloqueio de hash mismatch tem teste de execução local com artefatos temporários e não abre SSH.
- O relatório precisa ser fresco; por padrão, revisões com mais de `30` minutos são bloqueadas como `stale_review`.
- Se houver `stock_zeroing_present`, ele bloqueia mesmo com `DRY_RUN=false` e confirmação geral.
- Para aplicar um plano com zeragem, passa a exigir também `CONFIRM_BLING_RECONCILE_ZEROING=I_REVIEWED_STOCK_ZEROING`.
- Além disso, exige confirmação da lista exata normalizada em `CONFIRM_BLING_RECONCILE_ZEROING_SKUS`; para o plano atual, o valor esperado é `EP-743-BRA,SGB400`.
- Validação local sem essa confirmação retornou `applied=false`, `reason=stock_zeroing_present`, `stockZeroing=["SGB400","EP-743-BRA"]`.
- Validação local com idade máxima artificial `0` retornou `applied=false`, `reason=stale_review`.
- Validação local com confirmação de zeragem, mas sem lista de SKUs, retornou `applied=false`, `reason=stock_zeroing_sku_list_mismatch`.
- Revisão atual gerada com `Source SHA-256: 0f7cc05fb14ac84e8027fe437a485ee8eedbbda86902d634974d54c19c8f0dfd`.
- Para apply/preflight direto no guard, também é exigido `CONFIRM_BLING_RECONCILE_SOURCE_SHA256=0f7cc05fb14ac84e8027fe437a485ee8eedbbda86902d634974d54c19c8f0dfd`.
- Modo preflight local adicionado com `BLING_RECONCILE_PREFLIGHT_ONLY=1`; quando todas as travas passam, retorna `applied=false`, `reason=preflight_only`, `localGuardsPassed=true` e não abre SSH.
- Preflight do plano atual passou localmente com as confirmações exatas, mantendo `stockZeroing=["SGB400","EP-743-BRA"]`.
- Comando preferido de pré-check local: `node tools/check-bling-reconcile-apply-readiness.mjs`. Ele regenera a revisão, executa o preflight com a lista de zeragem extraída do próprio relatório e retorna `localGuardsPassed=true` sem SSH/apply.
- O comando de readiness também aceita `--input`, `--markdown-output` e `--json-output`, permitindo testar artefatos temporários sem depender do plano real.
- O comando aceita `--zeroing-skus` para validar uma lista explícita; se qualquer guard local falhar, sai com código diferente de zero e escreve o JSON no stderr.
- Quando passa, o readiness imprime `requiredApplyEnv` com `DRY_RUN=false`, confirmações de apply/zeragem, lista de SKUs e SHA-256 esperado. Não inclui segredo.
- O comando de readiness recusa `--apply` explicitamente; ele é somente leitura.

### 2026-05-21 - Validação real controlada de Bling diagnostics pela VPS

Mudança: criado executor sanitizado para validar `debug-product` e `debug-diagnostic` com um `blingId` real já descoberto no plano do reconcile.

Arquivos/infra alterados:

- `tmp-tests/vps-bling-diagnostics-live-read-check.cjs`
- `tmp-tests/vps-bling-diagnostics-live-read-check-static.test.mjs`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-bling-diagnostics-live-read-check-static.test.mjs`
- `node --check tmp-tests/vps-bling-diagnostics-live-read-check.cjs`
- `node tmp-tests/vps-bling-diagnostics-live-read-check.cjs`

Resultado sanitizado:

- `debug-product`: HTTP indireto OK, `data` recebido com chaves esperadas de produto.
- `debug-diagnostic`: `stockStatus` `200`, `productStatus` `200`, `stockItems` `1`, `productItems` `1`.

Resultado: diagnóstico real de produto e saldo do Bling passa pela VPS sem imprimir nome, SKU, saldo, token ou corpo bruto.

### 2026-05-21 - Validação real controlada de Bling image-proxy pela VPS

Mudança: criado executor sanitizado para descobrir uma imagem real de produto Bling via `debug-product` e validar o proxy `/api/bling?resource=image-proxy`.

Arquivos/infra alterados:

- `tmp-tests/vps-bling-image-proxy-live-check.cjs`
- `tmp-tests/vps-bling-image-proxy-live-check-static.test.mjs`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-bling-image-proxy-live-check-static.test.mjs`
- `node --check tmp-tests/vps-bling-image-proxy-live-check.cjs`
- `node tmp-tests/vps-bling-image-proxy-live-check.cjs`

Resultado sanitizado:

- `status`: `200`.
- `contentType`: `image/png`.
- `bytes`: `471268`.
- `triedProducts`: `1`.

Resultado: `image-proxy` passou com imagem real pela VPS sem imprimir URL da imagem, nome do produto, SKU, saldo, token ou corpo bruto.

### 2026-05-21 - Validação dry-run real de Bling sync-prices-vps pela VPS

Mudança: adicionado `dryRun=true` ao `sync-prices-vps`, corrigido o header `Range` do Supabase/PostgREST e removida a coluna inexistente `products.is_combo` do select/payload da VPS.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-sync-prices-dry-run-static.test.mjs`
- `tmp-tests/vps-bling-sync-prices-dry-run-check.cjs`
- `tmp-tests/vps-bling-sync-prices-dry-run-check-static.test.mjs`
- `tmp-tests/vps-bling-sync-prices-supabase-diagnostic.cjs`
- `tmp-tests/vps-bling-sync-prices-supabase-diagnostic-static.test.mjs`
- `tmp-tests/vps-bling-sync-prices-fastify-static.test.mjs`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521235514.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521235514.bak`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-bling-sync-prices-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-sync-prices-dry-run-static.test.mjs`
- `node tmp-tests/vps-bling-sync-prices-dry-run-check-static.test.mjs`
- `node --check tmp-tests/vps-bling-sync-prices-dry-run-check.cjs`
- `node tmp-tests/vps-bling-sync-prices-supabase-diagnostic-static.test.mjs`
- `node --check tmp-tests/vps-bling-sync-prices-supabase-diagnostic.cjs`
- `node tmp-tests/vps-bling-sync-prices-supabase-diagnostic.cjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `node tmp-tests/vps-bling-sync-prices-dry-run-check.cjs`

Diagnóstico:

- A primeira execução retornou `Supabase products fetch failed: 400`.
- Diagnóstico sanitizado mostrou `column products.is_combo does not exist`.
- O select foi ajustado para o schema real e o `Range` passou a usar `Range-Unit: items` com `Range: 0-49`.

Resultado sanitizado:

- `dryRun`: `true`.
- `wouldSync`: `50`.
- `page`: `0`.
- `total`: `2443`.
- `hasMore`: `true`.
- `nextPage`: `1`.
- Página `1`: `wouldSync` `50`, `hasMore=true`, `nextPage=2`; amostra sanitizada confirmou preservação de `bling_parent_id` em itens com variação.
- Página `48`: `wouldSync` `43`, `hasMore=false`, `nextPage=null`.

Resultado: `sync-prices-vps` está validado em modo planejamento real pela VPS, sem escrita em `/products/batch`.

Preparação guardada para aplicação:

- `tmp-tests/vps-bling-sync-prices-apply-guarded.cjs`
- `tmp-tests/vps-bling-sync-prices-apply-guarded-static.test.mjs`

Validação:

- `node tmp-tests/vps-bling-sync-prices-apply-guarded-static.test.mjs`
- `node --check tmp-tests/vps-bling-sync-prices-apply-guarded.cjs`
- `node tmp-tests/vps-bling-sync-prices-apply-guarded.cjs`

Resultado: executor não aplica nada por padrão. Para aplicação real, exige `DRY_RUN=false` e `CONFIRM_BLING_SYNC_PRICES_APPLY=I_UNDERSTAND_BLING_SYNC_PRICES_APPLY`.

Aplicação real controlada:

- Primeira tentativa da página `0`: `ok=false`, erro `fetch failed` ao chamar `/products/batch`.
- Causa: chamada local montava `https://127.0.0.1:4000` por padrão; Fastify local responde em HTTP.
- Correção: `getVpsBatchBaseUrl` agora detecta host local (`127.0.0.1`, `localhost`, `::1`) e usa `http`.
- Backup do deploy da correção:
  - `/var/www/mdv-api/.codex-backups/server.js.20260522000235.bak`
  - `/var/www/mdv-api/.codex-backups/vps_server.js.20260522000235.bak`
- Reexecução da página `0`: `ok=true`, `synced=50`, `total=2443`, `hasMore=true`, `nextPage=1`, `vpsStatus=200`.

### 2026-05-21 - Comparação pública de sitemap produção vs VPS

Mudança: criado comparador público de sitemap para contar URLs da produção atual e do staging da VPS sem usar credenciais.

Arquivos/infra alterados:

- `tmp-tests/vps-sitemap-public-compare.cjs`
- `tmp-tests/vps-sitemap-public-compare-static.test.mjs`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-sitemap-public-compare-static.test.mjs`
- `node --check tmp-tests/vps-sitemap-public-compare.cjs`
- `node tmp-tests/vps-sitemap-public-compare.cjs`

Resultado:

- Produção atual: `https://mercadodovale.com.br/sitemap.xml` redireciona para `www.mercadodovale.com.br`, retorna HTTP `200`, `text/xml`, `3` URLs (`/`, `/privacidade`, `/faq`).
- VPS staging: `http://76.13.232.162/sitemap.xml` com `Host: staging.mercadodovale.com.br` retorna HTTP `200`, `application/xml`, `2136` URLs, host canônico `staging.mercadodovale.com.br`.
- Diferença: VPS staging tem `2133` URLs a mais que a produção atual.

Resultado: o sitemap da VPS está substancialmente mais completo que o sitemap público atual. Antes do DNS final, ainda falta validar o host de produção e revisar slugs especiais.

### 2026-05-21 - Observação real do cron-dispatcher na VPS

Mudança: criado observador somente leitura para verificar a entrada do crontab e o log do cron-dispatcher sem ler `.env` remoto nem imprimir segredo.

Arquivos/infra alterados:

- `tmp-tests/vps-cron-dispatcher-log-check.cjs`
- `tmp-tests/vps-cron-dispatcher-log-check-static.test.mjs`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-cron-dispatcher-log-check-static.test.mjs`
- `node --check tmp-tests/vps-cron-dispatcher-log-check.cjs`
- `node tmp-tests/vps-cron-dispatcher-log-check.cjs`

Resultado sanitizado:

- `crontab_has_entry`: `true`.
- `log_exists`: `true`.
- `log_meta`: `120 bytes|2026-05-21 22:00:04.169945859 +0000`.
- última linha do log: `Cron ran successfully. Dispatched 1 templates.`

Resultado: o cron da VPS executou com sucesso e disparou 1 template. Nenhum `Authorization`, `CRON_SECRET` ou conteúdo de `.env` foi impresso.

### 2026-05-21 - Validação real controlada de leituras Bling pela VPS

Mudança: executadas consultas reais de leitura Bling passando por `api.xiaomipetrolina.com.br`, com token salvo lido do Supabase e saída sanitizada.

Arquivos/infra alterados:

- `tmp-tests/vps-bling-live-read-check.cjs`
- `tmp-tests/vps-bling-live-read-check-static.test.mjs`
- `tmp-tests/vps-bling-detail-live-read-check.cjs`
- `tmp-tests/vps-bling-detail-live-read-check-static.test.mjs`
- `tmp-tests/vps-bling-finance-live-read-check.cjs`
- `tmp-tests/vps-bling-finance-live-read-check-static.test.mjs`
- `tmp-tests/vps-bling-stock-live-read-check.cjs`
- `tmp-tests/vps-bling-stock-live-read-check-static.test.mjs`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-bling-live-read-check-static.test.mjs`
- `node --check tmp-tests/vps-bling-live-read-check.cjs`
- `node tmp-tests/vps-bling-live-read-check.cjs`
- `node tmp-tests/vps-bling-detail-live-read-check-static.test.mjs`
- `node --check tmp-tests/vps-bling-detail-live-read-check.cjs`
- `node tmp-tests/vps-bling-detail-live-read-check.cjs`
- `node tmp-tests/vps-bling-finance-live-read-check-static.test.mjs`
- `node --check tmp-tests/vps-bling-finance-live-read-check.cjs`
- `node tmp-tests/vps-bling-finance-live-read-check.cjs`
- `node tmp-tests/vps-bling-stock-live-read-check-static.test.mjs`
- `node --check tmp-tests/vps-bling-stock-live-read-check.cjs`
- `node tmp-tests/vps-bling-stock-live-read-check.cjs`

Resultados sanitizados:

- `/api/bling?resource=categories&page=1`: HTTP `200`, `71` categorias.
- `/api/bling?resource=products&page=1`: HTTP `200`, `100` produtos.
- `/api/bling?resource=nfe&pagina=1`: HTTP `200`, `100` notas.
- `/api/bling?resource=nfce&pagina=1`: HTTP `200`, `34` notas.
- `/api/bling?resource=product-detail&id=<descoberto>`: HTTP `200`, detalhe recebido.
- `/api/bling?resource=nf-detail&tipo=nfe&id=<descoberto>`: HTTP `200`, detalhe de NFe recebido.
- `/api/bling?resource=finance&resourceType=receber&action=list`: HTTP `200`, `100` contas.
- `/api/bling?resource=finance&resourceType=receber&action=get&id=<descoberto>`: HTTP `200`, detalhe recebido.
- `/api/bling?resource=finance&resourceType=pagar&action=list`: HTTP `200`, `10` contas.
- `/api/bling?resource=finance&resourceType=pagar&action=get&id=<descoberto>`: HTTP `200`, detalhe recebido.
- `/api/bling?resource=stock&page=1`: HTTP `200`, lista normalizada com `0` saldos.
- `/api/bling?resource=stock&page=1&idsProdutos[]=<descoberto>`: HTTP `200`, lista com `1` saldo.

Resultado: leituras reais de categorias, produtos, detalhe de produto, NFe, NFCe, detalhe de NFe, estoque e financeiro `list/get` passam pela VPS com Authorization válido. Nenhum token, produto, SKU, cliente, documento, nota, saldo, valor, link de pagamento ou corpo bruto foi impresso, e nenhuma mutação foi acionada.

Pendências:

- manter create/update/baixar/cancelar fora até existir ambiente ou caso aprovado.

### 2026-05-21 - Validação limitada guardada de Shopee Catalog completo

Mudança: adicionados limites `max_pages` e `max_items` à rota `get_full_catalog` e criado executor controlado para validar a leitura completa em ensaio pequeno.

Arquivos/infra alterados:

- `tmp-tests/vps-shopee-full-catalog-guarded-check.cjs`
- `tmp-tests/vps-shopee-full-catalog-guarded-check-static.test.mjs`
- `tmp-tests/vps-shopee-catalog-media-full-fastify-static.test.mjs`
- `vps_server.js`
- `vps_server.cjs`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521191110.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521191110.bak`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-shopee-full-catalog-guarded-check-static.test.mjs`
- `node tmp-tests/vps-shopee-catalog-media-full-fastify-static.test.mjs`
- `node --check tmp-tests/vps-shopee-full-catalog-guarded-check.cjs`
- `node tmp-tests/vps-shopee-full-catalog-guarded-check.cjs`: `full_catalog_executed` `false`, skip por `dry_run_enabled`.
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `DRY_RUN=false CONFIRM_SHOPEE_FULL_CATALOG_READ=I_UNDERSTAND_SHOPEE_FULL_CATALOG_READ SHOPEE_FULL_CATALOG_MAX_PAGES=1 SHOPEE_FULL_CATALOG_MAX_ITEMS=5 node tmp-tests/vps-shopee-full-catalog-guarded-check.cjs`: HTTP `200`, `item_count` `5`, sem erro.

Como executar a validação real em janela controlada:

- executar com `DRY_RUN=false` e `CONFIRM_SHOPEE_FULL_CATALOG_READ=I_UNDERSTAND_SHOPEE_FULL_CATALOG_READ`;
- ajustar `SHOPEE_FULL_CATALOG_MAX_PAGES` e `SHOPEE_FULL_CATALOG_MAX_ITEMS` para limitar o ensaio;
- opcionalmente ajustar `SHOPEE_FULL_CATALOG_PAGE_SIZE` entre `1` e `100`;
- manter saída sanitizada, apenas com contagem de itens e chaves de resposta.

Resultado: validação limitada de `get_full_catalog` passou pela VPS com 1 página e 5 itens. A varredura total do catálogo continua reservada para janela explícita.

Pendências:

- executar varredura total de `get_full_catalog` apenas em janela controlada, se ainda for necessária.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521191110.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Preparação guardada para mutações Shopee de produto na VPS

Mudança: criados executores controlados para validar `update_stock`, `update_price` e `ship_order` somente com produto/pedido de teste explícitos.

Arquivos/infra alterados:

- `tmp-tests/vps-shopee-mutation-guarded-check.cjs`
- `tmp-tests/vps-shopee-mutation-guarded-check-static.test.mjs`
- `tmp-tests/vps-shopee-ship-order-guarded-check.cjs`
- `tmp-tests/vps-shopee-ship-order-guarded-check-static.test.mjs`
- `tmp-tests/vps-shopee-test-candidate-discovery.cjs`
- `tmp-tests/vps-shopee-test-candidate-discovery-static.test.mjs`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-shopee-mutation-guarded-check-static.test.mjs`
- `node --check tmp-tests/vps-shopee-mutation-guarded-check.cjs`
- `node tmp-tests/vps-shopee-mutation-guarded-check.cjs`: `mutation_executed` `false`, skip por `missing_SHOPEE_TEST_PRODUCT_ID`.
- `SHOPEE_TEST_PRODUCT_ID=TEST-PRODUCT DRY_RUN=false node tmp-tests/vps-shopee-mutation-guarded-check.cjs`: `mutation_executed` `false`, skip por `missing_explicit_confirmation`.
- `node tmp-tests/vps-shopee-ship-order-guarded-check-static.test.mjs`
- `node --check tmp-tests/vps-shopee-ship-order-guarded-check.cjs`
- `node tmp-tests/vps-shopee-ship-order-guarded-check.cjs`: `mutation_executed` `false`, skip por `missing_SHOPEE_TEST_ORDER_SN`.
- `SHOPEE_TEST_ORDER_SN=TEST-ORDER DRY_RUN=false node tmp-tests/vps-shopee-ship-order-guarded-check.cjs`: `mutation_executed` `false`, skip por `missing_explicit_confirmation`.
- `node tmp-tests/vps-shopee-test-candidate-discovery-static.test.mjs`
- `node --check tmp-tests/vps-shopee-test-candidate-discovery.cjs`
- `node tmp-tests/vps-shopee-test-candidate-discovery.cjs`: `candidate_count` `50`, `test_like_count` `0`, saída sem SKU/nome/item/model.

Como executar a validação real em janela controlada:

- definir `SHOPEE_TEST_PRODUCT_ID` com um produto de teste já vinculado à Shopee;
- definir `SHOPEE_TEST_STOCK` e `SHOPEE_TEST_PRICE_CENTS` com valores de teste;
- executar com `DRY_RUN=false` e `CONFIRM_SHOPEE_TEST_MUTATION=I_UNDERSTAND_SHOPEE_TEST_MUTATION`.
- para `ship_order`, definir `SHOPEE_TEST_ORDER_SN` com pedido controlado e executar com `DRY_RUN=false` e `CONFIRM_SHOPEE_TEST_SHIP_ORDER=I_UNDERSTAND_SHOPEE_TEST_SHIP_ORDER`.

Resultado: trilhas de mutação de produto e envio preparadas com dupla trava. A descoberta encontrou produtos vinculados à Shopee, mas nenhum candidato claramente marcado como teste. Nenhuma mutação real foi executada neste passo.

Pendências:

- criar ou selecionar produto de teste vinculado à Shopee para validar `update_stock` e `update_price`;
- selecionar pedido de teste/controlado para validar `ship_order`.

### 2026-05-21 - Validação real controlada de leitura Shopee pela VPS

Mudança: executadas consultas reais de leitura Shopee por `api.xiaomipetrolina.com.br`, com saída sanitizada.

Arquivos/infra alterados:

- `tmp-tests/vps-shopee-live-read-check.cjs`
- `tmp-tests/vps-shopee-live-read-check-static.test.mjs`
- `tmp-tests/vps-shopee-order-live-read-check.cjs`
- `tmp-tests/vps-shopee-order-live-read-check-static.test.mjs`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-shopee-live-read-check-static.test.mjs`
- `node --check tmp-tests/vps-shopee-live-read-check.cjs`
- `node tmp-tests/vps-shopee-live-read-check.cjs`
- `node tmp-tests/vps-shopee-order-live-read-check-static.test.mjs`
- `node --check tmp-tests/vps-shopee-order-live-read-check.cjs`
- `node tmp-tests/vps-shopee-order-live-read-check.cjs`

Resultados sanitizados:

- `/api/shopee-actions?action=get_shop_info`: HTTP `200`, sem erro.
- `/api/shopee-catalog?action=shop_info`: HTTP `200`, sem erro.
- `/api/shopee-catalog?action=categories&page_size=5`: HTTP `200`, `category_list` com `2038` itens.
- `/api/shopee-catalog?action=logistics_channel_list`: HTTP `200`, `logistics_channel_list` com `2` canais.
- `/api/shopee-catalog?action=get_item_list&page_size=5&item_status=NORMAL`: HTTP `200`, `item` com `5` itens; item descoberto para validações encadeadas.
- `/api/shopee-catalog?action=get_item_base_info&item_id_list=<descoberto>`: HTTP `200`, `item_list` com `1` item; warning Shopee não bloqueante sobre frete estimado do canal `90006`.
- `/api/shopee-catalog?action=get_model_list&item_id=<descoberto>`: HTTP `200`, `model` com `4` modelos.
- `/api/shopee-actions?action=get_order_list&page_size=5&time_range_field=create_time&time_from=<janela>&time_to=<janela>`: HTTP `200`, `order_list` com `5` pedidos; pedido descoberto para validações encadeadas.
- `/api/shopee-actions?action=get_order_detail&order_sn_list=<descoberto>`: HTTP `200`, `order_list` com `1` pedido.
- `/api/shopee-actions?action=get_tracking_info&order_sn=<descoberto>`: HTTP `200`, `tracking_info` com `3` eventos.
- `/api/shopee-actions?action=get_escrow_detail&order_sn=<descoberto>`: HTTP `200`, resposta de pagamento recebida.

Resultado: credenciais/assinatura Shopee na VPS estão funcionando para leituras reais de loja, catálogo, item, modelos, pedidos, rastreio e pagamento. Nenhum ID, `order_sn`, dado de comprador, SKU, preço ou token foi impresso, e nenhuma mutação foi acionada.

Pendências:

- atualizar a linha do mapa de rotas para refletir a leitura real Shopee validada;
- validar mutações em produto/pedido de teste antes do corte final.

### 2026-05-21 - Validação real controlada do Telegram Webhook na VPS

Mudança: executado `/ping` real passando pelo webhook da VPS com `x-telegram-bot-api-secret-token`.

Objetivo: confirmar o ciclo Telegram -> VPS Fastify -> Telegram sem expor `bot_token`, `TELEGRAM_WEBHOOK_SECRET` ou `chat_id` no terminal.

Arquivos/infra alterados:

- `tmp-tests/vps-telegram-webhook-ping.cjs`
- `tmp-tests/vps-telegram-webhook-ping-static.test.mjs`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-telegram-webhook-ping-static.test.mjs`
- `node --check tmp-tests/vps-telegram-webhook-ping.cjs`
- `node tmp-tests/vps-telegram-webhook-ping.cjs`: `webhook_status` `200`, `webhook_body` `{ "ok": true }`, usando o chat configurado.
- `tail /var/log/mdv-cron-dispatcher.log`: log ainda não existe porque a primeira execução agendada ainda não ocorreu.

Resultado: webhook Telegram na VPS validado com comando real controlado. O próximo ponto de observação é o primeiro ciclo agendado do cron-dispatcher.

Pendências:

- observar `/var/log/mdv-cron-dispatcher.log` após 22:00 UTC;
- remover callbacks/domínios restantes da Vercel após regressão completa.

### 2026-05-21 - Validação real controlada dos comandos Telegram `/vendas`, `/estoque`, `/relatorio`, `/top10` e `/pedidos`

Mudança: executados comandos de leitura do bot pelo webhook da VPS, usando o chat configurado no banco e o `TELEGRAM_WEBHOOK_SECRET` da VPS.

Arquivos/infra alterados:

- `tmp-tests/vps-telegram-webhook-command.cjs`
- `tmp-tests/vps-telegram-webhook-command-static.test.mjs`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-telegram-webhook-command-static.test.mjs`
- `node --check tmp-tests/vps-telegram-webhook-command.cjs`
- `node tmp-tests/vps-telegram-webhook-command.cjs /vendas`: `webhook_status` `200`, `webhook_body` `{ "ok": true }`.
- `node tmp-tests/vps-telegram-webhook-command.cjs /estoque`: `webhook_status` `200`, `webhook_body` `{ "ok": true }`.
- `node tmp-tests/vps-telegram-webhook-command.cjs /relatorio`: `webhook_status` `200`, `webhook_body` `{ "ok": true }`.
- `node tmp-tests/vps-telegram-webhook-command.cjs /top10`: `webhook_status` `200`, `webhook_body` `{ "ok": true }`.
- `node tmp-tests/vps-telegram-webhook-command.cjs /pedidos`: `webhook_status` `200`, `webhook_body` `{ "ok": true }`.

Resultado: comandos de leitura que consultam vendas, produtos, ranking de itens e pedidos responderam pelo caminho Telegram -> VPS Fastify -> Supabase -> Telegram.

Pendências:

- observar `/var/log/mdv-cron-dispatcher.log` após 22:00 UTC;
- remover callbacks/domínios restantes da Vercel após regressão completa.

### 2026-05-21 - Validação real controlada dos comandos Telegram `/clientes`, `/modelo` e `/categoria`

Mudança: executados os últimos comandos principais de leitura do bot pelo webhook da VPS.

Validação:

- `node tmp-tests/vps-telegram-webhook-command-static.test.mjs`
- `node --check tmp-tests/vps-telegram-webhook-command.cjs`
- `node tmp-tests/vps-telegram-webhook-command.cjs /clientes`: `webhook_status` `200`, `webhook_body` `{ "ok": true }`.
- `node tmp-tests/vps-telegram-webhook-command.cjs "/modelo iphone"`: `webhook_status` `200`, `webhook_body` `{ "ok": true }`.
- `node tmp-tests/vps-telegram-webhook-command.cjs "/categoria celulares"`: `webhook_status` `200`, `webhook_body` `{ "ok": true }`.

Resultado: comandos principais do bot Telegram foram validados pelo caminho Telegram -> VPS Fastify -> Supabase -> Telegram.

Pendências:

- observar `/var/log/mdv-cron-dispatcher.log` após 22:00 UTC;
- remover callbacks/domínios restantes da Vercel após regressão completa.

### 2026-05-21 - Instalação do Cron Dispatcher na VPS e remoção do cron da Vercel no repositório

Mudança: instalado wrapper `/var/www/mdv-api/cron/cron-dispatcher.sh` na VPS e configurada entrada crontab `0 22 * * *` para chamar `https://api.xiaomipetrolina.com.br/api/cron-dispatcher` com `Authorization: Bearer ${CRON_SECRET}`.

Objetivo: substituir a agenda da Vercel por cron local da VPS mantendo o mesmo horário UTC do `vercel.json`.

Arquivos/infra alterados:

- `vercel.json`
- `tmp-tests/vps-cron-dispatcher-install.cjs`
- `tmp-tests/vps-cron-dispatcher-install-static.test.mjs`
- `tmp-tests/vercel-cron-disabled-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/cron/cron-dispatcher.sh`
- crontab da VPS

Validação:

- `date +%Z` na VPS: `UTC`.
- `node tmp-tests/vps-cron-dispatcher-install-static.test.mjs`
- `node --check tmp-tests/vps-cron-dispatcher-install.cjs`
- `node tmp-tests/vps-cron-dispatcher-install.cjs`: dry-run com `forceTemplateId=__codex_probe__`, sem instalar crontab.
- `node tmp-tests/vps-cron-dispatcher-install.cjs --apply`: instalou entrada no crontab.
- `crontab -l | grep cron-dispatcher`: sobrou apenas `0 22 * * * /var/www/mdv-api/cron/cron-dispatcher.sh >> /var/log/mdv-cron-dispatcher.log 2>&1`.
- `node tmp-tests/vercel-cron-disabled-static.test.mjs`: `vercel.json` não define mais `crons`.

Resultado: cron-dispatcher está agendado na VPS. Duas entradas antigas no crontab que chamavam `https://www.mercadodovale.com.br/api/cron-dispatcher` foram removidas para não passar mais pela produção/Vercel.

Pendências:

- observar `/var/log/mdv-cron-dispatcher.log` após a próxima execução real;
- fazer deploy/push da alteração de `vercel.json` quando for hora de garantir que futuros deploys da Vercel não recriem cron;
- remover Vercel do caminho final de DNS/callbacks após regressão completa.

Rollback: remover a linha `/var/www/mdv-api/cron/cron-dispatcher.sh` do crontab e, se necessário, restaurar temporariamente as chamadas antigas para `https://www.mercadodovale.com.br/api/cron-dispatcher`.

### 2026-05-21 - Configuração de segredos e ativação do webhook Telegram na VPS

Mudança: configurados `CRON_SECRET` e `TELEGRAM_WEBHOOK_SECRET` dedicados no `.env` da VPS e registrado o webhook real do Telegram para a rota da VPS.

Objetivo: remover os fallbacks temporários de autenticação e tirar o webhook Telegram do caminho da Vercel.

Arquivos/infra alterados:

- `tmp-tests/vps-migration-secrets-set.cjs`
- `tmp-tests/vps-migration-secrets-set-static.test.mjs`
- `tmp-tests/vps-telegram-set-webhook.cjs`
- `tmp-tests/vps-telegram-set-webhook-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/.env`
- `/var/www/mdv-api/.codex-backups/.env.20260521134644.bak`
- webhook configurado na API do Telegram

Validação:

- `node tmp-tests/vps-migration-secrets-set-static.test.mjs`
- `node --check tmp-tests/vps-migration-secrets-set.cjs`
- `node tmp-tests/vps-migration-secrets-set.cjs`: criou `CRON_SECRET` e `TELEGRAM_WEBHOOK_SECRET` com 64 caracteres cada; valores não foram impressos.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, API online após restart.
- `curl -i https://api.xiaomipetrolina.com.br/api/cron-dispatcher`: `401 Unauthorized`.
- `curl -i -X POST https://api.xiaomipetrolina.com.br/api/telegram-webhook --data @tmp-tests/telegram-webhook-ping-payload.json`: `401 Unauthorized` sem secret token.
- `node tmp-tests/vps-telegram-set-webhook-static.test.mjs`
- `node --check tmp-tests/vps-telegram-set-webhook.cjs`
- `node tmp-tests/vps-telegram-set-webhook.cjs`: `getWebhookInfo` antes apontava para `https://www.mercadodovale.com.br/api/telegram-webhook`; depois apontou para `https://api.xiaomipetrolina.com.br/api/telegram-webhook`, com `allowed_updates` = `message`, `edited_message`.

Resultado: o Telegram já envia novos updates para a rota da VPS usando `secret_token`. Chamadas públicas sem o secret token ficam bloqueadas.

Pendências:

- executar `/ping` real no chat do bot para confirmar o ciclo Telegram -> VPS -> Telegram;
- instalar cron na VPS para `/api/cron-dispatcher`;
- remover/desativar o Vercel Cron antigo após o cron da VPS ser validado.

Rollback:

- restaurar `/var/www/mdv-api/.codex-backups/.env.20260521134644.bak` para `/var/www/mdv-api/.env` e reiniciar `pm2 restart mdv-api --update-env`;
- reconfigurar o webhook do Telegram para `https://www.mercadodovale.com.br/api/telegram-webhook`, se for necessário voltar temporariamente para Vercel.

### 2026-05-21 - Deploy e validação staging do Telegram Webhook na VPS

Mudança: adicionada e publicada no Fastify da VPS a rota `/api/telegram-webhook`.

Objetivo: migrar o bot administrativo do Telegram para a VPS, preservando os comandos `/ping`, `/ajuda`, `/start`, `/help`, `/menu`, `/vendas`, `/relatorio`, `/top10`, `/estoque`, `/preco`, `/pedidos`, `/clientes`, `/modelo` e `/categoria`.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-telegram-webhook-fastify-static.test.mjs`
- `tmp-tests/telegram-webhook-ping-payload.json`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521134129.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521134129.bak`

Rotas/tabelas afetadas:

- `/api/telegram-webhook`
- `telegram_settings`
- `sales`
- `sale_items`
- `products`
- `orders`
- `customers`
- `categories`
- `models`
- `https://api.telegram.org/bot.../sendMessage`

Validação:

- `node tmp-tests/vps-telegram-webhook-fastify-static.test.mjs`
- `node tmp-tests/vps-cron-dispatcher-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-catalog-media-full-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-actions-add-item-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, API online após restart.
- `curl -i https://api.xiaomipetrolina.com.br/api/telegram-webhook`: `200 OK`, `{ "ok": true }`.
- `curl -i -X POST https://api.xiaomipetrolina.com.br/api/telegram-webhook --data {}`: `200 OK`, `{ "ok": true }`.
- `curl -i -X POST https://api.xiaomipetrolina.com.br/api/telegram-webhook --data @tmp-tests/telegram-webhook-ping-payload.json`: `503 Service Unavailable`, `{ "error": "TELEGRAM_WEBHOOK_SECRET not configured" }`.

Resultado: rota publicada, mas processamento de mensagens com texto fica travado até existir `TELEGRAM_WEBHOOK_SECRET`. Isso evita disparo público do bot enquanto o webhook real do Telegram não for registrado com secret token.

Pendências:

- configurar `TELEGRAM_WEBHOOK_SECRET` no `.env` da VPS;
- registrar o webhook do Telegram apontando para `https://api.xiaomipetrolina.com.br/api/telegram-webhook` com `secret_token`;
- executar `/ping` real controlado;
- validar comandos de leitura com banco real;
- desligar o webhook antigo da Vercel após confirmação.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521134129.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Deploy e validação staging do Cron Dispatcher na VPS

Mudança: adicionada e publicada no Fastify da VPS a rota `/api/cron-dispatcher`.

Objetivo: substituir a Vercel Cron/Function por execução controlada na VPS, preservando templates agendados do Telegram, variáveis de empresa, vendas do dia, estoque, agenda Instagram e tags customizadas de `system_tags`.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-cron-dispatcher-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521133159.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521133159.bak`

Rotas/ações afetadas:

- `/api/cron-dispatcher`
- `telegram_settings`
- `company_settings`
- `sales`
- `products`
- `instagram_schedule`
- `system_tags`
- `https://api.telegram.org/bot.../sendMessage`

Validação:

- `node tmp-tests/vps-cron-dispatcher-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-catalog-media-full-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-actions-add-item-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, API online após restart.
- `curl -i https://api.xiaomipetrolina.com.br/api/cron-dispatcher`: `401 Unauthorized`, `{ "error": "Unauthorized" }`.

Resultado: rota publicada e protegida. A primeira validação mostrou que o atalho por IP local ficava permissivo demais atrás do Nginx; a guarda foi corrigida para exigir segredo sempre. Como `CRON_SECRET` dedicado ainda não está configurado na VPS, a rota aceita `SYNC_SECRET` como fallback temporário.

Pendências:

- configurar `CRON_SECRET` dedicado no `.env` da VPS;
- criar/ativar a chamada agendada na própria VPS com `Authorization: Bearer <CRON_SECRET>`;
- executar um disparo real controlado com `forceTemplateId`;
- comparar o resultado/log contra a Vercel antes de desligar o cron antigo.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521133159.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Deploy e validação staging de mídia e catálogo completo Shopee Catalog

Mudança: adicionadas e publicadas no Fastify da VPS as ações `upload_image`, `upload_video` e `get_full_catalog` dentro de `/api/shopee-catalog`.

Objetivo: completar a cobertura do handler Vercel de Shopee Catalog na VPS, preservando upload multipart de imagem, upload de vídeo em partes com MD5 e polling, e varredura paginada do catálogo com detalhes em lotes.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-shopee-catalog-media-full-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521130314.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521130314.bak`

Rotas/ações afetadas:

- `/api/shopee-catalog?action=upload_image`
- `/api/shopee-catalog?action=upload_video`
- `/api/shopee-catalog?action=get_full_catalog`
- `/api/v2/media_space/upload_image`
- `/api/v2/media_space/init_video_upload`
- `/api/v2/media_space/upload_video_part`
- `/api/v2/media_space/complete_video_upload`
- `/api/v2/media_space/get_video_upload_result`

Validação:

- `node tmp-tests/vps-shopee-catalog-media-full-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-catalog-mutations-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-catalog-read-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-actions-add-item-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-actions-mutations-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-actions-read-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, API online após restart.
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-catalog?action=upload_image"`: `405 Method Not Allowed`, `{ "error": "POST required" }`.
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-catalog?action=upload_video"`: `405 Method Not Allowed`, `{ "error": "POST required" }`.

Resultado: mídia e catálogo completo estão publicados. As validações HTTP seguras confirmaram bloqueio de uploads por GET, sem enviar mídia para a Shopee.

Pendências:

- validar upload real de imagem com arquivo controlado;
- validar upload real de vídeo pequeno/controlado;
- validar `get_full_catalog` em janela controlada por consultar a Shopee real;
- comparar retorno contra a Vercel antes do corte final.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521130314.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Deploy e validação staging de Shopee Actions add_item

Mudança: adicionada e publicada no Fastify da VPS a ação `add_item` dentro de `/api/shopee-actions`.

Objetivo: preservar o fluxo legado que cria item Shopee a partir de produto da VPS, bloqueia duplicidade quando já existe vínculo, sobe imagens do produto para a Shopee quando possível, cria o item e grava `shopee_item_id` de volta no produto da VPS.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-shopee-actions-add-item-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521125742.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521125742.bak`

Rotas/ações afetadas:

- `/api/shopee-actions?action=add_item`
- `/api/v2/media_space/upload_image`
- `/api/v2/product/add_item`
- `/products/:id` via `PUT` para persistir `shopee_item_id`

Validação:

- `node tmp-tests/vps-shopee-actions-add-item-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-actions-mutations-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-actions-read-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-actions-refresh-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-catalog-mutations-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-catalog-read-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, API online após restart.
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-actions?action=add_item&product_id=test"`: `405 Method Not Allowed`, `{ "error": "POST required" }`.

Resultado: `add_item` está publicado, mas protegido contra GET para evitar criação acidental por URL. Nenhuma criação real de item foi executada neste bloco.

Pendências:

- validar criação real com produto de teste ainda não vinculado;
- confirmar upload de imagens reais em produto controlado;
- comparar payload e resposta contra a Vercel antes do corte final.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521125742.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Deploy e validação staging de mutações Shopee Actions

Mudança: adicionadas e publicadas no Fastify da VPS as ações mutáveis `ship_order`, `update_stock` e `update_price` dentro de `/api/shopee-actions`.

Objetivo: remover mais uma dependência da Vercel nas operações Shopee, preservando pré-checagens antes de `ship_order`, bloqueio idempotente para envio já preparado, leitura do produto na VPS antes de alterar estoque/preço e conversão de preço em centavos para valor Shopee.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-shopee-actions-mutations-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521125410.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521125410.bak`

Rotas/ações afetadas:

- `/api/shopee-actions?action=ship_order`
- `/api/shopee-actions?action=update_stock`
- `/api/shopee-actions?action=update_price`

Validação:

- `node tmp-tests/vps-shopee-actions-mutations-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-actions-read-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-actions-refresh-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-catalog-mutations-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-catalog-read-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, API online após restart.
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-actions?action=update_stock&product_id=test&stock=1"`: `405 Method Not Allowed`, `{ "error": "POST required" }`.
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-actions?action=ship_order&order_sn=TEST"`: `405 Method Not Allowed`, `{ "error": "POST required" }`.

Resultado: as ações mutáveis estão publicadas, mas protegidas contra GET para evitar alteração por URL. Nenhuma chamada real de alteração foi executada neste bloco.

Pendências:

- validar `update_stock`/`update_price` com produto Shopee de teste;
- validar `ship_order` com pedido controlado em status correto;
- validar `add_item` com produto de teste após a migração separada;
- comparar comportamento contra a Vercel antes do corte final.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521125410.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Deploy e validação staging de mutações Shopee Catalog

Mudança: adicionadas e publicadas no Fastify da VPS as mutações diretas de `/api/shopee-catalog`.

Objetivo: preservar compatibilidade com o handler Vercel para operações de catálogo que alteram produto, preço, estoque, variações e status, mantendo assinatura HMAC, renovação automática de token, validação de `POST` e debug copiável sem segredos.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-shopee-catalog-mutations-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521124802.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521124802.bak`

Rotas/ações afetadas:

- `/api/shopee-catalog?action=add_item`
- `/api/shopee-catalog?action=update_price`
- `/api/shopee-catalog?action=update_stock`
- `/api/shopee-catalog?action=update_model`
- `/api/shopee-catalog?action=init_tier_variation`
- `/api/shopee-catalog?action=delete_item`
- `/api/shopee-catalog?action=update_item_status`
- `/api/shopee-catalog?action=update_item`

Validação:

- `node tmp-tests/vps-shopee-catalog-mutations-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-catalog-read-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-actions-read-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-actions-refresh-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, API online após restart.
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-catalog?action=update_stock"`: `405 Method Not Allowed`, `{ "error": "POST required" }`.

Resultado: mutações diretas estão publicadas em staging. A validação HTTP segura confirmou que chamadas sem `POST` são bloqueadas antes de qualquer envio à Shopee. A implementação preserva a expansão de `price_list` para modelos reais, busca dados fiscais antes de `update_item` e atualiza GTIN em modelos quando necessário.

Pendências:

- validar uma mutação real com produto de teste;
- migrar upload de imagem/vídeo e o `get_full_catalog`;
- migrar mutações restantes de `/api/shopee-actions` (`ship_order`, `add_item`, `update_stock`, `update_price`).

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521124802.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Deploy e validação staging de Shopee Actions refresh_token

Mudança: adicionada a ação explícita `refresh_token` dentro de `/api/shopee-actions` no Fastify da VPS.

Objetivo: preservar compatibilidade com o frontend/fluxos legados que chamam renovação manual de token, reutilizando o helper central já usado pelo catálogo para assinar `/api/v2/auth/access_token/get` e persistir `shopee_access_token`/`shopee_refresh_token`.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-shopee-actions-refresh-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521123620.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521123620.bak`

Rotas/ações afetadas:

- `/api/shopee-actions?action=refresh_token`

Validação:

- `node tmp-tests/vps-shopee-actions-refresh-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-actions-read-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-catalog-read-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-actions"`: `400 Bad Request`, `{ "error": "action obrigatória" }`.
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-actions?action=get_order_detail"`: `400 Bad Request`, `{ "error": "order_sn_list não fornecido" }`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API online após restart.

Resultado: a renovação explícita está publicada na VPS, mas não foi chamada em HTTP real neste bloco para evitar rotação de token fora de janela controlada.

Pendências:

- acionar `refresh_token` uma vez com monitoramento quando for necessário renovar credenciais;
- migrar ações mutáveis `ship_order`, `add_item`, `update_stock` e `update_price`;
- comparar comportamento contra a Vercel antes do corte final.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521123620.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Deploy e validação staging de Shopee Actions leitura

Mudança: adicionada a rota `/api/shopee-actions` ao Fastify da VPS para ações de consulta/leitura.

Objetivo: migrar consultas operacionais da Shopee sem acionar alterações de pedido ou produto, reutilizando os helpers assinados do Shopee Catalog e a renovação automática de token.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-shopee-actions-read-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521123248.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521123248.bak`

Rotas/ações afetadas:

- `/api/shopee-actions?action=get_shop_info`
- `/api/shopee-actions?action=get_order_list`
- `/api/shopee-actions?action=get_escrow_list`
- `/api/shopee-actions?action=get_order_detail`
- `/api/shopee-actions?action=get_tracking_info`
- `/api/shopee-actions?action=get_escrow_detail`
- `/api/shopee-actions?action=get_shipping_document`

Validação:

- `node tmp-tests/vps-shopee-actions-read-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-catalog-read-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-actions"`: `400 Bad Request`, `{ "error": "action obrigatória" }`.
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-actions?action=get_order_detail"`: `400 Bad Request`, `{ "error": "order_sn_list não fornecido" }`.
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-actions?action=get_tracking_info"`: `400 Bad Request`, `{ "error": "order_sn não fornecido" }`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API online após restart.

Resultado: Shopee Actions leitura está disponível na VPS em staging e as validações HTTP seguras não consultam pedidos reais nem disparam envio/etiqueta.

Pendências:

- validar consultas reais com pedido Shopee controlado;
- migrar ações mutáveis `ship_order`, `add_item`, `update_stock` e `update_price` com validações anti-duplicidade;
- comparar comportamento contra a Vercel antes do corte final.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521123248.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Deploy e validação staging de Shopee Catalog leitura

Mudança: adicionada a rota `/api/shopee-catalog` ao Fastify da VPS para ações de consulta/leitura.

Objetivo: migrar a parte segura do catálogo Shopee antes das mutações, preservando assinatura HMAC com `access_token`/`shop_id`, renovação automática de token expirado e validações locais para parâmetros obrigatórios.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-shopee-catalog-read-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521122840.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521122840.bak`

Rotas/ações afetadas:

- `/api/shopee-catalog?action=categories`
- `/api/shopee-catalog?action=attributes`
- `/api/shopee-catalog?action=search_attribute_values`
- `/api/shopee-catalog?action=brand_list`
- `/api/shopee-catalog?action=shop_info`
- `/api/shopee-catalog?action=logistics_channel_list`
- `/api/shopee-catalog?action=warehouse_list`
- `/api/shopee-catalog?action=warehouse_detail`
- `/api/shopee-catalog?action=warehouse_locations`
- `/api/shopee-catalog?action=get_item_list`
- `/api/shopee-catalog?action=get_item_base_info`
- `/api/shopee-catalog?action=get_model_list`
- `/api/shopee-catalog?action=debug`

Validação:

- `node tmp-tests/vps-shopee-catalog-read-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-catalog?action=attributes"`: `400 Bad Request`, `{ "error": "category_id required" }`.
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-catalog?action=search_attribute_values"`: `400 Bad Request`, `{ "error": "attribute_id required" }`.
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-catalog?action=get_item_base_info"`: `400 Bad Request`, `{ "error": "item_id_list required" }`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API online após restart.

Resultado: Shopee Catalog leitura está disponível na VPS em staging e as validações HTTP seguras não acionam chamadas reais de catálogo nem alteram dados.

Pendências:

- validar consultas reais de leitura com credenciais Shopee em janela controlada;
- migrar ações mutáveis do catálogo (`add_item`, `update_price`, `update_stock`, `update_model`, `init_tier_variation`, `delete_item`, `update_item_status`, `update_item`, `upload_image`, `upload_video`);
- migrar `/api/shopee-actions`;
- comparar comportamento contra a Vercel antes do corte final.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521122840.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Deploy e validação staging de Shopee webhook

Mudança: adicionada a rota `/api/shopee-webhook` ao Fastify da VPS.

Objetivo: mover para a VPS o receptor de Push Mechanism da Shopee, preservando `POST` com resposta `{ "message": "success" }` para evitar retry.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-shopee-webhook-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521122207.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521122207.bak`

Rotas afetadas:

- `/api/shopee-webhook`

Validação:

- `node tmp-tests/vps-shopee-webhook-fastify-static.test.mjs`
- `node tmp-tests/vps-shopee-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-resource-parity-static.test.mjs`
- `node tmp-tests/vps-bling-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee-webhook"`: `405 Method Not Allowed`.
- `curl -i -X POST "https://api.xiaomipetrolina.com.br/api/shopee-webhook" --data "{}"`: `200 OK`, `{ "message": "success" }`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: webhook Shopee passa pelo VPS em staging; a validação segura não executa relay externo porque não envia `code=3` com dados de pedido.

Pendências:

- validar payload simulado `code=3` com `ordersn/status` em janela controlada;
- validar recebimento real da Shopee antes de apontar webhook definitivo;
- migrar `/api/shopee-catalog` e `/api/shopee-actions`;
- comparar comportamento contra a Vercel antes do corte final.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521122207.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Deploy e validação staging de Shopee OAuth

Mudança: adicionada a rota `/api/shopee` ao Fastify da VPS para as ações `auth` e `callback`.

Objetivo: iniciar a migração Shopee pela etapa de OAuth/callback, preservando assinatura HMAC SHA256, escolha live/sandbox, callback estável `/api/shopee?action=callback` e gravação dos tokens em `company_settings`.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-shopee-oauth-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521121650.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521121650.bak`

Rotas afetadas:

- `/api/shopee?action=auth`
- `/api/shopee?action=callback`

Validação:

- `node tmp-tests/vps-shopee-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-resource-parity-static.test.mjs`
- `node tmp-tests/vps-bling-admin-helpers-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee?action=callback"`: `400 Bad Request`, `Parâmetros ausentes (code, shop_id)`.
- `curl -i "https://api.xiaomipetrolina.com.br/api/shopee"`: `404 Not Found`, `Route not found or missing action`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: OAuth Shopee passa pelo VPS em staging sem trocar token em validação segura.

Pendências:

- validar `action=auth` com credenciais reais e conferir URL gerada;
- validar callback real com `code`/`shop_id` da Shopee em janela controlada;
- migrar `/api/shopee-catalog`, `/api/shopee-actions` e `/api/shopee-webhook`;
- comparar comportamento contra a Vercel antes de apontar callbacks definitivos.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521121650.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Auditoria final de paridade do `/api/bling`

Mudança: criado teste de paridade entre os recursos declarados em `api/bling.ts` e os recursos migrados no Fastify da VPS.

Objetivo: garantir que nenhum `resource` do handler Bling original ficou sem equivalente no `vps_server.js`/`vps_server.cjs` antes de passar para o próximo módulo da migração.

Arquivos alterados:

- `tmp-tests/vps-bling-resource-parity-static.test.mjs`
- `migração_VPS.md`

Validação:

- `node tmp-tests/vps-bling-resource-parity-static.test.mjs`

Resultado: todos os recursos encontrados em `api/bling.ts` estão presentes nos dois artefatos da VPS, incluindo a rota combinada `nfe|nfce` e a lista de recursos migrados no erro de recurso inválido.

Pendências:

- validações reais controladas para rotas que gravam ou consultam Bling com token real;
- comparação final contra Vercel antes do corte de DNS/callbacks;
- seguir para módulos ainda pendentes da migração, começando por Shopee.

### 2026-05-21 - Deploy e validação staging de Bling admin helpers

Mudança: adicionados os recursos `fix-profile`, `sync-model-brand` e `fix-bling-id` ao `/api/bling` do Fastify na VPS.

Objetivo: mover para a VPS as rotas administrativas auxiliares que corrigem perfil, sincronizam marca de modelo e ajustam `bling_id` por SKU, preservando respostas e validações do handler original.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-admin-helpers-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521120827.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521120827.bak`

Rotas afetadas:

- `/api/bling?resource=fix-profile`
- `/api/bling?resource=sync-model-brand`
- `/api/bling?resource=fix-bling-id`

Validação:

- `node tmp-tests/vps-bling-admin-helpers-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-diagnostics-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-webhook-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-product-update-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-reconcile-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i -X POST "https://api.xiaomipetrolina.com.br/api/bling?resource=fix-profile" --data "{}"`: `400 Bad Request`, `userId is required`.
- `curl -i -X POST "https://api.xiaomipetrolina.com.br/api/bling?resource=sync-model-brand" --data "{}"`: `400 Bad Request`, `model_id and brand_name are required`.
- `curl -i -X POST "https://api.xiaomipetrolina.com.br/api/bling?resource=fix-bling-id" --data "{}"`: `400 Bad Request`, `sku e blingId são obrigatórios`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: as rotas administrativas auxiliares passam pelo VPS em staging e validam payload antes de qualquer escrita.

Pendências:

- validar `fix-profile` com usuário real apenas quando necessário;
- validar `sync-model-brand` com modelo/marca controlados;
- validar `fix-bling-id` com SKU de teste ou caso real aprovado;
- comparar comportamento contra a Vercel antes do corte final.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521120827.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Deploy e validação staging de Bling diagnostics

Mudança: adicionados os recursos `image-proxy`, `debug-product` e `debug-diagnostic` ao `/api/bling` do Fastify na VPS.

Objetivo: mover para a VPS as rotas auxiliares de proxy seguro de imagem e diagnóstico de produto/estoque do Bling, preservando validações de host, HTTPS obrigatório e fallback para token salvo em `company_settings`.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-diagnostics-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521120309.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521120309.bak`

Rotas afetadas:

- `/api/bling?resource=image-proxy`
- `/api/bling?resource=debug-product`
- `/api/bling?resource=debug-diagnostic`

Validação:

- `node tmp-tests/vps-bling-diagnostics-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-product-detail-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-product-update-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-webhook-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-nf-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i "https://api.xiaomipetrolina.com.br/api/bling?resource=image-proxy"`: `400 Bad Request`, `Missing url parameter`.
- `curl -i "https://api.xiaomipetrolina.com.br/api/bling?resource=debug-product"`: `400 Bad Request`, `blingId is required`.
- `curl -i "https://api.xiaomipetrolina.com.br/api/bling?resource=debug-diagnostic"`: `400 Bad Request`, `blingId is required`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: `image-proxy`, `debug-product` e `debug-diagnostic` passam pelo VPS em staging; as chamadas de validação não consultam o Bling nem alteram dados.

Pendências:

- validar `image-proxy` com URL real de host permitido;
- validar `debug-product` e `debug-diagnostic` com `blingId` real em janela controlada;
- migrar rotas administrativas auxiliares restantes (`fix-profile`, `sync-model-brand`, `fix-bling-id`).

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521120309.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Deploy e validação staging de Bling webhook

Mudança: adicionada a rota dedicada `/api/bling-webhook` ao Fastify da VPS e preservada a compatibilidade legada `/api/bling?resource=webhook`, incluindo `webhook-logs`.

Objetivo: mover para a VPS o recebimento de webhooks do Bling, mantendo logs em `webhook_logs`, tratamento de eventos de estoque/produto, fallback de estoque e despacho compatível para payloads de Mercado Pago que cheguem por rewrite legado.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-webhook-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521115830.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521115830.bak`

Rotas afetadas:

- `/api/bling-webhook`
- `/api/bling?resource=webhook`
- `/api/bling?resource=webhook-logs`

Validação:

- `node tmp-tests/vps-bling-webhook-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-product-update-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-products-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-product-detail-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-stock-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-sync-prices-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-reconcile-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-finance-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-nf-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i https://api.xiaomipetrolina.com.br/api/bling-webhook`: `200 OK`, `{ ok: true, mode: "vps-fastify", accepts: "POST" }`.
- `curl -i "https://api.xiaomipetrolina.com.br/api/bling?resource=webhook"`: `200 OK`, `{ ok: true, mode: "vps-fastify", accepts: "POST" }`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: `/api/bling-webhook`, `/api/bling?resource=webhook` e `webhook-logs` passam pelo VPS em staging. O handler mantém logs, eventos de estoque/produto, busca de estoque no Bling quando há token, fallback não-zero do payload e bloqueio contra zerar estoque quando a API falha.

Pendências:

- validar POST simulado em janela controlada, pois grava `webhook_logs` e pode acionar atualização de produto;
- validar webhook real do Bling antes de apontar o callback definitivo;
- implementar sincronização Shopee direta no handler VPS ou confirmar que o retorno `stockTargets` pelo endpoint local cobre o fluxo necessário;
- comparar comportamento contra a Vercel antes do corte final.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521115830.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Deploy e validação staging de Bling product updates

Mudança: adicionados os recursos `product-update-fiscal` e `product-update-dimensions` ao `/api/bling` do Fastify na VPS.

Objetivo: mover para a VPS as atualizações de tributação e dimensões/peso de produtos no Bling, preservando busca do produto atual antes do `PUT` para não sobrescrever campos não informados.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-product-update-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521113351.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521113351.bak`

Rotas afetadas:

- `/api/bling?resource=product-update-fiscal`
- `/api/bling?resource=product-update-dimensions`

Validação:

- `node tmp-tests/vps-bling-product-update-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-products-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-product-detail-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-stock-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-sync-prices-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-reconcile-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-finance-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-nf-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -i -X POST "https://api.xiaomipetrolina.com.br/api/bling?resource=product-update-fiscal" --data "{}"`: `400 Bad Request`, `blingId required`.
- `curl -i -X POST "https://api.xiaomipetrolina.com.br/api/bling?resource=product-update-dimensions" --data "{}"`: `400 Bad Request`, `blingIds array and updateData required`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: `product-update-fiscal` e `product-update-dimensions` passam pelo VPS em staging, usam fallback de token salvo em `company_settings`, removem `estoque` antes do `PUT` e mantêm debug copiável sem corpo bruto ou tokens.

Pendências:

- validar atualização fiscal real apenas em produto de teste/controlado;
- validar atualização de dimensões real apenas em produto de teste/controlado;
- comparar resposta contra a Vercel antes do corte final;
- migrar webhooks e rotas auxiliares restantes.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521113351.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-21 - Deploy e validação staging de Bling NFe/NFCe

Mudança: adicionados os recursos `nfe`, `nfce` e `nf-detail` ao `/api/bling` do Fastify na VPS.

Objetivo: mover para a VPS a listagem e consulta de detalhe de notas fiscais do Bling, preservando fallback para token salvo em `company_settings`.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-nf-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260521112818.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260521112818.bak`

Rotas afetadas:

- `/api/bling?resource=nfe`
- `/api/bling?resource=nfce`
- `/api/bling?resource=nf-detail&tipo=nfe&id=...`
- `/api/bling?resource=nf-detail&tipo=nfce&id=...`

Validação:

- `node tmp-tests/vps-bling-nf-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-finance-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-reconcile-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-sync-prices-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-stock-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-stock-live-read-check.cjs`
- `node tmp-tests/vps-bling-product-detail-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-products-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-shipping-fastify-static.test.mjs`
- `node tmp-tests/vps-seo-produto-fastify-static.test.mjs`
- `node tmp-tests/vps-sitemap-fastify-static.test.mjs`
- `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`
- `node tmp-tests/mercadopago-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/bling?resource=nf-detail"`: `400 Bad Request`, `tipo must be nfe or nfce`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: `nfe`, `nfce` e `nf-detail` passam pelo VPS em staging, preservam filtros de emissão (`dataEmissaoInicio/Fim` e nomes nativos do Bling), `situacao`, paginação e debug copiável sem segredos.

Pendências:

- validar listagem real com Authorization/token salvo em sessão/admin controlado;
- validar detalhe de NF-e/NFC-e real não-mutável;
- comparar resposta contra a Vercel antes do corte final;
- migrar atualizações fiscais/dimensões, webhooks e rotas auxiliares restantes.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260521112818.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-20 - Deploy e validação staging de Bling finance

Mudança: adicionado o recurso `finance` ao `/api/bling` do Fastify na VPS.

Objetivo: mover para a VPS o proxy de Contas a Pagar/Receber do Bling, preservando ações de listagem, detalhe, criação, atualização, baixa e cancelamento.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-finance-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260520213350.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260520213350.bak`

Rotas afetadas:

- `/api/bling?resource=finance&resourceType=pagar`
- `/api/bling?resource=finance&resourceType=receber`

Validação:

- `node tmp-tests/vps-bling-finance-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-reconcile-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-sync-prices-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-stock-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-product-detail-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-products-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-shipping-fastify-static.test.mjs`
- `node tmp-tests/vps-seo-produto-fastify-static.test.mjs`
- `node tmp-tests/vps-sitemap-fastify-static.test.mjs`
- `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`
- `node tmp-tests/mercadopago-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/bling?resource=finance&resourceType=pagar&action=list"`: `401 Unauthorized`, `Missing Authorization header`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: `finance` passa pelo VPS em staging, exige Authorization do cliente, preserva `resourceType=pagar|receber`, filtros de vencimento/situação, `list/get/create/update/baixar/cancelar`, e debug copiável sem corpo financeiro bruto ou tokens.

Pendências:

- validar listagem real com Authorization válido em sessão/admin controlado;
- validar detalhe de conta real não-mutável;
- validar create/update/baixar/cancelar apenas em ambiente/controlado de teste;
- migrar NFe/NFCe, atualizações fiscais/dimensões, webhooks e rotas auxiliares restantes.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260520213350.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-20 - Deploy e validação staging de Bling reconcile

Mudança: adicionado o recurso `reconcile` ao `/api/bling` do Fastify na VPS.

Objetivo: mover para a VPS a reconciliação entre produtos locais mapeados por `bling_id`, produtos/saldos do Bling e atualização local de estoque/nome, mantendo suporte a `dryRun`.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-reconcile-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260520210523.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260520210523.bak`

Rotas afetadas:

- `/api/bling?resource=reconcile`
- `/products/stock`
- `/products/name`

Validação:

- `node tmp-tests/vps-bling-reconcile-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-sync-prices-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-stock-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-product-detail-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-products-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-shipping-fastify-static.test.mjs`
- `node tmp-tests/vps-seo-produto-fastify-static.test.mjs`
- `node tmp-tests/vps-sitemap-fastify-static.test.mjs`
- `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`
- `node tmp-tests/mercadopago-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/bling?resource=reconcile&dryRun=true"`: `401 Unauthorized`, confirmando barreira de autorização sem executar reconciliação.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: `reconcile` passa pelo VPS em staging, exige autorização (`CRON_SECRET`, sync key ou cron user-agent), preserva `dryRun`, monta plano local, busca produtos/saldos do Bling, aplica estoque/nome quando autorizado e mantém sync para `/products/stock` e `/products/name`.

Pendências:

- executar `dryRun=true` real com segredo controlado;
- comparar totais e planned changes contra a Vercel;
- executar aplicação real apenas após revisar o plano;
- migrar `finance`, atualizações fiscais/dimensões e webhooks restantes.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260520210523.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-20 - Deploy e validação staging de Bling sync-prices-vps

Mudança: adicionado o recurso `sync-prices-vps` ao `/api/bling` do Fastify na VPS.

Objetivo: permitir que a própria VPS leia preço/estoque do Supabase em páginas de 50 produtos e sincronize para `/products/batch`, preservando vínculos Bling usados por webhooks e reconciliação.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-sync-prices-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260520204120.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260520204120.bak`

Rotas afetadas:

- `/api/bling?resource=sync-prices-vps&page=...`
- `/products/batch`

Validação:

- `node tmp-tests/vps-bling-sync-prices-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-stock-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-product-detail-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-products-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-shipping-fastify-static.test.mjs`
- `node tmp-tests/vps-seo-produto-fastify-static.test.mjs`
- `node tmp-tests/vps-sitemap-fastify-static.test.mjs`
- `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`
- `node tmp-tests/mercadopago-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/bling?resource=sync-prices-vps&page=0"`: `405 Method Not Allowed`, confirmando rota sem executar sync real via GET.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: `sync-prices-vps` passa pelo VPS em staging, preserva paginação de 50 itens, `Range`/count do Supabase, campos `bling_id`, `bling_parent_id` e `parent_id`, e autenticação de `/products/batch` via sync key sem expor segredo em debug.

Pendências:

- executar sync real controlada com `POST` em página pequena;
- comparar resultado de uma página contra a Vercel;
- confirmar contagem e `hasMore/nextPage` em execução real;
- migrar `reconcile`, `finance`, atualizações fiscais/dimensões e webhooks restantes.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260520204120.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-20 - Deploy e validação staging de Bling stock/stock-sync

Mudança: adicionados os recursos `stock` e `stock-sync` ao `/api/bling` do Fastify na VPS.

Objetivo: permitir leitura de saldos do Bling pela VPS e preparar a baixa de estoque via `stock-sync`, preservando o contrato usado pelo PDV/pedidos.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-stock-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260520203451.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260520203451.bak`

Rotas afetadas:

- `/api/bling?resource=stock`
- `/api/bling?resource=stock&idsProdutos[]=...`
- `/api/bling?resource=stock-sync`

Validação:

- `node tmp-tests/vps-bling-stock-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-product-detail-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-products-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-shipping-fastify-static.test.mjs`
- `node tmp-tests/vps-seo-produto-fastify-static.test.mjs`
- `node tmp-tests/vps-sitemap-fastify-static.test.mjs`
- `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`
- `node tmp-tests/mercadopago-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/bling?resource=stock"`: `401 Unauthorized`, `Missing Authorization header`.
- `curl -X POST -H "Host: staging.mercadodovale.com.br" -H "Content-Type: application/json" --data-raw "{}" "http://76.13.232.162/api/bling?resource=stock-sync"`: `400 Bad Request`, `blingId and quantity required`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: `stock` e `stock-sync` passam pelo VPS em staging, com validação de Authorization/payload, suporte a `idsProdutos[]`, normalização de 400 do Bling para `{ data: [] }`, baixa `operacao: 'S'` e debug copiável sem tokens.

Validação real posterior: `node tmp-tests/vps-bling-stock-live-read-check.cjs` confirmou `GET /api/bling?resource=stock&page=1` e `GET /api/bling?resource=stock&page=1&idsProdutos[]=<descoberto>` via VPS com saída sanitizada.

Pendências:

- validar baixa real com produto de teste e quantidade controlada;
- comparar `stock` e `stock-sync` contra a Vercel antes do corte final;
- migrar `sync-prices-vps`, `reconcile`, `finance`, atualizações fiscais/dimensões e webhooks restantes.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260520203451.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-20 - Deploy e validação staging de Bling product-detail

Mudança: adicionado o recurso `product-detail` ao `/api/bling` do Fastify na VPS.

Objetivo: permitir que a VPS busque detalhe completo de produto do Bling, incluindo variações e estoque normalizado, usando Authorization recebido ou token salvo em `company_settings` com refresh quando expirado.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-product-detail-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260520202945.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260520202945.bak`

Rotas afetadas:

- `/api/bling?resource=product-detail&id=...`
- `/api/bling?resource=product-detail&id=...&variacoes=1`

Validação:

- `node tmp-tests/vps-bling-product-detail-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-products-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-shipping-fastify-static.test.mjs`
- `node tmp-tests/vps-seo-produto-fastify-static.test.mjs`
- `node tmp-tests/vps-sitemap-fastify-static.test.mjs`
- `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`
- `node tmp-tests/mercadopago-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/bling?resource=product-detail"`: `400 Bad Request`, `Product ID required`.
- `curl -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/bling?resource=product-detail&id=0"`: `404 Not Found` retornado pelo Bling, confirmando proxy/autenticação até o upstream.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: `product-detail` passa pelo VPS em staging, preserva variações (`variacoes=1`), soma saldos do Bling em `stock_quantity` e não expõe tokens/client secret em debug copiável.

Pendências:

- validar detalhe real com um `id` Bling existente em sessão/admin controlado;
- comparar detalhe de produto e variação contra a Vercel;
- migrar `stock`, `stock-sync`, `sync-prices-vps`, `reconcile`, `finance`, atualizações fiscais/dimensões e webhooks restantes.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260520202945.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-20 - Deploy e validação staging de Bling categories/products

Mudança: adicionados os recursos `categories` e `products` ao `/api/bling` do Fastify na VPS.

Objetivo: mover para a VPS a listagem de categorias e a busca/listagem de produtos do Bling, preservando Authorization do cliente, busca por nome/SKU e fallback de busca solta.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-products-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260520202530.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260520202530.bak`

Rotas afetadas:

- `/api/bling?resource=categories`
- `/api/bling?resource=products`
- `/api/bling?resource=products&search=...`

Validação:

- `node tmp-tests/vps-bling-products-fastify-static.test.mjs`
- `node tmp-tests/vps-bling-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-shipping-fastify-static.test.mjs`
- `node tmp-tests/vps-seo-produto-fastify-static.test.mjs`
- `node tmp-tests/vps-sitemap-fastify-static.test.mjs`
- `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`
- `node tmp-tests/mercadopago-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/bling?resource=categories"`: `401 Unauthorized`, `Missing Authorization header`.
- `curl -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/bling?resource=products&page=1"`: `401 Unauthorized`, `Missing Authorization header`.
- `curl -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/bling?resource=products&search=cabo"`: `401 Unauthorized`, `Missing Authorization header`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: recursos `categories` e `products` passam pelo VPS em staging, mantendo o contrato de autorização e sem incluir Authorization em debug copiável.

Pendências:

- validar listagem real com token Bling válido em sessão/admin controlado;
- comparar busca direta e busca fallback contra a Vercel;
- migrar `product-detail`, `stock`, `stock-sync`, `sync-prices-vps`, `reconcile`, `finance` e webhooks restantes.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260520202530.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-20 - Deploy e validação staging de Bling OAuth/exchange

Mudança: criada e deployada a primeira fatia do Bling no Fastify da VPS, cobrindo callback OAuth e troca de token por `/api/bling?resource=exchange`.

Objetivo: tirar o callback OAuth do caminho da Vercel preservando os caminhos públicos atuais (`/api/auth/callback/bling` e `/api/bling`).

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-bling-oauth-fastify-static.test.mjs`
- `tmp-tests/vps-shipping-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260520201711.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260520201711.bak`

Rotas afetadas:

- `/api/auth/callback/bling`
- `/api/bling?resource=oauth-callback`
- `/api/bling?resource=exchange`

Validação:

- `node tmp-tests/vps-bling-oauth-fastify-static.test.mjs`
- `node tmp-tests/vps-shipping-fastify-static.test.mjs`
- `node tmp-tests/vps-seo-produto-fastify-static.test.mjs`
- `node tmp-tests/vps-sitemap-fastify-static.test.mjs`
- `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`
- `node tmp-tests/mercadopago-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/auth/callback/bling"`: `302 Found`, `Location: /admin/settings/bling?error=missing_code`.
- `curl -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/bling?resource=oauth-callback&error=access_denied"`: `302 Found`, `Location: /admin/settings/bling?error=access_denied`.
- `curl -X POST -H "Host: staging.mercadodovale.com.br" -H "Content-Type: application/json" --data-raw "{}" "http://76.13.232.162/api/bling?resource=exchange"`: `400 Bad Request`, `Missing client_id or client_secret`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: callback OAuth do Bling e endpoint de exchange respondem pela VPS em staging, com redirects preservados e sem expor `client_secret`/body bruto em payloads de debug.

Pendências:

- validar reconexão real com código OAuth válido do Bling;
- migrar recursos de produtos/detalhe/reconcile dentro de `/api/bling`;
- migrar e validar `/api/bling-webhook`;
- comparar comportamento com a Vercel antes do corte final.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260520201711.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-20 - Deploy e validação staging de `/api/shipping`

Mudança: criada e deployada a rota `/api/shipping` diretamente no Fastify da VPS.

Objetivo: remover a dependência da Vercel para cálculo/geração de frete mantendo o contrato usado pelo frontend (`provider` e `action` por query string).

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-shipping-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260520200921.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260520200921.bak`

Rotas afetadas:

- `/api/shipping?provider=frenet&action=calculate`
- `/api/shipping?provider=melhor-envio&action=calculate`
- `/api/shipping?provider=melhor-envio&action=label`

Validação:

- `node tmp-tests/vps-shipping-fastify-static.test.mjs`
- `node tmp-tests/vps-seo-produto-fastify-static.test.mjs`
- `node tmp-tests/vps-sitemap-fastify-static.test.mjs`
- `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`
- `node tmp-tests/mercadopago-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -X POST -H "Host: staging.mercadodovale.com.br" -H "Content-Type: application/json" --data-raw "{}" "http://76.13.232.162/api/shipping?provider=frenet&action=calculate"`: `400 Bad Request`, `Token Frenet nao fornecido`, debug copiável sem segredo.
- `curl -X POST -H "Host: staging.mercadodovale.com.br" -H "Content-Type: application/json" --data-raw "{}" "http://76.13.232.162/api/shipping?provider=melhor-envio&action=calculate"`: `400 Bad Request`, `Token do Melhor Envio nao fornecido`, debug copiável sem segredo.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: rota validada no staging com validação de payload, contratos de Frenet e Melhor Envio preservados, `User-Agent` do Melhor Envio mantido e debug copiável sem incluir tokens.

Pendências:

- validar cotação real com token Frenet em ambiente controlado;
- validar cotação real com token Melhor Envio em sandbox/produção controlada;
- validar fluxo de etiqueta Melhor Envio com pedido de teste;
- confirmar no navegador a cotação da PDP pelo staging.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260520200921.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-20 - Deploy e validação staging de `/api/seo-produto`

Mudança: criada e deployada a rota `/api/seo-produto` diretamente no Fastify da VPS para atender `/produto/:slug` via Nginx.

Objetivo: remover a dependência da Vercel para HTML SEO de produto antes do corte de DNS do site.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-seo-produto-fastify-static.test.mjs`
- `migração_VPS.md`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/.codex-backups/server.js.20260520195648.bak`
- `/var/www/mdv-api/.codex-backups/vps_server.js.20260520195648.bak`

Rotas afetadas:

- `/api/seo-produto`
- `/produto/:slug`

Validação:

- `node tmp-tests/vps-seo-produto-fastify-static.test.mjs`
- `node tmp-tests/vps-sitemap-fastify-static.test.mjs`
- `node tmp-tests/vps-nginx-staging-config-static.test.mjs`
- `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`
- `node tmp-tests/mercadopago-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/autoresponder-vps-server-deploy.cjs`
- `curl -H "Host: staging.mercadodovale.com.br" http://76.13.232.162/api/seo-produto?slug=abracadeira-nylon-enforca-gato-300x36mm-bom-5495`: `200 OK`, `Content-Type: text/html; charset=utf-8`.
- `curl -H "Host: staging.mercadodovale.com.br" http://76.13.232.162/produto/abracadeira-nylon-enforca-gato-300x36mm-bom-5495`: `200 OK`, `Content-Type: text/html; charset=utf-8`.
- `curl -i https://api.xiaomipetrolina.com.br/status`: `200 OK`, confirmando API atual online após restart.

Resultado: rota validada no staging com HTML `text/html`, tags Open Graph de produto, canonical para `https://staging.mercadodovale.com.br/produto/...`, JSON-LD de `Product` e `BreadcrumbList`, cache `s-maxage=60, stale-while-revalidate=300`, busca MySQL por slug/UUID e fallback para `index.html` quando o produto não existir. Os metadados antigos da home (`og:type=website`, canonical da home e Twitter Card antigo) foram removidos antes da injeção. O preço no Schema.org mantém a convenção da base em centavos (`1790.00` -> `17.90`).

Pendências:

- validar outros slugs reais, incluindo produto sem imagem e produto com descrição longa;
- comparar HTML SEO da VPS contra o HTML atual da Vercel antes do corte final;
- validar visualmente no navegador quando o DNS/hosts de staging estiver configurado.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/server.js.20260520195648.bak` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-20 - Preparação do deploy estático do frontend na VPS

Mudança: criado o primeiro fluxo de deploy do frontend para a VPS, ainda sem executar troca de DNS.

Objetivo: permitir subir o `dist/` do Vite para a VPS em releases versionados, com symlink `current` e `previous` para rollback.

Arquivos/infra alterados:

- `scripts/deploy-vps-site.cjs`
- `package.json`
- `tmp-tests/vps-site-deploy-script-static.test.mjs`
- `docs/superpowers/plans/2026-05-20-vps-staging-frontend.md`
- `migração_VPS.md`

Rotas afetadas:

- `/`
- `/admin/*`, indiretamente, por serem rotas SPA servidas pelo mesmo `dist/`

Validação:

- `node tmp-tests/vps-site-deploy-script-static.test.mjs`
- `npm run build`

Resultado: teste estático passou e build Vite passou. Produção atual não foi alterada.

Pendências:

- configurar variáveis `VPS_SITE_HOST`, `VPS_SITE_USER`, `VPS_SITE_PASSWORD` ou `VPS_SITE_PRIVATE_KEY`, e `VPS_SITE_ROOT`;
- executar `npm run deploy:vps-site`;
- configurar Nginx staging apontando para `${VPS_SITE_ROOT}/current`;
- validar staging no navegador.

Rollback: após primeiro deploy, o script imprimirá comando `rollback` usando symlink `previous`.

Próximo passo: preparar Nginx staging para servir `${VPS_SITE_ROOT}/current` com fallback SPA.

### 2026-05-20 - Preparação do Nginx staging para frontend VPS

Mudança: criado template Nginx para servir o frontend em `staging.mercadodovale.com.br`.

Objetivo: deixar a VPS pronta para servir `${VPS_SITE_ROOT}/current` com fallback SPA, cache longo para assets e reservas de proxy para `/api`, `/sitemap.xml` e `/produto/:slug`.

Arquivos/infra alterados:

- `infra/nginx/mdv-site-staging.conf`
- `tmp-tests/vps-nginx-staging-config-static.test.mjs`
- `migração_VPS.md`

Rotas afetadas:

- `/`
- `/admin/*`
- `/api/*`, como proxy reservado para Fastify local
- `/sitemap.xml`, como rota reservada antes do fallback SPA
- `/produto/:slug`, como rota reservada antes do fallback SPA

Validação:

- `node tmp-tests/vps-nginx-staging-config-static.test.mjs`
- `node tmp-tests/vps-site-deploy-script-static.test.mjs`

Resultado: testes estáticos passaram. Produção atual não foi alterada.

Pendências:

- instalar `infra/nginx/mdv-site-staging.conf` na VPS;
- habilitar site no Nginx;
- validar `nginx -t`;
- recarregar Nginx;
- apontar/criar DNS de staging, se ainda não existir;
- executar deploy do `dist/`;
- validar no navegador.

Rollback: remover/desabilitar o site staging do Nginx ou voltar symlink `current` para `previous`.

Próximo passo: instalar e validar o staging real na VPS.

### 2026-05-20 - Execução do deploy e instalação do Nginx staging na VPS

Mudança: executado o primeiro deploy real do frontend na VPS e instalado o site Nginx de staging.

Objetivo: validar que a VPS consegue servir o build Vite sem depender da Vercel, mantendo rollback por symlink.

Arquivos/infra alterados:

- `/var/www/mdv-site/releases/20260520-180705`
- `/var/www/mdv-site/current`
- `/var/www/mdv-site/previous`
- `/etc/nginx/sites-available/mdv-site-staging`
- `/etc/nginx/sites-enabled/mdv-site-staging`
- `migração_VPS.md`

Rotas afetadas:

- `/`
- `/admin/*`
- `/assets/*`

Validação:

- `nginx -t`: configuração válida.
- `systemctl reload nginx`: recarga executada.
- `curl -I -H "Host: staging.mercadodovale.com.br" http://76.13.232.162/`: `200 OK`.
- `curl -I -H "Host: staging.mercadodovale.com.br" http://76.13.232.162/admin/products`: `200 OK`, confirmando fallback SPA.
- `curl -I -H "Host: staging.mercadodovale.com.br" http://76.13.232.162/assets/index-DgFecivF.js`: `200 OK` com `Cache-Control: public, max-age=31536000, immutable`.
- `curl -I -H "Host: staging.mercadodovale.com.br" http://76.13.232.162/assets/index-DgIrOX85.css`: `200 OK` com `Cache-Control: public, max-age=31536000, immutable`.

Resultado: o frontend está servido pela VPS em staging via `Host` header. A produção atual não foi alterada e continua apontando para a Vercel.

Pendências:

- criar/apontar DNS `staging.mercadodovale.com.br` para `76.13.232.162`;
- validar no navegador usando o domínio de staging;
- validar login/admin no staging;
- iniciar migração das rotas `/api/*` para Fastify na VPS.

Rollback: apontar `/var/www/mdv-site/current` para `/var/www/mdv-site/previous` ou desabilitar `mdv-site-staging` no Nginx.

Próximo passo: criar o DNS de staging ou validar via arquivo `hosts`, depois começar pelo bloco `/api/vps-proxy`.

### 2026-05-20 - Preparação da rota Fastify `/api/vps-proxy`

Mudança: criada compatibilidade da rota `/api/vps-proxy` diretamente no Fastify da VPS.

Objetivo: remover a Vercel do caminho crítico do proxy admin/cliente sem mudar ainda o contrato usado pelo frontend.

Arquivos/infra alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-proxy-fastify-route-static.test.mjs`
- `infra/nginx/mdv-site-staging.conf`
- `tmp-tests/vps-nginx-staging-config-static.test.mjs`
- `migração_VPS.md`

Rotas afetadas:

- `/api/vps-proxy`
- `/api/brasilapi-ncm`
- `/api/*` no Nginx staging

Validação:

- `node tmp-tests/vps-proxy-fastify-route-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `curl -i -H "Host: staging.mercadodovale.com.br" http://76.13.232.162/api/status`: encontrou `502 Bad Gateway` antes da correção, indicando proxy Nginx apontando para porta incorreta.

Resultado: código da rota Fastify foi preparado e o problema de porta do Nginx staging foi identificado. Produção atual não foi alterada.

Pendências:

- aplicar Nginx staging corrigido para `127.0.0.1:4000`;
- fazer deploy da API (`vps_server.js`) na VPS;
- validar `/api/status`, `/api/vps-proxy?path=/status`, `/api/vps-proxy?path=/products&limit=1` e `/api/brasilapi-ncm?search=8517`;
- validar uma chamada admin real com sessão Supabase;
- documentar resultado da regressão depois do deploy.

Rollback: reverter `vps_server.js` na VPS pelo backup do deploy da API ou remover o site staging do Nginx.

Próximo passo: aplicar a correção do Nginx staging e fazer deploy controlado da API.

### 2026-05-20 - Deploy e validação staging de `/api/vps-proxy`

Mudança: aplicada a correção do Nginx staging para a porta real do Fastify (`127.0.0.1:4000`) e feito deploy manual da API VPS.

Objetivo: validar a rota `/api/vps-proxy` fora da Vercel, mantendo o mesmo contrato do frontend.

Arquivos/infra alterados:

- `/etc/nginx/sites-available/mdv-site-staging`
- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/services/vpsUploadPathPolicy.cjs`
- `/var/www/mdv-api/.codex-backups/20260520-184952`
- `migração_VPS.md`

Rotas afetadas:

- `/api/vps-proxy`
- `/api/brasilapi-ncm`
- `/api/*` no staging Nginx

Validação:

- `nginx -t`: configuração válida.
- `systemctl reload nginx`: recarga executada.
- `node --check /var/www/mdv-api/server.js`: sintaxe válida antes do restart.
- `pm2 restart mdv-api --update-env`: processo `mdv-api` online.
- `curl -i -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/vps-proxy?path=%2Fstatus"`: `200 OK`.
- `curl -i -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/vps-proxy?path=%2Fproducts%3Flimit%3D1"`: `200 OK`.
- `curl -i -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/brasilapi-ncm?search=8517"`: `200 OK`.
- `curl -i -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/vps-proxy?path=%2Fcompany-settings"` sem sessão: `403 Admin required`, confirmando bloqueio administrativo.
- `curl -i "https://api.xiaomipetrolina.com.br/status"`: `200 OK`, confirmando API atual online após restart.

Resultado: `/api/vps-proxy` e `/api/brasilapi-ncm` já funcionam no staging pela VPS. A validação com sessão admin real ainda precisa ser feita no navegador depois do DNS/hosts de staging.

Pendências:

- validar login/admin real usando o domínio de staging;
- testar uma escrita administrativa pequena e reversível;
- decidir se o frontend em staging deve forçar proxy local para todas as chamadas VPS;
- manter produção principal na Vercel até regressão de navegador.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/20260520-184952/server.js` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

Próximo passo: validar navegador com staging e seguir para `/api/bling` ou callbacks OAuth, mantendo Vercel fora do caminho novo.

### 2026-05-20 - Preparação da rota Fastify `/api/mercadopago-webhook`

Mudança: criada a rota `/api/mercadopago-webhook` diretamente no Fastify da VPS, substituindo o rewrite da Vercel que hoje despacha para o webhook do Bling.

Objetivo: receber notificações do Mercado Pago na VPS e validar o pagamento real pela API oficial antes de atualizar o pedido no Supabase.

Arquivos alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/mercadopago-webhook-fastify-static.test.mjs`
- `migração_VPS.md`

Rotas afetadas:

- `/api/mercadopago-webhook`

Validação local:

- `node tmp-tests/mercadopago-webhook-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`

Debug copiável:

- Respostas de erro controlado retornam `debug` com `timestamp`, `operation`, `step`, `paymentId`, status upstream e mensagem bruta limitada.
- Tokens e chaves não são retornados no debug.

Pendências:

- fazer deploy da API VPS;
- validar `GET /api/mercadopago-webhook` em staging;
- validar `POST /api/mercadopago-webhook` com payload não-MP;
- validar payload MP simulado, sem atualizar pedido real;
- depois da validação, trocar status da rota para `vps-staging-validado-http`.

Rollback: restaurar o backup anterior de `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

## 2026-05-30 - Configuracoes WhatsApp via VPS table-data

Mudanca: `services/whatsappSettingsService.ts` deixou de usar `supabase.from('whatsapp_settings')` e passou a ler/gravar a tabela por `/table-data/whatsapp_settings` via `vpsClient`. A tela `pages/admin/settings/WhatsAppPage.tsx` continua usando o mesmo servico, agora sem import direto ou indireto dedicado ao Supabase para essa tabela.

Arquivos alterados:

- `services/whatsappSettingsService.ts`
- `tmp-tests/whatsapp-settings-service-vps-static.test.mjs`
- `migração_VPS.md`

Validacao:

- RED: `node tmp-tests\whatsapp-settings-service-vps-static.test.mjs` falhou enquanto o servico importava `./supabase`.
- `node tmp-tests\whatsapp-settings-service-vps-static.test.mjs`: OK.
- `node tmp-tests\whatsapp-page-no-lib-supabase-static.test.mjs`: OK.
- `node tmp-tests\table-data-service-vps-static.test.mjs`: OK.
- `npm.cmd run build`: OK fora do sandbox. O sandbox bloqueou leitura do `vite.config.ts`; o build elevado passou com os mesmos avisos conhecidos de chunk/dynamic import.

Rollback: restaurar a versao anterior de `services/whatsappSettingsService.ts`, que lia `whatsapp_settings` por Supabase.

## 2026-05-30 - Tags de cross-sell via VPS table-data

Mudanca: `services/cross-sell-tags.ts` deixou de usar `supabase.from('cross_sell_tags')` e passou a listar, criar, atualizar e apagar tags pela VPS em `/table-data/cross_sell_tags`. O servico preserva o slug local, ordenacao por nome, `updated_at` em updates e a protecao contra duplicidade por slug/nome antes e depois do POST.

Arquivos alterados:

- `services/cross-sell-tags.ts`
- `tmp-tests/cross-sell-tags-service-vps-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migração_VPS.md`

Validacao:

- RED: `node tmp-tests\cross-sell-tags-service-vps-static.test.mjs` falhou enquanto o servico importava `./supabase`.
- `node tmp-tests\cross-sell-tags-service-vps-static.test.mjs`: OK.
- `node tmp-tests\whatsapp-settings-service-vps-static.test.mjs`: OK.
- `node tmp-tests\vps-backfill-tools-static.test.mjs`: OK.
- `npm.cmd run build`: OK fora do sandbox, com os avisos conhecidos de chunk/dynamic import.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 382`, `.rpc(...) = 29`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.

Resultado: o inventario operacional Supabase caiu de `.from=393` para `.from=382` nesta sequencia WhatsApp + cross-sell. O guard tambem removeu as excecoes temporarias para `whatsapp_settings` e `cross_sell_tags`, impedindo retorno dessas tabelas para Supabase.

Rollback: restaurar a versao anterior de `services/cross-sell-tags.ts` e recolocar o baseline/allowlist anterior no auditor.

## 2026-05-30 - Agenda Instagram via VPS table-data

Mudanca: `services/instagramScheduleService.ts` deixou de usar `supabase.from('instagram_schedule')` e passou a listar, filtrar, criar, atualizar, apagar e alternar agenda pela VPS em `/table-data/instagram_schedule`. A ordenacao por `day_of_week` e `scheduled_time`, os filtros por dia/ativo e os labels usados pela tela de Marketing foram preservados.

Arquivos alterados:

- `services/instagramScheduleService.ts`
- `tmp-tests/instagram-schedule-service-vps-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migração_VPS.md`

Validacao:

- RED: `node tmp-tests\instagram-schedule-service-vps-static.test.mjs` falhou enquanto o servico importava `./supabase`.
- `node tmp-tests\instagram-schedule-service-vps-static.test.mjs`: OK.
- `node tmp-tests\cross-sell-tags-service-vps-static.test.mjs`: OK.
- `node tmp-tests\whatsapp-settings-service-vps-static.test.mjs`: OK.
- `npm.cmd run build`: OK fora do sandbox, com os avisos conhecidos de chunk/dynamic import.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 375`, `.rpc(...) = 29`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.

Resultado: o inventario operacional Supabase caiu mais sete chamadas `.from(...)` (`382 -> 375`) e o guard removeu a excecao temporaria de `instagram_schedule`.

Rollback: restaurar a versao anterior de `services/instagramScheduleService.ts` e recolocar `instagram_schedule`/baseline anterior no auditor.

## 2026-05-30 - Compartilhamento de catalogo via VPS

Mudanca: `services/catalogShareService.ts` deixou de buscar `company` e gravar `catalog_shares` via Supabase. Os dados da empresa agora vêm de `publicCompanySettingsService`, ja apoiado na VPS/public endpoint, e o rastreamento de compartilhamentos grava em `/table-data/catalog_shares` via `vpsClient`.

Arquivos alterados:

- `services/catalogShareService.ts`
- `tmp-tests/catalog-share-service-vps-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migração_VPS.md`

Validacao:

- RED: `node tmp-tests\catalog-share-service-vps-static.test.mjs` falhou enquanto o servico importava `./supabase`.
- `node tmp-tests\catalog-share-service-vps-static.test.mjs`: OK.
- `npm.cmd run build`: OK fora do sandbox, com os avisos conhecidos de chunk/dynamic import.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 371`, `.rpc(...) = 29`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.

Resultado: o inventario operacional Supabase caiu quatro chamadas `.from(...)` (`375 -> 371`) e a excecao temporaria `catalog-share-temporary` saiu do auditor.

Rollback: restaurar a versao anterior de `services/catalogShareService.ts` e recolocar `catalog_shares`/baseline anterior no auditor.

## 2026-05-30 - Logs de troca de unidades via VPS table-data

Mudanca: `services/units.ts` deixou de gravar e listar `unit_swap_logs` via Supabase e passou a usar `/table-data/unit_swap_logs` pela VPS. A tela `pages/admin/inventory/SerializedUnitsPage.tsx` tambem deixou de consultar `unit_swap_logs` diretamente no Supabase; ela agora usa `unitService.getSwapLogs({})` e enriquece a visualizacao com as unidades ja carregadas na tela.

Arquivos alterados:

- `services/units.ts`
- `pages/admin/inventory/SerializedUnitsPage.tsx`
- `tmp-tests/units-swap-logs-vps-static.test.mjs`
- `tmp-tests/serialized-units-swap-logs-vps-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migração_VPS.md`

Validacao:

- RED: `node tmp-tests\units-swap-logs-vps-static.test.mjs` falhou enquanto `services/units.ts` importava `./supabase`.
- RED: `node tmp-tests\serialized-units-swap-logs-vps-static.test.mjs` falhou enquanto `SerializedUnitsPage` fazia `.from('unit_swap_logs')`.
- `node tmp-tests\units-swap-logs-vps-static.test.mjs`: OK.
- `node tmp-tests\serialized-units-swap-logs-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 368`, `.rpc(...) = 29`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK fora do sandbox, com os avisos conhecidos de chunk/dynamic import.

Resultado: `unit_swap_logs` saiu do inventario operacional Supabase e o baseline do auditor ficou travado em `.from=368`, `.rpc=29`, `storage=13`.

Rollback: restaurar temporariamente as versoes anteriores de `services/units.ts` e `SerializedUnitsPage.tsx`, recolocar `unit_swap_logs` na allowlist operacional e voltar o baseline `.from` anterior; nao recomendado porque reintroduz Supabase no historico de troca de unidades.

## 2026-05-30 - Configuracoes Telegram via VPS table-data

Mudanca: `services/telegramSettings.ts` deixou de usar `supabase.from('telegram_settings')` e passou a ler/gravar configuracoes pela VPS em `/table-data/telegram_settings`. O servico preserva templates padrao, normalizacao de templates antigos sem `type`, merge nao-destrutivo de templates novos e fallback para configuracao vazia.

Arquivos alterados:

- `services/telegramSettings.ts`
- `tmp-tests/telegram-settings-service-vps-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migração_VPS.md`

Validacao:

- RED: `node tmp-tests\telegram-settings-service-vps-static.test.mjs` falhou enquanto o servico importava `./supabase`.
- `node tmp-tests\telegram-settings-service-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 366`, `.rpc(...) = 29`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK fora do sandbox, com os avisos conhecidos de chunk/dynamic import.

Resultado: `telegram_settings` saiu da allowlist operacional Supabase e o baseline do auditor caiu de `.from=368` para `.from=366`.

Rollback: restaurar a versao anterior de `services/telegramSettings.ts`, recolocar `telegram_settings` na allowlist `admin-config-temporary` e voltar o baseline `.from=368`; nao recomendado porque reintroduz Supabase na configuracao do Telegram.

## 2026-05-30 - Integracoes de pagamento via VPS table-data

Mudanca: `services/paymentIntegrationService.ts` deixou de usar Supabase para `companies` e `payment_integrations`. O servico agora usa o `getCompanyId` compartilhado de `companyContext` e lista/cria/atualiza/remove integracoes pela VPS em `/table-data/payment_integrations`.

Arquivos alterados:

- `services/paymentIntegrationService.ts`
- `tmp-tests/payment-integration-service-vps-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migração_VPS.md`

Validacao:

- RED: `node tmp-tests\payment-integration-service-vps-static.test.mjs` falhou enquanto o servico importava `./supabase`.
- `node tmp-tests\payment-integration-service-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 359`, `.rpc(...) = 29`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK fora do sandbox, com os avisos conhecidos de chunk/dynamic import.

Resultado: `payment_integrations` saiu da allowlist operacional Supabase, o servico eliminou sua copia local de consulta a `companies`, e o baseline do auditor caiu de `.from=366` para `.from=359`.

Rollback: restaurar a versao anterior de `services/paymentIntegrationService.ts`, recolocar `payment_integrations` na allowlist `integration-settings-temporary` e voltar o baseline `.from=366`; nao recomendado porque reintroduz Supabase no checkout/configuracao de gateways.

## 2026-05-30 - Templates Shopee via VPS table-data

Mudanca: `services/shopeeTemplateService.ts` deixou de usar `supabase.from('shopee_templates')` e passou a listar, criar, atualizar, remover e semear templates pela VPS em `/table-data/shopee_templates`. O fallback em `localStorage`, os templates padrao, a ordenacao por prioridade/nome e o parse defensivo dos campos JSON foram preservados.

Arquivos alterados:

- `services/shopeeTemplateService.ts`
- `tmp-tests/shopee-template-service-vps-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migração_VPS.md`

Validacao:

- RED: `node tmp-tests\shopee-template-service-vps-static.test.mjs` falhou enquanto o servico importava `./supabase`.
- `node tmp-tests\shopee-template-service-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 354`, `.rpc(...) = 29`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK fora do sandbox, com os avisos conhecidos de chunk/dynamic import.

Resultado: `shopee_templates` saiu da allowlist operacional Supabase e o baseline do auditor caiu de `.from=359` para `.from=354`.

Rollback: restaurar a versao anterior de `services/shopeeTemplateService.ts`, recolocar `shopee_templates`/`shopee-templates-temporary` na allowlist e voltar o baseline `.from=359`; nao recomendado porque reintroduz Supabase na configuracao de templates Shopee.

## 2026-05-30 - Tags do sistema via VPS table-data

Mudanca: `services/systemTagsService.ts` deixou de usar `supabase.from('system_tags')` e passou a listar, criar, atualizar, remover e ativar/desativar tags pela VPS em `/table-data/system_tags`. A normalizacao de `resolver_config`, ordenacao por contexto/ordem/nome e geracao de slug foram preservadas.

Arquivos alterados:

- `services/systemTagsService.ts`
- `tmp-tests/system-tags-service-vps-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migração_VPS.md`

Validacao:

- RED: `node tmp-tests\system-tags-service-vps-static.test.mjs` falhou enquanto o servico importava `./supabase`.
- `node tmp-tests\system-tags-service-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 347`, `.rpc(...) = 29`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK fora do sandbox, com os avisos conhecidos de chunk/dynamic import.

Resultado: `system_tags` saiu da allowlist operacional Supabase e o baseline do auditor caiu de `.from=354` para `.from=347`.

Rollback: restaurar a versao anterior de `services/systemTagsService.ts`, recolocar `system_tags` na allowlist `admin-config-temporary` e voltar o baseline `.from=354`; nao recomendado porque reintroduz Supabase na configuracao de tags do sistema.

## 2026-05-30 - Solicitacoes de tipo de cliente via VPS table-data

Mudanca: `services/typeUpgradeRequests.ts` deixou de usar Supabase para `customer_type_requests` e para atualizar o cliente aprovado. O servico agora usa `/table-data/customer_type_requests` e `/table-data/customers`, mantendo criacao com bloqueio de pendencia, consulta do cliente, listagem admin com resumo do cliente, aprovacao/rejeicao e estatisticas.

Arquivos alterados:

- `services/typeUpgradeRequests.ts`
- `tmp-tests/type-upgrade-requests-vps-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migração_VPS.md`

Validacao:

- RED: `node tmp-tests\type-upgrade-requests-vps-static.test.mjs` falhou enquanto o servico importava `./supabase`.
- `node tmp-tests\type-upgrade-requests-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 338`, `.rpc(...) = 29`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK fora do sandbox, com os avisos conhecidos de chunk/dynamic import.

Resultado: `customer_type_requests` saiu da allowlist operacional Supabase e o baseline do auditor caiu de `.from=347` para `.from=338`.

Rollback: restaurar a versao anterior de `services/typeUpgradeRequests.ts`, recolocar `customer_type_requests` na allowlist `customer-engagement-temporary` e voltar o baseline `.from=347`; nao recomendado porque reintroduz Supabase no fluxo de upgrade do cliente.

## 2026-05-30 - Mensagem copiada do catalogo com link da categoria

Mudanca: `utils/catalogMessageGenerator.ts` agora adiciona o link do catalogo/categoria no rodape da mensagem copiada. As frases antigas `Digite o numero ou o modelo escolhido...` e `Total: X modelos` permanecem bloqueadas pelo teste estatico.

Arquivos alterados:

- `utils/catalogMessageGenerator.ts`
- `tmp-tests/catalog-message-footer-static.test.mjs`
- `migração_VPS.md`

Validacao:

- RED: `node tmp-tests\catalog-message-footer-static.test.mjs` falhou enquanto a mensagem nao incluia o link da categoria.
- `node tmp-tests\catalog-message-footer-static.test.mjs`: OK.
- `rg -n "Digite o numero ou o modelo escolhido|Total: .*modelos|Qual desses aparelhos deseja" utils components pages services tmp-tests`: somente o teste contem as frases bloqueadas.
- `npm.cmd run build`: OK fora do sandbox, com os avisos conhecidos de chunk/dynamic import.

Resultado: o rodape copiado fica curto, sem contador de modelos e com `Veja no site: https://mercadodovale.com.br/?categoria=<categoria>`. No navegador usa a origem atual para preservar dominio/ambiente.

Rollback: remover `catalogUrl`/`buildCatalogUrl` de `utils/catalogMessageGenerator.ts` e voltar o teste anterior; nao recomendado porque perderia o link direto da categoria.

## 2026-05-30 - Promocoes de moedas via VPS table-data

Mudanca: `services/coinPromotionService.ts` deixou de usar `supabase.from('coin_promotions')` e o RPC `increment_coin_promo_uses`. Listagem, criacao, atualizacao, remocao, ativacao e incremento de uso agora passam por `/table-data/coin_promotions`; o credito de moedas ainda preserva o RPC `add_coins` ate a migracao do ledger de moedas.

Arquivos alterados:

- `services/coinPromotionService.ts`
- `tmp-tests/coin-promotion-service-vps-static.test.mjs`
- `tools/audit-supabase-operational-dependencies.mjs`
- `tmp-tests/supabase-operational-dependency-guard-static.test.mjs`
- `migração_VPS.md`

Validacao:

- RED: `node tmp-tests\coin-promotion-service-vps-static.test.mjs` falhou enquanto o servico ainda usava Supabase para a tabela.
- `node tmp-tests\coin-promotion-service-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 333`, `.rpc(...) = 28`, `supabase.storage = 13`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK fora do sandbox, com os avisos conhecidos de chunk/dynamic import.

Resultado: `coin_promotions` saiu da allowlist operacional Supabase, `increment_coin_promo_uses` saiu da allowlist de RPC e o baseline do auditor caiu de `.from=338` para `.from=333` e de `.rpc=29` para `.rpc=28`.

Rollback: restaurar a versao anterior de `services/coinPromotionService.ts`, recolocar `coin_promotions` em `customer-engagement-temporary`, recolocar `increment_coin_promo_uses` em `catalog-analytics-rpc-temporary` e voltar os baselines para `.from=338`/`.rpc=29`; nao recomendado porque reintroduz Supabase na configuracao de promocoes.

### 2026-05-27 - Log de navegacao admin/PDV na VPS

Mudanca: adicionada captura de navegacao das telas `/admin` e `/pdv`, com armazenamento na VPS e botao para copiar os ultimos logs na tela `Status VPS`.

Objetivo: permitir diagnostico rapido de caminho percorrido no painel e PDV, sem depender do console do navegador.

Arquivos alterados:

- `App.tsx`
- `services/adminNavigationLogService.ts`
- `pages/admin/settings/VpsStatusPage.tsx`
- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/admin-navigation-log-vps-static.test.mjs`
- `tmp-tests/admin-navigation-logger-frontend-static.test.mjs`
- `migracao_VPS.md`

Rotas afetadas:

- `POST /admin/navigation-log`
- `GET /admin/navigation-log?limit=200`

Validacao local:

- `node tmp-tests/admin-navigation-log-vps-static.test.mjs`
- `node tmp-tests/admin-navigation-logger-frontend-static.test.mjs`
- `npm.cmd run build`

Notas:

- O logger do frontend usa `router.subscribe()` e registra somente rotas `/admin` e `/pdv`.
- Query params sensiveis como `token`, `code`, `email`, `password`, `access_token` e `refresh_token` sao redigidos antes do envio.
- A tabela `admin_navigation_logs` e criada no boot da API e limitada aos 5000 registros mais recentes.
- O botao `Copiar logs` fica em `Admin > Configuracoes > Status VPS` e copia os ultimos 200 registros em texto legivel.

Pendencias:

- publicar frontend na VPS para o botao aparecer no dominio final;
- publicar/reiniciar API VPS para criar a tabela e liberar as rotas;
- validar no dominio final com sessao admin.

### 2026-05-27 - Deploy frontend do modal de etiquetas no admin

Mudanca: publicado novo build do frontend na VPS com o modal de impressao de etiquetas do card de produtos usando controle `-`/`+` para quantidade de copias e selecao total do campo ao clicar.

Objetivo: garantir que a melhoria ja commitada no frontend apareca em `https://www.mercadodovale.com.br/admin/products`.

Arquivos/infra alterados:

- `components/products/LabelPrintModal.tsx` no commit anterior `e88c358`;
- `scripts/deploy-vps-site.cjs`;
- `tmp-tests/vps-site-deploy-script-static.test.mjs`;
- `/var/www/mdv-site/releases/20260527-194954`;
- `/var/www/mdv-site/current`.

Rotas afetadas:

- `/admin/products`;
- `/assets/LabelPrintModal-CLAhplZ4.js`.

Validacao:

- `node tmp-tests\label-print-copy-stepper-static.test.mjs`: passou.
- `node tmp-tests\vps-site-deploy-script-static.test.mjs`: passou.
- `npm.cmd run deploy:vps-site`: build e upload concluidos; release ativa `/var/www/mdv-site/releases/20260527-194954`.
- `curl.exe -L -s -o NUL -w "%{http_code} %{url_effective}\n" "https://mercadodovale.com.br/"`: `200 https://www.mercadodovale.com.br/`.
- `curl.exe -L -s -o NUL -w "%{http_code} %{url_effective}\n" "https://www.mercadodovale.com.br/admin/products"`: `200 https://www.mercadodovale.com.br/admin/products`.
- `curl.exe -L -s -o NUL -w "%{http_code}\n" "https://www.mercadodovale.com.br/assets/LabelPrintModal-CLAhplZ4.js"`: `200`.

Resultado: frontend publicado na VPS e chunk do modal de etiquetas disponivel publicamente com o controle novo. O primeiro deploy falhou com `spawnSync npm.cmd EINVAL`; o script foi ajustado para rodar `npm.cmd run build` via shell no Windows e o deploy passou.

Pendencias: validar visualmente no navegador autenticado, porque o teste HTTP confirma bundle/rota, mas nao abre sessao admin.

Rollback: apontar `/var/www/mdv-site/current` para `/var/www/mdv-site/previous` na VPS.

### 2026-05-20 - Deploy e validação staging de `/sitemap.xml`

Mudança: feito deploy manual da API VPS com a rota `/api/sitemap` e validação do proxy Nginx de `/sitemap.xml`.

Objetivo: comprovar que o sitemap público já pode sair da Vercel e ser servido pela VPS.

Arquivos/infra alterados:

- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/services/vpsUploadPathPolicy.cjs`
- `/var/www/mdv-api/.codex-backups/20260520193807`
- `migração_VPS.md`

Rotas afetadas:

- `/api/sitemap`
- `/sitemap.xml`

Validação:

- `node --check /var/www/mdv-api/server.js`: sintaxe válida antes do restart.
- `pm2 restart mdv-api --update-env`: processo `mdv-api` online.
- `curl -H "Host: staging.mercadodovale.com.br" http://76.13.232.162/api/sitemap`: `200 OK`, `Content-Type: application/xml; charset=utf-8`.
- `curl -H "Host: staging.mercadodovale.com.br" http://76.13.232.162/sitemap.xml`: `200 OK`, `Content-Type: application/xml; charset=utf-8`.
- Ambas as respostas retornaram `cache-control: s-maxage=3600, stale-while-revalidate=86400`.
- Ambas as respostas geraram 2131 entradas `<url>`.
- As URLs canônicas saíram com `https://staging.mercadodovale.com.br/...`, mesmo o teste HTTP passando pela VPS.
- `curl -i "https://api.xiaomipetrolina.com.br/status"`: `200 OK`, confirmando API atual online após restart.

Resultado: `/sitemap.xml` está validada no staging pela VPS. A rota filtra produtos com slug/nome, remove pais e itens `exclude_from_seo`, escapa XML e força HTTPS canônico fora de localhost.

Pendências:

- comparar quantidade de URLs com sitemap atual da Vercel antes do corte final;
- validar o sitemap de produção com `Host: mercadodovale.com.br` antes da troca DNS;
- decidir se duplicatas de slug devem ser limpas no banco ou deduplicadas na geração.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/20260520193807/server.js` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-20 - Deploy e validação staging de `/api/mercadopago-webhook`

Mudança: feito deploy manual da API VPS com a rota `/api/mercadopago-webhook`.

Objetivo: comprovar que o webhook do Mercado Pago já pode responder pela VPS em staging, com debug copiável em falhas controladas.

Arquivos/infra alterados:

- `/var/www/mdv-api/server.js`
- `/var/www/mdv-api/vps_server.js`
- `/var/www/mdv-api/services/vpsUploadPathPolicy.cjs`
- `/var/www/mdv-api/.codex-backups/20260520191224`
- `migração_VPS.md`

Rotas afetadas:

- `/api/mercadopago-webhook`

Validação:

- `node --check /var/www/mdv-api/server.js`: sintaxe válida antes do restart.
- `pm2 restart mdv-api --update-env`: processo `mdv-api` online.
- `curl -i -H "Host: staging.mercadodovale.com.br" "http://76.13.232.162/api/mercadopago-webhook"`: `200 OK`.
- `curl --resolve staging.mercadodovale.com.br:80:76.13.232.162 -i -H "Content-Type: application/json" --data-raw "{\"type\":\"test\"}" "http://staging.mercadodovale.com.br/api/mercadopago-webhook"`: `200 OK`, `ignored`.
- `curl --resolve staging.mercadodovale.com.br:80:76.13.232.162 -i -H "Content-Type: application/json" --data-raw "{\"type\":\"payment\",\"data\":{\"id\":\"0\"}}" "http://staging.mercadodovale.com.br/api/mercadopago-webhook"`: `200 OK`, `payment lookup failed` com `debug` copiável.
- `curl -i "https://api.xiaomipetrolina.com.br/status"`: `200 OK`, confirmando API atual online após restart.

Resultado: `/api/mercadopago-webhook` está validada no staging pela VPS. O payload simulado não atualizou pedido real e retornou diagnóstico copiável com `timestamp`, `operation`, `step`, `paymentId`, status do Mercado Pago e mensagem bruta limitada.

Pendências:

- testar com uma notificação real do Mercado Pago em ambiente controlado;
- após regressão real, trocar o endpoint público do Mercado Pago para a rota VPS definitiva;
- decidir se o rewrite da Vercel será removido somente no corte final ou mantido temporariamente como compatibilidade.

Rollback: restaurar `/var/www/mdv-api/.codex-backups/20260520191224/server.js` para `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.

### 2026-05-20 - Preparação da rota Fastify `/api/sitemap`

Mudança: criada a geração de sitemap diretamente no Fastify da VPS para atender `/sitemap.xml` via Nginx.

Objetivo: remover a dependência da Vercel para o sitemap público antes do corte de DNS do site.

Arquivos alterados:

- `vps_server.js`
- `vps_server.cjs`
- `tmp-tests/vps-sitemap-fastify-static.test.mjs`
- `tmp-tests/vps-site-deploy-runbook-static.test.mjs`
- `migração_VPS.md`

Rotas afetadas:

- `/api/sitemap`
- `/sitemap.xml`

Validação local:

- `node tmp-tests/vps-site-deploy-runbook-static.test.mjs`
- `node tmp-tests/vps-site-deploy-script-static.test.mjs`
- `node tmp-tests/vps-nginx-staging-config-static.test.mjs`
- `node tmp-tests/vps-sitemap-fastify-static.test.mjs`
- `node --check vps_server.js`
- `node --check vps_server.cjs`

Debug copiável:

- Falhas na geração retornam `debug` com `timestamp`, `operation`, `step` e `rawMessage`.
- O sitemap não retorna segredos nem dados sensíveis.

Pendências:

- fazer deploy da API VPS;
- validar `/api/sitemap` em staging;
- validar `/sitemap.xml` pelo Nginx staging;
- confirmar que URLs de produto aparecem com o host correto;
- depois da validação, trocar status da rota para `vps-staging-validado-http`.

Rollback: restaurar o backup anterior de `/var/www/mdv-api/server.js` e reiniciar `pm2 restart mdv-api --update-env`.
# 2026-05-31 - Operacional Supabase zerado na VPS

Status: `.from(...)`, `.rpc(...)` e Supabase Storage operacionais zerados no auditor. O allowlist temporario operacional tambem ficou vazio.

Movido para VPS/MySQL nesta fatia: ledger de moedas/cashback, recompensas de indicacao, check-in, promocoes de moedas, fila de compra, relacoes dinamicas da importacao/exportacao e a camada transacional de estoque por local.

Endpoints VPS adicionados para estoque: `/stock-locations/priority-decrements`, `/stock-locations/priority-reservations`, `/stock-locations/order-reservations/consume`, `/stock-locations/order-reservations/release`, `/stock-locations/sale-restores`, `/stock-locations/order-restores`.

Validado com auditor operacional zerado, guardas estaticos de cashback/estoque/fila de compra e build Vite de producao.

Proxima decisao humana: substituir Supabase Auth por Auth proprio na VPS ou outro provedor. Essa decisao envolve login por email/CPF, OAuth Google/Facebook, reset de senha, refresh token e compatibilidade com `customers.user_id`.
## 2026-05-31 - Auditoria externa pos-corte VPS

Status local:
- `node tools\audit-legacy-deploy-removal-readiness.mjs`: `ready_to_remove_legacy_deploy=true`, `blockers=[]`.
- DNS `mercadodovale.com.br A`: Cloudflare proxied (`104.21.42.27`, `172.67.199.67`), nao o IP legado Vercel `76.76.21.21`.
- DNS `www.mercadodovale.com.br A`: Cloudflare proxied (`172.67.199.67`, `104.21.42.27`).
- DNS `www.mercadodovale.com.br CNAME`: sem CNAME publico, resposta SOA Cloudflare.
- Validacao HTTP confirma o proxy: `https://mercadodovale.com.br/` e `https://www.mercadodovale.com.br/admin` retornaram 200 servindo o site publicado na VPS.

Checklist manual pendente nos paineis externos:
- Bling callback: `https://www.mercadodovale.com.br/api/auth/callback/bling`.
- Bling webhook: `https://www.mercadodovale.com.br/api/bling-webhook`.
- Shopee callback: `https://www.mercadodovale.com.br/api/shopee?action=callback`.
- Shopee webhook: `https://www.mercadodovale.com.br/api/shopee-webhook`.
- Mercado Pago webhook: `https://www.mercadodovale.com.br/api/mercadopago-webhook`.

Rollback: manter ou restaurar URL antiga somente se uma integracao real falhar e registrar qual provedor bloqueou o corte.

## 2026-05-31 - Deploy VPS apos corte sequencial

Mudanca: frontend publicado na VPS apos ativar as flags finais de runtime. Release ativa: `/var/www/mdv-site/releases/20260531-200854`.

Validacao:
- `npm.cmd run deploy:vps-site`: OK.
- `curl https://mercadodovale.com.br/`: `200 https://www.mercadodovale.com.br/`.
- `curl https://www.mercadodovale.com.br/admin`: `200 https://www.mercadodovale.com.br/admin`.
- `curl https://api.xiaomipetrolina.com.br/status`: HTTP `200 OK`, MySQL `ok=true`.

Rollback: apontar `/var/www/mdv-site/current` para `/var/www/mdv-site/previous`.

## 2026-05-31 - Passo 2 do checklist externo validado

Objetivo: confirmar que callbacks e webhooks externos podem operar fora da Vercel, usando o dominio publico em `www.mercadodovale.com.br` e a VPS/Fastify como destino.

Validacao DNS:
- `Resolve-DnsName mv.mercadodovale.com.br`: Cloudflare proxied (`104.21.42.27`, `172.67.199.67`), sem `vercel-dns`.
- `Resolve-DnsName www.mercadodovale.com.br`: Cloudflare proxied (`104.21.42.27`, `172.67.199.67`).
- `Resolve-DnsName mercadodovale.com.br`: Cloudflare proxied (`104.21.42.27`, `172.67.199.67`).

Validacao automatizada:
- `node tools\audit-legacy-deploy-removal-readiness.mjs`: `ready_to_remove_legacy_deploy=true`, `blockers=[]`.
- `curl https://www.mercadodovale.com.br/api/status`: HTTP `200`, MySQL `ok=true`, produtos/imagens retornando totais.
- `curl https://mv.mercadodovale.com.br/#/catalog`: HTTP `200` servindo o bundle VPS `assets/index-DFs8JI8s.js`.
- `curl https://www.mercadodovale.com.br/api/auth/callback/bling`: HTTP `302` para `/admin/settings/bling?error=missing_code`, esperado sem codigo OAuth real.
- `curl https://www.mercadodovale.com.br/api/bling-webhook`: HTTP `200`, `mode=vps-fastify`, `accepts=POST`.
- `curl https://www.mercadodovale.com.br/api/shopee?action=callback`: HTTP `400`, esperado sem `code` e `shop_id`.
- `curl -X POST https://www.mercadodovale.com.br/api/shopee-webhook`: HTTP `200`, `message=success`.
- `curl https://www.mercadodovale.com.br/api/mercadopago-webhook`: HTTP `200`, `mode=vps-fastify`, `accepts=POST`.
- `curl https://www.mercadodovale.com.br/api/telegram-webhook`: HTTP `200`, `ok=true`.

Configuracoes internas conferidas:
- `company_settings.bling_callback_url`: `https://www.mercadodovale.com.br/api/auth/callback/bling`.
- `SHOPEE_REDIRECT_BASE_URL`: configurado para `https://www.mercadodovale.com.br`.

Guardas executados:
- `node tmp-tests\legacy-deploy-removal-static.test.mjs`: OK.
- `node tmp-tests\no-vercel-runtime-literals-static.test.mjs`: OK.
- `node tmp-tests\legacy-deploy-removal-readiness-static.test.mjs`: OK.

Checklist manual nos paineis oficiais:
- Bling: confirmado em 2026-05-31 no painel oficial. O redirect OAuth foi orientado para `https://www.mercadodovale.com.br/api/auth/callback/bling`. Em Webhooks, o servidor unico ficou como `Mercado do Vale VPS` apontando para `https://www.mercadodovale.com.br/api/bling-webhook`; Estoques, Produtos, Pedidos de Vendas, Notas Fiscais Eletronicas, Notas Fiscais de Consumidor Eletronicas e Fornecedores de Produtos aparecem ativos usando esse servidor, versao `v1`, com criacao/atualizacao/exclusao marcados.
- Shopee: confirmado em 2026-05-31 no Shopee Open Platform. O app `Mercado do Vale` esta `Online`; `Live Redirect URL Domain` ficou em `https://www.mercadodovale.com.br`; `Live Push` foi salvo como `ON`, status `Normal`, com `Live Call Back URL` em `https://www.mercadodovale.com.br/api/shopee-webhook`, `Deployment Service Area` em `Brazil` e push `order_status_push` (`code=3`) ativo. A chave de push foi gerada/salva no painel, sem ser registrada na documentacao.
- Mercado Pago: confirmado em 2026-05-31 no painel oficial de Webhooks. A URL configurada aparece apontando para `https://www.mercadodovale.com.br/api/mercadopago-webhook`; os eventos exibidos incluem pagamentos e vinculacao de aplicacoes. Conferencia feita em modo visual/read-only, sem alterar a configuracao do painel.

Validacao apos salvamento Bling:
- `curl https://www.mercadodovale.com.br/api/bling-webhook`: HTTP `200`, `{"ok":true,"mode":"vps-fastify","accepts":"POST"}`.
- `curl https://www.mercadodovale.com.br/api/auth/callback/bling`: HTTP `302` para `/admin/settings/bling?error=missing_code`, esperado sem codigo OAuth real.

Validacao apos salvamento Shopee:
- Painel `Push Mechanism`: `Live Push ON`, `Live Push Status Normal`, acao `Set Push` disponivel.
- `curl https://www.mercadodovale.com.br/api/shopee?action=callback`: HTTP `400`, esperado sem `code` e `shop_id`.
- `curl https://www.mercadodovale.com.br/api/shopee-webhook`: HTTP `405`, esperado para GET.
- `curl -X POST https://www.mercadodovale.com.br/api/shopee-webhook -H "Content-Type: application/json" --data "{}"`: HTTP `200`, `{"message":"success"}`.

Validacao apos conferencia Mercado Pago:
- `curl https://www.mercadodovale.com.br/api/mercadopago-webhook`: HTTP `200`, `{"ok":true,"mode":"vps-fastify","accepts":"POST"}`.
- `curl -X POST https://www.mercadodovale.com.br/api/mercadopago-webhook -H "Content-Type: application/json" --data "{}"`: HTTP `200`, `{"message":"ignored","reason":"not payment webhook"}`.

Resultado: passo 2 concluido pelo lado VPS/DNS/app e pelos paineis oficiais. Bling, Shopee e Mercado Pago estao conferidos contra as URLs finais no dominio `www.mercadodovale.com.br`; a validacao do Mercado Pago foi read-only no painel e HTTP segura na rota publica.

## 2026-05-31 - Checkpoint pos-paineis externos

Objetivo: revalidar a trilha segura do checklist apos concluir a conferencia visual dos paineis Bling, Shopee e Mercado Pago, sem executar OAuth real, payload real de webhook, escrita comercial, deploy, restart, DNS ou alteracao em provedor externo.

Validacao:
- `node tools\audit-legacy-deploy-removal-readiness.mjs`: `ready_to_remove_legacy_deploy=true`, `blockers=[]`; DNS `mercadodovale.com.br` e `www.mercadodovale.com.br` em Cloudflare proxied (`104.21.42.27`, `172.67.199.67`), sem CNAME publico em `www`.
- `node tmp-tests\legacy-deploy-removal-static.test.mjs`: OK.
- `node tmp-tests\no-vercel-runtime-literals-static.test.mjs`: OK.
- `node tmp-tests\legacy-deploy-removal-readiness-static.test.mjs`: OK.
- `VPS_EXTERNAL_CUTOVER_LIVE=true node tmp-tests\vps-external-cutover-read-only-check.cjs`: OK; Bling webhook `200`, Mercado Pago webhook `200`, Shopee webhook GET `405`, Bling callback sem code `302`, Shopee callback sem parametros `400`.
- `node tmp-tests\vps-external-cutover-read-only-check-static.test.mjs`: OK.
- `node tmp-tests\vps-migration-guard-regression.cjs`: `ok=true`, `checked=30`, `failed=0`, `mutation_executed=false`.

Resultado: a remocao da dependencia externa da Vercel continua sem blockers tecnicos e os endpoints publicos de integracao respondem pelo dominio final da VPS. Os scripts de escrita e payload real seguem bloqueados por padrao e exigem variaveis/confirmacoes explicitas para qualquer janela controlada.

Proximo passo: escolher uma janela controlada com alvo explicito para validar payload real/simulado de webhook ou escrita pequena/reversivel, ou seguir para a decisao humana de Auth proprio na VPS versus provedor externo.

## 2026-05-31 - Decisao Auth VPS

Decisao: seguir com Auth proprio na VPS como trilha principal, mantendo Supabase fora do runtime. A implementacao atual usa `VpsAuthProvider`, `vpsAuthService`, tokens Bearer proprios assinados na VPS e a tabela `customer_auth` no MySQL. O login por e-mail/senha e CPF/senha passa pela API publica `https://api.xiaomipetrolina.com.br`; Google/Facebook e recuperacao de senha por e-mail permanecem indisponiveis durante a migracao ate serem redesenhados em etapa propria.

Motivo: o auditor operacional ja esta zerado, o pacote runtime do Supabase nao deve voltar, e o modelo proprio preserva compatibilidade direta com `customers.user_id`/`customer_auth` sem reintroduzir dependencias da plataforma antiga.

Validacao:
- `node tmp-tests\vps-auth-cutover-static.test.mjs`: OK.
- `node tmp-tests\vps-auth-naming-static.test.mjs`: OK.
- `node tmp-tests\no-supabase-runtime-package-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from=0`, `.rpc=0`, `storage=0`, `supabase.auth=0`, `unclassifiedOperationalMatches=0`.
- `curl https://api.xiaomipetrolina.com.br/auth/me`: HTTP `401`, `{"error":"Unauthorized"}`, esperado sem token.
- `curl -X POST https://api.xiaomipetrolina.com.br/auth/login -H "Content-Type: application/json" --data "{}"`: HTTP `400`, `{"error":"Email/CPF e senha sao obrigatorios"}`, esperado sem credenciais.

Observacao de roteamento: `www.mercadodovale.com.br/auth/*` nao e a origem do Auth; no dominio do site, `/auth/me` cai no fallback SPA e `POST /auth/login` retorna `405` do Nginx. O frontend usa `VPS_DIRECT_BASE_URL`, cujo default e `https://api.xiaomipetrolina.com.br`, para chamar as rotas de autenticacao.

Pendencias:
- criar os e-mails transacionais da VPS; nao temos nenhum e-mail transacional criado hoje;
- desenhar recuperacao de senha por e-mail na VPS;
- implementar confirmacao de cadastro por e-mail quando houver envio configurado; flag `VPS_AUTH_REQUIRE_EMAIL_CONFIRMATION` desligada por padrao;
- decidir se Google/Facebook voltam via provedor externo/OIDC ou se ficam desativados;
- revisar expiracao/renovacao de token proprio e politica de logout global antes de considerar a remocao definitiva do provedor antigo em todos os ambientes.

### 2026-05-31 - Validacao real de login Auth VPS

Mudanca: criado `tmp-tests/verify-vps-auth-browser-login.cjs` para validar o login real no site publico com Chrome headless local, lendo credenciais admin e cliente apenas de `.env.vps.local`/`.env.local` e sem imprimir senha ou token. Criado tambem `tmp-tests/create-vps-retail-test-account.cjs` para gerar uma conta cliente descartavel via registro publico e salvar as credenciais locais ignoradas pelo Git.

Correcao encontrada durante a validacao: o formulario publico envia `customer_type=retail`, mas o MySQL da VPS aceita `CUSTOMER`, `ADMIN` ou `RESELLER`. A rota `/auth/register` agora normaliza `retail`/valor vazio para `CUSTOMER` e `resale`/`wholesale`/`reseller` para `RESELLER`, evitando erro `500` no cadastro publico.

Validacao:
- `node tmp-tests\verify-vps-admin-login.cjs`: HTTP `200`, usuario admin autenticado, `customer_type=ADMIN`, token presente.
- `node tmp-tests\vps-auth-customer-type-normalization-static.test.mjs`: OK.
- `node --check vps_server.cjs`, `node --check vps_server.js`, `node --check server.js`: OK.
- `node deploy-vps-server-only.cjs`: OK; API enviada para `/var/www/mdv-api`, env admin sincronizado e PM2 `mdv-api` reiniciado online.
- `curl https://api.xiaomipetrolina.com.br/status`: HTTP `200`, `ok=true`, MySQL `ok=true`.
- `MDV_FORCE_NEW_TEST_CUSTOMER=1 node tmp-tests\create-vps-retail-test-account.cjs`: conta cliente criada via `/auth/register`, `customer_type=CUSTOMER`, login HTTP `200`, token presente, credenciais salvas em `.env.vps.local`.
- `node tmp-tests\verify-vps-auth-browser-login.cjs`: OK; login admin abriu `https://www.mercadodovale.com.br/admin`, `customer_type=ADMIN`, token presente; login cliente comum abriu `https://www.mercadodovale.com.br/`, `customer_type=CUSTOMER`, token presente.
- `node --check tmp-tests\verify-vps-auth-browser-login.cjs`: OK.
- `node --check tmp-tests\create-vps-retail-test-account.cjs`: OK.

Resultado: login admin real e login cliente comum/retail foram validados por API e por navegador autenticado contra o Auth proprio da VPS. A falha de cadastro publico causada pelo enum de `customer_type` tambem foi corrigida e publicada na API da VPS.

Proximo passo: seguir para recuperacao de senha por e-mail, decisao Google/Facebook e revisao de expiracao/renovacao/logout global do token proprio.

### 2026-05-31 - Chave seletora para confirmacao de cadastro

Decisao: manter confirmacao de cadastro por e-mail em aberto durante a migracao, com chave seletora desligada por padrao. Hoje nao temos nenhum e-mail transacional criado para cadastro, confirmacao de e-mail ou recuperacao de senha, entao a ativacao real depende primeiro da criacao dos templates e da configuracao de envio SMTP/API.

Mudanca: adicionada a flag `VPS_AUTH_REQUIRE_EMAIL_CONFIRMATION="false"` em `.env.vps.example` e o helper `isAuthEmailConfirmationRequired()` nos servidores VPS. O retorno de Auth passa a expor `emailConfirmationRequired`, mas o fluxo continua permissivo enquanto a flag estiver desligada.

Validacao:
- `node tmp-tests\vps-auth-email-confirmation-flag-static.test.mjs`: OK.
- `node --check vps_server.cjs`: OK.
- `node --check vps_server.js`: OK.
- `node --check server.js`: OK.

Resultado: a chave ficou preparada sem bloquear cadastro/login atual. A pendencia principal agora e criar os e-mails transacionais da VPS e, depois disso, implementar tokens de confirmacao/recuperacao e decidir quando ligar `VPS_AUTH_REQUIRE_EMAIL_CONFIRMATION`.

### 2026-05-31 - Readiness final sem Vercel/Supabase runtime

Objetivo: executar a frente de limpeza/readiness versionada antes de qualquer corte operacional externo, confirmando que o repositorio nao depende mais de Vercel ou Supabase como runtime da aplicacao.

Validacao:
- `node tmp-tests\legacy-deploy-removal-static.test.mjs`: OK.
- `node tmp-tests\legacy-deploy-removal-readiness-static.test.mjs`: OK.
- `node tmp-tests\retired-supabase-project-artifacts-static.test.mjs`: OK.
- `node tmp-tests\retired-root-supabase-diagnostics-static.test.mjs`: OK.
- `node tools\audit-legacy-deploy-removal-readiness.mjs`: `ready_to_remove_legacy_deploy=true`, `legacy_config_present=false`, `legacy_api_files_count=0`, `legacy_crons_disabled=true`, `cors_allows_legacy_fallback=false`, `legacy_cron_user_agent_allowed=false`, `blockers=[]`. As consultas DNS internas retornaram `dns_timeout`, sem criar blocker no auditor.
- `node tmp-tests\no-supabase-runtime-package-static.test.mjs`: OK.
- `node tmp-tests\no-vercel-runtime-literals-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from=0`, `.rpc=0`, `storage=0`, `supabase.auth=0`, `unclassifiedOperationalMatches=0`.

Resultado: a frente versionada esta pronta para remover a plataforma antiga como runtime. O proximo corte deve ser externo/controlado: reconferir painéis e callbacks/webhooks oficiais em modo read-only antes de qualquer alteracao real.

### 2026-05-31 - Validacao externa final read-only

Objetivo: revalidar as rotas finais fora da Vercel e o SEO publico sem enviar payload real, sem reconectar OAuth, sem salvar configuracao em paineis externos e sem executar mutacoes comerciais.

Validacao local/guard:
- `node tmp-tests\vps-external-cutover-read-only-check-static.test.mjs`: OK.
- `node tmp-tests\vps-external-cutover-read-only-check.cjs`: OK em modo guard, `route_probe_sent=false`, `reason=missing_VPS_EXTERNAL_CUTOVER_LIVE_true`.
- `node tmp-tests\vps-oauth-preflight-check-static.test.mjs`: OK.
- `node tmp-tests\vps-migration-guard-regression.cjs`: `ok=true`, `checked=30`, `failed=0`, `mutation_executed=false`.

Validacao live/read-only fora do sandbox de rede:
- `VPS_EXTERNAL_CUTOVER_LIVE=true node tmp-tests\vps-external-cutover-read-only-check.cjs`: OK; `GET /api/bling-webhook` HTTP `200`, `GET /api/mercadopago-webhook` HTTP `200`, `GET /api/shopee-webhook` HTTP `405`, `GET /api/auth/callback/bling` HTTP `302` para `/admin/settings/bling?error=missing_code`, `GET /api/shopee?action=callback` HTTP `400`.
- `OAUTH_PREFLIGHT_LIVE=true node tmp-tests\vps-oauth-preflight-check.cjs`: OK; Bling callback sem code `302`, Bling exchange sem credenciais `400`, Shopee callback sem parametros `400`, Shopee auth URL `200` com `auth_host=partner.shopeemobile.com` e `redirect_host=www.mercadodovale.com.br`.
- `SEO_PRODUCTION_HOST_LIVE=true node tmp-tests\vps-seo-production-host-check.cjs`: OK; apex redireciona `301` para `https://www.mercadodovale.com.br/sitemap.xml`, sitemap HTTP `200`, `1843` URLs, `1840` produtos, hosts somente `www.mercadodovale.com.br`, amostra de 3 produtos com canonical `www`, `og:type=product` e 2 JSON-LD cada.

Observacao de painel: conferencia humana/read-only concluida para Bling, Shopee e Mercado Pago. Os paineis oficiais foram conferidos contra as URLs finais da VPS/Cloudflare, sem salvar configuracao, sem reconectar OAuth, sem enviar payload real e sem alterar recursos externos.

Resultado: rotas externas finais, OAuth preflight, SEO publico e conferencia read-only dos paineis oficiais Bling, Shopee e Mercado Pago estao concluidos sem dependencia de Vercel. Os guards continuam impedindo payload real e escrita por padrao. Proximo passo operacional: escolher uma janela controlada com alvo explicito para payload real/simulado reversivel, se ainda for necessario antes do corte definitivo.

### 2026-05-31 - Fechamento tecnico sem Vercel/Supabase runtime

Decisao: considerar concluido o corte tecnico de runtime Vercel/Supabase. O repositorio ativo nao possui `vercel.json`, `pages/api`, runtime `@vercel/node`, pacote runtime `@supabase/supabase-js`, cliente Supabase ativo, chamadas operacionais `.from(...)`, `.rpc(...)`, Storage ou `supabase.auth`. A aplicacao publica/admin usa site estatico na VPS/Cloudflare, API Fastify na VPS, MySQL e Auth proprio.

O que nao bloqueia o corte tecnico:
- e-mails transacionais da VPS ainda precisam ser criados para recuperacao de senha, confirmacao de cadastro e aviso de senha alterada;
- Google/Facebook seguem desativados ate decisao futura de OIDC/provedor externo;
- confirmacao de cadastro por e-mail fica preparada por `VPS_AUTH_REQUIRE_EMAIL_CONFIRMATION=false`, desligada por padrao;
- refresh token e logout global ficam como melhoria de seguranca do Auth proprio; o fluxo atual usa token Bearer proprio com TTL configuravel por `VPS_AUTH_TOKEN_TTL_SECONDS` e logout local no frontend.

Validacao de fechamento:
- `node tools\audit-legacy-deploy-removal-readiness.mjs`: `ready_to_remove_legacy_deploy=true`, `legacy_config_present=false`, `legacy_api_files_count=0`, `legacy_crons_disabled=true`, `cors_allows_legacy_fallback=false`, `legacy_cron_user_agent_allowed=false`, `blockers=[]`; DNS retornou `dns_timeout` no sandbox, sem blocker.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from=0`, `.rpc=0`, `storage=0`, `supabase.auth=0`, `unclassifiedOperationalMatches=0`.

Resultado: o corte de plataforma antiga esta tecnicamente concluido. Daqui para frente, qualquer payload real/simulado de webhook, reconexao OAuth real ou escrita comercial deve ser tratado como validacao operacional controlada, com alvo explicito e confirmacao propria, nao como dependencia restante da remocao de Vercel/Supabase.

### 2026-05-31 - Recuperacao de senha por e-mail no Auth VPS

Mudanca: implementada a base de recuperacao de senha do Auth proprio da VPS. A API agora possui `POST /auth/password-reset/request` para gerar token seguro, armazenar apenas hash em `customer_auth_password_resets` e tentar envio transacional por SMTP; e `POST /auth/password-reset/confirm` para validar token, expirar/rejeitar links usados e atualizar a senha. O frontend passou a chamar as rotas VPS em `vpsAuthService`, e a pagina `/redefinir-senha?token=...` usa o token do link para trocar a senha sem exigir sessao ativa.

Configuracao necessaria na VPS para envio real: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_STARTTLS`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_FROM_NAME`, `APP_PUBLIC_URL` e `VPS_AUTH_PASSWORD_RESET_TTL_MINUTES`. Sem SMTP configurado, a rota retorna resposta generica segura e registra que o envio nao saiu, para nao vazar existencia de conta.

Validacao:
- RED: `node tmp-tests\vps-auth-password-reset-static.test.mjs` falhou antes da implementacao exigindo tabela, rotas, hash de token, SMTP e integracao frontend.
- `node tmp-tests\vps-auth-password-reset-static.test.mjs`: OK.
- `node --check vps_server.cjs`: OK.
- `node --check vps_server.js`: OK.
- `node --check server.js`: OK.
- `npm.cmd run build`: OK fora do sandbox; avisos conhecidos de import dinamico/estatico permanecem sem erro.
- `node deploy-vps-server-only.cjs`: OK; API publicada em `/var/www/mdv-api` e PM2 `mdv-api` online.
- `curl https://api.xiaomipetrolina.com.br/status`: HTTP 200, `ok=true`, MySQL `ok=true`.
- `POST https://api.xiaomipetrolina.com.br/auth/password-reset/request` com e-mail inexistente: HTTP 200, `{"ok":true}`.
- `POST https://api.xiaomipetrolina.com.br/auth/password-reset/confirm` com token invalido: HTTP 400, `{"error":"Link de recuperacao invalido ou expirado"}`.
- `npm.cmd run deploy:vps-site`: OK; release ativa `/var/www/mdv-site/releases/20260601-015020`.
- `curl https://www.mercadodovale.com.br/redefinir-senha?token=invalid`: HTTP 200.

Resultado: a recuperacao de senha esta publicada na API e no frontend. O envio efetivo do e-mail depende apenas de configurar credenciais SMTP reais na VPS; sem SMTP configurado, a rota responde de forma generica e segura sem vazar existencia de conta.

### 2026-05-31 - Templates de e-mail transacional do Auth VPS

Mudanca: a criacao dos e-mails transacionais saiu do corpo inline da rota e passou a usar templates nomeados no servidor VPS. Foram criados `buildPasswordResetEmail` para recuperacao de senha e `buildPasswordChangedEmail` para aviso de senha alterada. A confirmacao de troca de senha agora tenta enviar o aviso de seguranca apos atualizar a senha, mantendo resposta da API independente do sucesso do SMTP para nao bloquear o fluxo do cliente.

Configuracao: o mesmo SMTP transacional documentado em `.env.vps.example` atende recuperacao de senha e avisos de seguranca. A confirmacao de cadastro por e-mail continua preparada pela flag `VPS_AUTH_REQUIRE_EMAIL_CONFIRMATION=false`, mas ainda fica para a proxima etapa porque depende da decisao de quando bloquear cadastro/login sem confirmacao.

Validacao:
- RED: `node tmp-tests\vps-auth-transactional-email-templates-static.test.mjs` falhou antes da implementacao exigindo templates nomeados e aviso de senha alterada.
- `node tmp-tests\vps-auth-transactional-email-templates-static.test.mjs`: OK.
- `node tmp-tests\vps-auth-password-reset-static.test.mjs`: OK.
- `node tmp-tests\vps-auth-email-confirmation-flag-static.test.mjs`: OK.
- `node --check server.js`: OK.
- `node --check vps_server.cjs`: OK.
- `node --check vps_server.js`: OK.
- `npm.cmd run build`: OK fora do sandbox; dentro do sandbox o Vite ficou bloqueado por permissao ao carregar `vite.config.ts`.

Resultado esperado: com SMTP configurado na VPS, o Auth proprio passa a enviar o link de recuperacao e tambem um aviso quando a senha for alterada. Sem SMTP configurado, as rotas continuam seguras e registram `smtp_not_configured` sem vazar existencia de conta.

### 2026-05-31 - Pagina admin de templates de e-mail

Mudanca: criada a pagina admin `E-mail` em Marketing & Loja para editar templates HTML dinamicos. A base inicial cobre compra realizada com sucesso, promocoes, itens novos, recuperacao de senha, senha alterada e confirmacao de cadastro, alem da criacao de novos templates personalizados. Cada template possui nome, assunto, preheader, corpo HTML, fallback em texto, variaveis dinamicas e preview renderizado com dados de exemplo.

Persistencia: adicionada a tabela `email_templates` na migracao automatica da VPS, com seeds nao destrutivos para os templates do sistema. Os templates ficam editaveis pelo painel via `/table-data/email_templates`.

Validacao:
- RED: `node tmp-tests\admin-email-templates-page-static.test.mjs` falhou antes da implementacao exigindo rota, menu, pagina, servico e tabela.
- `node tmp-tests\admin-email-templates-page-static.test.mjs`: OK.
- `node tmp-tests\vps-auth-transactional-email-templates-static.test.mjs`: OK.
- `node --check server.js`: OK.
- `node --check vps_server.cjs`: OK.
- `node --check vps_server.js`: OK.
- `npm.cmd run build`: OK fora do sandbox; dentro do sandbox o Vite ficou bloqueado por permissao ao carregar `vite.config.ts`.
- `curl http://127.0.0.1:5181/admin/settings/email`: HTTP 200 com dev server fora do sandbox.
- `node deploy-vps-server-only.cjs`: OK; API publicada em `/var/www/mdv-api` e PM2 `mdv-api` online.
- `npm.cmd run deploy:vps-site`: OK; release ativa `/var/www/mdv-site/releases/20260601-021638`.
- `curl https://api.xiaomipetrolina.com.br/status`: HTTP 200, `ok=true`, MySQL `ok=true`.
- `curl https://www.mercadodovale.com.br/admin/settings/email`: HTTP 200.
- `GET https://api.xiaomipetrolina.com.br/table-data/email_templates?limit=20`: HTTP 200, total `6` com os templates iniciais semeados.

Resultado esperado: o admin passa a ter um editor central para os e-mails transacionais e de marketing. A proxima etapa e ligar o envio real do Auth/marketing aos templates salvos em `email_templates`, em vez dos templates fixos no servidor.

### 2026-05-31 - Caixa de e-mail contato na VPS

Mudanca: criada a caixa real `contato@mercadodovale.com.br` na VPS com Postfix, Dovecot, IMAP, SMTP autenticado e OpenDKIM. A conta recebe localmente em Maildir e tambem encaminha copia para `handielson@gmail.com`. A Cloudflare passou a apontar `mail.mercadodovale.com.br` para `76.13.232.162`, com MX, SPF, DKIM e DMARC do dominio ajustados para a VPS.

API: configurado SMTP interno local em `127.0.0.1:2525` para a API `mdv-api`, usando `contato@mercadodovale.com.br` como remetente. O canal interno usa autenticacao SASL via Dovecot e evita depender de certificado publico para a propria API enviar e-mails transacionais.

Validacao:
- `node tools\setup-vps-mailbox.cjs`: OK; Postfix, Dovecot e OpenDKIM instalados e ativos.
- `node tools\cloudflare-mail-dns.cjs`: OK; DNS de e-mail aplicado na Cloudflare.
- `Resolve-DnsName mail.mercadodovale.com.br -Type A -Server 1.1.1.1`: `76.13.232.162`.
- `Resolve-DnsName mercadodovale.com.br -Type MX -Server 1.1.1.1`: `mail.mercadodovale.com.br`, prioridade `10`.
- `Resolve-DnsName mercadodovale.com.br -Type TXT -Server 1.1.1.1`: SPF unico `v=spf1 mx ip4:76.13.232.162 ~all`.
- `Resolve-DnsName default._domainkey.mercadodovale.com.br -Type TXT -Server 1.1.1.1`: DKIM publicado.
- `Resolve-DnsName _dmarc.mercadodovale.com.br -Type TXT -Server 1.1.1.1`: DMARC publicado.
- Teste local na VPS para `contato@mercadodovale.com.br`: Maildir recebeu mensagem e copia para Gmail foi aceita.
- `node tools\fix-vps-mail-dkim.cjs`: OK; OpenDKIM em `inet:localhost:8891` e Postfix assinando saidas.
- `node tools\fix-vps-mail-sasl.cjs`: OK; Dovecot criou `/var/spool/postfix/private/auth`, AUTH `plain login` habilitado, porta 25 sem SASL obrigatorio e submission com SASL.
- `node tools\configure-api-smtp-vps-mail.cjs`: OK; API reiniciada com SMTP interno e PM2 `mdv-api` online.
- `node tools\test-vps-internal-smtp.cjs`: OK; envio autenticado como `contato` para `handielson@gmail.com`, Gmail retornou `250 OK` e `mailq` ficou vazia.

Observacao: a senha da caixa fica somente na VPS em `/root/contato-mailbox-credentials.txt` e o token da Cloudflare deve permanecer apenas em ambiente local/seguro.

### 2026-06-01 - Remocao final do projeto Vercel legado

Mudanca: removido o projeto Vercel legado `handielson-amorim-bonfims-projects/mercado-do-vale` pelo CLI oficial da Vercel. O vinculo local `.vercel` tambem foi apagado do workspace para evitar deploy acidental no destino antigo.

Validacao:
- `npx.cmd vercel project inspect mercado-do-vale --scope handielson-amorim-bonfims-projects`: confirmou o alvo antes da remocao, ID `prj_5kdjUHyBqSremGLVUOtkuB3Nc4qG`.
- `npx.cmd vercel remove mercado-do-vale --scope handielson-amorim-bonfims-projects --yes`: OK, `Success! Removed 1 project`.
- `npx.cmd vercel project ls --scope handielson-amorim-bonfims-projects --json`: OK, lista atual nao contem `mercado-do-vale`.
- Pasta local `.vercel`: removida do workspace.

Resultado: o projeto Mercado do Vale nao fica mais publicado nem vinculado na Vercel. O runtime de producao permanece Cloudflare + VPS.

### 2026-06-01 - Limpeza final de rastros Supabase

Mudanca: removidos os rastros operacionais finais do Supabase no workspace principal. Sairam as variaveis `SUPABASE`/`VITE_SUPABASE` dos arquivos `.env*`, os scripts SQL soltos de RLS antigo e diagnosticos manuais que ainda importavam `services/supabase`.

Escopo preservado: permanecem apenas documentacao historica e testes/auditores com `supabase` no nome, usados como guardas para provar que o runtime atual nao voltou a depender do Supabase.

Validacao:
- `Select-String` nos arquivos `.env`, `.env.local` e `.env.production`: sem variaveis Supabase.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: OK, zero dependencias operacionais.
- `node tmp-tests\retired-supabase-project-artifacts-static.test.mjs`: OK.
- `node tmp-tests\no-supabase-runtime-package-static.test.mjs`: OK.

Resultado esperado: o runtime e as credenciais locais passam a ficar alinhados com Cloudflare + VPS, sem caminho acidental de retorno para Supabase.

## 2026-05-31 - Trava do dominio legado mv

Mudanca: qualquer carregamento do frontend em `mv.mercadodovale.com.br` passa a redirecionar antes de montar o app. O caso legado `https://mv.mercadodovale.com.br/#/catalog` segue para `https://www.mercadodovale.com.br/?categoria=Smartphones`; qualquer outro caminho no host `mv` preserva path, query e hash no dominio canonico `https://www.mercadodovale.com.br`.

Validacao:
- `node tmp-tests\legacy-mv-catalog-redirect-static.test.mjs`: OK.
- `npm.cmd run build`: OK; avisos conhecidos de import dinamico/estatico permanecem sem erro.
- `npm.cmd run deploy:vps-site`: OK. Release ativa: `/var/www/mdv-site/releases/20260601-001623`.
- Browser: `https://mv.mercadodovale.com.br/#/catalog` redirecionou para `https://www.mercadodovale.com.br/?categoria=Smartphones`.
- Browser: `https://mv.mercadodovale.com.br/produto/teste?x=1#abc` redirecionou para `https://www.mercadodovale.com.br/produto/teste?x=1#abc`.
- Bundle publico: `https://www.mercadodovale.com.br/assets/index-DF64M216.js` contem a trava para `mv.mercadodovale.com.br`.

Rollback: restaurar o comportamento anterior em `index.tsx` caso algum fluxo externo ainda dependa de navegar dentro do host `mv`.

## 2026-05-31 - Flags finais VPS ativadas

Mudanca: `USE_VPS.customers`, `USE_VPS.orders`, `USE_VPS.pdv` e `USE_VPS.sales` foram ativadas para concluir o corte de runtime admin/publico na VPS.

Sequencia: esta etapa depende do auditor Supabase operacional zerado e precede validacao admin/publica, build, deploy VPS e corte externo Vercel.

Validacao:
- `node tmp-tests\vps-final-flags-static.test.mjs`: OK.

Rollback: voltar essas quatro flags para `false` somente se uma validacao funcional bloquear admin, catalogo publico, checkout, pedidos ou PDV.
# 2026-06-08 - Painel agregado por modelo

- Escopo: criar painel operacional em Produtos para agregar modelo, RAM, armazenamento, cor, produtos/SKUs, unidades serializadas, localizacao, vendidos e valores.
- Fonte operacional: VPS/MySQL via servicos existentes.
- Regra: nenhuma dependencia nova de Vercel ou Supabase.
- Diario obrigatorio: cada deploy, validacao e limpeza desta entrega deve ser registrado aqui.
- Validacoes locais previstas:
  - `node services\modelProductAggregator.test.mjs`
  - `node tmp-tests\model-aggregator-no-legacy-runtime-static.test.mjs`
  - `npm.cmd run build`

Resultado local inicial:
- `node services\modelProductAggregator.test.mjs`: OK.
- `node tmp-tests\model-aggregator-no-legacy-runtime-static.test.mjs`: OK.
- `npm.cmd run build`: OK.
- Browser local: Vite subiu em `http://127.0.0.1:5181/`, mas a ferramenta de navegador recebeu `ERR_CONNECTION_REFUSED`; validar visualmente no dev local ou na VPS antes de considerar a tela aprovada para uso diario.

Publicacao VPS:
- Branch limpa enviada: `codex/model-product-aggregator-clean-20260608`.
- Commit publicado: `ef7880c` (`feat(products): add model aggregator page`).
- Comando: `npm.cmd run deploy:vps-site`.
- Resultado: OK em 2026-06-08. Release ativa: `/var/www/mdv-site/releases/20260608-160118`.
- Verificacao publica: `https://www.mercadodovale.com.br/index.html` apontou para `index-DxIr6aBC.js`; `https://www.mercadodovale.com.br/assets/ModelProductAggregatorPage-BaKgpxJf.js` respondeu `200 OK`.
- Rollback: `ssh root@76.13.232.162 "ln -sfn /var/www/mdv-site/previous /var/www/mdv-site/current"`.
