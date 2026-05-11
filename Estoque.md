# Estoque

Documento vivo para pesquisa estrutural, desenho tecnico, diario de producao e checklist da evolucao do sistema de estoque multi-depositos do Mercado do Vale.

Atualizado em: 11/05/2026

## Status Atual Da Implementacao

Ponto atual: fundacao multi-depositos criada, com entrada, ajuste, transferencia, baixa PDV por prioridade, devolucao PDV por local, reserva de pedido online por prioridade, baixa de pedido online por reserva/local e cancelamento/liberacao de pedido online por local ja implementadas em modo compativel. Bling, VPS, Shopee e catalogo publico foram conferidos para continuar usando estoque total, sem depender das novas tabelas internas.

### Retrato Atual Do Sistema

Estado operacional em 11/05/2026:

- O estoque total antigo `products.stock_quantity` continua existindo e segue sendo o numero principal para catalogo, Bling, Shopee e compatibilidade geral.
- A estrutura nova distribui esse total em `stock_deposits`, `stock_locations` e `product_stock_locations`.
- O backfill inicial joga o saldo atual para `Loja Principal / Estoque Geral`.
- A tela `/admin/inventory/locations` ja permite pesquisar produto, ver distribuicao por local, consultar divergencias e historico.
- A mesma tela ja permite `Entrada de estoque`, `Ajustar saldo` e `Transferir estoque`, sempre com motivo obrigatorio e registro em `stock_location_movements`.
- O PDV, para produtos manuais nao serializados, ja tenta baixar por prioridade: primeiro `Loja Principal`, depois outros depositos ativos.
- Se a migration nova ainda nao estiver aplicada, o PDV cai para o fluxo legado `decrement_stock`, preservando funcionamento do caixa.
- Cancelamento, estorno e delete de venda PDV ja tentam devolver estoque aos mesmos locais consumidos pela venda, usando o historico `sale` em `stock_location_movements`.
- Se a venda for antiga ou nao houver historico por local, a devolucao cai para o fluxo legado `increment_stock`.
- Produtos serializados continuam baixando pelo fluxo de unidades/IMEI no VPS; os campos de local fisico existem como preparacao.
- A lista de impressao por caixa/lote e apenas conferencia: nao reserva, nao baixa e nao movimenta estoque.
- O pedido online ja tenta reservar estoque na criacao por prioridade: primeiro `Loja Principal`, depois outros depositos ativos.
- Quando o pedido online e pago ou concluido no pagamento na entrega, a baixa numerica tenta consumir a reserva existente; se nao houver reserva, cai para baixa por prioridade com fallback legado para `decrement_stock`.
- Cancelamento/liberacao de pedido online por local ja tenta liberar reserva pendente ou devolver aos mesmos locais consumidos pela baixa do pedido, usando o historico `order_reservation`/`order` em `stock_location_movements`.
- Se o pedido foi baixado antes da migration ou nao houver historico por local, o cancelamento cai para o fluxo legado `increment_stock`.
- A migration Supabase ainda precisa ser executada/validada em ambiente real antes de depender dela em producao.

Ja esta pronto:

- Documento estrutural e checklist de producao.
- Migration Supabase aditiva para depositos, locais internos, saldo por local e historico de movimentacoes.
- Deposito/local padrao para migrar estoque atual para `Loja Principal / Estoque Geral`.
- View de divergencias entre `products.stock_quantity` e a soma por locais.
- Funcao de recalculo do estoque total a partir dos locais.
- Types e service de leitura para depositos, locais, distribuicao por produto e divergencias.
- Service de movimentacoes com listagem filtrada e registro de log auditavel.
- Tela admin `/admin/inventory/locations` para conferencia de depositos, locais, estoque por produto, divergencias e historico.
- Entrada operacional de estoque por deposito/local, com motivo obrigatorio e historico.
- Funcao SQL `add_product_stock_location` para entrada transacional, somando saldo e recalculando o total do produto.
- Modal de ajuste manual de saldo na tela de locais, com motivo obrigatorio.
- Funcao SQL `adjust_product_stock_location` para ajuste transacional com trava da linha, validacao e historico.
- Modal de transferencia entre locais, com validacao de saldo disponivel e motivo obrigatorio.
- Funcao SQL `transfer_product_stock_location` para transferencia transacional com trava da origem/destino e historico.
- Funcao SQL `decrement_product_stock_by_priority` para baixa transacional por prioridade, validando saldo total antes de alterar locais.
- Types e service `decrementStockByPriority` preparados para chamar a baixa por prioridade.
- PDV conectado a baixa por prioridade para produtos manuais nao serializados, com fallback temporario para `decrement_stock` enquanto a migration nao estiver aplicada.
- Cancelamento, estorno e delete de venda PDV conectados a devolucao por local, com fallback temporario para `increment_stock` quando nao houver historico local.
- Reserva de pedido online por prioridade conectada na criacao do pedido, sem alterar o estoque total publicado.
- Pedido online pago/concluido conectado a baixa por prioridade para produtos numericos, com fallback temporario para `decrement_stock` enquanto a migration nao estiver aplicada.
- Cancelamento/liberacao de pedido online por local conectado para pedidos que ja baixaram estoque numerico, com fallback temporario para `increment_stock`.
- Distribuicao por deposito/local exibida na tela individual do produto.
- Atalho de locais de estoque na listagem de produtos, abrindo a tela de locais com busca preenchida.
- Atalho `Locais de Estoque` no menu operacional.
- Tela admin `/admin/inventory/print-list` para montar lista avulsa de caixa/separacao por EAN, SKU ou nome.
- Impressao simples com `Nome | Variacao | SKU | Codigo de barras EAN | Quantidade`, caixa/lote, data e responsavel.
- Campos opcionais `deposit_id` e `location_id` nas unidades serializadas do VPS.
- Migration automatica no VPS para adicionar colunas e indices em `units`.
- Preservado `syncProductStock(productId)` no VPS contando unidades disponiveis sem filtrar deposito/local.
- Guarda estatica garantindo que Bling, VPS, catalogo e Shopee continuam usando `products.stock_quantity` como estoque total.
- Guarda estatica garantindo que a validacao de divergencia compara `products.stock_quantity` com a soma de `product_stock_locations`.
- RPCs de estoque por local mantendo execucao sob RLS, sem `SECURITY DEFINER`.

Ainda nao foi ativado:

- Deploy/execucao da migration em producao.

Regra de seguranca atual:

- A tela e os services podem consultar estrutura e historico.
- As escritas operacionais liberadas neste ponto sao entrada, ajuste manual e transferencia controladas por RPC, com motivo obrigatorio e log em `stock_location_movements`.
- A baixa por prioridade ja foi conectada ao PDV para produtos manuais nao serializados e ao pedido online quando pago/concluido.
- A devolucao por local ja foi conectada ao cancelamento, estorno e exclusao de venda PDV, com fallback legado para vendas sem historico local.
- A reserva por local ja foi conectada a criacao de pedido online; pagamento consome a reserva e cancelamento pendente libera a reserva.
- A devolucao por local ja foi conectada ao cancelamento de pedido online que ja tinha baixado estoque numerico, com fallback legado para pedidos sem historico local.
- Nenhuma rotina atual de catalogo, Bling, Shopee ou VPS passou a depender das novas tabelas.
- Produtos serializados podem receber local fisico opcional, mas a baixa continua respeitando o status da unidade como antes.

Proxima etapa recomendada:

- Testar a migration em ambiente local/staging e validar entrada, ajuste, transferencia, baixa PDV por prioridade e devolucao PDV por local com dados reais.
- Depois da validacao, aplicar a migration em producao e acompanhar as primeiras entradas, baixas e devolucoes pelo historico.

## Progresso Registrado Em 09/05/2026

### Avanco Principal

O ciclo basico do estoque multi-depositos para PDV foi fechado em modo compativel:

- Entrada operacional soma saldo no deposito/local escolhido.
- Ajuste manual corrige saldo por local com motivo obrigatorio.
- Transferencia move saldo entre locais sem alterar o total.
- Venda PDV baixa primeiro da `Loja Principal`, depois dos outros depositos ativos.
- Cancelamento, estorno e exclusao de venda PDV tentam devolver ao mesmo local consumido na venda.
- Quando a migration nova nao esta disponivel, ou quando a venda antiga nao tem historico local, o sistema cai para os RPCs legados `decrement_stock` e `increment_stock`.

### Arquivos Principais Alterados

- `supabase/migrations/20260509000001_multi_deposit_stock.sql`
- `types/stock-location.ts`
- `services/stockLocationService.ts`
- `services/saleService.ts`
- `pages/admin/inventory/StockLocationsPage.tsx`
- `Estoque.md`

### Testes E Build Executados

Foram usados testes estaticos para travar o contrato desta fase:

- `tmp-tests/stock-location-entry-static.test.mjs`
- `tmp-tests/stock-location-adjustment-static.test.mjs`
- `tmp-tests/stock-location-transfer-static.test.mjs`
- `tmp-tests/stock-location-priority-decrement-static.test.mjs`
- `tmp-tests/sale-priority-stock-decrement-static.test.mjs`
- `tmp-tests/sale-stock-restore-by-location-static.test.mjs`
- `tmp-tests/stock-locations-page-static.test.mjs`
- `tmp-tests/stock-locations-movements-page-static.test.mjs`
- `tmp-tests/stock-location-service-static.test.mjs`

O build `npm.cmd run build` foi executado fora do sandbox e passou. Restaram apenas avisos antigos do Vite sobre chunks/imports dinamicos.

### Pendencia De Validacao Real

Ainda falta rodar a migration em ambiente real/staging e testar com dados reais:

- Produto com saldo somente na Loja Principal.
- Produto com saldo dividido entre Loja Principal e outro deposito.
- Venda PDV consumindo parcialmente Loja Principal e completando em outro deposito.
- Cancelamento/estorno devolvendo exatamente aos locais consumidos.
- Entrada, ajuste e transferencia aparecendo no historico.
- Divergencia zerada entre `products.stock_quantity` e soma por locais apos cada operacao.

## O Que Falta Fazer

Pendencias principais:

- Testar a migration do Supabase em ambiente local/staging.
- Validar entrada, ajuste manual e transferencia com dados reais.
- Acompanhar a baixa do PDV por prioridade depois da migration aplicada no banco.
- Validar pedido online reservando, consumindo e liberando estoque por local com dados reais.
- Validar cancelamento/estorno/delete de venda PDV devolvendo ao local original com dados reais.
- Confirmar em ambiente real que Bling, VPS, catalogo e Shopee continuam usando apenas estoque total.
- Planejar deploy da migration em producao e registrar evidencias.
- Persistir historico de listas de impressao por caixa/lote, se isso virar necessario operacionalmente.

### Lista De Impressao Para Caixa / Separacao

Objetivo: permitir montar uma lista fisica para colocar em uma caixa, prateleira ou lote de separacao.

Primeira versao implementada:

- Permite adicionar itens bipando o codigo de barras/EAN.
- Permite adicionar itens escolhendo manualmente por SKU ou nome.
- Cada linha impressa contem `Nome | Variacao | SKU | Codigo de barras EAN | Quantidade`.
- Permite informar quantidade por item.
- Imprime em formato simples, legivel e proprio para conferencia fisica.
- Identifica a lista por caixa/lote, data e responsavel.
- A lista e apenas conferencia/separacao e nao baixa nem reserva estoque automaticamente.

Requisitos futuros:

- Salvar historico das listas por caixa/lote.
- Reabrir uma lista salva para reimpressao.
- Opcionalmente conectar a lista a reserva/baixa somente depois de validacao operacional.

## Resumo Do Que Foi Implementado Em 09/05/2026

### Banco E Modelo De Estoque

Foi criada uma fundacao aditiva para estoque multi-depositos sem remover nem substituir `products.stock_quantity`.

Arquivos principais:

- `supabase/migrations/20260509000001_multi_deposit_stock.sql`
- `types/stock-location.ts`
- `services/stockLocationService.ts`

O que foi adicionado:

- Tabelas `stock_deposits`, `stock_locations`, `product_stock_locations` e `stock_location_movements`.
- Deposito padrao `Loja Principal` e local padrao `Estoque Geral`.
- Backfill inicial de `products.stock_quantity` para `product_stock_locations`.
- View `stock_location_divergences` para comparar estoque total atual com soma por locais.
- Funcao `recalculate_product_stock_from_locations` para recalcular `products.stock_quantity` a partir dos locais.
- Types e service para depositos, locais, distribuicao por produto, divergencias e historico.

### Ajuste Manual De Saldo

Foi liberada a primeira escrita controlada da estrutura nova: ajuste manual de saldo por local.

O que foi feito:

- Funcao SQL `adjust_product_stock_location`.
- Metodo `adjustStockLocation` no `stockLocationService`.
- Modal `Ajustar saldo` em `/admin/inventory/locations`.
- Validacao de deposito, local, quantidade nao negativa e motivo obrigatorio.
- Bloqueio de ajuste para a mesma quantidade atual.
- Bloqueio de quantidade menor que saldo reservado.
- Recalculo de `products.stock_quantity` apos ajuste.
- Registro auditavel em `stock_location_movements`.

### Transferencia Entre Locais

Foi adicionada transferencia interna entre depositos/locais, ainda sem conectar venda, PDV ou pedido online.

O que foi feito:

- Funcao SQL `transfer_product_stock_location`.
- Metodo `transferStockLocation` no `stockLocationService`.
- Modal `Transferir estoque` em `/admin/inventory/locations`.
- Validacao de origem, destino, quantidade maior que zero, saldo disponivel e motivo obrigatorio.
- Bloqueio de origem e destino iguais.
- Preservacao de `reserved_quantity` na origem e no destino.
- Registro auditavel em `stock_location_movements` com origem, destino, quantidades anteriores e novas.
- Transferencia nao recalcula nem altera o total do produto, porque e apenas movimentacao interna.

### Entrada Operacional De Estoque

Foi adicionada entrada operacional para somar mercadoria em um deposito/local especifico.

O que foi feito:

- Funcao SQL `add_product_stock_location`.
- Metodo `addStockLocation` no `stockLocationService`.
- Modal `Entrada de estoque` em `/admin/inventory/locations`.
- Validacao de deposito, local, quantidade maior que zero e motivo obrigatorio.
- Soma do saldo atual do local sem alterar reservas existentes.
- Recalculo de `products.stock_quantity` apos a entrada.
- Registro auditavel em `stock_location_movements` com movimento `in`.

### Cancelamento/Estorno Por Local No PDV

Foi adicionada devolucao por local para cancelamento, estorno e exclusao de venda PDV.

O que foi feito:

- Funcao SQL `restore_product_stock_from_sale_movements`.
- Metodo `restoreSaleStockByLocation` no `stockLocationService`.
- Helper `restoreSaleStockForItems` no `saleService`.
- `cancelSale`, `refundSale` e `deleteSale` tentam restaurar pelo historico local da venda.
- A restauracao usa movimentos `sale` com `reference_type = 'sale'` e `reference_id = sale.id`.
- Cada item volta para o mesmo deposito/local de onde saiu.
- A restauracao registra movimento `cancel` com `reference_type = 'sale_restore'`.
- Se a venda nao tem historico por local ou a migration ainda nao existe, o fluxo cai para `increment_stock`.

### Interface Administrativa De Conferencia

Foi criada uma tela administrativa para consultar a estrutura nova antes de conectar os fluxos operacionais.

O que foi feito:

- Rota `/admin/inventory/locations`.
- Atalho `Locais de Estoque` no menu operacional.
- Listagem de depositos e locais internos.
- Busca de produto por nome, SKU ou EAN.
- Tabela de distribuicao por local.
- Tabela de divergencias entre `products.stock_quantity` e soma por locais.
- Historico de movimentacoes recentes.
- Suporte a query `search`, permitindo abrir a tela ja com busca preenchida.

### Produto E Listagem De Produtos

Foi exposta a localizacao interna no fluxo administrativo de produtos, em modo somente leitura.

O que foi feito:

- A tela individual do produto passou a mostrar `Distribuicao por local` na aba de estoque.
- A distribuicao mostra loja/deposito, local, saldo fisico, reservado e disponivel.
- A tela individual tem atalho para abrir `/admin/inventory/locations` com a busca do produto preenchida.
- O card da listagem de produtos ganhou atalho `Ver locais de estoque`.
- O atalho usa SKU, nome ou ID do produto para preencher a busca na tela de locais.

### Unidades Serializadas E VPS

Foi preparada a base para produtos controlados por unidade fisica/IMEI terem local opcional.

O que foi feito:

- Campos opcionais `deposit_id` e `location_id` em `types/unit.ts`.
- `services/units.ts` passou a carregar e enviar a localizacao fisica opcional.
- Migration automatica no VPS para adicionar `deposit_id` e `location_id` em `units`.
- `syncProductStock(productId)` no VPS continua contando unidades `available`, sem filtrar por deposito/local.

### Baixa De Pedido Online Por Prioridade

Foi adicionada baixa por prioridade para pedido online pago/concluido, mantendo compatibilidade com o fluxo antigo.

O que foi feito:

- `services/orderService.ts` passou a chamar `stockLocationService.decrementStockByPriority` quando o pagamento e confirmado.
- Pedido com pagamento na entrega tambem usa a mesma baixa ao ser concluido pelo admin.
- Os movimentos sao marcados com `reference_type: order` e `reference_id` do pedido.
- A baixa segue a regra operacional: consumir primeiro `Loja Principal`, depois outros depositos ativos.
- Se a migration/RPC nova ainda nao existir no banco, o fluxo cai para `decrement_stock`.
- Quando existe reserva local do pedido, o pagamento consome essa reserva e transforma em baixa `order`.
- Se nao houver reserva local, o fluxo continua tentando baixa por prioridade e depois fallback legado.

### Reserva De Pedido Online Por Local

Foi adicionada reserva por local no momento de criar pedido online.

O que foi feito:

- Funcao SQL `reserve_product_stock_by_priority`.
- Funcao SQL `consume_order_stock_reservations` para transformar reserva em baixa quando o pedido e pago/concluido.
- Funcao SQL `release_order_stock_reservations` para liberar reserva quando pedido pendente e cancelado ou falha no gateway.
- Metodos `reserveStockByPriority`, `consumeOrderStockReservations` e `releaseOrderStockReservations` no service de locais.
- `createOrder` tenta reservar produtos numericos por prioridade depois de gravar os itens.
- A reserva aumenta `reserved_quantity`, nao altera `quantity` nem `products.stock_quantity`.
- Pagamento confirmado consome a reserva, reduzindo `quantity` e `reserved_quantity` juntos.
- Cancelamento de pedido ainda nao pago libera `reserved_quantity` sem alterar o estoque fisico.
- Se a migration/RPC nova ainda nao existir no banco, o pedido segue no modo compativel sem reserva local.

### Cancelamento De Pedido Online Por Local

Foi adicionada devolucao por local para cancelamento de pedido online que ja tinha baixado estoque numerico.

O que foi feito:

- Funcao SQL `restore_product_stock_from_order_movements`.
- Metodo `restoreOrderStockByLocation` no service de locais.
- `cancelOrder` agora busca status/pagamento do pedido antes de restaurar estoque numerico.
- Pedidos ja pagos, em preparo, enviados, entregues ou concluidos tentam devolver aos mesmos locais consumidos pela baixa `order`.
- Pedidos ainda pendentes/cancelados nao geram devolucao numerica.
- Quando nao houver historico por local, o fallback usa `increment_stock` com os itens do pedido.

Limite mantido:

- A reserva online ainda precisa ser validada com dados reais em staging/producao antes de depender dela sem fallback.

### Limites De Seguranca Mantidos

Mesmo com entrada, ajuste, transferencia, baixa PDV por prioridade, devolucao PDV por local, reserva/baixa de pedido online por prioridade e devolucao de pedido online por local liberados, os fluxos externos continuam isolados.

Ainda nao foi conectado:

- Reserva automatica a partir de lista de impressao.
- Bling.
- Shopee.
- Catalogo publico.

Regra atual:

- O cliente continua vendo apenas disponibilidade geral.
- As novas tabelas sao ferramenta interna.
- Catalogo, Bling, Shopee e VPS continuam dependendo do estoque total, nao da localizacao interna.
- O PDV ja tenta a baixa por prioridade de local e cai para o fluxo antigo se a migration ainda nao estiver disponivel.
- Cancelamento, estorno e exclusao de venda PDV ja tentam devolver estoque ao local original da baixa e caem para `increment_stock` quando nao ha historico local.
- Pedido online pago/concluido ja tenta a baixa por prioridade de local e cai para `decrement_stock` se a migration ainda nao estiver disponivel.
- Cancelamento de pedido online ja tenta devolver ao local original da baixa e cai para `increment_stock` quando nao ha historico local.
- Pedido online criado ja tenta reservar por prioridade e libera a reserva se o pedido pendente for cancelado.

## Objetivo

Criar uma funcao extra de estoque multi-depositos onde cada produto pode ter saldo distribuido em varios depositos e, dentro de cada deposito, em locais especificos.

Exemplo de estrutura:

```text
Produto
  -> Deposito: Loja Principal
      -> Local: Balcao
      -> Local: Prateleira A
  -> Deposito: Deposito Juazeiro
      -> Local: Armario 01
      -> Local: Caixa Capas
```

O cliente continua vendo apenas se o produto esta disponivel ou nao. A localizacao detalhada e uma ferramenta interna para administracao, PDV, separacao, conferencia e movimentacao de estoque.

## Problema Atual

Hoje o sistema trabalha principalmente com `products.stock_quantity`, que representa o estoque total do produto.

Isso resolve a disponibilidade geral, mas nao responde perguntas operacionais como:

- Em qual deposito esta o produto?
- Em qual prateleira, gaveta, armario ou balcao ele esta?
- Qual saldo esta na loja e qual saldo esta guardado em outro local?
- De qual lugar a venda deve baixar estoque?
- Como transferir itens entre depositos sem perder historico?
- Como conferir divergencias por local?

## Conceito Principal

A nova estrutura deve manter compatibilidade com o estoque atual.

`products.stock_quantity` continua existindo como estoque total do produto, mas passa a ser a soma dos saldos internos por deposito/local.

```text
Produto X
  Loja Principal / Balcao: 2 un.
  Loja Principal / Prateleira A: 3 un.
  Deposito Externo / Caixa 01: 5 un.

products.stock_quantity = 10
```

## Modelo De Dados Proposto

### Tabela: stock_deposits

Representa cada deposito, loja, sala, estoque externo ou ponto fisico de armazenamento.

Campos sugeridos:

- `id`
- `name`
- `code`
- `type`
- `cep`
- `address`
- `is_default`
- `is_active`
- `created_at`
- `updated_at`

Tipos sugeridos:

- `store`: loja fisica
- `warehouse`: deposito
- `support`: assistencia/manutencao
- `transit`: em transito
- `other`: outro

### Tabela: stock_locations

Representa locais internos dentro de um deposito.

Campos sugeridos:

- `id`
- `deposit_id`
- `name`
- `code`
- `description`
- `is_default`
- `is_active`
- `created_at`
- `updated_at`

Exemplos:

- Balcao
- Prateleira A
- Gaveta 03
- Armario Capas
- Caixa Peliculas
- Vitrine

### Tabela: product_stock_locations

Representa o saldo de cada produto em cada deposito/local.

Campos sugeridos:

- `id`
- `product_id`
- `deposit_id`
- `location_id`
- `quantity`
- `reserved_quantity`
- `created_at`
- `updated_at`

Regras:

- `quantity` e o saldo fisico.
- `reserved_quantity` e o saldo separado para pedido ainda nao baixado.
- saldo disponivel = `quantity - reserved_quantity`.
- nao pode haver saldo negativo sem permissao especial.

### Tabela: stock_movements

Deve registrar toda entrada, saida, ajuste, transferencia e baixa por venda.

Campos sugeridos:

- `id`
- `product_id`
- `from_deposit_id`
- `from_location_id`
- `to_deposit_id`
- `to_location_id`
- `quantity`
- `movement_type`
- `reason`
- `reference_type`
- `reference_id`
- `notes`
- `created_by`
- `created_at`

Tipos de movimento:

- `in`: entrada
- `out`: saida
- `adjustment`: ajuste
- `transfer`: transferencia
- `reservation`: reserva
- `release_reservation`: liberar reserva
- `sale`: baixa por venda
- `cancel`: estorno/cancelamento

### Produtos Com IMEI Ou Unidade Serializada

Produtos controlados por unidade, como aparelhos com IMEI, devem receber os campos:

- `deposit_id`
- `location_id`
- `status`

Assim cada unidade especifica pode estar em um local especifico.

## Regras De Negocio

### Estoque Total

O estoque total do produto deve ser sempre a soma dos saldos por deposito/local.

```text
products.stock_quantity = SUM(product_stock_locations.quantity)
```

### Deposito Padrao

Ao criar a funcao, deve existir um deposito padrao:

- Nome: Loja Principal
- Local padrao: Estoque Geral

Todo estoque atual deve ser migrado para esse deposito/local.

### Venda No PDV

Primeira versao recomendada:

- PDV baixa automaticamente primeiro do deposito padrao `Loja Principal`.
- Se a loja nao tiver saldo suficiente, o sistema consome o restante dos outros depositos ativos.
- A baixa pode ser dividida em varios movimentos auditaveis quando uma unica venda consumir mais de um deposito/local.
- Para produto serializado, o vendedor escolhe a unidade especifica.

Versao futura:

- regra por vendedor
- regra por loja
- regra por caixa
- escolha inteligente por disponibilidade

### Prioridade De Saida De Estoque

Regra aprovada em 09/05/2026:

- Todo estoque numerico atual começa no deposito/local padrao `Loja Principal / Estoque Geral`.
- A saida operacional deve priorizar sempre a `Loja Principal`.
- Quando a loja nao tiver saldo suficiente, a baixa continua nos outros depositos ativos.
- A primeira versao pode usar a ordem: deposito padrao primeiro, depois outros depositos por nome/codigo.
- Futuramente a ordem dos depositos podera ser configuravel.

Exemplo:

```text
Produto X
  Loja Principal / Estoque Geral: 10 un.
  Deposito A / Estoque Geral: 20 un.

Venda de 12 un.
  baixa 10 un. da Loja Principal
  baixa 2 un. do Deposito A

Saldo final:
  Loja Principal / Estoque Geral: 0 un.
  Deposito A / Estoque Geral: 18 un.
```

Implementacao recomendada:

- Criar funcao SQL transacional para baixa por prioridade.
- A funcao deve travar saldos envolvidos, validar disponibilidade total e registrar um movimento `sale` ou `out` para cada local consumido.
- PDV, pedido online e futuras saidas operacionais devem chamar uma unica funcao/service, evitando baixa duplicada ou regras divergentes.
- Se nao houver saldo total suficiente, a funcao deve falhar sem alterar nenhum local.

### Pedido Online

O cliente nao ve deposito nem local.

Fluxo recomendado:

1. pedido criado
2. sistema reserva estoque
3. pagamento/venda confirmado
4. sistema baixa estoque do deposito definido
5. se cancelar, libera reserva ou estorna baixa

### Transferencia

Toda transferencia deve criar movimento com origem e destino.

Exemplo:

```text
Produto: Capa iPhone 15
Origem: Deposito / Caixa 02
Destino: Loja Principal / Balcao
Quantidade: 10
Motivo: Reposicao de loja
```

### Ajuste Manual

Ajuste manual deve exigir motivo.

Motivos sugeridos:

- conferencia
- perda
- avaria
- erro de cadastro
- inventario
- devolucao
- outro

## Impacto Nas Telas

### Admin > Estoque

Criar ou evoluir area com abas:

- Visao Geral
- Depositos
- Locais
- Estoque Por Local
- Movimentacoes
- Transferencias

### Tela De Depositos

Funcionalidades:

- criar deposito
- editar deposito
- desativar deposito
- marcar como padrao
- visualizar quantidade de locais
- visualizar valor total estimado em estoque

### Tela De Locais

Funcionalidades:

- listar locais por deposito
- criar local
- editar local
- desativar local
- marcar local padrao

### Tela De Estoque Por Local

Funcionalidades:

- pesquisar produto por nome, SKU, EAN ou codigo de barras
- ver saldo por deposito/local
- ajustar saldo
- transferir saldo
- ver historico do produto

### Tela Do Produto

Adicionar bloco:

```text
Distribuicao de estoque
Loja Principal: 3 un.
Deposito Juazeiro: 8 un.
Assistencia: 1 un.
```

Acoes:

- gerenciar locais
- transferir
- ajustar estoque

### Listagem De Produtos

Manter estoque total visivel.

Adicionar acao opcional:

- Ver distribuicao

### PDV

Adicionar comportamento:

- baixa do deposito padrao
- alerta quando saldo do deposito padrao for insuficiente
- opcao para escolher deposito/local quando necessario

### Impressao De Etiquetas

Opcional futuro:

- imprimir etiqueta com local interno
- exemplo: `A-03`, `Balcao`, `Caixa Capas`

## Integracoes

### Bling

Regra recomendada:

- Bling continua recebendo estoque total.
- Distribuicao por deposito/local fica interna no Mercado do Vale.
- Importacao de estoque do Bling cai no deposito/local padrao.

Motivo:

Evita quebrar a integracao atual e reduz risco operacional.

### VPS

Verificar:

- endpoints que leem `stock_quantity`
- sincronizacao de preco/estoque
- cache de produtos
- decremento/incremento de estoque

Regra recomendada:

- VPS continua usando estoque total por produto.
- API interna/admin passa a consultar distribuicao quando necessario.

### Shopee E Outros Marketplaces

Regra recomendada:

- marketplace recebe estoque total ou estoque configurado para venda online.
- locais internos nao devem ser expostos.

## Migracao Inicial

Passos:

1. criar tabelas novas
2. criar deposito padrao `Loja Principal`
3. criar local padrao `Estoque Geral`
4. migrar todos os produtos com estoque atual para esse local
5. validar soma por produto
6. manter `products.stock_quantity` sincronizado
7. testar venda, ajuste e cancelamento

Query conceitual:

```sql
INSERT INTO product_stock_locations (product_id, deposit_id, location_id, quantity)
SELECT id, :default_deposit_id, :default_location_id, stock_quantity
FROM products
WHERE COALESCE(stock_quantity, 0) > 0;
```

## Riscos E Cuidados

- Nao duplicar baixa de estoque.
- Nao quebrar venda atual.
- Nao quebrar catalogo publico.
- Nao quebrar sincronizacao Bling/VPS.
- Nao permitir soma diferente entre locais e `products.stock_quantity`.
- Ter historico completo para auditar divergencia.
- Migrar com rollback planejado.

## Plano De Implementacao

### Fase 1: Pesquisa Estrutural

- [x] Mapear todas as leituras de `products.stock_quantity`.
- [x] Mapear todas as escritas de estoque.
- [x] Mapear RPCs `increment_stock` e `decrement_stock`.
- [x] Mapear fluxo de vendas PDV.
- [x] Mapear fluxo de pedido online.
- [x] Mapear produtos com unidades serializadas/IMEI.
- [x] Mapear sincronizacao VPS.
- [x] Mapear sincronizacao Bling/Shopee.

#### Mapa Inicial Encontrado Em 09/05/2026

Leituras principais de estoque:

- `pages/store/PublicProductPage.tsx`: usa `stock_quantity` e `track_inventory` para disponibilidade, variantes, botao comprar e schema.
- `pages/catalog/index.tsx`: agrupa produtos e considera estoque para visibilidade do catalogo.
- `components/catalog/*`: cards, modal de produto e simuladores usam estoque total para exibir disponibilidade.
- `pages/customer/CustomerFavoritesPage.tsx`: normaliza estoque vindo de VPS/Supabase para favoritos.
- `pages/pdv/PDVPage.tsx`, `components/pdv/CartSection.tsx`, `components/pdv/ProductSearchSection.tsx`: validam estoque antes de adicionar ou aumentar quantidade no carrinho.
- `components/products/ProductCard.tsx`: exibe e sincroniza estoque real vindo do Bling.
- `components/products/ProductForm.tsx`: edita `track_inventory` e `stock_quantity`.
- `pages/admin/inventory/InventoryPage.tsx` + `services/inventory.ts`: tela atual de estoque, ainda com partes antigas usando agrupamento e dados de `specs`.
- `services/catalogConfigService.ts`, `services/catalogService.ts`, `services/productGrouping.ts`, `services/tagResolver.ts`: regras de visibilidade, agrupamento e tags dependem de estoque total.
- `services/averagePriceService.ts` e `components/products/sections/ProductPricing.tsx`: calculam custo/preco medio com base no estoque total.

Escritas principais de estoque:

- `services/inventory.ts`: `adjustStock()` atualiza diretamente `products.stock_quantity` e insere em `stock_movements`.
- `services/saleService.ts`: vendas PDV de produtos manuais nao serializados tentam baixar por `decrementStockByPriority`, priorizando Loja Principal; se a migration nova nao estiver disponivel, caem para `decrement_stock`. Cancelamento, estorno e delete tentam restaurar por local e caem para `increment_stock` quando nao ha historico local.
- `services/orderService.ts`: pedido criado tenta reservar por `reserveStockByPriority`; pedido pago e pedido com pagamento na entrega tentam consumir reserva por local antes de baixar por `decrementStockByPriority`, priorizando Loja Principal; se a migration nova nao estiver disponivel, caem para `decrement_stock`. Cancelamento de pedido pendente tenta liberar reserva; cancelamento de pedido que ja baixou estoque tenta restaurar por local e cai para `increment_stock` quando nao ha historico local.
- `services/products.ts`: criacao/edicao de produto salva `stock_quantity`; mudanca dispara sync Shopee.
- `components/products/ProductCard.tsx`: atualiza `products.stock_quantity` apos consultar estoque no Bling e tenta sincronizar VPS.
- `services/blingService.ts` e `api/bling.ts`: importam/sincronizam estoque vindo do Bling.
- `vps_server.cjs` e `vps_server.js`: endpoint `/products/stock` atualiza `stock_quantity` por SKU ou Bling ID.

Unidades serializadas/IMEI:

- `services/units.ts`: usa VPS MySQL como fonte de verdade para unidades serializadas.
- `unitService.markAsSold()`, `autoReserve()`, `release()` e `swapUnit()` mudam status da unidade.
- No VPS, `syncProductStock(productId)` recalcula `products.stock_quantity = COUNT(units WHERE status = 'available')`.
- Isso significa que multi-depositos precisa tratar produtos serializados com cuidado especial: o local deve morar na unidade, nao apenas no saldo agregado.

Tabelas e historico atuais:

- Ja existe `stock_movements`, mas ela so conhece `product_id`, `type`, `quantity`, `previous_quantity`, `new_quantity`, `reason` e `reference_id`.
- Ela nao tem origem/destino de deposito/local.
- Para multi-depositos, podemos evoluir essa tabela ou criar uma tabela nova de movimentos por local, preservando compatibilidade.

Riscos detectados:

- Existem dois modos de estoque no sistema: produto numerico (`products.stock_quantity`) e unidade serializada na VPS.
- `services/inventory.ts` tem trechos antigos que leem `specs.stock_quantity`, enquanto o resto do app usa `products.stock_quantity`.
- A baixa de pedido online nao restaura estoque numerico no `cancelOrder()` pelo trecho analisado; ela libera unidades serializadas, mas precisa ser conferida antes de alterar multi-depositos.
- Bling/VPS/Shopee devem continuar recebendo estoque total para nao quebrar integracoes.
- O primeiro passo de codigo deve ser compatibilidade e leitura, nao substituir a baixa de venda de uma vez.

Decisao tecnica preliminar:

- Criar multi-depositos como camada interna.
- Manter `products.stock_quantity` como total derivado.
- Comecar com migracao para deposito/local padrao.
- So depois adaptar PDV e pedidos para baixar por prioridade: loja primeiro, outros depositos depois.

#### Desenho Seguro De Banco E Migracao

Premissa principal:

- A primeira migration deve ser aditiva.
- Nenhum fluxo atual de venda, catalogo, Bling, Shopee ou VPS deve depender das novas tabelas no primeiro passo.
- O sistema deve conseguir validar a soma por local antes de trocar qualquer baixa de estoque.

Modelo recomendado para produtos sem unidade serializada:

```text
products.stock_quantity
  = soma operacional publicada para catalogo, PDV, Bling, Shopee e VPS

product_stock_locations.quantity
  = distribuicao interna por deposito/local
```

No inicio, `products.stock_quantity` continua sendo o campo de compatibilidade. A nova estrutura nasce sincronizada, mas ainda nao substitui as baixas atuais.

Modelo recomendado para produtos com IMEI/unidade serializada:

```text
units.status
units.deposit_id
units.location_id
```

Produtos serializados nao devem ser controlados manualmente por saldo agregado em `product_stock_locations`, porque o VPS ja recalcula `products.stock_quantity` contando `units` com `status = available`.

Regra para evitar contagem duplicada:

- Produto comum: saldo por local vive em `product_stock_locations`.
- Produto serializado: local vive na propria unidade em `units`.
- O total exibido continua em `products.stock_quantity`.

Tabelas novas no Supabase:

```text
stock_deposits
stock_locations
product_stock_locations
stock_location_movements
```

Recomendacao sobre `stock_movements` atual:

- Manter `stock_movements` como historico legado/compatibilidade.
- Criar `stock_location_movements` para a nova camada.
- Evitar alterar de imediato os checks atuais de `stock_movements`, pois ela aceita apenas `in`, `out` e `adjustment`.

Campos essenciais de `stock_location_movements`:

- `company_id`
- `product_id`
- `from_deposit_id`
- `from_location_id`
- `to_deposit_id`
- `to_location_id`
- `quantity`
- `movement_type`
- `reason`
- `reference_type`
- `reference_id`
- `previous_from_quantity`
- `new_from_quantity`
- `previous_to_quantity`
- `new_to_quantity`
- `notes`
- `created_by`
- `created_at`

Tipos sugeridos:

- `in`
- `out`
- `adjustment`
- `transfer`
- `reservation`
- `release_reservation`
- `sale`
- `cancel`
- `sync`

Migration inicial segura:

1. Criar `stock_deposits`.
2. Criar `stock_locations`.
3. Criar `product_stock_locations`.
4. Criar `stock_location_movements`.
5. Inserir deposito padrao por empresa: `Loja Principal`.
6. Inserir local padrao por deposito: `Estoque Geral`.
7. Copiar o estoque atual dos produtos comuns para o local padrao.
8. Gerar movimentos iniciais do tipo `sync` ou `adjustment` com referencia `initial_migration`.
9. Criar view ou query de conferencia: soma por local versus `products.stock_quantity`.
10. Nao substituir ainda `increment_stock` e `decrement_stock`.

Migration VPS para unidades serializadas:

- Adicionar campos nullable em `units`:
  - `deposit_id`
  - `location_id`
- Adicionar indices:
  - `idx_units_deposit_id`
  - `idx_units_location_id`
- Backfill inicial:
  - todas as unidades com local vazio entram em `Loja Principal / Estoque Geral`.

Cuidados na VPS:

- `syncProductStock(productId)` deve continuar contando apenas `units.status = 'available'`.
- O local da unidade nao deve alterar a contagem total.
- Endpoints de reserva, venda, troca e liberacao devem preservar `deposit_id` e `location_id`.

Funcoes futuras recomendadas:

```text
recalculate_product_stock_from_locations(product_id)
reserve_stock_from_location(product_id, quantity, location_id)
release_stock_reservation(product_id, quantity, location_id)
decrement_stock_from_location(product_id, quantity, location_id)
decrement_stock_by_priority(product_id, quantity, reference_type, reference_id)
increment_stock_to_location(product_id, quantity, location_id)
transfer_stock_between_locations(product_id, quantity, from_location_id, to_location_id)
```

Ordem segura de ativacao:

1. Criar tabelas e backfill.
2. Criar tela de conferencia sem editar dados.
3. Mostrar divergencias entre total e locais.
4. Permitir ajuste manual por local para produtos comuns.
5. Permitir transferencia entre locais.
6. Criar baixa por prioridade: `Loja Principal` primeiro, outros depositos depois.
7. Adaptar PDV para chamar baixa por prioridade.
8. Adaptar pedido online para reservar/baixar seguindo prioridade.
9. Adaptar unidades serializadas para exibir e escolher local.
10. Somente depois considerar `products.stock_quantity` como derivado automatico.

Rollback planejado:

- Como as tabelas novas sao aditivas, o rollback inicial e desligar a leitura das novas telas e manter `products.stock_quantity`.
- Antes de trocar baixas de venda, registrar ponto de verificacao com build, teste de PDV e teste de pedido online.
- Nao remover nem reescrever `stock_quantity` durante a primeira fase.

Proxima etapa segura:

- Criar plano e testes para baixa por prioridade antes de ligar PDV ou pedidos online.
- A baixa deve consumir `Loja Principal` primeiro e depois outros depositos ativos.
- Manter integracoes externas fora desse passo ate a funcao transacional estar validada.

### Fase 2: Banco De Dados

- [x] Criar migration para `stock_deposits`.
- [x] Criar migration para `stock_locations`.
- [x] Criar migration para `product_stock_locations`.
- [x] Criar `stock_location_movements` sem quebrar `stock_movements` atual.
- [x] Criar indices por produto, deposito e local.
- [x] Criar constraints para evitar saldo negativo.
- [x] Criar deposito/local padrao.
- [x] Criar migration de dados atuais.
- [x] Criar funcao para recalcular estoque total do produto.
- [x] Criar query/view de divergencia entre saldo total e saldo por local.
- [x] Planejar migration VPS para `units.deposit_id` e `units.location_id`.

### Fase 3: Services E Types

- [x] Criar types de deposito.
- [x] Criar types de local.
- [x] Criar types de saldo por local.
- [x] Criar service de depositos.
- [x] Criar service de locais.
- [x] Criar service de movimentacoes.
- [x] Criar service de saldo por produto/local.
- [x] Adaptar types/service de unidades serializadas para aceitar deposito/local opcionais.
- [x] Criar testes dos services.

### Fase 4: Interface Admin

- [x] Criar tela de Depositos.
- [x] Criar tela de Locais.
- [x] Criar tela de Estoque Por Local.
- [x] Criar modal de ajuste.
- [x] Criar modal de transferencia.
- [x] Criar historico de movimentacoes.
- [x] Adicionar distribuicao na tela do produto.
- [x] Adicionar atalho na listagem de produtos.
- [x] Criar tela inicial de conferencia sem edicao.
- [x] Criar lista de impressao para caixa/separacao com itens bipados ou escolhidos.

### Fase 5: Fluxos Operacionais

- [x] Integrar ajuste manual.
- [x] Integrar transferencia.
- [x] Integrar entrada de estoque.
- [x] Criar baixa por prioridade: loja primeiro, outros depositos depois.
- [x] Integrar baixa por venda PDV.
- [x] Integrar cancelamento/estorno PDV por local.
- [x] Integrar baixa de pedido online pago/concluido por prioridade.
- [x] Integrar cancelamento/liberacao de pedido online por local.
- [x] Integrar reserva de pedido online.

### Fase 6: Integracoes Externas

- [x] Garantir que Bling receba estoque total.
- [x] Garantir que VPS receba estoque total.
- [x] Garantir que catalogo leia estoque total.
- [x] Garantir que Shopee nao receba local interno.
- [x] Criar validacao de divergencia entre total e locais.
- [x] Preservar calculo VPS de estoque total por unidades disponiveis.

### Fase 7: Validacao E Deploy

- [x] Rodar testes unitarios/especificos.
- [x] Rodar build.
- [ ] Testar migracao em ambiente local.
- [ ] Testar venda PDV.
- [ ] Testar pedido online.
- [ ] Testar ajuste e transferencia.
- [ ] Testar leitura/bipagem de EAN na lista de impressao.
- [x] Conferir Vercel.
- [x] Conferir necessidade de deploy VPS.
- [x] Registrar evidencias no diario.

## Checklist Diario De Producao

### Inicio Do Dia

- [ ] Conferir branch atual.
- [ ] Conferir `git status`.
- [ ] Conferir se existem alteracoes paralelas nao relacionadas.
- [ ] Conferir ultimo commit/deploy.
- [ ] Definir objetivo do dia.
- [ ] Registrar objetivo no diario abaixo.

### Durante O Desenvolvimento

- [ ] Implementar uma fase por vez.
- [ ] Criar teste antes de alterar comportamento critico.
- [ ] Rodar testes especificos.
- [ ] Rodar build quando mexer em app web.
- [ ] Nao misturar alteracoes de outras areas.
- [ ] Atualizar este documento com decisoes novas.

### Final Do Dia

- [ ] Registrar o que foi feito.
- [ ] Registrar pendencias.
- [ ] Registrar comandos de verificacao.
- [ ] Registrar se houve commit.
- [ ] Registrar se houve push.
- [ ] Registrar se houve deploy Vercel.
- [ ] Registrar se houve deploy VPS.

## Diario De Producao

### 11/05/2026

Objetivo:

- Seguir o checklist da Fase 6 e travar que integracoes externas continuam usando estoque total, nao local interno.

Feito:

- [x] Criada guarda estatica para Bling, VPS, catalogo publico e Shopee.
- [x] Confirmado que Bling importa/reconcilia/webhook pelo `products.stock_quantity`.
- [x] Confirmado que o endpoint VPS `/products/stock` atualiza `products.stock_quantity`.
- [x] Confirmado que o catalogo publico le disponibilidade pelo estoque total.
- [x] Confirmado que Shopee envia apenas estoque total e nao recebe deposito/local interno.
- [x] Criada guarda estatica para validacao de divergencia entre `products.stock_quantity` e soma por locais.
- [x] Confirmado que a tela `/admin/inventory/locations` carrega e exibe divergencias.
- [x] Corrigida a migration para manter as RPCs de estoque por local sem `SECURITY DEFINER`, respeitando RLS.
- [x] Criado verificador SQL `supabase/verify_multi_deposit_stock.sql` para rodar depois da migration em staging/producao.
- [x] Confirmado que o build de producao passa depois dos ajustes desta etapa.
- [x] Conferida necessidade de deploy VPS: para o fluxo atual de estoque multi-depositos no Supabase, nao ha deploy VPS obrigatorio; para localizacao de unidades serializadas e futura migracao total do estoque para VPS, havera deploy separado.
- [x] Decidido manter a migracao total do estoque para VPS como etapa futura, depois de concluir o checklist atual.
- [x] Validada tecnicamente a lista de impressao: busca tenta EAN primeiro, cai para SKU/nome e nao movimenta estoque.
- [x] Criado checklist operacional `docs/operacional/2026-05-11-estoque-staging-validation.md` para guiar a validacao em staging/local.
- [x] Fechada decisao da lista de impressao: primeira versao fica apenas conferencia/separacao, sem reserva ou baixa automatica.
- [x] Conferida preparacao Vercel por build e `vercel.json`: API, sitemap, SEO de produto e fallback SPA continuam configurados.
- [x] Checklist de staging ampliado com preparacao, dados da execucao, criterios de aprovacao, criterios de bloqueio e rollback/contencao.
- [x] Registrado que qualquer commit futuro desta frente deve seguir `commit.md`: commit isolado por arquivo, push por padrao, `main` quando precisar Vercel e deploy VPS apenas quando atingir runtime/servicos da VPS.
- [x] Criado escopo de commit `docs/operacional/2026-05-11-estoque-commit-scope.md` para separar arquivos da frente de estoque antes de stagear.

Verificacoes executadas:

- [x] `node tmp-tests\external-integrations-total-stock-static.test.mjs`
- [x] `node tmp-tests\stock-location-divergence-validation-static.test.mjs`
- [x] `node tmp-tests\multi-deposit-stock-migration-static.test.mjs`
- [x] `node tmp-tests\stock-location-service-static.test.mjs`
- [x] `node tmp-tests\stock-locations-page-static.test.mjs`
- [x] `node tmp-tests\stock-location-priority-decrement-static.test.mjs`
- [x] `node tmp-tests\order-stock-reservation-static.test.mjs`
- [x] `node tmp-tests\order-priority-stock-decrement-static.test.mjs`
- [x] `node tmp-tests\sale-priority-stock-decrement-static.test.mjs`
- [x] `node tmp-tests\sale-stock-restore-by-location-static.test.mjs`
- [x] `node tmp-tests\stock-location-adjustment-static.test.mjs`
- [x] `node tmp-tests\stock-location-transfer-static.test.mjs`
- [x] `node tmp-tests\stock-location-entry-static.test.mjs`
- [x] `node tmp-tests\inventory-print-list-static.test.mjs`
- [x] `node tmp-tests\multi-deposit-stock-verification-sql-static.test.mjs`
- [x] `node tmp-tests\vercel-deploy-readiness-static.test.mjs`
- [x] `node tmp-tests\estoque-staging-runbook-static.test.mjs`
- [x] `node tmp-tests\estoque-commit-scope-static.test.mjs`
- [x] `npm.cmd run build`

Pendencias:

- [ ] Testar migration em ambiente local/staging.
- [ ] Validar venda PDV e pedido online com dados reais depois da migration aplicada.
- [ ] Conferir integracoes externas em ambiente real depois do deploy da migration.
- [ ] Instalar/disponibilizar Supabase CLI ou aplicar a migration em staging via SQL Editor para executar `supabase/verify_multi_deposit_stock.sql`.
- [ ] Testar bipagem fisica de EAN na lista de impressao com scanner real.
- [ ] Executar checklist `docs/operacional/2026-05-11-estoque-staging-validation.md` em ambiente com dados reais.
- [ ] Conferir deploy real no Vercel depois que a migration for validada e publicada.
- [ ] Quando for comitar, seguir o fluxo de `commit.md` e nao misturar arquivos fora do escopo.
- [ ] Usar `docs/operacional/2026-05-11-estoque-commit-scope.md` como lista de conferencia antes do stage.

Roteiro manual da proxima validacao:

1. Aplicar `supabase/migrations/20260509000001_multi_deposit_stock.sql` em staging ou ambiente local com backup.
2. Rodar `supabase/verify_multi_deposit_stock.sql` e registrar contagem de divergencias.
3. Escolher um produto com saldo somente na `Loja Principal` e fazer venda PDV parcial.
4. Escolher um produto com saldo dividido entre `Loja Principal` e outro deposito e fazer venda maior que o saldo da loja.
5. Cancelar/estornar a venda e conferir devolucao ao local original.
6. Criar pedido online, confirmar pagamento/concluir e conferir reserva/baixa por local.
7. Cancelar pedido pendente e conferir liberacao de reserva.
8. Fazer entrada, ajuste e transferencia na tela `/admin/inventory/locations`.
9. Bipar EAN na lista de impressao e imprimir uma lista teste.
10. Conferir Bling, VPS, catalogo e Shopee recebendo apenas `products.stock_quantity`.

### 09/05/2026

Objetivo:

- Criar o documento estrutural `Estoque.md` para guiar a implementacao de multi-depositos e locais internos.

Feito:

- [x] Definido conceito de estoque por deposito/local.
- [x] Definido modelo de dados proposto.
- [x] Definidos fluxos de movimentacao, ajuste e transferencia.
- [x] Definido impacto em telas administrativas.
- [x] Definida estrategia inicial para Bling, VPS e marketplaces.
- [x] Criado checklist de implementacao por fases.
- [x] Criado checklist diario de producao.
- [x] Criada migration aditiva Supabase para depositos, locais, saldo por local e movimentos por local.
- [x] Criada view de divergencias entre saldo total e saldo por local.
- [x] Criada funcao de recalculo do estoque total a partir dos locais.
- [x] Criados types e service inicial de leitura para depositos, locais, distribuicao e divergencias.
- [x] Criada pagina administrativa de conferencia em `/admin/inventory/locations`.
- [x] Adicionado atalho `Locais de Estoque` no menu operacional.
- [x] Adicionada pesquisa por produto para conferir distribuicao por local.
- [x] Adicionados campos opcionais `deposit_id` e `location_id` nas unidades serializadas do VPS.
- [x] Criada migracao automatica no VPS para adicionar colunas e indices nas tabelas existentes.
- [x] Mantido `syncProductStock(productId)` contando unidades disponiveis sem filtrar deposito/local.
- [x] Adaptados `types/unit.ts` e `services/units.ts` para carregar e enviar localizacao fisica opcional.
- [x] Criado service de movimentacoes com listagem filtrada e registro de log auditavel.
- [x] Adicionada secao somente leitura de historico de movimentacoes na tela de locais.
- [x] Criada funcao SQL `adjust_product_stock_location` para ajuste manual transacional.
- [x] Criado metodo `adjustStockLocation` no service de locais.
- [x] Criado modal `Ajustar saldo` na tela `/admin/inventory/locations`.
- [x] Ajuste manual exige deposito, local, quantidade valida e motivo.
- [x] Ajuste manual rejeita quantidade igual a atual para evitar historico com movimento zero.
- [x] Ajuste manual atualiza saldo por local, recalcula `products.stock_quantity` e registra historico.
- [x] Criada funcao SQL `transfer_product_stock_location` para transferencia transacional entre locais.
- [x] Criado metodo `transferStockLocation` no service de locais.
- [x] Criado modal `Transferir estoque` na tela `/admin/inventory/locations`.
- [x] Transferencia exige origem, destino diferente, quantidade disponivel e motivo.
- [x] Transferencia preserva reservas existentes, nao altera o estoque total do produto e registra historico.
- [x] Criada funcao SQL `add_product_stock_location` para entrada operacional transacional.
- [x] Criado metodo `addStockLocation` no service de locais.
- [x] Criado modal `Entrada de estoque` na tela `/admin/inventory/locations`.
- [x] Entrada exige deposito, local, quantidade maior que zero e motivo.
- [x] Entrada soma saldo por local, preserva reservas, recalcula `products.stock_quantity` e registra historico `in`.
- [x] Criada funcao SQL `decrement_product_stock_by_priority` para baixa transacional por prioridade.
- [x] Baixa por prioridade consome depositos padrao primeiro e depois outros depositos ativos.
- [x] Baixa por prioridade valida saldo total antes de alterar qualquer local.
- [x] Baixa por prioridade registra movimento `sale` por local consumido e recalcula `products.stock_quantity`.
- [x] Criada funcao SQL `restore_product_stock_from_sale_movements` para devolver venda PDV aos locais consumidos.
- [x] Criado metodo `restoreSaleStockByLocation` no service de locais.
- [x] `cancelSale`, `refundSale` e `deleteSale` tentam devolucao por local antes do fallback legado.
- [x] Devolucao PDV por local registra movimento `cancel` e recalcula `products.stock_quantity`.
- [x] Criado metodo `decrementStockByPriority` no service de locais.
- [x] Mantido PDV e pedidos online fora da baixa por prioridade nesta etapa.
- [x] Adicionada distribuicao por local na tela individual do produto.
- [x] Adicionado atalho `Ver locais de estoque` no card da listagem de produtos.
- [x] Tela `/admin/inventory/locations` aceita query `search` para abrir com a busca preenchida.
- [x] Criada tela `/admin/inventory/print-list` para lista avulsa de caixa/separacao.
- [x] Lista de impressao permite adicionar produto por EAN, SKU ou nome.
- [x] Lista de impressao permite ajustar quantidade e remover itens antes de imprimir.
- [x] Impressao mostra caixa/lote, responsavel, data, nome, variacao, SKU, EAN e quantidade.
- [x] Lista de impressao nao baixa, reserva, transfere ou ajusta estoque automaticamente.
- [x] Adicionado atalho `Lista de Impressao` no menu operacional.
- [x] Registrada regra operacional de saida: baixa sempre prioriza `Loja Principal`; se faltar saldo, continua nos outros depositos.

Pendencias:

- [x] Aprovado inicio passo a passo da implementacao cautelosa.
- [x] Mapear arquivos atuais que leem/escrevem estoque.
- [x] Escrever spec tecnica inicial de banco e migracao.
- [x] Criar plano de implementacao detalhado.
- [x] Aprovar inicio da Fase 2 com migration aditiva.
- [x] Planejar e aprovar alteracao VPS para localizar unidades serializadas.
- [x] Criar interface administrativa de conferencia antes de permitir edicao.
- [x] Criar lista de impressao para caixa/separacao com `Nome | Variacao | SKU | Codigo de barras EAN`.
- [x] Permitir montar lista de impressao bipando EAN ou escolhendo produtos manualmente.
- [x] Definir se a lista impressa sera apenas conferencia/separacao ou se futuramente vai reservar/baixar estoque: primeira versao fica apenas conferencia/separacao; reserva/baixa fica para decisao futura.
- [x] Criar funcao transacional de baixa por prioridade antes de conectar PDV/pedidos.

Verificacoes executadas:

- [x] `node tmp-tests\multi-deposit-stock-migration-static.test.mjs`
- [x] `node tmp-tests\stock-location-service-static.test.mjs`
- [x] `node tmp-tests\stock-locations-page-static.test.mjs`
- [x] `node tmp-tests\vps-units-location-fields-static.test.mjs`
- [x] `node tmp-tests\stock-location-movements-service-static.test.mjs`
- [x] `node tmp-tests\stock-locations-movements-page-static.test.mjs`
- [x] `node tmp-tests\stock-location-adjustment-static.test.mjs`
- [x] `node tmp-tests\stock-location-transfer-static.test.mjs`
- [x] `node tmp-tests\product-stock-location-surface-static.test.mjs`
- [x] `node tmp-tests\inventory-print-list-static.test.mjs`
- [x] `node tmp-tests\stock-location-priority-decrement-static.test.mjs`
- [x] Conferencia visual em `http://127.0.0.1:5182/admin/inventory/locations`
- [x] `npm.cmd run build`

## Decisoes Em Aberto

- [x] O PDV deve baixar sempre do deposito padrao na primeira versao? Sim: deve priorizar `Loja Principal` e depois outros depositos quando faltar saldo.
- [ ] Vendedor podera escolher deposito/local no momento da venda? Futuro; primeira versao deve ser automatica por prioridade.
- [x] O pedido online deve reservar estoque imediatamente ou apenas baixar na confirmacao? Primeira versao: reserva na criacao e consome a reserva no pagamento/conclusao, com fallback compativel quando a migration ainda nao existe.
- [ ] Produtos sem controle de estoque devem aparecer nessa estrutura?
- [ ] Etiquetas devem mostrar local interno?
- [ ] Havera permissao especifica para transferencia entre depositos?
- [ ] A lista de impressao deve salvar historico por caixa/lote ou ser apenas impressao avulsa?
- [x] A lista de impressao deve permanecer apenas como conferencia ou futuramente reservar/baixar estoque? Primeira versao permanece apenas como conferencia/separacao; reserva/baixa fica fora do fluxo atual.
- [ ] Migrar a fonte principal do estoque do Supabase para VPS/MySQL? Futuro; primeiro concluir validacao do checklist atual.

## Criterios De Sucesso

- Estoque total do produto continua correto.
- Admin consegue cadastrar varios depositos.
- Admin consegue cadastrar locais dentro de cada deposito.
- Admin consegue consultar onde esta cada produto.
- Admin consegue transferir produto entre locais.
- Admin consegue ajustar saldo com historico.
- Admin consegue bipar ou escolher produtos e imprimir lista de caixa com nome, variacao, SKU e EAN legivel.
- Venda continua funcionando sem quebrar o fluxo atual.
- Catalogo publico nao expoe informacao interna.
- Bling/VPS continuam recebendo estoque total.
- Historico permite auditar divergencias.
