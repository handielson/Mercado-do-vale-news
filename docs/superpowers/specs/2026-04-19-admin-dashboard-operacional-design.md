# Dashboard Operacional Admin

## Objetivo

Atualizar a home administrativa (`/admin`) para virar um painel operacional real, sem remover atalhos ou fluxos existentes, e dividir a entrega em etapas pequenas para reduzir risco.

O dashboard deve passar a oferecer:

- KPIs reais do dia: `faturamento do dia` e `lucro do dia`
- bloco Shopee com contadores e hiperlinks diretos
- relatório diário consolidado de vendas
- base para uma lista de compra persistente e acumulada

## Escopo por Fases

### Fase 1: Dashboard Seguro

Objetivo:
organizar a home atual e trocar os cards estáticos por blocos funcionais, sem ainda mexer na lógica completa de compras.

Entregas:

- extrair o dashboard inline de `routes/index.tsx` para componentes dedicados
- manter os atalhos atuais já existentes
- adicionar KPIs reais:
  - faturamento do dia
  - lucro do dia
- adicionar área Shopee com links diretos para:
  - novos
  - falta enviar
  - enviados
  - cancelados
  - reclamações/devoluções
- manter o alerta de mensagens não lidas

Critério de segurança:

- nada do painel atual deve perder rota, botão ou navegação
- se algum bloco novo falhar ao carregar, o restante do dashboard continua renderizando

### Fase 2: Consolidador de Vendas

Objetivo:
criar uma leitura única de vendas do dia, juntando diferentes origens e preservando o canal.

Fontes previstas:

- PDV
- Shopee
- Bling

Preparação futura:

- o modelo deve aceitar origens agregadas que venham do Bling, como Mercado Livre

Saídas:

- lista detalhada de vendas do dia
- resumo consolidado ao final da lista

Campos da lista detalhada:

- data/hora
- origem
- modelo
- SKU
- quantidade
- estoque atual
- último preço de compra
- último preço de venda

Resumo consolidado:

- agrupamento por `modelo + SKU`
- soma total vendida
- canais/origens que participaram

### Fase 3: Lista de Compra Persistente

Objetivo:
transformar o consolidado de vendas em uma fila operacional de recompra.

Comportamento:

- a lista é alimentada diariamente
- os itens ficam acumulados até tratamento manual
- a lista não é apenas relatório: ela precisa sustentar decisão de compra

Campos:

- modelo
- SKU
- estoque atual
- último preço de compra
- último preço de venda
- quantidade acumulada
- origens de venda
- status
- motivo

Status:

- pendente
- comprado
- não comprado
- removido

Regras:

- ao marcar `não comprado` ou `removido`, exigir motivo
- permitir recolocar depois um item removido ou não comprado
- permitir copiar e imprimir a lista

### Fase 4: Evolução

Itens posteriores:

- filtros por período
- filtros por canal
- melhorias de performance
- automação futura para geração de pedido de compra
- novas origens do Bling

## Arquitetura Proposta

### Componentes

Criar componentes dedicados para tirar complexidade da rota:

- `AdminDashboardPage`
- `DashboardKpiCards`
- `DashboardShopeePanel`
- `DashboardDailySalesPanel`
- `DashboardPurchaseQueueSummary`

Na Fase 1, somente os componentes dos KPIs e Shopee precisam estar ativos; os demais podem entrar de forma incremental.

### Camada de Dados

Criar serviços separados da UI:

- `dashboardMetricsService`
  - busca faturamento e lucro do dia
- `dashboardShopeeService`
  - busca contadores operacionais Shopee
- `salesConsolidationService`
  - unifica PDV, Shopee e Bling em um formato comum
- `purchaseQueueService`
  - gerencia a lista persistente de compra

Essa separação permite ativar blocos por fases e evita colocar lógica pesada dentro da página.

### Tolerância a Falhas

Cada bloco carrega isoladamente:

- falha nos dados da Shopee não pode derrubar os KPIs
- falha no consolidado de vendas não pode remover atalhos
- blocos devem exibir estado de erro curto e continuar o restante da tela

## Fluxos Funcionais

### KPIs do Dia

Entradas:

- vendas realizadas no dia
- custos conhecidos por item

Saídas:

- faturamento do dia
- lucro do dia

Observação:

- para a primeira entrega, lucro será calculado a partir de `preço de venda - último preço de compra conhecido`
- ajustes contábeis avançados ficam fora desta fase

### Shopee Operacional

O dashboard deve mostrar contadores clicáveis com hiperlink para a área correspondente, preferencialmente abrindo já com o contexto certo quando a tela permitir.

Estados:

- novos
- falta enviar
- enviados
- cancelados
- reclamações/devoluções

### Relatório Diário de Vendas

O relatório é diário, mas a consolidação precisa unificar origens numa lista só.

A lista detalhada deve preservar a origem de cada venda:

- PDV
- Shopee
- Bling
- futuras origens agregadas do Bling

Ao final, apresentar um resumo consolidado por `modelo + SKU`.

### Lista de Compra

A lista de compra não substitui o relatório diário; ela deriva dele.

Regras iniciais:

- item vendido no consolidado diário pode alimentar a fila de recompra
- itens pendentes continuam visíveis em dias seguintes
- usuário pode marcar comprado, justificar não compra, remover ou recolocar

## UX

Direção visual:

- manter o visual atual do admin
- reforçar leitura rápida da home
- separar claramente:
  - visão financeira
  - operação Shopee
  - vendas do dia
  - compra/reposição

Prioridade de leitura:

1. indicadores do dia
2. urgências Shopee
3. vendas do dia
4. resumo da compra

## Testes

### Fase 1

- dashboard continua abrindo em `/admin`
- atalhos antigos continuam funcionando
- blocos novos carregam sem afetar o restante da tela

### Fase 2

- consolidador junta múltiplas origens no mesmo formato
- origem da venda é exibida corretamente
- resumo final agrupa por `modelo + SKU`

### Fase 3

- lista de compra persiste status e motivo
- itens removidos podem ser recolocados
- copiar e imprimir funcionam sem alterar dados

## Fora de Escopo Agora

- automação completa de pedido de compra
- cálculo contábil avançado de lucro
- integração Mercado Livre nativa
- filtros analíticos amplos por período/canal na primeira entrega

## Ordem Recomendada de Implementação

1. Fase 1: dashboard seguro
2. Fase 2: consolidador de vendas
3. Fase 3: lista de compra persistente
4. Fase 4: polimento e expansão

## Revisão Rápida

Checklist:

- sem placeholders
- sem dependência de implementar tudo de uma vez
- sem substituir atalhos atuais
- com caminho claro para crescer por etapas
