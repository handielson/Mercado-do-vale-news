# Fila de correções — revisão de catálogo e PDV

Revisão em 07/10/2026. Não é auditoria integral. As consultas de produção foram somente leituras, sem exibir valores privados.

| # | Prioridade | Problema | Estado |
|---|---|---|---|
| 1 | Alta | API pública expõe custo e preços comerciais sem autenticação | Publicado e validado — v1.2.572-protecao-precos |
| 2 | Alta | Filtros `in_ids` e `min_price` das seções ignorados pela API | Publicado — v1.2.573-filtros-venda-imei |
| 3 | Alta | Venda e baixa de IMEIs não são uma operação atômica | Publicado — v1.2.573-filtros-venda-imei |
| 4 | Alta | Confirmação de WhatsApp iniciada antes da baixa dos aparelhos | Publicado — v1.2.574-whatsapp-pos-estoque |
| 5 | Média | Categoria filtrada após buscar amostra limitada de produtos | Corrigido e testado localmente; publicação pendente |
| 6 | Média | Recentes, novidades e mais vendidos não agrupam famílias | Corrigido e testado localmente; publicação pendente |
| 7 | Média | Reordenação das seções com gravações independentes | Pendente |
| 8 | Média | Fallback de produtos em cache sem conferir validade | Pendente |

## Item 1 — proteção de preços na resposta

Fonte dos valores: MySQL, sem alteração de preço ou estoque. Fonte da autorização: sessão Bearer validada pela API e tipo atual do cliente no banco. Parâmetros do navegador não concedem acesso.

- Visitante e cliente de varejo: preço de varejo/promoção; sem custo, revenda ou atacado.
- Conta comercial autenticada (`resale`, `reseller`, `wholesale`): preços comerciais; sem custo.
- Administrador autenticado: preserva os campos operacionais. Chave de transporte/proxy, mesmo válida, não libera custo nas rotas públicas; integrações internas mantêm suas rotas protegidas de operação.
- Proteção central em `services/productReadPrivacy.cjs`, montada nos três entrypoints, para listagem, ID, slug, EAN, categoria, IDs, combos e ofertas públicas por site.
- Respostas de produtos não podem entrar em cache compartilhado. Frontend não armazena respostas autenticadas no cache anônimo nem no localStorage do catálogo; namespaces antigos não são reutilizados.
- Publicação autorizada pelo usuário via publish-vps e concluída na versão v1.2.572-protecao-precos. API direta e proxy: lista, ID e slug sem campos privados e com no-store. Login administrativo real conserva custo e preços comerciais. Demais perfis cobertos nos testes HTTP com dados sintéticos.

Testes: `node --test tmp-tests/product-read-privacy.test.cjs`. Exercitam HTTP Fastify com dados sintéticos, visitante, token inválido, varejo, comercial, administrador, chave interna, custos aninhados, datas e troca de sessão no cache. Não acessam banco/WhatsApp real.

Validação local: cinco testes de privacidade e 17 testes de rotas de ofertas passaram, além das regressões de configuração pública de seções, responsável no CRUD, categorias, normalização de tipos de conta, nome público e preço da variação. Teste do deploy seletivo e regressão de baixa por local do PDV passaram. Sintaxe dos três entrypoints e módulo validada. Build de produção e trava contra runtime Supabase passaram. Produção: mysql.ok=true, home HTTP 200, VERSION correspondente e navegador com catálogo/ficha administrativa sem erros de console. Nenhum preço ou estoque alterado.

## Item 2 — filtros de produtos na consulta

Fonte de verdade: campos `products.id` e `products.price_retail` no MySQL. Consumidor: `catalogSectionsService.getProductsForSection`, que envia `in_ids`, `min_price` e `max_price` à rota `/products`. Valores são inteiros em centavos, conforme contrato interno; R$ 19,90 é `1990`. Não se usa o campo legado `price` nem se altera valor cadastrado.

Os três entrypoints agora aplicam IDs e limites inclusivos de preço antes de ORDER BY, LIMIT e OFFSET, com parâmetros SQL. IDs são deduplicados; uma lista vazia retorna vazia, sem ampliar a consulta. Limites inválidos, negativos, fracionários, não finitos ou invertidos retornam HTTP 400 antes de consultar o banco. Mantidos filtros existentes de status, pais, categoria e pesquisa. Produtos fixados continuam seguindo a ordem definida no consumidor; limites de preço da busca dinâmica não mudam a regra existente de produtos fixados.

## Item 3 — venda e baixa de unidades no mesmo commit

Fonte: MySQL, tabelas sales, sale_items, units, products e product_stock_locations. Nova operação autenticada POST /sales/finalize-serialized nos três entrypoints utiliza services/serializedSaleFinalization.cjs. O PDV envia venda e itens juntos quando há uma unidade serializada. A transação trava produtos/unidades em ordem estável, confere vínculo com o SKU, disponibilidade e quantidade unitária, grava venda/itens, marca todos os aparelhos vendidos e recalcula seus saldos na mesma conexão. Falha desfaz o conjunto. Reenvio idêntico com mesmo ID de venda não duplica itens ou baixa; ID com dados divergentes é rejeitado.

services/saleService.ts não faz mais baixas/liberações individuais após gravar venda. Retorno de erro da operação impede seguir para notificações e demais etapas. Cashback e avisos de venda da nova rota começam após commit. A confirmação WhatsApp das vendas com IMEI passa a começar depois da baixa destes aparelhos. Item 4 permanece pendente para garantir ordenação em relação a produtos sem IMEI: a baixa numérica em vendas mistas e o fluxo de venda sem unidades seguem o contrato anterior, com falhas registradas para conferência. Não foram alterados cálculo de preço, pagamento externo, cancelamento, Bling ou mensagens.

Testes sintéticos em tmp-tests/serialized-sale-transaction.test.cjs cobrem commit, repetição, falha no segundo item, segundo aparelho e saldo, concorrência simulada, unidade oculta, SKU incorreto, duplicidade e quantidade inválida, uso da conexão transacional no saldo, cliente real rejeitando a operação e rotas HTTP sem notificações antes do commit. Regressões de finalização serializada, baixa por local, log e termo WhatsApp passaram; build e sintaxe passaram. Teste legado sale-stock-restore-by-location-static.test.mjs indisponível: depende de supabase/migrations/20260509000001_multi_deposit_stock.sql, removida anteriormente. Não se restaura Supabase para executá-lo. Não houve teste mutante em MySQL real nem publicação. Itens 2 e 3 e quatro arquivos Shopee preexistentes preservados no Git; sem commit/push/deploy nesta etapa.

Teste `node --test tmp-tests/products-section-filters.test.cjs` executa o handler real de cada entrypoint via HTTP Fastify, com banco simulado: IDs ausentes, duplicados, combinação de filtros, limites exatos em centavos, zero, paginação após filtro, status/pais e entrada maliciosa vinculada como parâmetro. Confere também a proteção de custo do item 1. Três testes HTTP passaram junto com os cinco testes de privacidade, regressões de busca e normalização monetária. Sintaxe dos entrypoints validada. Publicação deste item ainda não solicitada; produção não alterada nesta etapa. Quatro arquivos preexistentes Shopee preservados.

Itens 2 e 3 publicados em v1.2.573-filtros-venda-imei (b2388b28). API e site validados, filtros por ambos os transportes e PDV sem erros. Transacoes verificadas com falhas/concorrrencia sinteticas; em producao apenas leitura e rejeicao de corpo vazio, sem venda real.

## Item 4 — confirmacao WhatsApp depois da baixa local

Publicado em v1.2.574-whatsapp-pos-estoque (65fd2f17). Site e PDV validados; sem venda, baixa ou envio real no teste. A fonte dos saldos continua sendo o MySQL; services/saleService.ts coordena a persistencia dos itens e a baixa por prioridade nos depositos. A chamada de confirmacao WhatsApp so inicia depois destas etapas. Falha de itens ou baixa bloqueia a chamada, preserva needs_review e registra inventory_not_finalized no log. Falha no envio apos baixa bem-sucedida permanece aviso, sem repetir estoque. O PDV tambem bloqueia o envio automatico do termo de garantia quando a venda retorna needs_review, evitando mensagem parcial em carrinho misto. Fluxos de entrega e envio manual seguem os contratos existentes.

Protecao: tmp-tests/pdv-whatsapp-inventory-sequencing.test.cjs executa o service real com transporte simulado: baixa pendente, venda numerica/mista, falha na baixa, falha na persistencia, erro de WhatsApp, venda so com unidade serializada e produto sem controle de estoque. Nenhum envio, venda ou estoque real durante a validacao.

## Item 5 — categoria antes da amostra limitada

Em 08/10/2026, services/catalogSectionsService.ts passou a enviar category com os IDs selecionados e suas subcategorias diretas antes da consulta de produtos. Fonte da hierarquia: vpsApiService.getCategories, cadastro categories da VPS/MySQL. A rota /products ja aceita IDs separados por virgula e aplica category_id no SQL antes de LIMIT/OFFSET; nenhum ajuste de API necessario. Removido filtro tardio no navegador. Mantidas regras globais de visibilidade, ordenacao e prioridade dos produtos fixados. Cache de produtos das secoes atualizado para v8 para nao reutilizar amostras incompletas anteriores.

Teste existente de expansao ampliado para executar o service real com 300 produtos fora da categoria antes dos desejados. Confere categorias selecionadas, filhos, pins e secao sem filtro. Testes HTTP dos tres entrypoints ampliados para categoria simples/multipla, paginacao e combinacao de preco. Privacidade, configuracao publica e build aprovados. Sem publicacao ou alteracao de dados reais nesta etapa.

## Item 6 — familias nas secoes da homepage

Em 08/10/2026, CatalogSectionComponent passou a usar groupProductsByVariants em todas as secoes, removendo a excecao para recent/new/bestsellers. Fonte da identidade: productGroupingCore, com parent_id e parent_name quando existe pai cadastrado, e os fallbacks existentes para produtos independentes. Mantido agrupador canonico, sem nova regra de nome ou alteracao de cadastros. Cada familia ocupa um card e mantem as memorias, cores e precos das variacoes disponiveis retornadas pela consulta. Limite de cards aplicado depois de agrupar; ordem das familias segue a primeira variacao na ordenacao recebida. Busca usa a mesma amostra das demais secoes agrupadas, ate 200 produtos; nao e uma consulta ilimitada de todos os filhos do catalogo.

Protecao em tmp-tests/catalog-sections-family-grouping.test.mjs executa o agrupador real e o calculo de cards da secao. Valida os tres tipos, limite de familias, produtos independentes, nome do pai, memorias, cores, precos individuais e exclusao de inativos/sem estoque. Regressoes de categoria do item 5, nome de familia, modelos genericos, carregamento e build passaram. Itens 5 e 6 aguardam publicacao. Nenhum dado real alterado.
