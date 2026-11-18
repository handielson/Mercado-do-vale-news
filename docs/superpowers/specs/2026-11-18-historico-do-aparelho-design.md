# Histórico do aparelho e devolução de itens — design

- Data: 18/11/2026
- Autor: Claude (com Handielson)
- Status: aprovado pelo usuário em 18/11/2026 ("pode fazer, na sua sequência")
- Skill: superpowers:brainstorming → próximo passo superpowers:writing-plans

## 1. Objetivo

Duas entregas ligadas:

1. Cada aparelho serializado (celular e tablet, por IMEI/serial) ganha uma **página própria no admin** com a vida dele em ordem: entrada no estoque, por onde passou, reservas, vendas, cancelamentos, devoluções, RMA, trocas e ajustes, até onde está e de quem é agora.
2. **Devolução de itens da venda**, parcial ou completa, com estorno financeiro documentado (comprovantes, recibo em PDF, termo assinado).

Motivo (caso real de 18/11): a venda 8D7563B4 (Poco X8, IMEI 868499080873669) foi estornada e o aparelho voltou ao estoque. O registro existe, mas espalhado. O "Diário do aparelho" atual é o log bruto do banco: 26 linhas, a maioria de produto e de outro aparelho do mesmo SKU, sem cliente, valor ou link da venda.

### Decisões do usuário
- **Só para a loja (admin).** Nada da página nem dos eventos internos aparece para a cliente.
- Abordagem **B** (de 3): página + o aparelho passa a ter registro e local próprios. Com a devolução, a entrega fica em três partes.
- Transferir celular passa a pedir o IMEI (o usuário aceitou isso ao escolher B).
- **Todo aparelho nasce no Depósito** (Deposito / Entrada / Conferencia); o usuário transfere depois. Os disponíveis sem local hoje vão para lá na implantação.
- **Devolução parcial ou completa dos itens entra no projeto.**
- Estorno: opção de devolver **na mesma forma em que entrou**; se não for assim, informar o método da devolução. Pix e estorno no cartão exigem **upload do comprovante**.
- A devolução gera um **comprovante em PDF** para mandar no WhatsApp da cliente e para **imprimir, a cliente assinar e subir no sistema**. Com isso a devolução fica **finalizada**, com todas as informações daquela venda.

### Fora do escopo
- Saldo calculado a partir dos eventos (abordagem C, descartada).
- Produtos sem IMEI/serial (acessório, 3D): seguem com o histórico do produto.

## 2. Como funciona hoje (levantamento)

| Fonte | O que tem | Por aparelho? |
|---|---|---|
| `units` | status (`available`, `sold`, `reserved`, `hidden`, `rma`, `scrapped`), IMEI 1/2, serial, custo, `sale_id`/`order_id`, `intake_id`/`intake_photo_path`, `deposit_id`/`location_id` | Sim, mas **local vazio em 261 de 285** (vendidos inclusos) |
| `unit_journal_events` (triggers `mdv_unit_journal_*`, desde 14/10/2026) | antes/depois de `units`, `products`, `sales`, `orders`, `sale_items`, `product_stock_locations`, `stock_location_movements`. Tem `baseline` e `existing_sale_reference` para o que existia antes | Mistura: eventos de produto e de saldo por local caem no diário de **todos** os aparelhos do produto |
| `sale_items.serialized_unit_id` + `sales` | venda, cliente, valor, forma de pagamento, status, caixa do estorno (`refund_cash_session_id`) | Sim |
| `smartphone_photo_intakes` | entrada por foto (foto, IA, preço confirmado) | Sim, via `units.intake_id` |
| `warranty_documents`, `signed_warranty_documents` | termo de garantia da venda | Sim (`serialized_unit_id`) |
| `unit_swap_logs` | troca de aparelho em pedido (`old_unit_id`/`new_unit_id`) | Sim |
| `smartphone_sale_cost_basis` | custo usado na venda | Sim |
| `stock_location_movements` / `product_stock_locations` | transferência e saldo por local | **Não**: só produto e quantidade (`POST /stock-locations/transfers`) |

Leitores atuais: `services/unitJournalServer.cjs` (`GET /admin/units/:unitId/journal`, `GET /admin/units/journal?identifier=`, `GET /admin/products/:productId/journal`) e `components/inventory/UnitJournalModal.tsx` (aberto em `SerializedUnitsPage` e `ProductCard`).

Mudanças de status passam por `services/units.ts` (`release`, `markAsSold`, `markAsRma`), `saleService.ts` (venda, cancelamento, estorno), `orderService.ts` (pedido online), `serializedSaleFinalization.cjs` (finalização PDV na API) e pela entrada (`smartphonePhotoIntakeServer.cjs`, `POST /units`, e a futura porta única do spec `2026-11-05-entrada-unica-design.md`).

## 3. Abordagens consideradas

- **A. Só a página sobre o que existe.** Rápida e cobre o passado, mas não resolve "onde está" nem transferências.
- **B. Página + registro próprio do aparelho + local por aparelho.** *(escolhida)* Linha do tempo confiável daqui para frente; o passado vem da reconstrução da A.
- **C. Saldo calculado pelos eventos.** Descartada: mexe no estoque inteiro, risco alto e pouco ganho.

## 4. Parte 1 — Página do aparelho

### Rota e acesso
- `/admin/aparelhos/:identificador`, em que o identificador pode ser IMEI 1, IMEI 2, serial ou id da unidade. Se achar mais de um aparelho, lista para escolher. Se não achar, diz isso e mostra a busca.
- Busca por IMEI/serial no topo da própria página e um item **Aparelhos** no menu de Estoque.
- Links para a página: ícone de histórico na lista de Unidades (troca o modal), IMEI nos itens de **Detalhes da venda**, aba Estoque/unidades do produto e o resultado de busca por IMEI que existir.
- Só admin (mesma regra do leitor do diário: sessão de administrador). Nada novo em rotas da cliente.
- Pensada para celular primeiro (Estoque é das áreas mais usadas no celular).

### Topo (resumo)
- Produto (nome, SKU, foto), IMEI 1, IMEI 2, serial, condição.
- **Situação agora**: Disponível / Reservado (pedido) / Vendido (cliente + link da venda) / RMA / Oculto / Descartado.
- **Onde está**: depósito e local; se vazio, "Local não registrado" com o botão **Definir local** (Parte 2).
- Custo de entrada, preço atual, dias em estoque (desde a última entrada) e quantas vezes foi vendido/devolvido.
- Ações rápidas que já existem hoje, sem regra nova: abrir produto, abrir venda atual, imprimir etiqueta.

### Linha do tempo
Mais novo primeiro, cada item com data/hora, o que aconteceu em português, quem fez (quando souber) e links. Eventos da Parte 1, reconstruídos no servidor:

| Evento | De onde sai |
|---|---|
| Entrada no estoque (manual, por foto, importação) | `unit_insert` do diário; `intake_id` → foto e dados da entrada por foto; `baseline` para o que já existia em 14/10 ("já estava cadastrado") |
| Dados do aparelho corrigidos (IMEI/serial/custo/condição) | `unit_update` com mudança nesses campos |
| Reservado / reserva liberada (pedido online) | `unit_update` de status com `order_id` |
| Vendido | `sale_items_insert` + `sales`: cliente, vendedor, valor do item, total, forma de pagamento, link da venda |
| Venda cancelada / estornada | `sale_update` para `cancelled`/`refunded` + `refund_cash_session_id`; a liberação seguinte (`unit_update` para `available`) aparece como "Voltou ao estoque" |
| Garantia emitida / termo assinado | `warranty_documents`, `signed_warranty_documents` |
| Trocado em pedido | `unit_swap_logs` (entrou no lugar de / saiu no lugar de) |
| RMA, oculto, descartado | `unit_update` de status |
| Venda anterior ao diário | `existing_sale_reference` |

Regras:
- Eventos `product_*`, `product_stock_locations_*` e `stock_location_movements_*` **não** entram na linha do tempo (são do produto). Ficam só em **Dados técnicos**.
- **Dados técnicos**: uma seção recolhida com o diário bruto atual (o que o modal mostra hoje, com impressão e WhatsApp), para auditoria.
- Mesmo evento visto por duas fontes (ex.: `sale_items_insert` e o `unit_update` para `sold`) vira **um** item.
- O nome da cliente aparece (página interna).

### Servidor
- `GET /admin/units/:unitId/timeline` e `GET /admin/units/timeline?identifier=` (admin). Devolve `{ unit, product, current: {status, location, sale, order}, events: [...] , technical_available: true }`.
- A montagem fica num módulo próprio (`services/unitTimeline.cjs`), com função pura que recebe as linhas das fontes e devolve os eventos, para testar com casos reais (o Poco 868499080873669 é o primeiro caso de teste).

## 5. Parte 2 — Registro e local do aparelho

### Tabela `unit_events`
Só inclusão (triggers bloqueiam UPDATE/DELETE, como no diário). Campos: `id`, `unit_id`, `product_id`, `event_type`, `occurred_at`, `actor_user_id`, `actor_name`, `from_deposit_id`, `from_location_id`, `to_deposit_id`, `to_location_id`, `status_before`, `status_after`, `reference_type`, `reference_id`, `reason`, `payload_json`.

Tipos: `entry`, `transfer`, `location_set`, `reserved`, `reservation_released`, `sold`, `sale_cancelled`, `sale_refunded`, `returned_to_stock`, `rma_sent`, `rma_returned`, `hidden`, `unhidden`, `scrapped`, `swapped_in`, `swapped_out`, `data_corrected`.

Quem grava: a **API**, na mesma transação da mudança, num helper único (`recordUnitEvent`) chamado de cada fluxo da seção 2. O frontend não grava eventos direto.

A página passa a usar `unit_events` como fonte principal a partir da data da implantação e a reconstrução da Parte 1 para antes. Na virada, um evento das duas fontes vira um item só.

### Local por aparelho
- `units.deposit_id`/`location_id` passam a ser a verdade de onde o aparelho está.
- **Regra de consistência** para produto serializado: o saldo de `product_stock_locations` de cada local = número de aparelhos `available`/`reserved` naquele local. Toda mudança de local do aparelho mexe nos dois na mesma transação.
- **Transferência**: na tela de transferência, produto serializado pede os IMEIs (bipar ou escolher da lista do local de origem). A quantidade é a soma dos IMEIs escolhidos. Grava `transfer` por aparelho + o movimento de produto que já existe.
- **Venda PDV**: aparelho com local conhecido sai **do local dele**. Sem local, segue a prioridade atual (Loja Principal antes) e grava no evento de onde saiu.
- **Volta ao estoque** (cancelamento/devolução): Deposito / Entrada / Conferencia.
- **Entrada**: todo aparelho novo nasce em Deposito / Entrada / Conferencia, em todos os caminhos de entrada (porta única do spec de 05/11 quando existir).
- **Definir local**: botão na página do aparelho. Grava `location_set` e ajusta o saldo por local (sai de um local do produto que tenha saldo sem aparelho atribuído, entra no local escolhido).
- **Implantação**: os 68 aparelhos disponíveis sem local (de 86) vão para Deposito / Entrada / Conferencia, com evento `location_set` ("local inicial na implantação") e saldo por local ajustado; o usuário transfere depois.

## 6. Parte 3 — Devolução de itens da venda

Hoje existem "Cancelar venda" e "Estornar venda" (venda inteira: devolve estoque, libera aparelho, registra no caixa) e "Estornar parte do pagamento" (`sale_partial_refunds`: só dinheiro, por forma de pagamento, sem estoque). Não há devolução por item.

### Fluxo (em Detalhes da venda → **Devolver itens**)
1. **Itens**: lista os itens da venda com a quantidade já devolvida; escolher itens e quantidades (aparelho é 1 por IMEI). Motivo obrigatório (ex.: "cliente desistiu").
2. **Valor**: para cada item, valor pago = preço do item − parte proporcional dos descontos da venda (desconto do item, desconto promocional, ajuste final, cupom). O total sugerido pode ser editado para menos (ex.: item danificado), nunca para mais do que o saldo devolvível.
3. **Estorno financeiro**:
   - **Mesma forma em que entrou** (padrão): divide o valor pelas formas de pagamento da venda, na ordem dinheiro → Pix → débito → crédito, sem passar do que entrou em cada uma menos o que já foi estornado. Pix com `mercado_pago_payment_id` estorna pelo Mercado Pago (como o estorno parcial faz hoje). Cartão: o operador estorna na maquininha; o sistema registra.
   - **Outra forma**: o operador escolhe o método (dinheiro, Pix, transferência, outro) e o valor de cada um.
   - Crediário (`a_prazo`): abate do débito da cliente pelo fluxo do crediário, sem dinheiro.
   - Estorno em dinheiro exige caixa aberto (sai do caixa aberto no momento, como o estorno de hoje). As outras formas não dependem de caixa, mas entram no caixa aberto se houver.
   - **Comprovante obrigatório** para Pix manual e estorno no cartão (foto/PDF); pode subir na hora ou depois.
   - **Dinheiro**: o comprovante é o próprio recibo de devolução assinado (declaração de recebimento abaixo); não há upload separado. A saída de dinheiro no caixa fica ligada à devolução. Pix estornado pelo Mercado Pago guarda o id do estorno como comprovante.
   - Cartão com juros repassados: o valor do estorno no cartão é o valor com juros proporcional (`total_with_fee`), para a cliente receber o que pagou.
4. **Confirmar**: na mesma transação, os itens voltam ao estoque (produto comum: local de onde saiu, como `restoreSaleStockByLocation`; aparelho: Depósito / Entrada / Conferencia), o aparelho volta a `available` com evento "Devolvido", grava a devolução e as saídas no caixa aberto.
5. **Recibo de devolução (PDF)**: dados da loja, cliente, venda original (número, data, itens), itens devolvidos com IMEI/serial, valores, formas de estorno, motivo, operador, campo de assinatura da cliente. Quando houver dinheiro em espécie, uma **declaração de recebimento** acima da assinatura: "Declaro que recebi de Mercado do Vale a quantia de R$ X (valor por extenso) em dinheiro, referente à devolução dos itens acima da venda #N." Um documento só (decisão do usuário: o recibo de devolução já serve como recibo do dinheiro). Botões **Enviar no WhatsApp** (mesma automação do PDF de garantia, `/whatsapp/automation/...`) e **Imprimir**.
6. **Finalizar**: subir o recibo assinado (mesmo processo do termo de garantia assinado: foto/scan → PDF). Quando o recibo assinado e os comprovantes obrigatórios estão no sistema, a devolução fica **Finalizada**.

### Estados
- Devolução: `pendente` (registrada, faltam comprovante e/ou recibo assinado) → `finalizada`. Estoque e caixa já mudam no `pendente`: o item voltou fisicamente.
- Venda: `parcialmente devolvida` ou `devolvida` (todos os itens). Devolver tudo substitui o "Cancelar/Estornar venda" quando houve pagamento; "Cancelar" continua para venda lançada por engano.
- Lista de **devoluções pendentes** (falta comprovante ou assinatura) no admin, para não ficar esquecida.

### Dados
- `sale_returns`: venda, status, motivo, total, operador, caixa, datas, recibo PDF gerado, recibo assinado (arquivo privado), WhatsApp enviado (status/data).
- `sale_return_items`: item da venda, quantidade, valor, `serialized_unit_id`, local de retorno.
- `sale_return_refunds`: forma original ou escolhida, valor, índice da forma de pagamento da venda, gateway/ids, comprovante (arquivo privado), status.
- Arquivos em `private-uploads` (nunca públicos), lidos só por admin.

### Efeitos que precisam acompanhar
- Bling: devolução de estoque como no cancelamento (`syncReturnedSaleStockToBling`).
- Moedas de indicação/cashback e créditos de entrega: proporcionais ao valor devolvido (cancelamento total já estorna hoje).
- Lucro/relatórios da venda passam a descontar o devolvido.
- Área da cliente: venda devolvida esconde os dados do aparelho devolvido (regra da v1.2.861, estendida a item devolvido).
- NFC-e/NF-e: se a venda tiver nota, avisar que a nota de devolução é feita à parte. Emissão fiscal fica fora deste projeto.

## 7. Critérios de aceite

- Abrir `/admin/aparelhos/868499080873669` mostra: entrada por foto em 30/10, vendido para Eliany Alves De Carvalho na venda #8D7563B4 por R$ 1.999,00, venda estornada em 18/11, voltou ao estoque em Loja Principal / Estoque Geral, situação Disponível. Sem os eventos de produto na linha do tempo.
- O IMEI 2 e o serial encontram a mesma página.
- Cliente sem sessão admin recebe 401 nas rotas novas.
- Parte 2: transferir um celular de um local para outro exige o IMEI e muda o local do aparelho e os saldos dos dois locais juntos; a página mostra a transferência com quem fez.
- Parte 2: vender, estornar, reservar, mandar para RMA e definir local geram exatamente um evento cada.
- Parte 3: devolver só o Poco da venda 8D7563B4 (cenário de teste) sugere R$ 1.916,17 (R$ 1.999,00 − R$ 82,83, a parte dele nos R$ 84,48 de desconto); estorna em dinheiro + cartão; o aparelho vai para o Depósito disponível; a película e o copo continuam vendidos; a venda fica "parcialmente devolvida"; o PDF sai com os IMEIs; ao subir o recibo assinado e o comprovante do cartão, fica "Finalizada".
- Testes de regressão (regra do `publicar.md`): montagem da linha do tempo com o caso real, rotas só admin, consistência local × saldo, um evento por ação.

## 8. Decisões tomadas pelo Claude (corrigíveis)

- Nome e rota: **Aparelhos**, `/admin/aparelhos/:identificador`.
- A página substitui o modal "Diário do aparelho" nos atalhos; o diário bruto fica em "Dados técnicos". O histórico do **produto** (modal no `ProductCard`) continua como está.
- Parte 1 não grava nada novo; só lê.
- Na Parte 2, a API é a única que grava eventos.
- Aparelho devolvido volta para **Deposito / Entrada / Conferencia** (para conferir antes de voltar à vitrine); produto comum volta para o local de onde saiu.
- Ordem das entregas: **1** página do aparelho → **2** registro/local por aparelho (Depósito, transferência por IMEI) → **3** devolução de itens. A 3 pode vir antes da 2 se for mais urgente; ela grava a própria tabela e a página lê.
- Crédito na loja e troca não entram (o usuário não pediu); a devolução já fica preparada para ganhar esse método depois.
- Distribuição do estorno "mesma forma": dinheiro → Pix → débito → crédito.
- Comprovante pode subir depois; a devolução fica pendente até ter tudo.

## 9. Fica para quem constrói

- Layout exato dos cards e ícones (seguir o padrão do admin; celular primeiro).
- Paginação da linha do tempo (aparelho raramente passa de algumas dezenas de eventos).
- Ordem de ligar `recordUnitEvent` nos fluxos, desde que todos da seção 5 estejam cobertos antes de publicar a Parte 2.
