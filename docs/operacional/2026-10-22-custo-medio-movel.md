# Custo medio movel de smartphones

Implementacao local solicitada em 22/10/2026. Nao publicada e nenhuma migration aplicada em producao nesta tarefa.

## Regra e fontes

`units.cost_price` continua sendo a compra real de cada IMEI. A configuracao reutiliza `smartphonePriceGroupsCore.configuration`: empresa, modelo, RAM, armazenamento, versao, rede e condicao; cores compartilham saldo. Nao ha nova regra concorrente de agrupamento. Nenhum preco de venda e recalculado por este controle.

`smartphone_inventory_cost_state` guarda o saldo gerencial por modelo/configuracao e os estados das unidades, sem IMEIs. `unit_journal_events`, ja existente e imutavel, e a origem dos movimentos. Eventos sao reconhecidos individualmente em `smartphone_inventory_cost_events`; nao se usa somente o maior AUTO_INCREMENT, para nao perder commits tardios. A leitura do painel projeta os movimentos em transacao com rollback e nao inicializa nem grava saldos.

Na ativacao, a base usa somente unidades fisicas `available` e `reserved`; vendidos e ocultos nao compoem o saldo inicial. Reserva conserva custo porque o aparelho ainda nao saiu; ocultacao/remoção retira valor medio e reativacao devolve o valor retirado. A media de compra dos IMEIs atualmente disponiveis continua mostrada separadamente, para nao confundir compra real com saldo gerencial.

Cada entrada soma o custo novo ao valor restante e divide pela quantidade total. Cada venda retira o valor medio, independentemente do IMEI escolhido. A precisao interna e de seis casas abaixo do centavo, em inteiros BigInt serializados como strings; os centavos residuais sao distribuidos nas baixas, preservando o total sem deixar residuo no estoque zerado. Pode haver um centavo de diferenca entre os custos registrados de vendas consecutivas.

Exemplo: 92500 + 99900 + 117000 centavos geram media de 103133 centavos exibidos. Qualquer primeiro IMEI vendido tem custo gerencial 103133; os demais conservam a mesma media exibida. A soma das tres baixas e 309400, com ajuste de um centavo em uma delas. Nova entrada altera a media do saldo restante, sem separar por dia.

## Vendas, edicoes e devolucoes

A finalizacao serializada trava modelos em ordem estavel antes dos produtos/unidades. Venda, itens, custo congelado, baixa por IMEI e saldo de custo sao confirmados na mesma transacao. O servidor substitui somente `sale_items.unit_cost`, `sales.cost_total` e `sales.profit` pelo custo gerencial; valores de venda e compra real nao mudam. Taxa da operadora e entrega continuam descontadas do lucro. `smartphone_sale_cost_basis` guarda a base imutavel por venda/unidade, incluindo a compra real observada na venda.

Repetir a mesma requisicao devolve a venda ja confirmada, sem refazer a media. Falha em itens, unidades, estoque ou saldo de custo desfaz a transacao inteira. A confirmacao de IMEI no PDV consulta a media na referencia de precos existente para a previa do carrinho; a finalizacao confere novamente no servidor.

Abrir/atualizar os custos de uma venda consulta a base congelada e nao troca a media pelo custo atual do IMEI ou produto. A API bloqueia edicao generica do custo congelado e acesso generico as tres tabelas de controle. Vendas sem base anterior mantem o fluxo legado; o controle novo nao reconstitui ou reprecifica vendas anteriores a ativacao.

Retorno de uma unidade vendida repoe o valor gerencial retirado, mesmo que tenha havido nova compra ou correcao posterior do custo real. Correcao da compra de um IMEI ainda em estoque ajusta o saldo atual pela diferenca; a correcao de um vendido nao altera o lucro registrado. Compra desconhecida impede finalizar uma nova venda da configuracao; zero conhecido e valido.

Os escritores de unidades sincronizam o saldo pelo helper canonico de estoque nos tres entrypoints. A finalizacao por foto sincroniza antes do commit. Demais saidas com vinculo a venda sao consumidas pelo diario; custos/totais de vendas novas existentes sao atualizados pelo controle, preservando vendas anteriores a ativacao.

## Ativacao futura

1. Seguir `publish-vps` mediante pedido de publicacao. Fazer backup de banco/codigo e suspender escritas operacionais durante a migration e a base inicial.
2. Conferir diario/triggers instalados. Aplicar explicitamente `migrations/vps-smartphone-moving-average.sql` no MySQL operacional. Ela cria tres tabelas vazias; nao altera precos, compras ou vendas.
3. Disponibilizar os dois modulos `smartphoneMovingAverage*`, dependencias canônicas e `scripts/initialize-smartphone-moving-average.cjs` na API. Do diretorio da API, rodar o inicializador primeiro em dry-run e depois `--apply`. Ele preserva modelos ja inicializados e nao reaplica base. Conferir quantidades e custos ausentes antes de retomar vendas.
4. Publicar `serializedSaleFinalization.cjs`, `smartphonePhotoIntakeServer.cjs`, `smartphonePriceGroupsServer.cjs` e as alteracoes de `syncProductStock` nos entrypoints efetivos. `--photo-intake-only` isolado nao atualiza esses hooks nem a finalizacao de vendas; nao basta para esta entrega.
5. Publicar o frontend apos API/schema e validar consultas e previas sem gravar vendas reais de teste. Nao remover tabelas de custo ou diario em rollback de codigo.

## Validacao local

Testes de media/entradas/devolucao/arredondamento/custos desconhecidos; transacao serializada com base autoritativa, retry e rollback; diario com IDs tardios e consulta sem mutacao; protecao API e atualizacao da venda preservando base. Suites de grupos, cadastro por foto, dinheiro e navegador do painel, alem de build e sintaxe.

Comando focado: `node --test tmp-tests/smartphone-moving-average.test.cjs tmp-tests/smartphone-moving-average-server.test.cjs tmp-tests/serialized-sale-transaction.test.cjs tmp-tests/sale-moving-average-refresh.test.cjs tmp-tests/pdv-moving-average-preview.test.cjs`. Tambem executar `npm.cmd run test:smartphone-price-groups`, `npm.cmd run test:smartphone-photo-intake`, `npm.cmd run test:money` e `npm.cmd run build`. O deploy verifica as tres tabelas e os cinco triggers relevantes do diario antes de qualquer upload desta API; recusa publicar se faltar a migration.

MySQL real local nao estava disponivel: o Docker CLI existe, mas o daemon estava desligado. Os testes de banco desta tarefa usam fixtures transacionais, sem acesso ou escrita em producao. Validacao da migration em MySQL isolado fica obrigatoria antes de ativar em producao.
