# Fila de correções — revisão de catálogo e PDV

Revisão em 07/10/2026. Não é auditoria integral. As consultas de produção foram somente leituras, sem exibir valores privados.

| # | Prioridade | Problema | Estado |
|---|---|---|---|
| 1 | Alta | API pública expõe custo e preços comerciais sem autenticação | Publicado e validado — v1.2.572-protecao-precos |
| 2 | Alta | Filtros `in_ids` e `min_price` das seções ignorados pela API | Publicado — v1.2.573-filtros-venda-imei |
| 3 | Alta | Venda e baixa de IMEIs não são uma operação atômica | Publicado — v1.2.573-filtros-venda-imei |
| 4 | Alta | Confirmação de WhatsApp iniciada antes da baixa dos aparelhos | Publicado — v1.2.574-whatsapp-pos-estoque |
| 5 | Média | Categoria filtrada após buscar amostra limitada de produtos | Publicado — v1.2.575-secoes-categorias-familias |
| 6 | Média | Recentes, novidades e mais vendidos não agrupam famílias | Publicado — v1.2.575-secoes-categorias-familias |
| 7 | Média | Reordenação das seções com gravações independentes | Publicado — v1.2.576-secoes-ordem-cache |
| 8 | Média | Fallback de produtos em cache sem conferir validade | Publicado — v1.2.576-secoes-ordem-cache |

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

Protecao em tmp-tests/catalog-sections-family-grouping.test.mjs executa o agrupador real e o calculo de cards da secao. Valida os tres tipos, limite de familias, produtos independentes, nome do pai, memorias, cores, precos individuais e exclusao de inativos/sem estoque. Regressoes de categoria do item 5, nome de familia, modelos genericos, carregamento e build passaram. Itens 5 e 6 publicados em v1.2.575-secoes-categorias-familias (07f699af), com homepage validada sem erros de console. Nenhum dado real alterado.

## Item 7 — ordem completa das secoes em uma transacao

Em 08/10/2026, a fonte da ordem continua sendo catalog_sections.display_order no MySQL. O service envia uma unica chamada POST /catalog/sections/reorder. Os tres entrypoints protegem a rota com requireSyncKeyOrAdmin, bloqueiam as linhas em ordem de ID (FOR UPDATE), conferem o conjunto completo de IDs e atualizam todos os display_order na mesma conexao/transacao. Falha desfaz as atualizacoes. IDs duplicados ou invalidos retornam 400; lista alterada por criacao/exclusao retorna 409 antes de escrever. A ordenacao continua global, como getSections sem userId e a vitrine existentes; nenhum escopo novo por usuario.

SectionsTab bloqueia cliques de reordenacao simultaneos, restaura a lista anterior e avisa/recarrega quando o salvamento falha. Cache so e invalidado depois do sucesso. O helper de deploy seletivo aceita ampliar a versao anterior conhecida do bloco de secoes, preservando outras alteracoes remotas e rejeitando blocos divergentes.

Cinco testes em tmp-tests/catalog-sections-reorder.test.cjs executam os handlers reais via Fastify com transacoes simuladas e os metodos reais do service/painel: falhas em cada posicao, rollback, commit, liberacao da conexao, validacao de IDs, controle de acesso, chamada unica, cache e cliques concorrentes. Regressoes de configuracao publica, deploy seletivo, CRUD, categorias e familias passaram, assim como sintaxe dos tres entrypoints e build. Publicacao pendente; nenhum dado real ou ordem de producao alterados. Arquivos preexistentes Shopee preservados.

## Item 8 — validade do cache de produtos e aviso de falha

Em 08/10/2026, services/catalogSectionsService.ts centralizou a leitura do cache de produtos das secoes: carregamento normal e fallback passam pelo mesmo limite existente de cinco minutos, sem renovar timestamp ao reutilizar dados. Arrays invalidos, timestamp ausente/nao numerico/nao finito, data futura e idade igual ou maior ao limite sao rejeitados. Cache persistente continua restrito ao visitante sem token; leitores autenticados nao reutilizam precos publicos. Fonte de precos/estoque permanece /products da VPS/MySQL; localStorage e apenas uma copia temporaria.

Sem cache valido, a falha e propagada para CatalogSectionComponent em vez de retornar [] e ocultar silenciosamente a secao. A tela limpa produtos anteriores, mostra aviso e botao Tentar novamente, que consulta a API ignorando o cache inicial. Se essa consulta falha mas ainda existe cache valido, exibe os dados com aviso de que precos/disponibilidade podem ter mudado. Sucesso limpa o aviso; uma consulta bem-sucedida sem produtos continua ocultando a secao vazia. Resultados de requisicoes anteriores nao substituem o estado atual apos troca de usuario/secao ou nova tentativa.

Quatro testes em tmp-tests/catalog-sections-cache-validity.test.cjs executam o service real com relogio/localStorage/transporte simulados e o carregamento real do componente: limite exato, cache invalido/futuro, nao renovacao da idade, isolamento autenticado, renovacao apos sucesso, aviso de fallback, limpeza de dados/avisos e resultado cancelado. Junto com categoria, familias, carregamento e item 7, passaram 12 testes e o build com verificacao de ausencia de Supabase no runtime. Publicacao pendente; nenhum preco, estoque ou dado de producao alterado.

Itens 7 e 8 publicados em v1.2.576-secoes-ordem-cache (aee295dc), API seletiva e site validados. Quinze testes passaram; teste publico somente leitura/rejeicao de corpo invalido, sem alterar a ordem real. Main sincronizada e arquivos Shopee preexistentes preservados.

## Segunda revisao — 08/10/2026

Nova fila identificada por execucao do codigo real com dependencias simuladas, sem mutacoes externas:

1. Devolucao de estoque parcial bloqueava nova tentativa ao encontrar qualquer movimento de cancelamento. Corrigido localmente; publicacao pendente.
2. Criacao de venda ainda chama sincronizacao Bling quando a baixa local falha. Pendente.
3. Persistencia da venda numerica e dos seus itens permanece separada. Pendente.
4. Cache do catalogService principal pode reutilizar dados antigos sem limite de idade. Pendente; correcao anterior foi das secoes.
5. Publico-alvo do banner e removido antes da API e nao persistido nela. Pendente.
6. Reordenacao de banners grava linhas separadamente e pode deixar ordem parcial. Pendente.

### Item 1 — devolucao atomica por movimentos

Fonte da devolucao: stock_location_movements na VPS/MySQL, com destinos derivados dos locais da baixa original. services/stockMovementRestoration.cjs centraliza a regra consumida pelos tres entrypoints. A transacao bloqueia a venda/pedido e os produtos, compara quantidades ja devolvidas por produto/local e grava somente o restante. Saldos, movimentos e totais dos produtos usam a mesma conexao; qualquer falha desfaz o conjunto. Repeticao concluida nao grava de novo. Uma devolucao antiga parcial pode ser retomada explicitamente, sem recomecar as quantidades ja registradas. Historico contraditorio bloqueia a operacao para conferencia. Nao foi executada recuperacao automatica de dados reais.

saleService.ts envia ao Bling apenas a quantidade devolvida nesta tentativa, distribuida pelas linhas da venda; aparelhos liberados sao contados por unidade efetivamente devolvida. Chamadas externas, status da venda e liberacao de aparelhos continuam fora da transacao dos movimentos numericos. Esta correcao nao implementa entrega duravel de sincronizacoes externas.

Validacao: 16 testes do escritor transacional, quatro testes comportamentais do consumidor e quatro regressoes existentes, totalizando 24 aprovados. Inclui falhas em saldos, movimentos, totais e commit, rollback/repeticao, concorrencia simulada, historico parcial e quantidade enviada ao Bling. Build, sintaxe dos entrypoints/modulo/deployer e git diff --check aprovados. Dois testes legados de devolucao por local nao executaram por dependerem de supabase/migrations/20260509000001_multi_deposit_stock.sql, anteriormente removida; nao se reintroduziu Supabase. Nao houve teste mutante em MySQL real, envio ao Bling, commit, push ou publicacao. Alteracoes Shopee preexistentes preservadas.

### Correcao adicional — conflito de familia no pre-cadastro Poco X8 Pro

Leitura da API em 08/10/2026 confirmou pre-cadastro 848e8a38-6d7e-494a-893b-b9ca040cca3b pendente (Branco, 8GB/256GB), modelo 438dc426-f126-4577-984b-1fab0d4c616c. Filhos apontam para PX8PRO-PAI, cujo company_id esta nulo. A consulta companies retorna tabela inexistente; o resolvedor de empresa default portanto nao fornece fallback. Ha tambem pais importados PX85G8256 e PX85G12512 no mesmo modelo. Fonte comercial: products.parent_id; bling_parent_id e referencia externa, nao outra autoridade para escolher pai local.

smartphoneModelFamily.cjs agora aceita recuperar empresa do pai legado ja vinculado somente apos bloquear e conferir todos os seus filhos (mesmo modelo e empresa). Reutiliza o unico pai apontado pelos filhos; ignora candidatos importados referenciados por bling_parent_id apenas quando eles nao possuem filhos locais. Preserva pais concorrentes sem prova de referencia Bling como conflito. Nao move filhos com pai existente, nao exclui pais importados e nao modifica identificadores Bling. Empresa do pai e gravada dentro da transacao da finalizacao, sem alterar custos/precos/estoque nesta regra. Dry-run nao grava nada.

Quinze testes de familia e cinco verificacoes existentes de cadastro por foto passaram, incluindo legado sem empresa/default, referencias externas, bloqueios multiempresa/modelo/pai e consulta sem escrita. Sintaxe e diff aprovados. Correcao local pendente de publicacao; pre-cadastro nao finalizado nesta etapa e nenhum cadastro/estoque real alterado. Correcao de devolucao do item 1 e arquivos Shopee preexistentes preservados.
