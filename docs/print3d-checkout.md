# Checkout e PIX 3D — implementação local

Nenhuma migration, configuração externa, cobrança real ou publicação foi executada. Rotas desligadas por padrão. Testes usam banco e provedor simulados.

Validação local usa testes focados e cenário de navegador móvel com APIs externas bloqueadas. O cenário verifica retry com a mesma chave, escolha de entrada/frete, PIX simulado, confirmação da entrada e prévia sem chamadas à API da loja. Isso não substitui homologação em MySQL e provedor reais.

Após a correção da regra: 124 testes automatizados passaram, incluindo 432 comparações de prévia/servidor dentro da suíte. Navegador móvel validou 50%, 70% e 100% nos três modos, recusa de 49%, repetição do pedido e estorno. A barra de comparação MDV não aparece nas rotas 3D.

## Regra confirmada pelo operador

- Todos os pedidos: cliente escolhe entrada de 50% a 100% dos produtos, incluindo peças prontas. O estoque altera a produção necessária, não a entrada.
- Frete posterior: percentual escolhido dos produtos agora; restante dos produtos e frete inteiro no saldo.
- Frete inteiro agora: percentual escolhido dos produtos mais todo o frete na entrada.
- Frete dividido: percentual escolhido do total (produtos e frete) na entrada; restante no saldo. Com 50%, paga metade do pedido com frete.
- Percentuais em pontos-base inteiros (5000–10000), centavos inteiros e arredondamento global para cima. Tela mostra entrada e saldo antes da confirmação.
- Saldo quitado antes do envio; se houver encomenda, cobrança do saldo aguarda produção concluída. Pagamento antecipado de 100% do total quita o pedido; 100% dos produtos com frete posterior ainda deixa saldo de frete.
- Conta 3D verificada; encomenda exige WhatsApp verificado.

## Implementação

Checkout, pedido, reserva das peças prontas por localização, plano financeiro e OPs são gravados numa transação. A cotação de frete é assinada por dez minutos e vinculada ao carrinho, preço, divisão pronta/encomenda, prazo e CEP. Mudanças exigem nova conferência. Valores do navegador não definem o pedido.

PIX tem intenção persistida antes da chamada ao provedor e chave estável para recuperar uma tentativa interrompida. Webhook assinado consulta o pagamento canônico; recebedor, moeda, método, referência e valor precisam corresponder. Somente confirmação financeira libera produção. A cobrança do saldo exige produção concluída; quitação integral exige a soma total, incluindo frete.

Cancelamento antes de qualquer confirmação financeira trava pedido, cobranças, OPs e cada localização reservada na mesma transação. A liberação diminui somente o saldo ainda reservado, grava movimento `release_reservation` e mantém evento de auditoria. A varredura de PIX vencido usa o mesmo caminho. Uma aprovação recebida depois do cancelamento fica registrada como `late_payment` para revisão/estorno, sem recibo, produção ou reativação do pedido.

Telas: `/loja-3d/checkout`, `/loja-3d/pedidos`, `/loja-3d/conta/producao`. Demonstração explícita usa dados fictícios. Consulta real exige sessão 3D; não usa sessão MDV. Tabelas financeiras/reservas bloqueadas no CRUD genérico.

## Pendências para ativação

Entradas e ajustes manuais usam `services/manualStockMovement.cjs`, compartilhado pelas duas entradas da API. Travam produto e saldo antes da leitura, gravam movimento e total na mesma transação e preservam a quantidade reservada. Testes MySQL locais cobriram entrada versus reserva, ajuste versus reserva, rejeição de ajuste abaixo do reservado, rollback de movimento inválido e criação concorrente do primeiro saldo de um local. Essas operações ainda não possuem chave de idempotência: duas entradas intencionais somam duas vezes; uma retentativa após resposta perdida exige conferência do histórico.

O consumo/liberação das reservas MDV foi extraído para `services/orderStockReservation.cjs`: trava o pedido, verifica operação anterior, trava produtos em ordem estável e atualiza saldo/movimentos/total na mesma transação. Consumo e liberação são mutuamente exclusivos; repetição da mesma operação não baixa novamente. MySQL local confirmou consumo concorrente repetido, disputa consumir/liberar, preservação da reserva de outro pedido e rollback após erro no movimento. Pedidos 3D continuam usando seu fluxo próprio. Ainda é necessário auditar reservas legadas com operações parcialmente gravadas antes desta correção e a confirmação financeira MDV, que continua fora desta transação de estoque.

Em 27/09/2026, os testes em MySQL 8.4 descartável confirmaram concorrência e rollback. Depois, um backup integral do banco operacional foi restaurado em outro MySQL 8.4 descartável: as migrations 028–051 foram aplicadas sobre a cópia fiel, preservando as contagens de 2.771 produtos, 9 pedidos e 2 banners. As mesmas migrations foram então aplicadas ao banco operacional com trava exclusiva, backup validado e comparação de produtos, pedidos, banners e totais de estoque antes/depois. Todas as habilitações 3D continuam desligadas. Ainda faltam provedor de pagamento, NAS, transportadora, saldos iniciais de materiais e operação piloto.

- Configurar e homologar a varredura de vencimentos, o cancelamento do PIX no provedor e a fila de revisão/estorno de pagamentos tardios. O trabalhador local só inicia com `MDV_PRINT3D_EXPIRY_ENABLED=1`, checkout totalmente pronto e intervalo de 1 a 60 minutos; ele permanece desligado sem essas condições. **Não ativar operação real antes disso.**
- As migrations 040–048 e dependências já foram homologadas na cópia fiel e aplicadas com as funções desligadas. Antes da ativação, preencher e conferir os saldos físicos, repetir a concorrência em operação piloto controlada e validar reinício/recuperação.
- Configurar empresa central por `MDV_PRINT3D_COMPANY_ID`; habilitações separadas de clientes, frete, produção e checkout. Checkout usa `MDV_PRINT3D_CHECKOUT_ENABLED=1` somente depois das dependências.
- PIX exclusivo: `MDV_PRINT3D_PAYMENTS_ENABLED`, `MDV_PRINT3D_MP_ACCESS_TOKEN`, `MDV_PRINT3D_MP_COLLECTOR_ID`, `MDV_PRINT3D_MP_WEBHOOK_SECRET` e `MDV_PRINT3D_MP_NOTIFICATION_URL` HTTPS terminando em `/print3d/payments/webhook`. Segredos só no servidor. Nenhuma reutilização automática das credenciais MDV.
- Homologar webhook, timeout/repetição, pagamento tardio e reembolso no provedor. Reembolso/chargeback exige revisão operacional; não libera produção.
- Integrar trava da expedição, controle físico de acessórios e demais insumos, e fluxo fiscal. O filamento já é baixado por cor no apontamento local; as peças aprovadas ficam reservadas ao pedido, sem entrar no estoque vendável. A expedição deve consumir essa alocação somente depois da quitação.

Fontes oficiais consultadas para o adaptador: [PIX Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/integrate-pix) e [webhooks](https://www.mercadopago.com.br/developers/pt/docs/links-and-debts/additional-content/your-integrations/notifications/webhooks?scope=prod).

A reconciliação externa agora passa por `services/externalStockReconciliation.cjs`, com trava por produto e confirmação conjunta dos locais, movimentos e total. Uma reentrada conserva as peças reservadas em seus locais e envia apenas o saldo livre para Entrada/Conferência. Saldo externo abaixo do reservado retorna `external_stock_below_reserved` e conserva o saldo físico local; requer conferência operacional. As rotas revisadas não gravam o total antes da reconciliação. O lote de preços/estoque comunica erros no corpo e seu cliente verifica o resultado mesmo com HTTP 200. Preços e estoque ainda têm transações separadas: falha de estoque não desfaz um preço já confirmado.

Validação local: MySQL descartável com schema mínimo, testes focados de contrato e interpretação de respostas, e build. Não valida todos os escritores legados nem ordenação temporal dos eventos externos. A regressão antiga `bling-sync-prices-vps-regression.test.mjs` está impedida pela ausência de `api/bling.ts`.

A edição individual (`PUT /products/:id`) usa a reconciliação na conexão da transação de cadastro/preço. A opção `transactional` do escritor de preços garante transação também para produtos que não são smartphones. O reconciliador não confirma nem libera uma conexão recebida do chamador. Estoque omitido não é alterado; estoque menor que o reservado produz HTTP 409 e desfaz a edição. MySQL mínimo confirmou rollback depois do ajuste, recusa e confirmação conjunta. A importação em lote e demais escritores legados continuam na auditoria.

A importação `/products/batch` também opta pela transação por item. O INSERT inicia saldo zero e o ramo de atualização não sobrescreve o total; a reconciliação usa a mesma conexão quando o payload contém saldo não nulo. A identidade resolvida previamente pelo Bling permanece canônica. Colisão de outra chave com ID diferente falha e reverte o item, incluindo alterações comerciais. O cliente interpreta `errors` mesmo em HTTP 200. Isso mantém sucesso parcial entre itens, mas elimina sucesso parcial dentro do cadastro/estoque de um item. Teste local executou handler e SQL reais com schema central mínimo ampliado (não uma cópia fiel da operação), cobrindo cadastro novo, estoque omitido, conflito de SKU, rollback e reserva concorrente.

A materialização de saldo sem local usa agora o modo `materializeUndistributed` do reconciliador. Ele lê `products.stock_quantity` sob trava e preenche apenas a diferença positiva entre total central e locais. Chamadas repetidas/simultâneas não adicionam novamente a diferença; o histórico continua identificado como `undistributed_stock`. MySQL mínimo confirmou concorrência, rollback e preservação das reservas. Isso não substitui a carga inicial legada nem a sincronização por IMEI, ainda pendentes de revisão.

A carga inicial usa `materializeUndistributed` com `initialMigration`: o saldo é lido sob trava do produto e a operação é omitida quando já existe qualquer local ou histórico de migração inicial. O destino continua sendo o estoque geral, sem redirecionar a carga histórica para Entrada/Conferência. Testes locais confirmaram uma única inicialização concorrente e preservação das reservas. O estoque serializado permanece pendente: checkout 3D reserva quantidades e a sincronização de unidades recria locais com reservas derivadas dos status dos IMEIs; esses contratos ainda precisam ser conciliados.

Cancelamento foi validado no MySQL mínimo com concorrência, isolamento do cliente, bloqueio de pedido pago, preservação de reserva de outro pedido e rollback de movimento. A primeira execução real da seleção de expiração revelou erro 3065 do MySQL por `DISTINCT` e `ORDER BY updated_at`; o agrupamento por pedido com `MIN(updated_at)` e desempate por ID corrigiu essa consulta. Ainda é necessário revisar avanço entre lotes com candidatos futuros/conflitantes e homologar cancelamento no gateway antes de ativar o trabalhador.

O varredor de expiração agora pagina por ID de pedido, evitando que candidatos futuros ou conflitos esperados prendam a execução no primeiro lote. `limit` limita cancelamentos confirmados; `scanned` pode ser maior. Conflitos 404/409 são preservados para revisão em `review_order_ids` e não interrompem os demais; o trabalhador registra somente uma contagem. Erros inesperados continuam falhando a execução. MySQL local confirmou futuro → pago/revisão → vencido com página de um item. Homologação de volume e retry/cancelamento do provedor seguem pendentes antes de ativar.

O cancelamento remoto possui agora confirmação persistida na cobrança (`provider_cancelled`, projetado como `cancelled` ao cliente). O trabalhador habilitado busca pedidos 3D já cancelados com cobranças locais `cancelled` e ID remoto; tenta novamente após falhas e deixa de selecionar os confirmados. Tentativas sem conclusão atualizam `updated_at`; lotes são ordenados pela tentativa mais antiga. A repetição manual também consulta pendências. MySQL descartável e adaptador simulado confirmaram recuperação após timeout/recriação do trabalhador sem reativar pedido. Cobranças sem ID remoto persistido e homologação externa seguem pendentes.

A resposta tardia de criação do PIX após cancelamento agora grava o ID remoto validado mesmo quando ainda está pendente. O estado local não volta a ativo e o código PIX não é exposto; o trabalhador consegue reencontrar a cobrança para cancelamento remoto. Teste MySQL com adaptador suspenso confirmou cancelamento concorrente, persistência da identidade e encerramento posterior sem recibo. Timeout permanentemente sem resposta/webhook ainda exige uma estratégia de recuperação da identidade remota e homologação.


### Recuperação de PIX com resposta perdida — validação local

- Cobranças de pedidos 3D cancelados sem identificador remoto entram na reconciliação persistente.
- A busca usa `external_reference=print3d:<charge.id>` na API de pagamentos do Mercado Pago. Exige um único resultado, valida conta recebedora, moeda, método e valor, e consulta novamente o pagamento pelo ID antes de cancelar.
- Busca vazia, ambígua ou incompatível mantém a pendência para nova conferência. Nunca cria outro PIX nem reabre pedido cancelado. Pedidos ativos e de outros canais são excluídos na consulta SQL.
- Evidência: 38 testes focados passaram; MySQL 8.4 local descartável passou incluindo resposta perdida, busca inicialmente vazia, recuperação após recriar o trabalhador e ausência de recibos indevidos. Provedor simulado, sem chamadas financeiras reais.
- Limitação: homologação real permanece pendente. A documentação do provedor limita a busca aos últimos 12 meses; ausência de resultado não prova que a cobrança nunca existiu. Pendências antigas exigem conferência administrativa.
- Referência oficial: https://www.mercadopago.com.br/developers/en/reference/online-payments/subscriptions/search-payments/get


### Avisos administrativos de reconciliação PIX — local

- Pedidos 3D agora expõem contagem de cobranças cujo cancelamento remoto ainda está pendente e contagem/valor de pagamentos tardios, usando exclusivamente `print3d_payment_charges` do pedido.
- O cartão de pedido mostra avisos distintos para conferência de cancelamento e análise de estorno. Valores tardios continuam separados dos recibos confirmados; o aviso não executa estorno.
- Validação: 8 testes focados, build Vite e navegador móvel com APIs interceptadas passaram. MySQL local confirmou o aviso pendente e sua remoção após reconciliação. Nenhuma publicação ou chamada financeira real.
- Pendente: fluxo administrativo de resolução/estorno com rastreabilidade e homologação real do provedor.


### Reconciliação de estorno de pagamento tardio — local

- O trabalhador agora revisita cobranças `late_payment` de pedidos cancelados por consulta ao provedor. Não solicita estorno automaticamente.
- Uma resposta autenticada e correspondente à cobrança com status `refunded` e valor integral estornado encerra a pendência daquela cobrança. A ordem permanece cancelada e nenhum recibo de compra é criado.
- Estornos parciais continuam em revisão. Notificações antigas de cancelamento não apagam um pagamento tardio; notificações antigas de aprovação não reabrem uma cobrança já estornada.
- Painel mostra a quantidade de estornos integrais confirmados separadamente. O evento histórico de pagamento tardio permanece preservado.
- Evidência: 45 testes focados, integração MySQL descartável (incluindo parcial, integral, repetição, histórico e listagem real), navegador móvel com APIs interceptadas e build passaram.
- Pendentes: solicitação administrativa de estorno e homologação real. Nenhuma operação financeira externa ou publicação executada.


### Notificações simultâneas de pagamento — correção validada

- Teste novo com MySQL descartável bloqueia o pedido, recebe duas notificações do mesmo PIX e libera ambas. Antes da correção, havia um único recibo, porém a segunda resposta retornava cobertura financeira desatualizada.
- A referência imutável cobrança → pedido é consultada antes de iniciar a transação. A liquidação continua travando pedido e cobrança; as leituras de recibos passam a enxergar o resultado da notificação anterior.
- Após a correção, ambas retornam o valor integral confirmado e o banco contém exatamente um recibo. 35 testes focados e a suíte MySQL passaram. Nenhum banco operacional ou provedor real foi usado.


### Contas por e-mail com MySQL descartável

- Cenário `tmp-tests/print3d-accounts-mysql-scenario.cjs`, chamado pela suíte MySQL, registra rotas reais de conta 3D e usa hash scrypt, tokens, sessão assinada e limitador transacional reais.
- Confirmou cadastro, recusa de login antes de verificar e-mail, prova de uso único, login, recusa de assinatura no formato MDV (HMAC com segredo direto), cinco senhas erradas e bloqueio subsequente com `Retry-After: 900`.
- Recuperação por e-mail durante o bloqueio funcionou; redefine senha, limpa bloqueio da conta, incrementa versão de autenticação e invalida a sessão antiga. Token de recuperação não pode ser reutilizado.
- Suíte MySQL passou. CAPTCHA e envio de e-mail são adaptadores simulados; não houve mensagens reais. Ainda falta homologar WhatsApp/Google completos, navegador com login real e entregabilidade/configuração externa.


### Contas por WhatsApp, CPF e recuperação com MySQL descartável

- Ampliado `tmp-tests/print3d-accounts-mysql-scenario.cjs` com rotas reais e tabelas exclusivas 3D para gerar/conferir/consumir código de WhatsApp.
- Validou código errado, vínculo da prova ao telefone, uso único, cadastro sem e-mail, data de WhatsApp confirmado e login por telefone ou CPF com a mesma senha.
- Alternar telefone e CPF nas cinco falhas não contorna a trava: o sexto acesso é bloqueado pela conta. Recuperação por WhatsApp durante a trava redefine senha, invalida a sessão anterior e permite novo login por ambos os identificadores.
- O teste avança somente o relógio de reenvio do código em 61 segundos para respeitar o intervalo entre mensagens; não avança o bloqueio de login de 15 minutos.
- Suíte MySQL passou. CAPTCHA e envio WhatsApp/e-mail foram simulados e permaneceram locais. Não valida n8n, número real, entrega de mensagens nem a interface completa de cadastro.


### Google 3D com MySQL descartável

- Novo cenário `tmp-tests/print3d-google-mysql-scenario.cjs`, executado após os cenários de conta na suíte MySQL, usa rotas Google reais, migrations, transações, hash scrypt e sessão 3D assinada.
- Validou prepare → start → callback → exchange, comprovante ligado ao navegador, troca simultânea do mesmo código (um sucesso e uma recusa), retorno pelo identificador estável Google, recusa de união automática por e-mail, vínculo explícito à conta autenticada, uso único e conta desativada.
- Suíte MySQL e 9 testes de Google/sessão passaram. Identidade/token Google e CAPTCHA são simulados; não houve acesso à conta Google real. A autenticação da sessão usada no vínculo foi consultada no banco de teste.
- Pendentes: credenciais OAuth próprias, callbacks/origens reais, cookies HTTPS no navegador e teste de autenticação ponta a ponta no domínio separado. O proxy público local não encaminha start/callback OAuth; estes permanecem no host de callback configurado.


### Preservação da sessão durante falhas temporárias

- Corrigido `print3dAccountClient.me()`: erro de rede, 429 e indisponibilidade da API não apagam mais a sessão 3D. Apenas resposta 401 encerra a sessão consultada; resposta atrasada não remove um token de login posterior.
- A tela de conta trata a falha de consulta e exibe o erro, evitando rejeição não tratada. Quando o serviço volta, a sessão preservada permite consultar a conta novamente.
- Dois testes de cliente cobrem matriz de erros e corrida entre sessões. O navegador via gateway HTTP local confirmou 503 com token preservado, recuperação após 200 e remoção após 401. Build independente passou.
- Tudo local, API fixture; não altera duração de sessão, validação de senha, bloqueio de tentativas ou autenticação no servidor.


### Autenticação real ligada ao checkout no MySQL local

- Novo cenário `tmp-tests/print3d-account-checkout-mysql.cjs` é instalado no mesmo Fastify das contas reais. Usa sessões emitidas por login, validação de versão, checkout, reserva, plano e criação de OP canônicos.
- Conta com e-mail confirmado e sem WhatsApp validado teve encomenda recusada (403), mesmo enviando campo de validação forjado no corpo. Estoque reservado permaneceu zero após a recusa. A mesma conta conseguiu comprar uma unidade pronta.
- Conta com WhatsApp confirmado criou encomenda de duas peças; pedido ficou exclusivamente vinculado ao cliente 3D, OP aguardando entrada, ficha/arquivo corretos fixados. Entrada de 70% com frete proporcional resultou em 1750 centavos sobre total de 2500.
- Sessão MDV inválida foi recusada e outra conta 3D recebeu 404 ao consultar o pedido alheio. Suíte MySQL passou.
- Catálogo/frete e metadados NAS são fixtures locais; não houve cotação externa, cobrança, fabricação nem acesso a arquivo real.
