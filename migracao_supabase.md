# Migracao Supabase

## 2026-05-31 - Flags finais VPS ativadas

Mudanca: `USE_VPS.customers`, `USE_VPS.orders`, `USE_VPS.pdv` e `USE_VPS.sales` foram ativadas para concluir o corte de runtime admin/publico na VPS.

Sequencia: esta etapa depende do auditor Supabase operacional zerado e precede validacao admin/publica, build, deploy VPS e corte externo Vercel.

Validacao:
- `node tmp-tests\vps-final-flags-static.test.mjs`: OK.

Rollback: voltar essas quatro flags para `false` somente se uma validacao funcional bloquear admin, catalogo publico, checkout, pedidos ou PDV.

## 2026-05-31 - Dependencias operacionais Supabase zeradas

Mudanca: o guard operacional chegou a zero para `.from(...)`, `.rpc(...)` e Supabase Storage. Cashback/moedas, recompensas de indicacao, check-in, promocoes de moedas, fila de compra, dicionarios dinamicos da planilha e fluxos transacionais de estoque passaram para VPS/table-data ou endpoints dedicados da VPS.

Escopo admin/publico: afeta paginas admin de Bling, importacao/exportacao, cashback, PDV, pedidos online e estoque, alem dos caminhos publicos de catalogo, checkout, check-in/moedas e pedidos. A camada operacional de dados agora fica na VPS/MySQL para ambos os lados.

Infra VPS: `vps_server.js` e `vps_server.cjs` ganharam endpoints para baixa/reserva/consumo/liberacao/restauracao de estoque por local: `/stock-locations/priority-decrements`, `/priority-reservations`, `/order-reservations/consume`, `/order-reservations/release`, `/sale-restores` e `/order-restores`.

Verificacao:
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 0`, `.rpc(...) = 0`, `supabase.storage = 0`, allowlist operacional vazio.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tmp-tests\cashback-rpc-vps-ledger-static.test.mjs`: OK.
- `node tmp-tests\vps-stock-location-contract-static.test.mjs`: OK.
- `npm.cmd run build`: OK fora do sandbox.

Pendencia: Supabase ainda permanece como provedor de Auth/sessao (`SupabaseAuthContext`, `AuthContext`, `vpsClient` e alguns headers de upload). Remover essa parte exige definir o modelo de autenticacao da VPS: senha/OAuth, reset de senha, emissao e renovacao de token, compatibilidade com contas existentes e migração dos `user_id`.

Rollback: restaurar os RPCs/queries Supabase e baselines anteriores; nao recomendado porque reintroduz dados operacionais fora da VPS.

## 2026-05-31 - Catalogo Bling sem Supabase operacional

Mudanca: `services/blingService.ts` deixou de usar `.from(...)` para `products`, `categories`, `brands` e `models`. A importacao Bling valida categorias pela VPS, grava produtos com `vpsApiService.updateProduct`/`createProduct`, resincroniza detalhes por `updateProduct` e usa `modelService` para push/pull de dimensoes.

Escopo admin/publico: afeta a integracao admin do Bling e tem impacto direto no catalogo publico, pois produtos, categorias, marcas e modelos ficam no trilho VPS/MySQL.

Validacao:

- RED: `node tmp-tests\bling-import-products-vps-static.test.mjs`, `node tmp-tests\bling-import-categories-vps-static.test.mjs` e `node tmp-tests\bling-model-dimensions-vps-static.test.mjs` falharam enquanto o servico ainda tinha `.from(...)`.
- `node tmp-tests\bling-import-products-vps-static.test.mjs`: OK.
- `node tmp-tests\bling-import-categories-vps-static.test.mjs`: OK.
- `node tmp-tests\bling-model-dimensions-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 0`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: nao ha mais chamadas operacionais `.from(...)` no auditor; a allowlist `products-catalog-migration-temporary` foi removida; o baseline caiu de `.from=10` para `.from=0`.

Rollback: restaurar os caminhos Supabase no `blingService` e recolocar a allowlist de catalogo; nao recomendado porque reintroduz dados operacionais de catalogo fora da VPS.

## 2026-05-31 - Modelo selecionado do Bling pela VPS

Mudanca: `services/blingService.ts` deixou de consultar `models` com join em `brands` pelo Supabase para carregar o modelo selecionado na importacao Bling. A rotina agora usa `modelService.getById(modelId)` e `brandService.getById(modelData.brand_id)`.

Escopo admin/publico: afeta a importacao admin do Bling quando ha modelo escolhido manualmente. O impacto publico e indireto, pois os produtos importados passam a herdar descricao/modelo/marca da base VPS/MySQL.

Validacao:

- RED: `node tmp-tests\bling-selected-model-vps-static.test.mjs` falhou enquanto a rotina ainda usava `.from('models')`.
- `node tmp-tests\bling-selected-model-vps-static.test.mjs`: OK.
- `node tmp-tests\bling-brands-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 10`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `models` caiu de 4 para 3 ocorrencias restantes e o baseline caiu de `.from=11` para `.from=10`.

Rollback: restaurar a consulta direta a `supabase.from('models')` para o modelo selecionado e voltar `MAX_BASELINE_FROM_CALLS` para 11; nao recomendado porque reintroduz leitura de catalogo fora da VPS.

## 2026-05-31 - Marcas do Bling pela VPS

Mudanca: `services/blingService.ts` deixou de resolver e criar `brands` pelo Supabase durante a importacao de modelos/produtos do Bling. O helper agora usa `brandService.list()` e `brandService.create()`, ambos apoiados na VPS.

Escopo admin/publico: afeta a integracao admin com o Bling. O impacto publico e indireto, pois marcas de produtos importados passam a ser persistidas na base VPS/MySQL usada pelo catalogo.

Validacao:

- RED: `node tmp-tests\bling-brands-vps-static.test.mjs` falhou enquanto o helper ainda usava `.from('brands')`.
- `node tmp-tests\bling-brands-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 11`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `brands` saiu dos alvos restantes e o baseline caiu de `.from=15` para `.from=11`.

Rollback: restaurar o helper antigo com `supabase.from('brands')` e voltar `MAX_BASELINE_FROM_CALLS` para 15; nao recomendado porque recoloca criacao de marca do Bling fora da VPS.

## 2026-05-31 - Modelos da planilha pela VPS

Mudanca: `services/dataSyncService.ts` deixou de consultar `models` pelo Supabase para montar o template dinamico de planilha. A rotina agora usa `modelService.list()` e `vpsApiService.getBrands()` para preencher `template_values` e fallback de marca.

Escopo admin/publico: afeta a ferramenta admin de geracao de planilha de importacao de produtos. O impacto publico e indireto, pois a planilha alimenta dados publicados no catalogo VPS/MySQL.

Validacao:

- RED: `node tmp-tests\data-sync-models-vps-static.test.mjs` falhou enquanto o servico ainda usava `.from('models')`.
- `node tmp-tests\data-sync-models-vps-static.test.mjs`: OK.
- `node tmp-tests\data-sync-products-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 15`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `models` caiu de 5 para 4 ocorrencias restantes e o baseline caiu de `.from=16` para `.from=15`.

Rollback: restaurar a consulta direta a `supabase.from('models')` no `DataSyncService` e voltar `MAX_BASELINE_FROM_CALLS` para 16; nao recomendado porque recoloca dados de template de produto fora da VPS.

## 2026-05-31 - Importacao de produtos por planilha pela VPS

Mudanca: `services/dataSyncService.ts` deixou de atualizar e inserir `products` pelo Supabase durante a sincronizacao de planilha. Produtos existentes agora usam `vpsApiService.updateProduct`, e produtos novos usam `vpsApiService.createProduct`.

Escopo admin/publico: afeta a ferramenta admin de importacao/sync de planilhas. O impacto publico e direto no catalogo, pois os produtos criados ou atualizados passam a ser persistidos pela VPS/MySQL.

Validacao:

- RED: `node tmp-tests\data-sync-products-vps-static.test.mjs` falhou enquanto o servico ainda usava `.from('products')`.
- `node tmp-tests\data-sync-products-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 16`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `products` caiu de 5 para 3 ocorrencias restantes e o baseline caiu de `.from=18` para `.from=16`.

Rollback: restaurar update/insert em `supabase.from('products')` no `DataSyncService` e voltar `MAX_BASELINE_FROM_CALLS` para 18; nao recomendado porque recoloca importacao admin de catalogo fora da VPS.

## 2026-05-31 - Vinculo Bling ID pela VPS

Mudanca: `pages/admin/settings/BlingPage.tsx` deixou de atualizar `products.bling_id` pelo Supabase durante a reimportacao de produtos sem vinculo. A escrita agora usa `vpsApiService.updateProduct(productId, { bling_id })`.

Escopo admin/publico: afeta a pagina admin de Bling, no fluxo de checar e vincular produtos sem `bling_id`. O impacto publico e indireto, pois o catalogo passa a ler o vinculo persistido na VPS/MySQL.

Validacao:

- RED: `node tmp-tests\bling-page-product-link-vps-static.test.mjs` falhou enquanto `reimportProduct` ainda usava `.from('products')`.
- `node tmp-tests\bling-page-product-link-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 18`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `products` caiu de 6 para 5 ocorrencias restantes e o baseline caiu de `.from=19` para `.from=18`.

Rollback: restaurar o update direto em `supabase.from('products')` na `BlingPage` e voltar `MAX_BASELINE_FROM_CALLS` para 19; nao recomendado porque recoloca um fluxo admin do Bling fora da VPS.

## 2026-05-31 - Precos de variacao pela VPS

Mudanca: `priceHistoryService.applyPricesToVariation` deixou de atualizar `products` pelo Supabase. O servico agora usa `vpsApiService.updateProduct` para aplicar os precos em cada produto da variacao e continua gravando `product_price_history` por `/table-data/product_price_history`.

Escopo admin/publico: afeta paineis admin de precos por modelo/variacao. O impacto publico e direto no catalogo, pois os precos publicados passam a ser atualizados pela VPS/MySQL.

Validacao:

- RED: `node tmp-tests\price-history-vps-static.test.mjs` falhou enquanto `applyPricesToVariation` ainda usava `.from('products')`.
- `node tmp-tests\price-history-vps-static.test.mjs`: OK.
- `node tmp-tests\price-history-null-regression.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 19`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `products` caiu de 7 para 6 ocorrencias restantes e o baseline caiu de `.from=20` para `.from=19`.

Rollback: restaurar o update em lote via Supabase em `applyPricesToVariation` e voltar `MAX_BASELINE_FROM_CALLS` para 20; nao recomendado porque recoloca escrita de preco fora da VPS.

## 2026-05-31 - Company context pela VPS

Mudanca: `companyContext.getCompanyId` deixou de consultar `companies` no Supabase e passou a resolver o slug `mercado-do-vale` por `/table-data/companies` via `vpsClient`. `LegacyMigration` e `blingService` passaram a reutilizar esse helper central em vez de manter consultas locais.

Escopo admin/publico: afeta fluxos admin de migracao legada e integracao Bling. O impacto publico e indireto, pois o mesmo `company_id` orienta dados de catalogo e clientes na base VPS/MySQL.

Validacao:

- RED: `node tmp-tests\company-context-vps-static.test.mjs` falhou enquanto os tres pontos ainda usavam `.from('companies')`.
- `node tmp-tests\company-context-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 20`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `companies` saiu dos alvos restantes, as allowlists `auth-and-profile-temporary` e `company-alias-temporary` foram removidas, e o baseline caiu de `.from=23` para `.from=20`.

Rollback: restaurar os helpers locais com `.from('companies')`, recolocar as allowlists de company/profile e voltar `MAX_BASELINE_FROM_CALLS` para 23; nao recomendado porque recoloca resolucao de tenant fora da VPS.

## 2026-05-31 - Gerenciamento de permissoes pela VPS

Mudanca: `PermissionsManagementPage` deixou de listar, apagar e inserir `user_permissions` pelo Supabase. A pagina admin agora usa `vpsClient` em `/table-data/user_permissions`, deleta os registros existentes por `id` e recria o conjunto por `/table-data/user_permissions/bulk`.

Escopo admin/publico: afeta apenas a pagina admin de gerenciamento de permissoes. O impacto publico e indireto, pois as regras administrativas ficam registradas na base operacional da VPS/MySQL.

Validacao:

- RED: `node tmp-tests\permissions-management-vps-static.test.mjs` falhou enquanto a pagina ainda usava `.from('user_permissions')`.
- `node tmp-tests\permissions-management-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 23`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `user_permissions` saiu dos alvos restantes, foi removido da allowlist `auth-and-profile-temporary`, e o baseline caiu de `.from=26` para `.from=23`.

Rollback: restaurar o CRUD direto em `user_permissions` no Supabase, recolocar o alvo na allowlist de auth/perfil e voltar `MAX_BASELINE_FROM_CALLS` para 26; nao recomendado porque recoloca permissoes admin fora da VPS.

## 2026-05-31 - Ajuste manual de estoque pela VPS

Mudanca: `services/inventory.ts` deixou de atualizar `products.stock_quantity` e registrar/consultar `stock_movements` diretamente no Supabase. O ajuste manual agora grava produto com `vpsApiService.updateProduct`, registra movimento em `/table-data/stock_movements` via `vpsClient` e le o historico pela mesma tabela na VPS.

Escopo admin/publico: afeta a tela admin de estoque/inventario e seus historicos. O impacto publico e indireto: o saldo exibido no catalogo continua vindo da VPS/MySQL.

Validacao:

- RED: `node tmp-tests\inventory-stock-adjustment-vps-static.test.mjs` falhou enquanto o servico ainda usava Supabase para `products`/`stock_movements`.
- `node tmp-tests\inventory-stock-adjustment-vps-static.test.mjs`: OK.
- `node tmp-tests\inventory-adjust-stock-vps-current-product-static.test.mjs`: OK.
- `node tmp-tests\inventory-vps-products-static.test.mjs`: OK.
- `node tmp-tests\inventory-service-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 27`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Extensao: a consulta de `users.company_id` usada para auditar o movimento tambem saiu do Supabase e passou a usar `/table-data/users` por `vpsClient`.

Resultado: `stock_movements` e `users` sairam dos alvos restantes, `products` caiu de 9 para 7 ocorrencias, as allowlists `inventory-and-operations-temporary` e `legacy-users-table-temporary` foram removidas, e o baseline caiu de `.from=31` para `.from=26`.

Rollback: restaurar a escrita direta em `products` e leitura/escrita de `stock_movements` no Supabase, recolocar a allowlist temporaria de inventario e voltar `MAX_BASELINE_FROM_CALLS` para 31; nao recomendado porque recoloca ajuste manual de estoque fora da VPS.

## 2026-05-31 - Analytics de vendas pela VPS

Mudanca: `dashboardMetricsService`, `dashboardSalesDigestService` e `tagResolver` deixaram de consultar `sales` diretamente no Supabase. Os indicadores diarios, digest de vendas e tags `count_sales_today`/`sum_sales_today` agora usam `getSales` do `saleService`, que ja esta apoiado em `/table-data/sales` e `/table-data/sale_items` na VPS.

Escopo admin/publico: afeta dashboards/admin, digest operacional e tags usadas em mensagens/automacoes. O impacto publico e indireto quando essas tags alimentam respostas ou conteudos exibidos ao cliente.

Validacao:

- RED: `node tmp-tests\sales-analytics-vps-static.test.mjs` falhou enquanto os servicos ainda usavam `.from('sales')`.
- `node tmp-tests\sales-analytics-vps-static.test.mjs`: OK.
- `node tmp-tests\sale-service-vps-table-data-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 31`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK fora do sandbox; dentro do sandbox o Vite continua bloqueado ao ler diretorios acima do workspace.

Resultado: `sales` saiu dos alvos operacionais restantes, a allowlist `sales-customers-finance-temporary` foi removida, e o baseline caiu de `.from=36` para `.from=31`.

Rollback: restaurar as leituras diretas de `sales` nos tres servicos, recolocar a allowlist temporaria de vendas/clientes/financeiro e voltar `MAX_BASELINE_FROM_CALLS` para 36; nao recomendado porque reintroduz analytics de vendas fora da VPS.

## 2026-05-31 - Importacao legada de vendas pela VPS

Mudanca: `components/import/LegacySalesImportTab.tsx` deixou de usar Supabase para listar, limpar, criar e atualizar vendas legadas. A ferramenta agora usa `vpsClient` em `/table-data/sales`, `/table-data/sales/{id}?pk=id` e `/table-data/sale_items/bulk`, mantendo `customerService` para clientes ja migrados.

Escopo admin/publico: afeta a ferramenta admin de importacao de vendas do MV-Gestao e geracao de PDFs. O impacto publico e indireto: historico/importacoes passam a permanecer na base operacional da VPS/MySQL.

Validacao:

- RED: `node tmp-tests\legacy-sales-import-vps-sales-static.test.mjs` falhou enquanto a aba ainda usava `.from('sales')`/`.from('sale_items')`.
- `node tmp-tests\legacy-sales-import-vps-sales-static.test.mjs`: OK.
- `node tmp-tests\legacy-sales-import-customers-vps-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 36`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `sales` caiu de 10 para 5 ocorrencias operacionais, `sale_items` saiu dos alvos restantes, e o baseline caiu de `.from=43` para `.from=36`.

Rollback: restaurar o uso direto de Supabase na `LegacySalesImportTab` e voltar `MAX_BASELINE_FROM_CALLS` para 43; nao recomendado porque recoloca a importacao legada fora da VPS.

## 2026-05-31 - Sync VPS da importacao sem products no Supabase

Mudanca: a aba de sync VPS em `pages/admin/import/DataImportExportPage.tsx` deixou de ler `products` no Supabase como fonte de preco/estoque. O fluxo agora pagina produtos da propria VPS com `vpsApiService.getProducts({ offset, ... })` e reaplica o payload pelo endpoint `bulkSyncPricesStock`, mantendo a ferramenta administrativa sem dependencia operacional Supabase.

Escopo admin/publico: afeta apenas a ferramenta admin de importacao/exportacao. O impacto publico e indireto: preserva o catalogo publico alimentado pela VPS/MySQL.

Validacao:

- RED: `node tmp-tests\data-import-export-vps-sync-static.test.mjs` falhou enquanto a pagina ainda lia `.from('products')`.
- `node tmp-tests\data-import-export-vps-sync-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 43`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `products` caiu de 10 para 9 ocorrencias operacionais, `sales` passou a ser o maior alvo restante, e o baseline caiu de `.from=44` para `.from=43`.

Rollback: restaurar a leitura direta de `products` no Supabase dentro do sync VPS e voltar `MAX_BASELINE_FROM_CALLS` para 44; nao recomendado porque reintroduz a fonte legada numa ferramenta de migracao.

## 2026-05-31 - SEO Dashboard grava products pela VPS

Mudanca: `pages/admin/settings/SEODashboardPage.tsx` deixou de atualizar `products` diretamente pelo Supabase ao gerar slugs e meta tags. A tela ja lia a lista pela VPS em `seoDashboardData.js`; agora hidrata cada produto com `vpsApiService.getProductById(p.id, true)` e grava com `vpsApiService.updateProduct`.

Escopo admin/publico: afeta a pagina admin de analise SEO. O impacto publico e indireto: slugs/meta tags continuam abastecendo o catalogo publico, mas a escrita fica na VPS/MySQL.

Validacao:

- RED: `node tmp-tests\seo-dashboard-products-vps-static.test.mjs` falhou enquanto a pagina ainda usava `.from('products')`.
- `node tmp-tests\seo-dashboard-products-vps-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 44`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `products` caiu de 12 para 10 ocorrencias operacionais e o baseline caiu de `.from=46` para `.from=44`.

Rollback: restaurar os updates diretos em `SEODashboardPage` e voltar `MAX_BASELINE_FROM_CALLS` para 46; nao recomendado porque reintroduz escrita de catalogo fora da VPS.

## 2026-05-31 - ShopeePage sem shopee_products no Supabase

Mudanca: `pages/admin/settings/ShopeePage.tsx` deixou de ler, criar, atualizar e excluir `shopee_products` diretamente pelo Supabase. O fluxo admin de lista/importacao/vinculo manual/status/preco/rename/publicacao/variacoes agora usa `shopeeProductService`, que centraliza `list`, `getByProductIds`, `upsert`, `upsertMany`, `updateByProductId` e `deleteByShopeeItemId` pela VPS em `/table-data/shopee_products`.

Escopo admin/publico: afeta diretamente a pagina admin da Shopee. O impacto publico e indireto: o mesmo servico de metadados preserva a fonte VPS/MySQL ja usada pelos caminhos compartilhados de produtos.

Validacao:

- RED: `node tmp-tests\shopee-page-product-links-vps-static.test.mjs` falhou enquanto a ShopeePage ainda nao usava `shopeeProductService`.
- `node tmp-tests\shopee-page-product-links-vps-static.test.mjs`: OK.
- `node tmp-tests\shopee-products-service-vps-static.test.mjs`: OK.
- `node tmp-tests\shopee-variation-modal-static.test.mjs`: OK apos atualizar o teste para o endpoint Shopee atual na VPS.
- `node tmp-tests\shopee-existing-variation-flow-static.test.mjs`: OK apos atualizar o teste para o endpoint Shopee atual na VPS.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 46`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `shopee_products` saiu do inventario operacional Supabase e foi removido da allowlist `products-catalog-migration-temporary`. O baseline caiu de `.from=57` para `.from=46`.

Rollback: restaurar os acessos diretos a `shopee_products` na `ShopeePage`, recolocar `shopee_products` na allowlist de catalogo e voltar `MAX_BASELINE_FROM_CALLS` para 57; nao recomendado porque recoloca a integracao Shopee admin fora da VPS.

## 2026-05-31 - Metadados Shopee compartilhados via VPS

Mudanca: criado `services/shopeeProducts.ts` para ler metadados de `shopee_products` pela VPS em `/table-data/shopee_products`. `hooks/useProducts.ts`, `services/products.ts` e a limpeza de vinculo obsoleto em `ProductCard` passaram a usar esse servico, removendo leituras/exclusao direta de `shopee_products` nesses caminhos compartilhados.

Escopo admin/publico: afeta principalmente admin/listagem de produtos e cards de produto. O impacto publico e indireto: o servico central de produtos preserva o enriquecimento `shopee_item_id` vindo da VPS. A pagina Shopee ainda concentra os acessos restantes para uma fatia propria.

Validacao:

- RED: `node tmp-tests\shopee-products-service-vps-static.test.mjs` falhou enquanto o servico VPS de `shopee_products` nao existia.
- `node tmp-tests\shopee-products-service-vps-static.test.mjs`: OK.
- `node tmp-tests\use-products-shopee-link-state-static.test.mjs`: OK.
- `node tmp-tests\product-list-shopee-link-state-static.test.mjs`: OK.
- `node tmp-tests\product-card-status-stock-vps-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 57`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `shopee_products` caiu de 15 para 11 ocorrencias operacionais, o baseline caiu de `.from=61` para `.from=57` e a allowlist `shopee-products-crossmodule-temporary` foi removida.

Rollback: restaurar leituras/exclusao direta de `shopee_products` em `useProducts`, `productService` e `ProductCard`, remover `services/shopeeProducts.ts` e voltar `MAX_BASELINE_FROM_CALLS` para 61; nao recomendado porque recoloca metadados compartilhados da Shopee fora da VPS.

## 2026-05-31 - LegacyMigration sem customers no Supabase

Mudanca: `pages/LegacyMigration.tsx` deixou de consultar, inserir e atualizar `customers` diretamente pelo Supabase. A comparacao de CPFs existentes, a migracao individual, a migracao em lote e a vinculacao posterior de `user_id` agora usam `customerService.list`, `customerService.getByCpfCnpj`, `customerService.create` e `customerService.update`. Supabase permanece nessa pagina somente para Auth/admin Auth e para a consulta temporaria de `companies`, que fica para outra fatia.

Escopo admin/publico: mudanca em ferramenta administrativa legada de migracao de clientes. O impacto publico e indireto: clientes migrados continuam sendo criados/atualizados na base operacional da VPS/MySQL, usada pelos fluxos publicos de login/perfil.

Validacao:

- RED: `node tmp-tests\legacy-migration-customers-vps-static.test.mjs` falhou enquanto `LegacyMigrationPage` ainda continha chamadas `.from('customers')`.
- `node tmp-tests\legacy-migration-customers-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 61`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: `customers` saiu dos alvos operacionais do auditor, o baseline caiu de `.from=73` para `.from=61` e a allowlist temporaria `customer-core-temporary` foi removida.

Rollback: restaurar as leituras/escritas diretas de `customers` em `LegacyMigrationPage`, recolocar `customer-core-temporary` se necessario e voltar `MAX_BASELINE_FROM_CALLS` para 73; nao recomendado porque reintroduz a tabela operacional de clientes no Supabase.

## 2026-05-31 - SupabaseAuthContext sem CRUD direto de customers

Mudanca: `contexts/SupabaseAuthContext.tsx` deixou de ler e gravar `customers` diretamente pelo Supabase nos fluxos de carregamento de perfil, criacao por OAuth, ativacao de conta, criacao de conta, atualizacao de perfil e preview admin. O contexto agora usa `customerService.getByUserId`, `customerService.getByCpfCnpj`, `customerService.create` e `customerService.update`, mantendo Supabase somente para Auth (`signUp`, `signInWithPassword`, OAuth, reset/update de senha, sessao e signOut).

Escopo admin/publico: afeta o carregamento de sessao usado por admin e publico, criacao/ativacao de conta publica, perfil do cliente e preferencia local de preview do admin. Nenhuma tela visual foi alterada nesta fatia.

Validacao:

- RED: `node tmp-tests\supabase-auth-customer-service-only-static.test.mjs` falhou enquanto `SupabaseAuthContext` ainda continha sete chamadas `.from('customers')`.
- `node tmp-tests\supabase-auth-customer-service-only-static.test.mjs`: OK.
- `node tmp-tests\supabase-auth-cpf-vps-customer-static.test.mjs`: OK.
- `node tmp-tests\auth-context-vps-customer-static.test.mjs`: OK.
- `node tmp-tests\customer-service-vps-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 73`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.

Resultado: o baseline operacional do guard caiu de `.from=80` para `.from=73`, e as ocorrencias operacionais de `customers` cairam de 19 para 12.

Rollback: restaurar as chamadas diretas a `customers` em `SupabaseAuthContext` e voltar `MAX_BASELINE_FROM_CALLS` para 80; nao recomendado porque recoloca CRUD de cliente no Supabase em fluxos compartilhados de admin/publico.

## 2026-05-31 - Login publico por CPF sem leitura direta de customers

Mudanca: `contexts/SupabaseAuthContext.tsx` deixou de consultar `supabase.from('customers')` nos fluxos `checkCPF` e `signInWithCpf`. As duas consultas agora usam `customerService.getByCpfCnpj`, que le clientes pela VPS/MySQL e compara CPF/CNPJ normalizado, com ou sem mascara. Supabase permanece no fluxo somente para Auth (`signInWithPassword`).

Escopo admin/publico: mudanca no auth publico/autenticado de cadastro/login de cliente por CPF. Nenhuma tela admin foi alterada nesta fatia.

Validacao:

- RED: `node tmp-tests\supabase-auth-cpf-vps-customer-static.test.mjs` falhou enquanto `checkCPF` e `signInWithCpf` ainda liam `customers` pelo Supabase.
- `node tmp-tests\supabase-auth-cpf-vps-customer-static.test.mjs`: OK.
- `node tmp-tests\customer-service-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 80`, `.rpc(...) = 24`, `supabase.storage = 0`, `supabase.auth = 37`, `unclassifiedOperationalMatches = 0`.

Resultado: o baseline operacional do guard caiu de `.from=82` para `.from=80`, e as ocorrencias operacionais de `customers` cairam de 21 para 19.

Rollback: restaurar as leituras diretas de `customers` em `checkCPF` e `signInWithCpf`, voltar a comparacao exata de CPF/CNPJ no helper se necessario e retornar `MAX_BASELINE_FROM_CALLS` para 82; nao recomendado porque reintroduz leitura operacional de cliente fora da VPS no login publico.

## 2026-05-31 - AuthContext legado sem leitura direta de customers

Mudanca: `contexts/AuthContext.tsx` deixou de consultar `supabase.from('customers')` no carregamento de perfil por `user_id`. O contexto legado agora usa `customerService.getByUserId(userId)`, mantendo Supabase somente para Auth (`getSession`, `onAuthStateChange` e `signOut`).

Escopo admin/publico: mudanca preventiva em contexto legado; o provider ativo do app continua sendo `SupabaseAuthProvider`. Nenhuma tela publica ou admin recebeu alteracao visual nesta fatia.

Validacao:

- RED: `node tmp-tests\auth-context-vps-customer-static.test.mjs` falhou enquanto o contexto legado ainda lia `customers` pelo Supabase.
- `node tmp-tests\auth-context-vps-customer-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 82`, `.rpc(...) = 24`, `supabase.storage = 0`, `supabase.auth = 37`, `unclassifiedOperationalMatches = 0`.

Resultado: o baseline operacional do guard caiu de `.from=83` para `.from=82`, e as ocorrencias operacionais de `customers` cairam de 22 para 21.

Rollback: restaurar a consulta direta de `customers` em `contexts/AuthContext.tsx` e voltar `MAX_BASELINE_FROM_CALLS` para 83; nao recomendado porque reintroduz dependencia operacional de cliente fora da VPS.

## 2026-05-31 - Fallback do login admin sem leitura direta de customers

Mudanca: `pages/auth/AdminLoginPage.tsx` deixou de consultar `supabase.from('customers')` no fallback de seguranca do login admin. O fallback agora usa `customerService.getByUserId(user.id)`, e `services/customers.ts` ganhou esse helper lendo a base de clientes pela VPS/MySQL. Supabase permanece na tela apenas para Auth (`signInWithPassword`/`signOut`).

Escopo admin/publico: mudanca somente no login administrativo. Nenhuma pagina publica foi alterada nesta fatia.

Validacao:

- RED: `node tmp-tests\admin-login-vps-customer-fallback-static.test.mjs` falhou enquanto o fallback ainda lia `customers` pelo Supabase.
- `node tmp-tests\admin-login-vps-customer-fallback-static.test.mjs`: OK.
- `node tmp-tests\customer-service-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 83`, `.rpc(...) = 24`, `supabase.storage = 0`, `supabase.auth = 37`, `unclassifiedOperationalMatches = 0`.

Resultado: o baseline operacional do guard caiu de `.from=84` para `.from=83`, e as ocorrencias operacionais de `customers` cairam de 23 para 22.

Rollback: restaurar a consulta direta de `customers` no fallback do login admin e voltar `MAX_BASELINE_FROM_CALLS` para 84; nao recomendado porque reintroduz leitura operacional de cliente fora da VPS.

## 2026-05-31 - Clientes da importacao legada via VPS

Mudanca: `components/import/LegacySalesImportTab.tsx` deixou de consultar `supabase.from('customers')` durante a analise da importacao do MV-Gestao. O cruzamento CPF -> cliente do novo sistema agora usa `customerService.list()`, mantendo o match por CPF normalizado e reaproveitando a camada VPS/MySQL de clientes. As leituras/escritas restantes de `sales` e `sale_items` da ferramenta legada foram preservadas para outra fatia.

Escopo admin/publico: mudanca somente em ferramenta administrativa de importacao legada de vendas. Nenhuma pagina publica foi alterada nesta fatia.

Validacao:

- RED: `node tmp-tests\legacy-sales-import-customers-vps-static.test.mjs` falhou enquanto a aba ainda lia `customers` pelo Supabase.
- `node tmp-tests\legacy-sales-import-customers-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 84`, `.rpc(...) = 24`, `supabase.storage = 0`, `supabase.auth = 37`, `unclassifiedOperationalMatches = 0`.

Resultado: o baseline operacional do guard caiu de `.from=85` para `.from=84`, e as ocorrencias operacionais de `customers` cairam de 24 para 23.

Rollback: restaurar `supabase.from('customers').select('id, name, cpf_cnpj')` no diagnostico da importacao legada e voltar `MAX_BASELINE_FROM_CALLS` para 85; nao recomendado porque reintroduz leitura de cliente fora da VPS.

## 2026-05-31 - Validacao de codigo de indicacao pela VPS

Mudanca: `services/cashbackService.ts` deixou de consultar `supabase.from('customers')` dentro de `validateReferralCode`. A validacao agora carrega `customers` por `/table-data/customers`, compara `referral_code` em memoria, bloqueia o uso do proprio codigo e retorna o nome do indicador sem acessar a tabela operacional no Supabase.

Escopo admin/publico: mudanca afeta principalmente o fluxo publico/autenticado de indicacao e cashback, onde o cliente valida um codigo de indicacao. O admin nao recebeu tela nova nesta fatia; os RPCs de moedas continuam no backlog separado.

Validacao:

- RED: `node tmp-tests\cashback-referral-vps-customers-static.test.mjs` falhou enquanto `validateReferralCode` ainda lia `customers` via Supabase.
- `node tmp-tests\cashback-referral-vps-customers-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 85`, `.rpc(...) = 24`, `supabase.storage = 0`, `supabase.auth = 37`, `unclassifiedOperationalMatches = 0`.

Resultado: o baseline operacional do guard caiu de `.from=87` para `.from=85`, e as ocorrencias operacionais de `customers` cairam de 26 para 24.

Rollback: restaurar as duas leituras diretas de `customers` em `validateReferralCode` e voltar `MAX_BASELINE_FROM_CALLS` para 87; nao recomendado porque recoloca um fluxo publico de cashback fora da VPS.

## 2026-05-31 - Busca de clientes PDV/Frete via customerService

Mudanca: `components/pdv/CustomerSection.tsx` e `components/shipping/FreightCalculator.tsx` deixaram de consultar `supabase.from('customers')` diretamente. Ambos agora usam `customerService.list(...)`, reaproveitando a camada VPS/MySQL criada para clientes. O `customerService` tambem passou a buscar por telefone e por CPF/CNPJ sem mascara, preservando o comportamento anterior das buscas digitadas no PDV e no calculador de frete.

Escopo admin/publico: mudanca focada em fluxos administrativos/PDV. O PDV usa a busca e os clientes recentes pela VPS; o calculador de frete administrativo usa a busca de cliente pela VPS para preencher endereco/etiqueta. Nenhuma pagina publica foi alterada nesta fatia.

Validacao:

- RED: `node tmp-tests\customer-components-vps-service-static.test.mjs` falhou enquanto PDV e Frete ainda importavam/consultavam Supabase para `customers`.
- `node tmp-tests\customer-components-vps-service-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 87`, `.rpc(...) = 24`, `supabase.storage = 0`, `supabase.auth = 37`, `unclassifiedOperationalMatches = 0`.

Resultado: o baseline operacional do guard caiu de `.from=90` para `.from=87`, e as ocorrencias operacionais de `customers` cairam de 29 para 26.

Rollback: restaurar as consultas diretas a `customers` em `CustomerSection` e `FreightCalculator` e voltar `MAX_BASELINE_FROM_CALLS` para 90; nao recomendado porque recoloca caminhos de admin/PDV fora da VPS.

## 2026-05-31 - Customer service via VPS table-data

Mudanca: `services/customers.ts` deixou de importar `services/supabase` e passou a usar `vpsClient` para o CRUD operacional de `customers`. Listagem, busca por ID/CPF-CNPJ, criacao, atualizacao, exclusao e contagem ativa agora leem/escrevem por `/table-data/customers`, com cache local, filtros em memoria por empresa e normalizacao dos campos JSON `address`/`custom_data`.

Escopo admin/publico: a fatia afeta o admin e o PDV que usam `customerService`, incluindo cadastro/listagem de clientes, seletores de cliente em cashback/pedidos e criacao de cliente pelo PDV. Nenhuma pagina publica foi alterada diretamente nesta fatia; o contexto de cliente autenticado segue separado e a pagina publica de moedas ja havia sido desacoplada na etapa anterior.

Validacao:

- RED: `node tmp-tests\customer-service-vps-static.test.mjs` falhou enquanto `customerService` ainda importava Supabase e usava `supabase.from('customers')`.
- `node tmp-tests\customer-service-vps-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 90`, `.rpc(...) = 24`, `supabase.storage = 0`, `supabase.auth = 37`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK fora do sandbox; avisos conhecidos de chunks grandes e import dinamico/estatico permanecem.

Resultado: o baseline operacional do guard caiu de `.from=97` para `.from=90`, e as ocorrencias operacionais de `customers` cairam de 36 para 29.

Rollback: restaurar as chamadas Supabase de `services/customers.ts`, remover `tmp-tests/customer-service-vps-static.test.mjs` e voltar `MAX_BASELINE_FROM_CALLS` para 97; nao recomendado porque reintroduz o CRUD central de clientes no Supabase.

## 2026-05-31 - Pagina publica de moedas sem leitura direta de customers

Mudanca: `pages/catalog/CoinsInfoPage.tsx` deixou de importar `services/supabase` e de consultar `customers.referral_code` diretamente. A pagina agora reutiliza `useSupabaseAuth()` e le `customer.referral_code` do contexto ja carregado, evitando uma leitura operacional extra no Supabase.

Escopo admin/publico: mudanca somente na pagina publica de informacoes das Moedas do Vale. Nenhuma tela admin foi alterada nesta fatia.

Validacao:

- `node tmp-tests\coins-info-page-customer-context-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 97`, `.rpc(...) = 24`, `supabase.storage = 0`, `supabase.auth = 37`, `unclassifiedOperationalMatches = 0`.

Resultado: `customers` caiu de 37 para 36 ocorrencias e o baseline operacional do guard caiu de `.from=98` para `.from=97`.

Rollback: voltar `CoinsInfoPage` para `supabase.auth.getUser()` + `supabase.from('customers')`, remover `tmp-tests/coins-info-page-customer-context-static.test.mjs` e restaurar o baseline `.from=98`; nao recomendado porque reintroduz leitura direta de cliente na pagina publica.

## 2026-05-31 - VPS client sem import estatico do Supabase

Mudanca: `services/vpsClient.ts` deixou de importar `./supabase` diretamente e passou a usar `getSupabaseClient()` via `services/lazySupabase.ts` apenas quando precisa consultar a sessao para anexar `Authorization`. Se Supabase estiver indisponivel ou sem env vars, o cliente da VPS continua montando as chamadas sem Bearer token, mantendo `x-sync-key` e permitindo leituras publicas pela VPS.

Escopo admin/publico: a mudanca reduz o acoplamento global do runtime publico com Supabase. Paginas publicas e servicos que usam `vpsClient` para leitura na VPS nao carregam mais `services/supabase.ts` por causa do cliente compartilhado. Admin e fluxos protegidos continuam recebendo `Authorization` quando houver sessao Supabase.

Validacao:

- `node tmp-tests\vps-client-lazy-supabase-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 98`, `.rpc(...) = 24`, `supabase.storage = 0`, `supabase.auth = 38`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK fora do sandbox. O sandbox falhou primeiro ao carregar `vite.config.ts` com `Access is denied`, comportamento ja conhecido do projeto. O build manteve avisos conhecidos de chunks grandes e import dinamico/estatico, incluindo imports estaticos restantes de `services/supabase.ts` em telas/servicos ainda nao migrados.

Resultado: o acoplamento de Auth no audit caiu de 39 para 38 chamadas, e o `vpsClient` nao obriga mais o bundle publico a inicializar Supabase apenas para falar com a VPS.

Rollback: trocar `getSupabaseClient()` de volta para `import { supabase } from './supabase'` em `vpsClient.ts` e remover `tmp-tests/vps-client-lazy-supabase-static.test.mjs`; nao recomendado porque reintroduz dependencia Supabase no caminho compartilhado de VPS.

## 2026-05-31 - Vendas PDV via VPS table-data

Mudanca: `services/saleService.ts` deixou de usar Supabase para os fluxos principais de vendas PDV em `sales` e `sale_items`. `createSale` agora cria a venda por `POST /table-data/sales`, grava itens por `POST /table-data/sale_items/bulk` e faz rollback por `DELETE /table-data/sales/:id` se a inclusao de itens falhar. `getSaleById`, `getSales`, `getSalesSummary`, `cancelSale`, `refundSale` e `deleteSale` leem `sales`, `sale_items`, `customers` e `team_members` pela VPS em `/table-data/*`, hidratam cliente/vendedor em memoria e usam `PATCH/DELETE /table-data/sales/:id` para status/exclusao.

Pendencias preservadas: `createSale` ainda usa Supabase para o RPC `process_referral_reward`; os RPCs de estoque (`decrement_stock`/`increment_stock`) tambem continuam no backlog transacional separado. A importacao legada de vendas ainda tem acessos diretos restantes a `sales`/`sale_items`.

Escopo admin/publico: mudanca focada no PDV/admin de vendas. Nenhuma pagina publica foi alterada nesta etapa.

Validacao:

- RED: `node tmp-tests\sale-service-vps-table-data-static.test.mjs` falhou enquanto `saleService` nao importava `vpsClient`, depois falhou enquanto `createSale` ainda nao gerava ID local nem gravava `sales`/`sale_items` pela VPS.
- `node tmp-tests\sale-service-vps-table-data-static.test.mjs`: OK.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: OK.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 98`, `.rpc(...) = 24`, `supabase.storage = 0`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: OK via build Vite; restaram apenas avisos de chunks grandes e import dinamico/estatico no mesmo modulo.
- `npx.cmd tsc --noEmit --skipLibCheck services\saleService.ts`: falhou por erros preexistentes/fora da fatia em `blingService`, `import.meta` sem contexto de `tsconfig` e iteracao ES target; nao apontou um erro isolavel novo do bloco migrado.

Atualizacao adicional: a busca do nome do comprador usada pelo referral deixou de consultar `customers` no Supabase e passou a usar `loadCustomerNameById()` via `/table-data/customers`.

Resultado: o baseline operacional Supabase caiu de `.from=112` para `.from=98`. `sales` caiu de 18 para 10 ocorrencias, `sale_items` de 7 para 2 e `customers` de 38 para 37, mantendo pontos restantes para RPCs de referral/estoque transacional e importacao legada.

Rollback: restaurar as consultas Supabase em `createSale`, `getSaleById`, `getSales`, `getSalesSummary`, `cancelSale`, `refundSale` e `deleteSale`, remover `tmp-tests/sale-service-vps-table-data-static.test.mjs` e voltar `MAX_BASELINE_FROM_CALLS` para 112; nao recomendado porque reintroduz criacao/leitura/listagem de PDV fora da VPS.

Este documento define o plano para remover o Supabase do caminho operacional do Mercado do Vale, mantendo o Supabase somente para autenticacao de login enquanto a VPS e o Synology assumem o restante do sistema.

## Objetivo

Reduzir o Supabase ao minimo necessario:

- manter Supabase Auth para login de administradores e clientes;
- remover tabelas operacionais do Supabase;
- mover regras de negocio, APIs, jobs e webhooks para a VPS;
- mover dados estruturados para MySQL na VPS;
- mover arquivos grandes para Synology;
- manter rollback e validacao por modulo.

## Decisao de Arquitetura

| Tipo de dado ou funcao | Destino final | Observacao |
| --- | --- | --- |
| Login e sessao | Supabase Auth | Permanecer por enquanto |
| Produtos, modelos, marcas, categorias | VPS/MySQL | APIs via Fastify |
| Estoque, IMEI, seriais e movimentacoes | VPS/MySQL | Fonte operacional principal |
| Vendas, pedidos, pagamentos e PDV | VPS/MySQL | Preservar formato de preco em centavos |
| Clientes e dados cadastrais | VPS/MySQL | Auth pode continuar referenciando usuario Supabase |
| Configuracoes da empresa | VPS/MySQL | Evitar leitura direta do Supabase no frontend |
| Bling, Shopee, Mercado Pago e webhooks | VPS/Fastify | Logs e debug copiavel na VPS |
| Fotos e imagens de produto | Synology | Guardar URL/referencia no MySQL |
| Videos e arquivos grandes | Synology | Nunca versionar arquivos grandes no repo |
| Logs operacionais | VPS | PM2, Nginx e arquivos controlados |
| Cache/CDN/DNS | Cloudflare | Apenas borda, nao regra de negocio |

## Varredura Inicial do Supabase

Varredura executada em 2026-05-26 usando leitura estatica do codigo/services/migrations, leitura real do Supabase com service role local sem expor segredos, listagem de buckets do Supabase Storage e identificacao de RPCs usadas pelo frontend/services.

### Manter no Supabase

| Item | O que existe | Destino | Acao |
| --- | --- | --- | --- |
| Supabase Auth | Login, sessao, refresh, reset de senha e usuarios autenticados | Supabase Auth | Manter por enquanto |
| `profiles` | 1 registro | Supabase Auth / VPS metadata | Avaliar se fica como complemento do Auth ou migra para MySQL |
| `user_companies` | 0 registros | Supabase Auth / VPS metadata | Provavel legado; validar antes de remover |
| `recovery_codes` | migration antiga de auth | Supabase Auth ou remover | Verificar se ainda e usado |

### Migrar para VPS/MySQL

| Area | Tabelas encontradas | Contagem atual | Destino | Prioridade |
| --- | --- | ---: | --- | --- |
| Produtos | `products` | 2446 | VPS/MySQL | Alta |
| Produtos | `models` | 1373 | VPS/MySQL | Alta |
| Produtos | `brands` | 251 | VPS/MySQL | Alta |
| Produtos | `categories` | 74 | VPS/MySQL | Alta |
| Produtos | `colors` | 21 | VPS/MySQL | Alta |
| Produtos | `rams` | 9 | VPS/MySQL | Alta |
| Produtos | `storages` | 8 | VPS/MySQL | Alta |
| Produtos | `versions` | 2 | VPS/MySQL | Alta |
| Produtos | `battery_healths` | 9 | VPS/MySQL | Alta |
| Produtos | `custom_fields` | 48 | VPS/MySQL | Alta |
| Produtos | `model_color_images` | 71 | VPS/MySQL metadata + Synology arquivos | Alta |
| Produtos | `model_eans` | 0 | VPS/MySQL | Media |
| Produtos | `model_variants` | 0 | VPS/MySQL ou remover legado | Baixa |
| Produtos | `model_variant_images` | 0 | VPS/MySQL metadata + Synology arquivos ou remover legado | Baixa |
| Produtos | `product_images` | 0 | VPS/MySQL metadata + Synology arquivos | Media |
| Produtos | `product_combos` | contagem nao retornada | VPS/MySQL | Media |
| Estoque | `product_stock_locations` | 2539 | VPS/MySQL | Alta |
| Estoque | `stock_location_movements` | 2621 | VPS/MySQL | Alta |
| Estoque | `stock_locations` | 40 | VPS/MySQL | Alta |
| Estoque | `stock_deposits` | 4 | VPS/MySQL | Alta |
| Estoque | `stock_movements` | 0 | VPS/MySQL ou remover legado | Media |
| Estoque | `units` | 0 | VPS/MySQL ou remover legado | Media |
| Estoque | `unit_swap_logs` | 0 | VPS/MySQL ou remover legado | Media |
| Precos | `product_price_history` | 648 | VPS/MySQL | Alta |
| Precos | `payment_fees` | 48 | VPS/MySQL | Alta |
| Vendas | `sales` | 236 | VPS/MySQL | Alta |
| Vendas | `sale_items` | 689 | VPS/MySQL | Alta |
| Pedidos online | `orders` | 7 | VPS/MySQL | Alta |
| Pedidos online | `order_items` | 7 | VPS/MySQL | Alta |
| Clientes | `customers` | 246 | VPS/MySQL, preservando vinculo Auth | Alta |
| Clientes | `customer_type_requests` | 1 | VPS/MySQL | Media |
| Equipe | `team_members` | 1 | VPS/MySQL | Media |
| Permissoes | `user_permissions` | 36 | VPS/MySQL, validado por token Supabase | Alta |
| Empresa | `companies` | 1 | VPS/MySQL | Alta |
| Empresa | `company_settings` | 1 | VPS/MySQL | Alta |
| Empresa | `company_documents` | 1 | VPS/MySQL metadata + Synology arquivo | Media |
| Catalogo | `catalog_settings` | 1 | VPS/MySQL | Alta |
| Catalogo | `catalog_sections` | 3 | VPS/MySQL | Alta |
| Catalogo | `catalog_banners` | 2 | VPS/MySQL metadata + Synology imagens | Alta |
| Catalogo | `catalog_shares` | 0 | VPS/MySQL ou remover legado | Baixa |
| Catalogo | `category_display_config` | 0 | VPS/MySQL ou remover legado | Baixa |
| Catalogo | `product_views` | 0 | VPS/MySQL/logs VPS | Baixa |
| Catalogo | `product_reviews` | 0 | VPS/MySQL | Baixa |
| Cashback | `coin_transactions` | 36 | VPS/MySQL | Media |
| Cashback | `coin_balances` | 5 | VPS/MySQL | Media |
| Cashback | `cashback_settings` | 3 | VPS/MySQL | Media |
| Cashback | `checkin_logs` | 7 | VPS/MySQL | Media |
| Cashback | `coin_promotions` | 0 | VPS/MySQL ou remover legado | Baixa |
| Beneficios | `customer_benefits` | 0 | VPS/MySQL ou remover legado | Baixa |
| Beneficios | `benefit_redemptions` | 0 | VPS/MySQL ou remover legado | Baixa |
| Promocoes | `promotions` | 1 | VPS/MySQL | Media |
| Cupons | `coupons` | 0 | VPS/MySQL ou remover legado | Baixa |
| Garantias | `warranty_templates` | 4 | VPS/MySQL | Media |
| Garantias | `warranty_documents` | 0 | VPS/MySQL metadata + Synology PDF | Media |
| Shopee | `shopee_products` | 332 | VPS/MySQL | Alta |
| Shopee | `shopee_templates` | contagem nao retornada | VPS/MySQL | Media |
| Pagamentos | `payment_integrations` | 1 | VPS/MySQL, segredos na VPS | Alta |
| Frete | `shipping_settings` | 1 | VPS/MySQL | Media |
| Frete | `shipping_zones` | 3 | VPS/MySQL | Media |
| Frete | `shipping_price_ranges` | 0 | VPS/MySQL ou remover legado | Baixa |
| Frete | `shipping_presets` | contagem nao retornada | VPS/MySQL | Media |
| Comunicacao | `whatsapp_settings` | 1 | VPS/MySQL | Media |
| Comunicacao | `telegram_settings` | 1 | VPS/MySQL | Media |
| Comunicacao | `instagram_schedule` | 16 | VPS/MySQL | Media |
| Automacao | `system_tags` | 37 | VPS/MySQL | Media |
| Automacao | `cross_sell_tags` | 1251 | VPS/MySQL | Media |
| Feedback | `customer_feedbacks` | 0 | VPS/MySQL ou remover legado | Baixa |
| Logs | `webhook_logs` | 5843 | VPS/logs ou MySQL historico | Alta |
| Logs | `system_logs` | 0 | VPS/logs | Baixa |
| Logs | `performance_metrics` | 0 | VPS/logs ou remover legado | Baixa |
| Compras | `purchase_queue_items` | contagem nao retornada | VPS/MySQL | Media |
| Entregas | `delivery_credits` | 0 | VPS/MySQL ou remover legado | Baixa |

Tabelas com "contagem nao retornada" existem, mas a API nao devolveu `count` exato nessa consulta. Elas precisam de recontagem especifica antes da migracao.

### Migrar para Synology

| Bucket Supabase | Estado atual | Destino | Acao |
| --- | --- | --- | --- |
| `product-images` | publico, pelo menos 1 item na raiz | Synology | Migrar imagens de produto e salvar URL/caminho no MySQL |
| `catalog-banners` | publico, 4 itens na raiz, limite 10 MB | Synology | Migrar banners e atualizar `catalog_banners.image_url` |
| `company-documents` | privado, 1 item na raiz, PDF, limite 20 MB | Synology privado/controlado | Migrar PDFs e salvar metadados no MySQL |
| `customer-avatars` | publico, 0 itens na raiz | Synology ou remover | Validar se ainda existe uso real |

Arquivos grandes fora de bucket tambem precisam ser inventariados:

- imagens em campos `images`, `image_url`, `banner_url`, `logo_url`;
- videos em `video_url`, `synology_video_*` e referencias antigas;
- PDFs e documentos de garantia;
- anexos do AutoResponder/WhatsApp/Telegram, se existirem.

### RPCs Supabase a substituir na VPS

| Grupo | RPCs encontradas | Destino |
| --- | --- | --- |
| Cashback/moedas | `add_coins`, `add_pending_coins`, `confirm_pending_coins`, `cancel_pending_coins`, `refund_coins`, `refund_referral_coins`, `spend_coins`, `increment_coin_promo_uses` | VPS/Fastify + MySQL transacional |
| Estoque por local | `add_product_stock_location`, `adjust_product_stock_location`, `transfer_product_stock_location`, `reserve_product_stock_by_priority`, `decrement_product_stock_by_priority`, `consume_order_stock_reservations`, `release_order_stock_reservations`, `restore_product_stock_from_order_movements`, `restore_product_stock_from_sale_movements` | VPS/Fastify + MySQL transacional |
| Estoque legado | `increment_stock`, `decrement_stock` | VPS/Fastify ou remover apos migrar vendas/pedidos |
| Catalogo | `increment_banner_views`, `increment_banner_clicks`, `increment_product_views` | VPS/Fastify ou logs agregados |
| Indicacao | `process_referral_reward` | VPS/Fastify + MySQL |
| Admin legado | `exec_sql` | Remover; nao manter RPC generica no Supabase |

### Dependencias Diretas no Codigo

As tabelas com maior acoplamento no codigo hoje sao:

- `products`: encontrado em 40 arquivos;
- `categories`: 12 arquivos;
- `customers`: 12 arquivos;
- `models`: 11 arquivos;
- `company_settings`: 10 arquivos;
- `companies`: 10 arquivos;
- `warranty_templates`: 6 arquivos;
- `brands`, `coin_transactions`, `model_color_images`, `sales`: entre 5 e 6 arquivos.

Essas devem ser migradas com adaptadores/servicos VPS primeiro, porque reduzem mais dependencias Supabase por etapa.

### Varredura Local Complementar do Codigo

Varredura executada em 2026-05-26 no workspace local, sem acessar banco e sem imprimir segredos.

Comandos-base usados:

```powershell
rg -n "\.from\('([^']+)'\)|supabase\.from\('([^']+)'\)" services pages components hooks contexts utils --glob '*.ts' --glob '*.tsx' --glob '*.js' --glob '*.cjs' --glob '*.mjs'
rg -n "rpc\(" services pages components hooks contexts utils --glob '*.ts' --glob '*.tsx' --glob '*.js' --glob '*.cjs' --glob '*.mjs'
```

Resumo encontrado:

| Tipo | Ocorrencias | Arquivos | Observacao |
| --- | ---: | ---: | --- |
| Leituras/escritas `.from(...)` | 556 | 112 | Inclui services, pages, components, contexts e utils |
| RPCs Supabase | 31 | 8 | Concentradas em cashback, estoque, catalogo, pedidos e vendas |

Distribuicao por pasta para `.from(...)`:

| Pasta | Arquivos com dependencia |
| --- | ---: |
| `services/` | 63 |
| `pages/` | 25 |
| `components/` | 17 |
| `contexts/` | 2 |
| `utils/` | 4 |

Tabelas mais acopladas nesta varredura local:

| Tabela | Ocorrencias locais | Prioridade pratica |
| --- | ---: | --- |
| `products` | 76 | Alta |
| `customers` | 39 | Alta |
| `models` | 33 | Alta |
| `company_settings` | 21 | Alta |
| `orders` | 20 | Alta |
| `catalog_banners` | 19 | Alta |
| `sales` | 18 | Alta |
| `model_color_images` | 15 | Alta |
| `brands` | 15 | Alta |
| `categories` | 15 | Alta |
| `catalog_settings` | 15 | Alta |
| `shopee_products` | 15 | Alta |
| `custom_fields` | 12 | Media |
| `companies` | 10 | Alta |
| `warranty_templates` | 10 | Media |

RPCs ainda chamadas no codigo:

| RPC | Ocorrencias | Area |
| --- | ---: | --- |
| `add_coins` | 4 | Cashback |
| `process_referral_reward` | 3 | Pedidos/vendas |
| `decrement_stock` | 2 | Estoque legado |
| `increment_stock` | 2 | Estoque legado |
| `adjust_product_stock_location` | 1 | Estoque por local |
| `transfer_product_stock_location` | 1 | Estoque por local |
| `add_product_stock_location` | 1 | Estoque por local |
| `decrement_product_stock_by_priority` | 1 | Estoque por local |
| `reserve_product_stock_by_priority` | 1 | Estoque por local |
| `consume_order_stock_reservations` | 1 | Estoque por local |
| `release_order_stock_reservations` | 1 | Estoque por local |
| `restore_product_stock_from_sale_movements` | 1 | Estoque por local |
| `restore_product_stock_from_order_movements` | 1 | Estoque por local |
| `increment_product_views` | 1 | Catalogo |
| `increment_banner_views` | 1 | Catalogo |
| `increment_banner_clicks` | 1 | Catalogo |
| `add_pending_coins` | 1 | Cashback |
| `confirm_pending_coins` | 1 | Cashback |
| `cancel_pending_coins` | 1 | Cashback |
| `spend_coins` | 1 | Cashback |
| `refund_coins` | 1 | Cashback |
| `refund_referral_coins` | 1 | Cashback |
| `increment_coin_promo_uses` | 1 | Cashback |
| RPC dinamica em `cashbackService` | 1 | Cashback |

Conclusao da varredura: o primeiro bloco executavel deve atacar `products`, `models`, `brands`, `categories`, `company_settings`, `companies` e `shopee_products`, porque essas tabelas puxam a maior parte das telas admin/catalogo e reduzem a pressao sobre Supabase sem mexer ainda nos fluxos transacionais mais sensiveis de venda, estoque e cashback.

### Ordem Tecnica Recomendada por Dados Reais

1. Auth e autorizacao VPS usando token Supabase.
2. `companies`, `company_settings`, `user_permissions`.
3. `brands`, `categories`, `models`, `products`, campos tecnicos e precos.
4. `product_stock_locations`, `stock_location_movements`, `stock_locations`, `stock_deposits`.
5. Buckets `product-images`, `catalog-banners`, `company-documents` para Synology.
6. `customers`, `sales`, `sale_items`, `orders`, `order_items`.
7. `shopee_products`, `payment_integrations`, frete e webhooks.
8. Cashback, cupons, beneficios, garantias e comunicacao.
9. Logs, metricas, tabelas vazias e legados para arquivar/remover.

## Regra Principal

Nova funcao operacional deve nascer na VPS, nao no Supabase.

Supabase so deve ser usado para:

- autenticacao;
- sessao do usuario;
- transicao temporaria de modulos ainda nao migrados.

Qualquer nova dependencia no Supabase precisa ter justificativa registrada antes de ser implementada.

## Checklist Geral

- [ ] Mapear todas as leituras diretas de `supabase.from(...)` no frontend.
- [ ] Mapear todos os servicos que ainda dependem de tabelas Supabase.
- [ ] Classificar cada dependencia: auth, dado operacional, arquivo, configuracao, log ou legado.
- [ ] Definir tabela equivalente no MySQL para cada dado operacional.
- [ ] Definir endpoint VPS/Fastify para cada fluxo usado pelo frontend.
- [ ] Migrar dados em lote com relatorio de contagem antes/depois.
- [ ] Validar leitura pela VPS antes de desligar leitura Supabase.
- [ ] Validar escrita pela VPS antes de desligar escrita Supabase.
- [ ] Manter rollback por modulo enquanto houver risco.
- [ ] Remover fallback Supabase somente depois de validacao real.
- [ ] Atualizar documentacao do modulo migrado.
- [ ] Criar teste regressivo para impedir retorno acidental ao Supabase.

## Checklist por Area

### Autenticacao

- [ ] Manter Supabase Auth ativo para login.
- [ ] Confirmar login admin.
- [ ] Confirmar login cliente.
- [ ] Confirmar refresh de sessao.
- [ ] Confirmar logout.
- [ ] Definir como a VPS valida usuario logado.
- [ ] Padronizar envio do token Supabase para endpoints protegidos.
- [ ] Garantir que a VPS nao precise de service role no frontend.
- [ ] Documentar quais env vars Supabase continuam obrigatorias.

### Produtos e Catalogo

- [ ] Confirmar que produtos ativos sao lidos da VPS/MySQL.
- [ ] Migrar categorias para MySQL.
- [ ] Migrar marcas para MySQL.
- [ ] Migrar modelos para MySQL.
- [ ] Migrar campos tecnicos para MySQL.
- [ ] Migrar RAM, armazenamento, versao e saude de bateria para MySQL.
- [ ] Remover consultas Supabase da criacao/edicao/listagem de produtos.
- [ ] Validar cadastro individual.
- [ ] Validar cadastro em massa.
- [ ] Validar pagina publica de produto.
- [ ] Validar SEO e sitemap usando dados da VPS.

### Estoque

- [ ] Confirmar que quantidade em estoque vem da VPS/MySQL.
- [ ] Migrar IMEI, IMEI2, serial e EAN.
- [ ] Migrar movimentacoes de estoque.
- [ ] Migrar locais/depositos de estoque.
- [ ] Garantir que variacao de cor nao afete medias de smartphone quando a regra for RAM/armazenamento.
- [ ] Validar sincronizacao com Bling.
- [ ] Validar baixa por venda.
- [ ] Validar ajuste manual.
- [ ] Validar historico e auditoria.

### Precos e Financeiro

- [ ] Manter preco interno em centavos.
- [ ] Validar conversao para Bling em reais.
- [ ] Migrar preco de custo, varejo, revenda, atacado e promocional.
- [ ] Migrar historico de preco quando necessario.
- [ ] Migrar configuracoes de taxas e gateways.
- [ ] Validar calculo de margem.
- [ ] Validar campo "quero ganhar".
- [ ] Validar medias de estoque.
- [ ] Criar teste para impedir mistura de reais/centavos.

### Clientes e Vendas

- [ ] Migrar clientes para MySQL.
- [ ] Preservar vinculo com usuario Supabase Auth quando existir.
- [ ] Migrar enderecos.
- [ ] Migrar pedidos.
- [ ] Migrar itens de venda.
- [ ] Migrar pagamentos.
- [ ] Migrar garantias vinculadas a venda.
- [ ] Validar PDV.
- [ ] Validar carrinho publico.
- [ ] Validar historico do cliente.
- [ ] Validar recibos e documentos.

### Arquivos, Imagens e Videos

- [ ] Inventariar imagens que ainda estao no Supabase Storage ou em base64.
- [ ] Inventariar videos que ainda estao fora do Synology.
- [ ] Definir politica de caminho no Synology.
- [ ] Migrar imagens de produto para Synology.
- [ ] Migrar videos de produto para Synology.
- [ ] Guardar no MySQL apenas URL, caminho, metadados e ordem.
- [ ] Validar miniaturas no admin.
- [ ] Validar imagens na pagina publica.
- [ ] Validar video na pagina publica.
- [ ] Remover blobs/base64 do banco operacional.
- [ ] Criar rotina de auditoria de arquivos quebrados.

### Integracoes

- [ ] Migrar Bling para endpoints VPS.
- [ ] Migrar Shopee para endpoints VPS.
- [ ] Migrar Mercado Pago para endpoint VPS.
- [ ] Migrar Melhor Envio/Frenet para VPS.
- [ ] Migrar Telegram/WhatsApp/AutoResponder quando aplicavel.
- [ ] Garantir debug copiavel sem segredo.
- [ ] Garantir logs na VPS.
- [ ] Validar webhooks reais em janela controlada.
- [ ] Remover callbacks antigos apos validacao.

### Configuracoes e Admin

- [ ] Migrar dados da empresa para MySQL.
- [ ] Migrar configuracoes de catalogo.
- [ ] Migrar secoes e banners.
- [ ] Migrar documentos e templates.
- [ ] Migrar permissoes e papeis que nao forem parte direta do Auth.
- [ ] Validar telas admin sem leitura direta do Supabase.
- [ ] Criar endpoints VPS protegidos por permissao.

## Ordem Recomendada

1. Inventario de dependencias Supabase.
2. Auth e autorizacao na VPS.
3. Produtos, catalogo e estoque.
4. Imagens/videos para Synology.
5. Clientes, vendas e financeiro.
6. Integracoes e webhooks.
7. Configuracoes admin.
8. Remocao de fallbacks Supabase.
9. Auditoria final e testes de regressao.

## Proximo Bloco de Trabalho

### Bloco 1 - Inventario e Guarda de Regressao

Objetivo: impedir que novas dependencias operacionais no Supabase entrem enquanto a migracao avanca.

- [x] Criar teste estatico que conte `.from(...)`, `.rpc(...)` e `supabase.storage` fora de arquivos permitidos.
- [x] Definir allowlist temporaria por modulo ainda nao migrado.
- [x] Separar dependencias permitidas de Auth (`supabase.auth`) das dependencias operacionais.
- [x] Gerar relatorio por tabela e arquivo para guiar commits pequenos.
- [x] Atualizar este documento com o relatorio antes de migrar codigo.

Comandos de guarda criados:

```powershell
node tmp-tests\supabase-operational-dependency-guard-static.test.mjs
node tools\audit-supabase-operational-dependencies.mjs
```

Baseline inicial registrado em 2026-05-26:

| Metrica | Limite atual |
| --- | ---: |
| `.from(...)` | 556 |
| `.rpc(...)` | 31 |
| `supabase.storage` | 13 |

Regra: durante a migracao, esses numeros so devem diminuir ou permanecer iguais quando houver justificativa temporaria. Se aumentarem, o audit falha.

Avanco em 2026-05-26:

| Mudanca | Antes | Depois |
| --- | ---: | ---: |
| `services/productService.ts` sem Supabase direto | 556 `.from(...)` | 551 `.from(...)` |
| Dependencias diretas em `products` | 76 | 72 |
| Arquivos com `.from(...)` | 112 | 111 |
| `components/admin/SectionsTab.tsx` carrega opcoes por VPS | 551 `.from(...)` | 549 `.from(...)` |
| Dependencias diretas em `categories` | 15 | 14 |
| Dependencias diretas em `products` | 72 | 71 |
| Arquivos com `.from(...)` | 111 | 110 |
| `utils/catalogMessageGenerator.ts` gera mensagens por VPS | 549 `.from(...)` | 546 `.from(...)` |
| Dependencias diretas em `categories` | 14 | 13 |
| Dependencias diretas em `products` | 71 | 69 |
| Arquivos com `.from(...)` | 110 | 109 |
| `utils/catalogPDFGenerator.ts` gera PDF por VPS | 546 `.from(...)` | 542 `.from(...)` |
| Dependencias diretas em `company_settings` | 21 | 20 |
| Dependencias diretas em `categories` | 13 | 12 |
| Dependencias diretas em `products` | 69 | 67 |
| Arquivos com `.from(...)` | 109 | 108 |
| `components/cart/NewOrderModal.tsx` carrega variacoes por VPS | 542 `.from(...)` | 541 `.from(...)` |
| `utils/cartShareUtils.ts` carrega variacoes de orcamento por VPS | 541 `.from(...)` | 540 `.from(...)` |
| Dependencias diretas em `products` | 67 | 65 |
| Arquivos com `.from(...)` | 108 | 106 |
| `components/catalog/QuoteModal.tsx` carrega cores disponiveis por VPS | 540 `.from(...)` | 539 `.from(...)` |
| `pages/store/OrderTrackingPage.tsx` enriquece itens por VPS | 539 `.from(...)` | 538 `.from(...)` |
| Dependencias diretas em `products` | 65 | 63 |
| Arquivos com `.from(...)` | 106 | 105 |
| Historicos/recibos carregam specs de produtos por VPS | 538 `.from(...)` | 534 `.from(...)` |
| Dependencias diretas em `products` | 63 | 59 |
| `components/catalog/ProductDetailsModal.tsx` resolve garantia de produto por VPS | 534 `.from(...)` | 532 `.from(...)` |
| `components/settings/ModelPricesPanel.tsx` carrega variacoes ativas por VPS | 532 `.from(...)` | 531 `.from(...)` |
| Dependencias diretas em `products` | 59 | 56 |
| Arquivos com `.from(...)` | 105 | 104 |
| Leituras simples em cashback, pedidos online, teste de catalogo e frete por VPS | 531 `.from(...)` | 527 `.from(...)` |
| Dependencias diretas em `products` | 56 | 52 |
| Arquivos com `.from(...)` | 104 | 103 |
| `ModelsPage` e `ProductCombosPage` leem produtos por VPS | 527 `.from(...)` | 525 `.from(...)` |
| `orderService` e `averagePriceService` leem produtos por VPS | 525 `.from(...)` | 523 `.from(...)` |
| Dependencias diretas em `products` | 52 | 48 |
| Arquivos com `.from(...)` | 103 | 101 |
| Digest de vendas e monitoramento deixam de consultar `products` no Supabase | 523 `.from(...)` | 522 `.from(...)` |
| `tagResolver` e promocao do PDV leem produtos por VPS | 522 `.from(...)` | 518 `.from(...)` |
| Dependencias diretas em `products` | 48 | 42 |
| Leituras de inventario passam para VPS mantendo ajustes de estoque no Supabase | 518 `.from(...)` | 513 `.from(...)` |
| Validadores de unicidade de IMEI/serial consultam produtos por VPS | 513 `.from(...)` | 511 `.from(...)` |
| Dependencias diretas em `products` | 42 | 35 |
| Arquivos com `.from(...)` | 101 | 99 |
| SEO dashboard e diagnosticos Bling consultam produtos por VPS | 511 `.from(...)` | 505 `.from(...)` |
| Dependencias diretas em `products` | 35 | 29 |
| Arquivos com `.from(...)` | 99 | 98 |
| Guard de dependencias operacionais ajustado para o baseline atual | 505 `.from(...)` | limite travado em 505 |
| `DataSyncService.generateDynamicTemplate` exporta produtos da categoria por VPS | 505 `.from(...)` | 504 `.from(...)` |
| Dependencias diretas em `products` | 29 | 28 |
| `ProductListPage` lista candidatos sem video por VPS | 504 `.from(...)` | 503 `.from(...)` |
| Dependencias diretas em `products` | 28 | 27 |
| `SEODashboardPage` valida unicidade de slug com estado carregado da VPS | 503 `.from(...)` | 502 `.from(...)` |
| Dependencias diretas em `products` | 27 | 26 |
| `inventory.adjustStock` le estoque atual do produto por VPS | 502 `.from(...)` | 501 `.from(...)` |
| Dependencias diretas em `products` | 26 | 25 |
| `ProductForm` valida IMEI/serial por VPS | 501 `.from(...)` | 499 `.from(...)` |
| Dependencias diretas em `products` | 25 | 23 |
| Arquivos com `.from(...)` | 98 | 97 |
| `BlingService.importBlingProducts` verifica duplicata por VPS | 499 `.from(...)` | 498 `.from(...)` |
| Dependencias diretas em `products` | 23 | 22 |
| Auditor separa Auth e allowlist operacional temporaria | 498 `.from(...)` | 498 `.from(...)`; Auth separado: 48 chamadas; allowlist: 267 ocorrencias; nao classificadas: 275 |
| `CashbackPage` carrega categorias de promocoes por VPS | 498 `.from(...)` | 497 `.from(...)` |
| `catalogService.getCategoriesWithNames` carrega categorias por VPS | 497 `.from(...)` | 496 `.from(...)` |
| `DataSyncService.syncGoogleSpreadsheet` valida marcas por VPS | 496 `.from(...)` | 495 `.from(...)` |
| `catalogSectionsService` expande categorias de secoes por VPS | 495 `.from(...)` | 494 `.from(...)` |
| `CartPage` busca garantia de marca por VPS | 494 `.from(...)` | 493 `.from(...)` |

Validacao do guard em 2026-05-26:

- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: passou.
- `node tmp-tests\data-sync-template-vps-products-static.test.mjs`: passou.
- `node tmp-tests\product-list-video-vps-read-static.test.mjs`: passou.
- `node tmp-tests\seo-dashboard-vps-slug-uniqueness-static.test.mjs`: passou.
- `node tmp-tests\inventory-adjust-stock-vps-current-product-static.test.mjs`: passou.
- `node tmp-tests\product-form-unique-validation-vps-static.test.mjs`: passou.
- `node tmp-tests\unique-validation-vps-products-static.test.mjs`: passou.
- `node tmp-tests\bling-import-duplicate-vps-products-static.test.mjs`: passou.
- `node tmp-tests\bling-vps-products-static.test.mjs`: passou.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 498`, `.rpc(...) = 31`, `supabase.storage = 13`.
- `node tmp-tests\vps-migration-guard-regression.cjs`: `ok=true`, `checked=28`, `failed=0`, `mutation_executed=false`.
- `npm.cmd run build`: passou fora do sandbox depois de bloqueio de leitura do `vite.config.ts` dentro do sandbox.

Atualizacao do guard em 2026-05-27:

- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: passou.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 498`, `.rpc(...) = 31`, `supabase.storage = 13`, `supabase.auth = 48`, `allowedOperationalMatches = 267`, `unclassifiedOperationalMatches = 275`.
- A allowlist temporaria agora agrupa dependencias por modulo (`auth-and-profile`, `products-catalog`, `sales-customers-finance`, `admin-config`, `inventory-and-operations` e `integration-settings`) para guiar a reducao incremental sem misturar Auth com dados operacionais.

Refino da allowlist em 2026-05-27:

- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: passou.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 498`, `.rpc(...) = 31`, `supabase.storage = 13`, `supabase.auth = 48`, `allowedOperationalMatches = 417`, `unclassifiedOperationalMatches = 125`.
- Novos grupos classificados: `orders-temporary`, `warranty-temporary`, `catalog-taxonomy-temporary`, `customer-engagement-temporary`, `admin-team-temporary` e `storage-temporary`.
- Proximos maiores grupos nao classificados: `customers`, `delivery_credits`, `model_variants`, `rams`, `shopee_templates`, `storages`, `system_logs`, RPCs de cashback e tabelas de frete.

Fechamento do inventario em 2026-05-27:

- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: passou.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 498`, `.rpc(...) = 31`, `supabase.storage = 13`, `supabase.auth = 48`, `allowedOperationalMatches = 542`, `unclassifiedOperationalMatches = 0`.
- O guard agora trava `MAX_UNCLASSIFIED_OPERATIONAL_MATCHES = 0`, portanto qualquer nova chamada operacional Supabase sem classificacao explicita falha a auditoria.
- O inventario ficou pronto para guiar a reducao por modulo. Maiores grupos permitidos temporariamente: `products-catalog-migration-temporary` (126), `admin-config-temporary` (63), `sales-customers-finance-temporary` (54), `catalog-taxonomy-temporary` (46), `customer-engagement-temporary` (31), `orders-temporary` (24), `cashback-rpc-temporary` (21), `product-variant-taxonomy-temporary` (18) e `warranty-temporary` (18).

Reducao catalogo/cashback em 2026-05-27:

- `node tmp-tests\cashback-categories-vps-static.test.mjs`: passou.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: passou.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 497`, `.rpc(...) = 31`, `supabase.storage = 13`, `supabase.auth = 48`, `allowedOperationalMatches = 541`, `unclassifiedOperationalMatches = 0`.
- `CashbackPage` agora usa `vpsApiService.getCategories(true)` para popular categorias das promocoes de moedas. O baseline travado do guard caiu para `MAX_BASELINE_FROM_CALLS = 497`.

Reducao catalogo/marketing em 2026-05-27:

- `node tmp-tests\catalog-service-categories-vps-static.test.mjs`: passou.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: passou.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 496`, `.rpc(...) = 31`, `supabase.storage = 13`, `supabase.auth = 48`, `allowedOperationalMatches = 540`, `unclassifiedOperationalMatches = 0`.
- `catalogService.getCategoriesWithNames` agora usa `vpsApiService.getCategories()` para popular selects como o da pagina de Marketing. O baseline travado do guard caiu para `MAX_BASELINE_FROM_CALLS = 496`.

Reducao catalogo/importacao em 2026-05-27:

- `node tmp-tests\data-sync-import-brands-vps-static.test.mjs`: passou.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: passou.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 495`, `.rpc(...) = 31`, `supabase.storage = 13`, `supabase.auth = 48`, `allowedOperationalMatches = 539`, `unclassifiedOperationalMatches = 0`.
- `DataSyncService.syncGoogleSpreadsheet` agora usa `vpsApiService.getBrands()` para validar marcas no upload/sync de planilha. O baseline travado do guard caiu para `MAX_BASELINE_FROM_CALLS = 495`.

Reducao catalogo/secoes em 2026-05-27:

- `node tmp-tests\catalog-sections-category-expansion-vps-static.test.mjs`: passou.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: passou.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 494`, `.rpc(...) = 31`, `supabase.storage = 13`, `supabase.auth = 48`, `allowedOperationalMatches = 538`, `unclassifiedOperationalMatches = 0`.
- `catalogSectionsService` agora usa `vpsApiService.getCategories()` para expandir categorias pai/filhas nas secoes de catalogo. O baseline travado do guard caiu para `MAX_BASELINE_FROM_CALLS = 494`.

Reducao carrinho/garantia em 2026-05-27:

- `node tmp-tests\cart-brand-warranty-vps-static.test.mjs`: passou.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: passou.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 493`, `.rpc(...) = 31`, `supabase.storage = 13`, `supabase.auth = 48`, `allowedOperationalMatches = 537`, `unclassifiedOperationalMatches = 0`.
- `CartPage` agora usa `brandService.listActive()` para obter `warranty_days` de garantias por marca. O baseline travado do guard caiu para `MAX_BASELINE_FROM_CALLS = 493`.

Reducao PDP publica/categoria em 2026-05-27:

- `node tmp-tests\public-product-category-config-vps-static.test.mjs`: falhou primeiro por ainda existir `supabase.from('categories')` na PDP e passou apos a troca.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: passou.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 492`, `.rpc(...) = 31`, `supabase.storage = 13`, `supabase.auth = 48`, `allowedOperationalMatches = 536`, `unclassifiedOperationalMatches = 0`.
- `PublicProductPage` agora usa `vpsApiService.getCategories()` tambem para aplicar `config` da categoria na PDP, removendo o fallback direto em `categories`. O baseline travado do guard caiu para `MAX_BASELINE_FROM_CALLS = 492`.

Reducao formulario produto/margens em 2026-05-27:

- `node tmp-tests\product-pricing-category-margins-vps-static.test.mjs`: falhou primeiro por ainda existir `supabase.from('categories')` no `ProductPricing` e passou apos a troca.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: passou.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 491`, `.rpc(...) = 31`, `supabase.storage = 13`, `supabase.auth = 48`, `allowedOperationalMatches = 535`, `unclassifiedOperationalMatches = 0`.
- `ProductPricing` agora usa `vpsApiService.getCategories()` para carregar `margin_wholesale` e `margin_reseller`. O baseline travado do guard caiu para `MAX_BASELINE_FROM_CALLS = 491`.

Reducao produtos/video em 2026-05-30:

- `node tmp-tests\product-list-video-vps-write-static.test.mjs`: falhou primeiro por `ProductListPage` ainda escrever `video_url` diretamente em `supabase.from('products')` e passou apos a troca para `vpsApiService.updateProduct`.
- `node tmp-tests\product-list-video-vps-read-static.test.mjs`: passou.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: falhou primeiro ao esperar `MAX_BASELINE_FROM_CALLS = 120` enquanto o guard ainda estava em `121` e passou apos travar o novo baseline.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 120`, `.rpc(...) = 24`, `supabase.storage = 0`, `supabase.auth = 39`, `allowedOperationalMatches = 144`, `unclassifiedOperationalMatches = 0`.
- `ProductListPage.handleAutoGenerateVideos` agora le os candidatos pela VPS e grava os links gerados de video pela VPS/MySQL. O import de Supabase saiu da pagina e o baseline travado do guard caiu para `MAX_BASELINE_FROM_CALLS = 120`.

Reducao banco de imagens/produtos em 2026-05-30:

- `node tmp-tests\product-image-bank-vps-only-static.test.mjs`: falhou primeiro porque `ProductImageBankPage` ainda importava Supabase e fazia fallback obrigatorio de `products.images`; passou apos remover as escritas diretas.
- `node tmp-tests\product-image-bank-direct-upload-static.test.mjs`: passou.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: falhou primeiro ao esperar `MAX_BASELINE_FROM_CALLS = 116` enquanto o guard ainda estava em `120` e passou apos travar o novo baseline.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 116`, `.rpc(...) = 24`, `supabase.storage = 0`, `supabase.auth = 39`, `allowedOperationalMatches = 140`, `unclassifiedOperationalMatches = 0`.
- `ProductImageBankPage` agora persiste upload direto, upload inline, exclusao e sincronizacao manual de imagens de produto pela VPS/MySQL. A dependencia direta em `products` caiu de `19` para `15`, e os arquivos com `.from(...)` cairam de `29` para `28`.

Reducao card de produto/status e estoque em 2026-05-30:

- `node tmp-tests\product-card-status-stock-vps-static.test.mjs`: falhou primeiro porque `ProductCard` ainda atualizava `status` e `stock_quantity` em `supabase.from('products')`; passou apos migrar as duas escritas para `vpsApiService.updateProduct` com merge do produto atual.
- `node tmp-tests\product-card-image-gallery-static.test.mjs`: passou.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: falhou primeiro ao esperar `MAX_BASELINE_FROM_CALLS = 114` enquanto o guard ainda estava em `116` e passou apos travar o novo baseline.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 114`, `.rpc(...) = 24`, `supabase.storage = 0`, `supabase.auth = 39`, `allowedOperationalMatches = 138`, `unclassifiedOperationalMatches = 0`.
- `ProductCard` agora alterna status e sincroniza estoque do Bling pela VPS/MySQL. A dependencia direta em `products` caiu de `15` para `13`.

Correcao enderecamento de estoque sem local em 2026-05-30:

- `node tmp-tests\stock-location-incoming-conference-static.test.mjs`: falhou primeiro porque a VPS ainda nao criava o local operacional de entrada/conferencia e passou apos a implementacao.
- `node tmp-tests\vps-stock-location-contract-static.test.mjs`: passou.
- `node tmp-tests\stock-location-batch-transfer-static.test.mjs`: passou.
- `npm.cmd run build`: passou fora do sandbox; o build manteve apenas os avisos ja conhecidos de chunk/import dinamico.
- A VPS agora cria e mantem `Deposito / Entrada-Conferencia` (`DEPOSITO` + `ENTRADA-CONFERENCIA`) para saldos recebidos de integracoes e saldos ja existentes sem local definido.
- `reconcileProductStockLocationsToTotal` passou a gravar deltas positivos de estoque externo em `Deposito / Entrada-Conferencia`, em vez de colocar automaticamente na `Loja Principal / Estoque Geral`.
- A consulta de distribuicao de estoque materializa qualquer diferenca entre `products.stock_quantity` e `product_stock_locations` nesse local de entrada, permitindo que a tela de transferencia em lote movimente o item normalmente apos abrir/recarregar o produto.
- Regra operacional definida: os itens que vao entrando ficam primeiro em `Deposito / Entrada-Conferencia`; depois o operador transfere para `Loja Principal`, caixa ou outro local fisico conforme a conferencia.

Reducao paginacao de modelos em 2026-05-30:

- `npx.cmd tsx tmp-tests\model-pagination.test.ts`: falhou primeiro porque `modelPagination` ainda esperava cliente Supabase com `.from('models')` e passou apos trocar para leitura via cliente VPS.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: falhou primeiro ao esperar `MAX_BASELINE_FROM_CALLS = 113` enquanto o guard ainda estava em `114` e passou apos travar o novo baseline.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 113`, `.rpc(...) = 24`, `supabase.storage = 0`, `supabase.auth = 39`, `allowedOperationalMatches = 137`, `unclassifiedOperationalMatches = 0`.
- `modelPagination.fetchAllModelRows` agora consulta `/models?company_id=...` na VPS, com filtro opcional de `brand_id`, e nao depende mais de pagina Supabase no frontend.

Reducao limpeza Shopee no card de produto em 2026-05-30:

- `node tmp-tests\product-card-status-stock-vps-static.test.mjs`: falhou primeiro porque `clearStaleShopeeLink` ainda limpava `products.shopee_item_id` com `supabase.from('products').update(...)` e passou apos migrar a escrita para `vpsApiService.updateProduct`.
- `node tmp-tests\supabase-operational-dependency-guard-static.test.mjs`: falhou primeiro ao esperar `MAX_BASELINE_FROM_CALLS = 112` enquanto o guard ainda estava em `113` e passou apos travar o novo baseline.
- `node tools\audit-supabase-operational-dependencies.mjs`: `ok=true`, `.from(...) = 112`, `.rpc(...) = 24`, `supabase.storage = 0`, `supabase.auth = 39`, `allowedOperationalMatches = 136`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: passou fora do sandbox; permanecem apenas os avisos conhecidos de chunk/import dinamico.
- `ProductCard.clearStaleShopeeLink` ainda remove o vinculo em `shopee_products` pelo fluxo legado, mas a escrita em `products` agora passa pela VPS/MySQL.

Correcao refresh token Bling em busca de produtos em 2026-05-30:

- `node tmp-tests\bling-search-invalid-token-refresh-static.test.mjs`: falhou primeiro porque `searchBlingProducts` reutilizava o access token salvo mesmo quando o proxy retornava `invalid_token`; passou apos adicionar deteccao centralizada de falha de autenticacao e retry com `getValidToken({ forceRefresh: true })`.
- `node tools\audit-supabase-operational-dependencies.mjs`: passou com `ok=true`, `.from(...) = 112`, `.rpc(...) = 24`, `supabase.storage = 0`, `supabase.auth = 39`, `allowedOperationalMatches = 136`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: passou fora do sandbox; permanecem apenas os avisos conhecidos de chunk/import dinamico.
- Publicacao Vercel feita por engano foi revertida em 2026-05-30: aliases voltaram para o deploy anterior `mercado-do-vale-a7flpqse9...` e os deploys `ph8ckbohb`/`ctphx5dyd` foram removidos.
- A busca de produtos no Bling agora tenta renovar o token uma vez quando o Bling responde 401/`invalid_token`, cobrindo casos em que o token salvo ainda parecia valido pela data de expiracao, mas foi invalidado pelo Bling.

Debug copiavel para erro de busca Bling em 2026-05-30:

- `node tmp-tests\bling-products-copy-debug-static.test.mjs`: falhou primeiro porque a tela de produtos do Bling nao mantinha um payload copiavel do ultimo erro; passou apos adicionar estado, formatador JSON e painel com botao `Copiar debug`.
- `node tmp-tests\bling-search-invalid-token-refresh-static.test.mjs`: passou, preservando o retry de token invalido.
- `node tmp-tests\stock-location-incoming-conference-static.test.mjs`: passou, preservando a entrada de saldo externo em `Deposito / Entrada-Conferencia`.
- `node tools\audit-supabase-operational-dependencies.mjs`: passou com `ok=true`, `.from(...) = 112`, `.rpc(...) = 24`, `supabase.storage = 0`, `supabase.auth = 39`, `allowedOperationalMatches = 136`, `unclassifiedOperationalMatches = 0`.
- `npm.cmd run build`: passou fora do sandbox; permanecem apenas os avisos conhecidos de chunk/import dinamico.
- `npm.cmd run deploy:vps-site`: passou; site publicado na VPS em `/var/www/mdv-site/releases/20260530-221417` e servido pelo Nginx via `/var/www/mdv-site/current`.
- Validacao remota: `https://mercadodovale.com.br/admin/settings/bling` aponta para `/assets/index-GhnLk9at.js`; o chunk `BlingPage-DORQ_DgI.js` contem `Copiar debug`, `Debug busca produtos Bling` e `bling-products-fetch`.
- Quando a busca de produtos do Bling falhar, a aba Produtos agora mostra um painel vermelho com `Copiar debug` e um textarea contendo URL, user agent, termo pesquisado, fase/contagem da busca, tokenExpiresAt e `error.message/stack` completos.

### Bloco 2 - Produtos e Catalogo Leitura

Objetivo: garantir que listagem, busca, pagina publica e SEO leiam prioritariamente da VPS/MySQL.

- [ ] Auditar chamadas a `products`, `models`, `brands`, `categories`, `custom_fields` e `model_color_images`.
- [ ] Trocar chamadas diretas em componentes por services/adaptadores VPS quando endpoint ja existir.
- [ ] Criar endpoints VPS faltantes apenas quando a tela precisar.
- [ ] Manter fallback Supabase temporario somente com comentario e teste de remocao futura.
- [ ] Validar admin produtos, pagina publica, catalogo e sitemap.

### Bloco 3 - Configuracoes Base

Objetivo: remover leitura direta de configuracoes operacionais no frontend.

- [ ] Auditar `company_settings`, `companies`, `catalog_settings`, `catalog_banners` e `user_permissions`.
- [ ] Centralizar leitura em endpoints VPS protegidos quando admin e publicos quando catalogo.
- [ ] Validar temas, banners, SEO, permissoes e configuracoes da empresa.

## Validacao por Modulo

Cada modulo migrado deve registrar:

```text
Modulo:
Origem Supabase:
Destino VPS/MySQL/Synology:
Endpoints afetados:
Tabelas afetadas:
Arquivos afetados:
Dados migrados:
Contagem antes:
Contagem depois:
Teste executado:
Resultado:
Rollback:
Pendencias:
```

## Criterio de Pronto

A migracao Supabase sera considerada concluida quando:

- nenhuma tela operacional depender de `supabase.from(...)`;
- nenhum arquivo grande depender de Supabase Storage;
- o frontend usar Supabase somente para login/sessao;
- a VPS validar permissoes e executar regras de negocio;
- MySQL for a fonte principal dos dados operacionais;
- Synology for a fonte principal de fotos, videos e arquivos grandes;
- houver testes impedindo retorno acidental de fluxos operacionais ao Supabase.

## Riscos

- migrar dados sem contagem antes/depois pode gerar perda silenciosa;
- manter escrita duplicada Supabase/VPS por muito tempo pode causar divergencia;
- remover fallback antes da validacao real pode quebrar admin, PDV ou catalogo;
- imagens/videos sem auditoria podem gerar produto sem midia;
- auth precisa continuar funcionando durante toda a transicao.

## Regras de Seguranca

- nao commitar secrets;
- nao imprimir tokens;
- nao colocar service role no frontend;
- nao apagar tabelas Supabase sem backup e aprovacao explicita;
- nao remover fallback sem teste de leitura e escrita no destino novo;
- nao versionar fotos, videos ou arquivos grandes.
