# Migracao Supabase

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
