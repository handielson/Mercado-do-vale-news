# Biblioteca de erros do robô e do sistema

> Gerado em 2026-11-21 23:50 UTC por `scripts/export-bot-error-library.cjs` a partir da tabela `bot_error_library`.
> **Antes de investigar um erro, procure aqui** (Ctrl+F pelo sintoma). Para editar, use a aba Erros do painel do servidor
> (https://servidor.mercadodovale.com.br/agentes.html) e exporte de novo. Não edite este arquivo à mão.

Total: 211 · 0 voltaram · 0 abertos · 211 corrigidos.

## n8n (137)

### #203 Resposta sobre visita ou endereço chegava em um bloco

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.859 · origem historico
- **Onde:** n8n · Loja - Localizacao
- **O que aconteceu:** O cliente recebia endereço, horário quando aplicável, link longo do Maps e mensagem final em um único bloco no WhatsApp.
- **Causa:** O nó usava || entre os trechos. O nó Dividir mensagens interpretava esse separador como quebra de linha. A separação em mensagens exigia |||.
- **Correção:** O nó passou a usar ||| e a montar quatro mensagens para pedidos de visita e três para perguntas sobre o endereço. A localização sai como pino quando há coordenadas cadastradas ou como link quando elas faltam.
- **Como testar:** Executar os nós Loja - Localizacao e Dividir mensagens com um pedido de visita e uma pergunta sobre o endereço. Conferir quatro mensagens na visita, três na consulta de endereço e o pino quando houver coordenadas.
- **Tags:** visita, endereço, WhatsApp

### #204 Conflito de revisão impedia o envio da resposta da loja

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.867 · origem historico
- **Onde:** n8n · Estado Conversa - Preparar
- **O que aconteceu:** O cliente recebeu resposta ao cumprimento, mas ficou sem retorno ao perguntar onde ficava a loja logo depois.
- **Causa:** A primeira execução avançou a revisão da conversa de 3 para 4. Na retentativa, a saída de Loja - Localizacao, reconstruída a partir de Parse Classificacao, sobrescrevia a revisão atualizada com a revisão 3. As três gravações foram recusadas e a resposta foi descartada.
- **Correção:** Quando conversationStateRebase é verdadeiro, o nó passou a preservar a revisão, o contador de tentativas, a marca de rebase e os dados de controle do contexto da retentativa.
- **Como testar:** Executar n8n-state-rebase-revision.test.cjs com MDV_N8N_SALES_SNAPSHOT e verificar que a retentativa com a saída da Loja grava contra a revisão 4. O fluxo anterior repete a revisão 3.
- **Tags:** estado, concorrência, retentativa

### #205 Consultas do robô falhavam no executor do n8n

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.876 · origem historico
- **Onde:** n8n · consultas de garantia, horário e contexto de vendas
- **O que aconteceu:** O robô dizia que não conseguia confirmar a garantia ou que o horário estava indisponível. O contexto de vendas também falhava ao buscar dados.
- **Causa:** As consultas usavam fetch, indisponível no executor de código do n8n 2.x.
- **Correção:** As consultas passaram a usar helpers.httpRequest.
- **Como testar:** Executar n8n-bot-correcoes-handoff-lista.test.cjs contra a cópia do fluxo ativo e conferir que o contexto de vendas recebe o horário real da loja.
- **Tags:** garantia, horário, HTTP

### #206 Robô respondia depois que a equipe já havia atendido

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.876 · origem historico
- **Onde:** n8n · envio de respostas
- **O que aconteceu:** O cliente recebia uma resposta automática depois de a equipe já ter respondido à mesma pergunta.
- **Causa:** O fluxo enviava a resposta automática sem verificar se a equipe havia enviado uma mensagem manual depois da pergunta do cliente.
- **Correção:** Antes do envio, o fluxo passou a verificar se houve mensagem manual da equipe após a pergunta e a suprimir a resposta automática nesse caso.
- **Como testar:** Executar n8n-bot-correcoes-handoff-lista.test.cjs contra a cópia do fluxo ativo.
- **Tags:** atendimento, equipe, envio

### #207 Cumprimento ou confirmação descartava a lista de celulares

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.876 · origem historico
- **Onde:** n8n · montagem e envio da lista de celulares
- **O que aconteceu:** O cliente ficava sem a lista de celulares quando mandava uma mensagem curta, como “bom dia” ou “blz”, enquanto ela estava sendo montada.
- **Causa:** Uma mensagem curta recebida durante a montagem tornava a resposta pendente descartável na gravação do estado ou no envio.
- **Correção:** Cumprimentos e confirmações passaram a preservar a lista na gravação do estado e no envio. A exceção na gravação se aplica somente a um evento mais novo e exclui eventos repetidos.
- **Como testar:** Executar n8n-bot-correcoes-handoff-lista.test.cjs contra a cópia do fluxo ativo.
- **Tags:** lista, celulares, concorrência

### #208 Agente prometia enviar a lista e deixava cliente esperando

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.876 · origem historico
- **Onde:** n8n · Agente Geral
- **O que aconteceu:** O cliente recebia a promessa de que a lista seria atualizada e enviada em seguida, mas a lista não chegava.
- **Causa:** A instrução do agente permitia prometer um envio futuro que o fluxo não realizava.
- **Correção:** A instrução passou a proibir promessas de envio futuro.
- **Como testar:** Executar n8n-bot-correcoes-handoff-lista.test.cjs contra a cópia do fluxo ativo.
- **Tags:** lista, agente, atendimento

### #198 Pedido de celular mais em conta caía no atendimento humano

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.850 · origem historico
- **Onde:** n8n · Vendas - Preparar Busca
- **O que aconteceu:** Ao perguntar qual era o celular mais em conta, o cliente recebeu duas respostas inconclusivas e foi encaminhado a um atendente.
- **Causa:** O detector exigia que todas as palavras fossem relacionadas a celular ou preço. A palavra “que” impedia o reconhecimento do pedido genérico.
- **Correção:** O detector passou a aceitar palavras de ligação comuns e valores numéricos. Pedidos genéricos exibem a lista de celulares em ordem crescente de preço, e pedidos por modelo continuam na busca específica.
- **Como testar:** Perguntar “Qual celular mais em conta que você tem aí?” e testar variações. Conferir a lista ordenada do mais barato para o mais caro. Perguntar “qual o mais barato do redmi 15” e conferir a busca pelo modelo.
- **Tags:** busca, preço, intenção

### #199 Complemento da escolha refazia a busca com um filtro antigo

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.852 · origem historico
- **Onde:** n8n · Vendas - Verificar Pos Lista e Vendas - Contexto Produtos
- **O que aconteceu:** Após escolher a opção 2 e enviar “De 512gb”, o cliente recebeu a mesma lista novamente em vez da apresentação do Poco X8 Pro escolhido.
- **Causa:** A segunda mensagem descartou a resposta da escolha e iniciou outra busca. O filtro anterior de 8 GB foi combinado com 512 GB, formando uma configuração inexistente.
- **Correção:** O fluxo passou a reconhecer complementos da escolha, como capacidade, cor ou repetição do número, e a reenviar o card do item selecionado.
- **Como testar:** Simular “A opção 2” seguida de “De 512gb” e conferir que ambas geram o mesmo card. Responder “Sim” e conferir que o fluxo avança para retirada ou entrega.
- **Tags:** seleção, contexto, catálogo

### #200 5G no nome do modelo gerava título incorreto na lista

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.852 · origem historico
- **Onde:** n8n · Vendas - Contexto Produtos
- **O que aconteceu:** A lista aparecia com o título “Celulares com 5G” quando o cliente havia pedido um modelo cujo nome incluía “5G”.
- **Causa:** O “5G” do nome do modelo era tratado como um pedido de filtro por conectividade ao montar o título.
- **Correção:** O fluxo deixou de usar o título “Celulares com 5G” quando o termo aparece apenas no nome do modelo pedido.
- **Tags:** catálogo, título, 5G

### #201 Busca por tablet dizia que modelo em estoque não existia

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.856 · origem historico
- **Onde:** n8n · Vendas - Contexto Produtos
- **O que aconteceu:** O robô abria a resposta dizendo que não encontrou o Redmi Pad 2 em estoque, embora o aparelho aparecesse na própria lista.
- **Causa:** A palavra genérica “tablet” entrava na comparação do nome, fazendo “redmi pad 2 tablet” divergir de “Redmi Pad 2”.
- **Correção:** Termos genéricos como “tablet”, “celular”, “smartphone” e “aparelho” foram excluídos da comparação do nome do modelo.
- **Como testar:** Enviar “Vou tem o Redmi pad 2 256 tablet?” e conferir que a resposta lista o Redmi Pad 2 8 GB/256 GB sem dizer que o modelo está fora de estoque.
- **Tags:** busca, tablets, estoque

### #202 Emoji enviado em seguida descartava a resposta em andamento

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.856 · origem historico
- **Onde:** n8n · Controle Bot - Aplicar mensagem atual
- **O que aconteceu:** Depois de enviar “✨”, o cliente recebeu uma resposta que dizia que o tablet estava indisponível, oferecia celulares e prometia retorno de um especialista sem acionar atendimento. A loja precisou corrigir a informação manualmente.
- **Causa:** A regra de substituição pela mensagem mais recente descartava a resposta em andamento. O emoji seguia para a IA geral, que respondia com o histórico antigo.
- **Correção:** Mensagens compostas apenas por emoji, enviadas em até 60 segundos após outra mensagem do cliente, preservam a resposta em andamento e não geram resposta própria.
- **Como testar:** Enviar o pedido do tablet e “✨” sete segundos depois. Conferir que a resposta sobre o tablet é preservada e que o emoji não gera resposta própria. Testar também um emoji isolado fora da janela e uma nova mensagem de texto.
- **Tags:** emoji, mensagens, contexto

### #196 Primeira aprovação PayJoy não acionava a lista de elegíveis

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.846 · origem historico
- **Onde:** n8n · fluxo de aprovação PayJoy
- **O que aconteceu:** Na primeira aprovação sem contexto anterior, o robô informava o valor da entrada, mas não enviava a lista de aparelhos elegíveis.
- **Causa:** O ramo de aprovação sem contexto calculava a entrada para o texto, mas não disponibilizava o campo payjoyCalculation exigido pelo fluxo da lista.
- **Correção:** O ramo de primeira aprovação passou a disponibilizar em payjoyCalculation o cálculo que já fazia.
- **Como testar:** Simular uma primeira aprovação sem contexto de R$ 1.400 a 30% e conferir se o robô informa a entrada de R$ 420 e envia a lista de elegíveis.
- **Tags:** PayJoy, aprovação, catálogo

### #197 Nova aprovação PayJoy era interpretada como escolha de cor

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.846 · origem historico
- **Onde:** n8n · fluxo pós-lista PayJoy
- **O que aconteceu:** Ao informar uma nova aprovação enquanto o robô aguardava a escolha de cor, o cliente não recebia o novo cálculo nem a lista atualizada.
- **Causa:** O estado awaiting_color priorizava o tratamento da mensagem como escolha do catálogo e bloqueava o encaminhamento para o fluxo de pagamento.
- **Correção:** O fluxo pós-lista passou a encaminhar relatos concretos de aprovação com valores aos interpretadores de pagamento já usados pelo robô.
- **Como testar:** Durante awaiting_color, informar uma nova aprovação com valores e reproduzir a classificação indevida como escolha de item. Verificar se o fluxo encaminha a mensagem ao resolvedor de pagamento, recalcula a entrada e gera uma nova lista.
- **Tags:** PayJoy, aprovação, cor

### #193 Pedido de tablet retornava lista de celulares

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.845 · origem historico
- **Onde:** n8n · Vendas - Preparar Busca / Vendas - Contexto Produtos / Vendas - Catalogo pronto?
- **O que aconteceu:** Uma cliente perguntou pelo Redmi Pad 2 e recebeu uma lista de 23 celulares. Depois, o robô disse que um atendente conferiria os tablets.
- **Causa:** O fluxo de catálogo encaminhava pedidos de tablet para a lista de celulares.
- **Correção:** A busca passou a consultar a categoria Tablet e reutilizar o formato da lista de celulares. Quando o modelo pedido não está em estoque, o robô informa a ausência e lista os tablets disponíveis.
- **Como testar:** Reproduzir a pergunta sobre o Redmi Pad 2 sem estoque e conferir a lista de tablets disponíveis. Perguntar também quais tablets a loja tem e verificar o título e o formato da lista geral.
- **Tags:** tablet, catálogo, estoque

### #194 Pedido de acessório de tablet retornava lista de celulares

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.845 · origem historico
- **Onde:** n8n · fluxo de catálogo de vendas
- **O que aconteceu:** Ao pedir capa, película ou outro acessório de tablet, o cliente recebia a lista de celulares.
- **Causa:** O fluxo encaminhava pedidos de acessórios de tablet para a lista de celulares.
- **Correção:** Pedidos de acessórios de tablet passaram a usar a busca pelo texto.
- **Como testar:** Pedir um acessório de tablet e verificar que o robô faz a busca pelo texto sem enviar a lista de celulares.
- **Tags:** tablet, acessórios, busca

### #190 Tabela de parcelamento repetia a chamada de 12x

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.838 · origem historico
- **Onde:** n8n · Vendas - Resolver Parcelamento
- **O que aconteceu:** O cliente via a chamada “Em 12x…” além da linha de 12 parcelas na própria tabela.
- **Causa:** O nó gerava uma linha adicional em `requestedLine` para a parcela já exibida na tabela.
- **Correção:** Removeu a linha adicional na origem e unificou a formatação da tabela na cotação e na escolha da parcela.
- **Como testar:** No WhatsApp, selecionar o Redmi 15 de 8 GB / 256 GB e conferir que a tabela da variante Roxo tem 12 opções, de 1x de R$ 1.349,00 a 12x de R$ 125,79 (R$ 1.509,53), sem repetir a chamada de 12x.
- **Tags:** parcelamento, duplicação, tabela

### #191 Bot não reconhecia pergunta sobre quantidade de parcelas

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.838 · origem historico
- **Onde:** n8n · Vendas - Verificar Pos Lista
- **O que aconteceu:** Depois de escolher um produto, perguntar “parcela em quantas vezes?” não acionava a cotação de parcelamento.
- **Causa:** A regra de cotação existente não reconhecia essa formulação.
- **Correção:** Incluiu “parcela em quantas vezes?” na regra de cotação existente.
- **Como testar:** Selecionar um produto no WhatsApp, perguntar “parcela em quantas vezes?” e conferir o envio da tabela com 12 opções.
- **Tags:** parcelamento, cotação, reconhecimento

### #192 Administradores recebiam alertas duplicados pela mesma falha

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.844 · origem historico
- **Onde:** n8n · workflow de erros mdvBotError2026a / API · /n8n-bot/error-alerts
- **O que aconteceu:** Os administradores recebiam vários alertas iguais no WhatsApp durante um único incidente. Em 11/11, chegaram cerca de 20 mensagens iguais.
- **Causa:** O agrupamento nos dados estáticos do n8n falhava com execuções paralelas e não conseguia gravar quando o banco do n8n estava sem conexão.
- **Correção:** Moveu o agrupamento para a API, que identifica o incidente pelo workflow e pelo erro, envia o primeiro alerta imediatamente, conta as repetições, manda lembretes a cada 30 minutos e resume o incidente após 10 minutos sem falhas. O workflow envia o alerta diretamente pela Evolution se a API não responder.
- **Como testar:** Fazer um POST para /n8n-bot/error-alerts pela URL pública com a lista de administradores vazia e conferir que o incidente é aberto sem envio de mensagem.
- **Tags:** alertas, incidentes, duplicação, WhatsApp

### #189 Bot podia manter preço desatualizado após a cotação

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.836 · origem historico
- **Onde:** n8n · fluxo de vendas
- **O que aconteceu:** Se o preço mudasse depois do envio da lista, o cliente podia receber valores antigos no PIX ou no cartão, e o rascunho podia ficar com o preço anterior.
- **Causa:** O fluxo usava o preço da cotação sem revalidar a configuração no catálogo.
- **Correção:** O bot passou a consultar o catálogo, calcular PIX e cartão pelo maior preço do grupo de cores disponível e atualizar o rascunho. Se uma promoção separar as cores em grupos de preço, mostra os grupos atuais, informa a validade e pede a cor. Se a cor ficar indisponível, oferece as disponíveis. Se a consulta falhar, oferece a lista atualizada. Os dois agentes passaram a usar os preços atuais do fluxo.
- **Como testar:** No WhatsApp, pedir a lista, selecionar o Redmi 15 de 8 GB / 256 GB cotado a R$ 1.349,00, pedir as parcelas e escolher a cor Preto. Conferir 12x de R$ 125,79 (R$ 1.509,53), o rascunho a R$ 1.349,00 e a ausência do aviso “Valor atualizado hoje” quando o preço não mudar.
- **Tags:** preço, catálogo, parcelamento, rascunho

### #184 Acessório sem memória gerava erro de configuração

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.778 · origem historico
- **Onde:** n8n · Vendas - Verificar Pos Lista
- **O que aconteceu:** Ao pedir fotos com uma capa selecionada, o cliente recebia repetidamente um aviso de combinação indisponível de memória e cor.
- **Causa:** A resolução de variantes descartava itens sem memória e classificava a seleção do acessório como inválida.
- **Correção:** Opções sem memória em todas as configurações passaram a pular a resolução de memória e cor.
- **Como testar:** Com uma capa selecionada na lista, pedir “Pode mandar as fotos” ou “Manda” e verificar se o aviso de combinação indisponível deixou de aparecer.
- **Tags:** acessórios, variantes, memória

### #185 Celulares seminovos eram agrupados com novos e herdavam preços

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.789 · origem historico
- **Onde:** n8n · Vendas - Contexto Produtos
- **O que aconteceu:** Um aparelho seminovo podia aparecer agrupado com um novo e receber o preço do aparelho novo.
- **Causa:** A chave usada para agrupar configurações não incluía a condição do aparelho.
- **Correção:** A condição passou a integrar a chave de agrupamento. Seminovos e usados passaram a ter identificação no nome e a aparecer em uma mensagem própria no fim da lista.
- **Como testar:** Executar `tmp-tests/n8n-used-condition-list.test.cjs` pelo gate comercial.
- **Tags:** seminovos, catálogo, preço

### #186 Robô respondia a mensagens automáticas de outras empresas

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.819 · origem historico
- **Onde:** n8n · Dados
- **O que aconteceu:** O robô tratava avisos de ausência como respostas do cliente. Em um caso, perguntou o bairro de entrega após receber uma mensagem automática do CREAS.
- **Causa:** Mensagens automáticas recebidas entravam no fluxo como falas do cliente.
- **Correção:** O nó passou a identificar e ignorar essas mensagens, aguardando a próxima mensagem do cliente.
- **Como testar:** Executar `tmp-tests/n8n-autoreply-guard.test.cjs` para conferir cinco respostas automáticas ignoradas, sete mensagens de clientes e mensagens da própria loja (`fromMe`).
- **Tags:** WhatsApp, mensagens automáticas, atendimento

### #187 Lista de estoque completo anunciava filtro de 64 GB

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.819 · origem historico
- **Onde:** n8n · Vendas - Contexto Produtos
- **O que aconteceu:** Ao pedir um realme note 60x de 64 GB, o cliente podia receber a lista do estoque completo com um título que anunciava apenas aparelhos de 64 GB.
- **Causa:** O título retinha a memória solicitada mesmo quando o modelo ou o filtro não retornava resultados e o fluxo voltava ao estoque completo.
- **Correção:** O título passou a mencionar a memória somente quando a lista está filtrada. Para o estoque completo, passou a mostrar “Celulares disponiveis agora”.
- **Como testar:** Pedir “realme note 60x de 64 GB” no cenário em que a busca volta ao estoque completo e conferir o título genérico. Verificar também uma lista efetivamente filtrada por memória.
- **Tags:** catálogo, armazenamento, filtro

### #180 Confirmação de promoções esquecia as marcas pedidas

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.712 · origem historico
- **Onde:** n8n · Vendas - Preparar Busca
- **O que aconteceu:** Ao confirmar que queria ver promoções, o cliente perdia o filtro das marcas que já havia pedido.
- **Causa:** A confirmação de promoções não preservava as marcas solicitadas nos turnos anteriores.
- **Correção:** A busca de promoções passou a manter as marcas já solicitadas.
- **Como testar:** Pedir ofertas de mais de uma marca, confirmar que quer ver promoções e verificar se a busca mantém as marcas pedidas.
- **Tags:** promoções, marcas, contexto

### #181 Atendimento Meta perdia a intenção de catálogo

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.712 · origem historico
- **Onde:** n8n · Vendas - Contexto Produtos e Vendas - Verificar Pos Lista
- **O que aconteceu:** O cliente podia perder a continuidade do pedido de catálogo durante a conversa.
- **Causa:** O fluxo não preservava a intenção de catálogo e a pergunta de continuidade ao processar a lista.
- **Correção:** Os dois nós passaram a preservar a intenção de catálogo e a pergunta de continuidade, com até três aparelhos por bloco.
- **Como testar:** Executar os testes de paridade e atendimento Meta.
- **Tags:** catálogo, Meta, continuidade

### #182 Compra não prosseguia pelo Messenger

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.712 · origem historico
- **Onde:** n8n · Resolver Acao de Conversacao
- **O que aconteceu:** O cliente não conseguia continuar a compra pela conversa no Messenger quando precisava informar os dados para o pedido.
- **Causa:** O fluxo não coletava pelo Messenger os dados necessários para prosseguir com a compra.
- **Correção:** O fluxo passou a pedir o WhatsApp de cadastro e o endereço por texto no Messenger, quando necessários.
- **Como testar:** Executar os testes de paridade e atendimento Meta.
- **Tags:** Messenger, compra, cadastro

### #183 Busca por celulares baratos retornava capa ou nenhuma lista

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.778 · origem historico
- **Onde:** n8n · Vendas - Preparar Busca e Vendas - Contexto Produtos
- **O que aconteceu:** Ao pedir promoções, o cliente recebeu o orçamento de uma capa de R$ 14,90. Ao pedir celulares mais baratos, recebeu uma pergunta de escolha sem ter recebido a lista.
- **Causa:** O reconhecimento de pedidos genéricos de celular não aceitava expressões como “em conta”, “mais barato” e “promoções”, que acabavam em uma busca por texto.
- **Correção:** Pedidos genéricos de celulares baratos e promoções sem produto definido passaram a buscar na categoria Celulares. A nova lista substitui a anterior e mostra até oito celulares em ordem crescente de preço.
- **Como testar:** Pedir “Quais as promoções” e “Celulares em conta mais barato” e conferir se o bot envia uma lista de celulares do menor para o maior preço. Comparar antes e depois os pedidos específicos de capa, fone e Redmi 15.
- **Tags:** busca, celulares, promoções

### #179 Robô mencionava link PayJoy sem enviá-lo

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.692 · origem historico
- **Onde:** n8n · Parse Classificacao
- **O que aconteceu:** A cliente enviou “Pay Joy” e depois “Como que faz”. O robô mencionou um link, mas não o enviou.
- **Causa:** O parser exigia payjoy sem espaço na mensagem atual ou na última saída e ignorava a mensagem anterior da cliente.
- **Correção:** O parser passou a aceitar “Pay Joy” e a consultar a mensagem imediatamente anterior do mesmo cliente em até dois minutos. Perguntas sobre como iniciar a análise seguem para a política PayJoy, que valida o domínio, envia uma única URL oficial e registra a espera do resultado.
- **Como testar:** Enviar “Pay Joy” e, quatro segundos depois, “Como que faz”. Confirmar o envio de uma única URL oficial e o registro da espera do resultado. Verificar que perguntas gerais recebem explicação e que recusa, contexto antigo ou assunto interrompido não disparam link.
- **Tags:** PayJoy, contexto, parser, link

### #173 Falha na leitura de foto PayJoy podia ficar sem resposta

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.660 · origem historico
- **Onde:** n8n · Conversor e leitor WhatsApp PayJoy
- **O que aconteceu:** O cliente podia ficar sem orientação quando o conversor ou o leitor falhava ao processar a foto.
- **Causa:** O conversor ou o leitor podia terminar sem produzir um item para o tratamento de erro ou ilegibilidade.
- **Correção:** Garante que conversor e leitor gerem um item para acionar o tratamento já existente em caso de falha.
- **Como testar:** Usar uma imagem ilegível no ensaio nativo isolado e simular falha do leitor nos testes focados.
- **Tags:** WhatsApp, PayJoy, OCR, fallback

### #174 Conflito ao salvar OCR deixava cálculo PayJoy rejeitado

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.660 · origem historico
- **Onde:** n8n · Persistência da leitura PayJoy no WhatsApp
- **O que aconteceu:** Um conflito de revisão podia deixar o atendimento com um cálculo que não foi aceito no estado da conversa.
- **Causa:** O tratamento genérico de conflito não descartava o cálculo derivado da gravação rejeitada.
- **Correção:** Restaura o estado canônico, descarta o cálculo rejeitado e pede confirmação fora do rebase genérico. Uma pausa humana concorrente bloqueia a resposta.
- **Como testar:** Simular conflito de revisão ao gravar o OCR e verificar a restauração do estado, a remoção do cálculo e o pedido de confirmação. Repetir com pausa humana concorrente e verificar que a resposta é bloqueada.
- **Tags:** PayJoy, OCR, concorrência, estado

### #175 WhatsApp pedia novamente dados de aprovação PayJoy

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.661 · origem historico
- **Onde:** n8n · Pós-lista, roteador e pagamento
- **O que aconteceu:** A foto gerava o cálculo da entrada, mas, ao perguntar sobre a entrada no turno seguinte, o cliente precisava informar novamente os dados da aprovação.
- **Causa:** A reutilização da aprovação válida estava restrita aos canais Meta nesses três pontos do fluxo.
- **Correção:** Estende ao WhatsApp a reutilização de uma aprovação válida. O pós-lista encaminha a pergunta ao roteador, e a política usa a calculadora e a resposta canônicas com o aparelho selecionado. Novos valores ou percentuais explícitos são respeitados.
- **Como testar:** Usar uma imagem sintética com R$ 1.600,00 aprovados a 14% e verificar a entrada de R$ 224,00. Serializar e recarregar o estado entre a foto, as perguntas sobre entrada, a escolha de retirada e a nova pergunta. Verificar SKU, memória, cor, etapa, texto final e ausência de novo pedido de print ou dados.
- **Tags:** WhatsApp, PayJoy, entrada, memória

### #162 Aprovação PayJoy de terceiro era atribuída ao cliente

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.654 · origem historico
- **Onde:** n8n · Resultado PayJoy
- **O que aconteceu:** O bot tratava uma aprovação PayJoy de outra pessoa como se fosse do cliente.
- **Causa:** A interpretação do resultado não distinguia a aprovação do cliente da aprovação de terceiros.
- **Correção:** Preserva a identificação de quem recebeu a aprovação ao interpretar o resultado.
- **Tags:** PayJoy, aprovação, titularidade

### #163 Pergunta após aprovação PayJoy confundia a interpretação

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.654 · origem historico
- **Onde:** n8n · Resultado PayJoy
- **O que aconteceu:** O bot não entendia corretamente uma aprovação PayJoy acompanhada de uma pergunta.
- **Causa:** A interpretação não contemplava uma aprovação seguida de pergunta na mesma mensagem.
- **Correção:** Passa a reconhecer a aprovação mesmo quando há uma pergunta em seguida.
- **Tags:** PayJoy, aprovação, intenção

### #164 Cadastro aceitava dados pessoais inválidos

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.654 · origem historico
- **Onde:** n8n · Cadastro
- **O que aconteceu:** O cadastro podia aceitar CPF, telefone ou data de nascimento inválidos.
- **Causa:** O fluxo não validava adequadamente esses campos.
- **Correção:** Valida CPF, telefone e data de nascimento no cadastro.
- **Tags:** cadastro, CPF, telefone, nascimento

### #165 Resposta negativa virava nome no cadastro

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.654 · origem historico
- **Onde:** n8n · Cadastro
- **O que aconteceu:** Uma negativa enviada pelo cliente podia ser registrada como seu nome.
- **Causa:** O fluxo aceitava respostas negativas como entrada para o campo de nome.
- **Correção:** Impede que negativas sejam interpretadas como nome.
- **Tags:** cadastro, nome, negativas

### #166 Pergunta sobre entrega sobrepunha escolha explícita de retirada

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.654 · origem historico
- **Onde:** n8n · Fluxo de retirada
- **O que aconteceu:** O bot podia perder a escolha de retirada quando o cliente também perguntava sobre entrega.
- **Causa:** Uma menção interrogativa de entrega podia ter prioridade sobre a escolha explícita de retirada.
- **Correção:** Dá prioridade à retirada explicitamente escolhida.
- **Como testar:** Executar o cenário de retirada em dois turnos e verificar a preservação do estado, do horário e do corpo final da mensagem do WhatsApp.
- **Tags:** retirada, entrega, intenção

### #167 Endereços válidos com Modelo ou Garantia eram rejeitados

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.654 · origem historico
- **Onde:** n8n · Cadastro de endereço
- **O que aconteceu:** O cliente podia ter um endereço válido rejeitado por conter palavras como Modelo ou Garantia.
- **Causa:** A interpretação do endereço tratava essas palavras como incompatíveis com um endereço válido.
- **Correção:** Preserva a validade de endereços que contenham essas palavras.
- **Tags:** cadastro, endereço, validação

### #169 Escolha de cor interceptava perguntas sobre entrada PayJoy

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.656 · origem historico
- **Onde:** n8n · Fluxo Meta PayJoy
- **O que aconteceu:** Enquanto o bot aguardava a cor do aparelho, a pergunta sobre entrada não usava a aprovação PayJoy já registrada.
- **Causa:** A etapa de escolha da cor tinha prioridade sobre a intenção de consultar a entrada.
- **Correção:** Prioriza a pergunta sobre entrada, usa a aprovação persistida e preserva a escolha do aparelho.
- **Como testar:** Validar o webhook real em sete turnos por canal, com conversas sintéticas e zero envios Meta.
- **Tags:** Meta, PayJoy, entrada, cor

### #170 Print PayJoy de conversa anterior não chegava ao leitor

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.656 · origem historico
- **Onde:** n8n · Leitor Meta PayJoy
- **O que aconteceu:** Clientes com conversas iniciadas antes da correção podiam enviar um novo print sem que ele fosse lido.
- **Causa:** O encaminhamento ao leitor não aproveitava o contexto recente e confiável da loja nessas conversas.
- **Correção:** Usa esse contexto para autorizar a leitura do novo print. Os valores financeiros vêm da nova leitura.
- **Tags:** Meta, PayJoy, imagem, contexto

### #172 Foto PayJoy no WhatsApp parava no Switch sem resposta

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.660 · origem historico
- **Onde:** n8n · Dados e Switch do WhatsApp PayJoy
- **O que aconteceu:** O cliente enviava uma foto e ficava sem resposta, embora o n8n registrasse a execução como bem-sucedida.
- **Causa:** Uma imageMessage sem estado PayJoy no staticData terminava no Switch antes de chegar ao leitor.
- **Correção:** Preserva a imagem no nó Dados e recupera o contexto PayJoy da API após verificar as pausas e antes de classificar a imagem. O estado de conversa passa a aceitar payjoyByJid no WhatsApp. O histórico recente pode autorizar a leitura, e a falta de contexto gera um pedido de esclarecimento.
- **Como testar:** Executar dois turnos em memórias separadas, persistindo o link no primeiro e enviando a foto no segundo. Verificar a recuperação do contexto e cobrir ausência, invalidez ou expiração do contexto, pausa manual e reset.
- **Tags:** WhatsApp, PayJoy, imagem, contexto

### #160 Falha do classificador comprometia o atendimento

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.654 · origem historico
- **Onde:** n8n · Classificador de atendimento
- **O que aconteceu:** Quando o classificador falhava ou retornava uma saída inválida, o atendimento não tinha uma resposta segura garantida.
- **Causa:** O fluxo não encaminhava falhas e saídas inválidas para um tratamento seguro.
- **Correção:** Encaminha a falha pelo envio existente com uma resposta segura, sem confirmar pedido nem consumir dados de cadastro. O bloqueio do bot impede o envio.
- **Como testar:** No n8n 2.43.8 isolado, simular falha e saída inválida e verificar uma mensagem ao destino local em cada caso. Com bloqueio manual, verificar zero mensagens.
- **Tags:** classificador, fallback, bloqueio

### #161 Venda de aparelho próprio ou usado recebia política incorreta

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.654 · origem historico
- **Onde:** n8n · Fluxo de vendas
- **O que aconteceu:** O cliente recebia orientação inadequada ao falar sobre vender um aparelho próprio ou usado.
- **Causa:** A intenção de vender um aparelho próprio ou usado não acionava a política correspondente.
- **Correção:** Aplica a política correta a essa intenção.
- **Tags:** vendas, usados, intenção

### #158 Recuperação da memória podia selecionar o runner por engano

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.647 · origem historico
- **Onde:** n8n · script de recuperação da memória PostgreSQL
- **O que aconteceu:** A exportação e a validação da credencial de memória podiam apontar para o runner em vez do container principal.
- **Causa:** A seleção de containers permitia confundir o serviço principal do n8n com o runner.
- **Correção:** A seleção passou a usar o rótulo exato do serviço no Docker Swarm, com n8n_n8n para o container principal e n8n_n8n-db para o PostgreSQL.
- **Tags:** n8n, Docker, runner, memória

### #159 Webhook do WhatsApp perdia a confirmação imediata

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.652 · origem historico
- **Onde:** n8n · Webhook WhatsApp
- **O que aconteceu:** O webhook do WhatsApp deixava de devolver imediatamente o HTTP 200 esperado após a composição com o atendimento Meta.
- **Causa:** O gerador do fluxo integrado não preservava o contrato de resposta imediata do webhook do WhatsApp.
- **Correção:** O gerador passou a configurar o webhook em modo responseNode e a inserir uma resposta HTTP 200 com o JSON {"message":"Workflow was started"} antes da entrada comercial. O validador rejeita confirmação ausente, modo incorreto ou corpo divergente.
- **Como testar:** Verificar estruturalmente todas as saídas condicionais e confirmar que o WhatsApp recebe HTTP 200 com o corpo esperado antes da entrada comercial.
- **Tags:** WhatsApp, webhook, ACK, n8n

### #154 Bot dizia que a lista de celulares já havia sido enviada

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.640 · origem historico
- **Onde:** n8n · fluxo de vendas WhatsApp
- **O que aconteceu:** Ao perguntar «Quais vc tem?», o cliente ouviu que a lista estava «logo acima», mas ainda não a havia recebido.
- **Causa:** Uma nova mensagem chegou antes do envio da lista calculada. O reprocessamento tratou a lista pendente como já apresentada.
- **Correção:** O fluxo reconhece pedidos de 6 GB de RAM e 128 GB de armazenamento na linguagem do cliente e só registra o catálogo como entregue após a confirmação da Evolution para o último item. O reprocessamento preserva listas ainda não enviadas.
- **Como testar:** Simular as duas ordens entre a confirmação de envio e o reprocessamento, uma falha parcial de envio e uma lista dividida em três mensagens. Verificar a rota pelo Switch e se a lista pendente continua disponível para envio.
- **Tags:** WhatsApp, catálogo, reprocessamento, entrega

### #155 Bot respondia com preços resumidos e política genérica no Pix

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.640 · origem historico
- **Onde:** n8n · fluxo de vendas WhatsApp
- **O que aconteceu:** «Valores?» retornava preços resumidos e «No Pix, menor valor?» recebia uma resposta genérica sobre pagamentos.
- **Causa:** Os pedidos de valores e de menor preço no Pix seguiam respostas resumidas ou genéricas sem aplicar as configurações de preços em contexto.
- **Correção:** As perguntas passaram a consultar as configurações e usar o formato completo de oferta, com fatos verificados quando disponíveis, memória, preço no Pix, parcelas e total no cartão, cores e separador. Desconto adicional exige confirmação.
- **Como testar:** Na conversa sobre celulares, perguntar «Valores?» e depois «No Pix, menor valor?». Conferir os preços no Pix e no cartão e o formato da oferta.
- **Tags:** WhatsApp, preços, Pix, cartão

### #156 Memória do bot falhava ao acessar o PostgreSQL

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.645 · origem historico
- **Onde:** n8n · Memoria Vendas e Memoria de contexto postggress
- **O que aconteceu:** As execuções 45016 e 45021 falharam com EHOSTUNREACH ao acessar a memória dos agentes.
- **Causa:** A credencial Postgres account apontava para o endereço 10.11.0.2:5432 na rede compartilhada easypanel, que era inacessível pelo container do n8n.
- **Correção:** O host da credencial compartilhada foi alterado para n8n-db na rede dedicada easypanel-n8n. O n8n foi reiniciado antes do runner.
- **Como testar:** Confirmar em dry-run que os dois nós usam a mesma credencial e que n8n-db:5432 aceita conexão TCP. Após aplicar, verificar HTTP 200 em health e readiness e conferir se não surgiram novas falhas EHOSTUNREACH.
- **Tags:** memória, PostgreSQL, rede, n8n

### #157 Readiness transitório 502 interrompia a recuperação da memória

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.646 · origem historico
- **Onde:** n8n · script de recuperação da memória PostgreSQL
- **O que aconteceu:** A aplicação da correção indicava falha logo após o restart, embora o readiness voltasse a HTTP 200 segundos depois.
- **Causa:** O script interpretava o HTTP 502 durante a inicialização como falha definitiva.
- **Correção:** O script passou a aguardar healthz e healthz/readiness separadamente, com tempo limite em cada verificação, e a reiniciar n8n e runner somente quando a credencial muda.
- **Como testar:** Verificar que um 502 inicial seguido de HTTP 200 permite concluir a recuperação. Reaplicar com o host já correto e conferir changed=false, restarted=false e host n8n-db.
- **Tags:** memória, readiness, reinício, n8n

### #150 Leitura de prints PayJoy enviava parâmetro rejeitado pelo modelo

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.631 · origem historico
- **Onde:** n8n · PayJoy - Ler aprovacao / PayJoy - Calcular entrada do print
- **O que aconteceu:** O robô não conseguia interpretar o print da análise PayJoy com o novo modelo.
- **Causa:** A versão 1.8 do nó de imagens enviava max_tokens, parâmetro rejeitado pelo GPT-6 Luna.
- **Correção:** Atualizou o nó de imagens para a versão 2.3, que usa a API Responses com max_output_tokens de 1600. Adaptou o parser ao novo formato e passou a pedir esclarecimento quando a resposta não podia ser interpretada.
- **Como testar:** Executar a operação nativa de visão com um print sintético aprovado de R$ 1.600 e 14% e verificar entrada de R$ 224. Com um print sem resultado, verificar que não há cálculo.
- **Tags:** PayJoy, visão, n8n

### #151 Opção dos nós de chat omitia o esforço de raciocínio

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.631 · origem historico
- **Onde:** n8n · OpenAI Chat Model / OpenAI Classificador / OpenAI Vendas
- **O que aconteceu:** A configuração de esforço de raciocínio escolhida pela loja não aparecia nas requisições dos três nós de chat.
- **Causa:** A versão instalada dos nós não serializava reasoningEffort=none pela opção comum.
- **Correção:** Configurou o envio explícito de reasoning_effort=none via Extra Body JSON, com temperatura zero.
- **Como testar:** Executar supplyData/invoke nos nós instalados com os parâmetros e prompts do candidato e inspecionar o payload para confirmar o modelo resolvido, reasoning_effort=none e temperatura zero.
- **Tags:** n8n, OpenAI, configuração

### #152 Classificador do WhatsApp parava com HTTP 400

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.632 · origem historico
- **Onde:** n8n · OpenAI Chat Model / OpenAI Classificador / OpenAI Vendas
- **O que aconteceu:** O atendimento parava na etapa de classificação da mensagem.
- **Causa:** A migração enviava reasoning_effort no nível superior à API Responses. O teste anterior usava Chat Completions e não cobria o endpoint usado por padrão no n8n 2.38.5.
- **Correção:** Ativou Responses explicitamente nos três nós de chat e configurou o esforço como extraBody.reasoning.effort=none. Atualizou os testes para executar o Tools Agent V3 completo e inspecionar as requisições reais.
- **Como testar:** Executar os cenários nativos de classificação, conversa e vendas pelo Tools Agent V3 e confirmar o endpoint Responses, o parâmetro reasoning.effort=none e a ausência de HTTP 400.
- **Tags:** classificador, Responses, HTTP400

### #153 Pedido contextual do link PayJoy não seguia o fluxo correto

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.634 · origem historico
- **Onde:** n8n · Fluxo de continuidade PayJoy
- **O que aconteceu:** Ao retomar a conversa e pedir o site da análise PayJoy, inclusive para um amigo, o cliente podia ficar sem o link oficial.
- **Causa:** O fluxo não encaminhava o pedido contextual do site da análise para a política de pagamento que obtém e valida a URL oficial.
- **Correção:** Ajustou os nós de contexto, classificação, parse, resolução e política de pagamento para encaminhar o pedido contextual ao fluxo de pagamento. Se a URL estiver ausente ou inválida, o atendimento segue para a equipe.
- **Como testar:** Executar os cenários nativos de continuidade, incluindo o pedido registrado do final 2670, com estado e URL fictícios. Verificar o encaminhamento de pedidos contextuais e confirmar que saudação ou sim isolado sem oferta pendente não dispara o link.
- **Tags:** PayJoy, continuidade, WhatsApp

### #148 Credencial do n8n exposta na configuração MCP

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.617 · origem historico
- **Onde:** n8n · configuração MCP
- **O que aconteceu:** A configuração MCP com credencial do n8n estava acessível na branch pública do repositório da loja.
- **Causa:** O arquivo .cursor/mcp.json, que continha configuração sensível, estava versionado no Git.
- **Correção:** O arquivo foi removido da branch pública, mantido localmente e incluído no .gitignore. Foi criado um exemplo sem chave, e o pre-commit e o prebuild passaram a bloquear tokens literais do n8n.
- **Como testar:** Executar os três testes da guarda e confirmar que o arquivo MCP privado retorna HTTP 404 na branch pública.
- **Tags:** credenciais, MCP, Git

### #149 Robô apresentava a PayJoy como financeira

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.618 · origem historico
- **Onde:** n8n · fluxo PayJoy
- **O que aconteceu:** O cliente via a PayJoy descrita como financeira no atendimento pelo WhatsApp.
- **Causa:** O fluxo continha um título e uma referência antiga que classificavam a PayJoy como financeira.
- **Correção:** A atribuição incorreta foi removida, e as explicações sobre a PayJoy passaram a usar os fatos oficiais e as regras da loja registrados em services/payjoyKnowledge.cjs.
- **Como testar:** Rodar o caso de falsa atribuição no snapshot publicado e verificar que a descrição antiga está ausente da entidade e do histórico ativo do workflow.
- **Tags:** PayJoy, WhatsApp, pagamentos

### #147 Robô ignorava aceite informal da oferta PayJoy

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.616 · origem historico
- **Onde:** n8n · Fluxo PayJoy
- **O que aconteceu:** Ao responder «oi sim» a uma oferta PayJoy, o cliente caía no atendimento geral sem receber o link oficial.
- **Causa:** O reconhecedor literal dependia de listas de palavras de confirmação e não interpretava a resposta no contexto da última pergunta.
- **Correção:** O classificador existente passou a receber o contexto da oferta pendente e a última pergunta. O resolvedor e a política passaram a usar a mesma decisão validada. Um aceite válido envia o link oficial e coloca o fluxo em espera pelo resultado.
- **Como testar:** Com uma oferta PayJoy pendente, classificar a mensagem sintética «oi sim» e verificar se o fluxo decide enviar o link oficial e aguardar o resultado. Conferir também que recusa, dúvida, pausa humana, JSON inválido e baixa confiança não disparam o envio automático.
- **Tags:** PayJoy, consentimento, WhatsApp, classificação

### #144 n8n interrompia execuções ao atingir o limite do heap

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.592 · origem historico
- **Onde:** n8n · fluxo do robô de vendas
- **O que aconteceu:** Uma conversa do robô no WhatsApp teve a execução interrompida. O processo principal do n8n caiu e reiniciou automaticamente.
- **Causa:** O processo principal atingiu o limite do heap do V8, próximo de 4 GB. A causa exata do crescimento do heap não foi isolada. As consultas de configurações carregavam imagens que representavam quase todo o volume da resposta.
- **Correção:** Aumentou o limite do heap do processo principal para 6144 MiB e direcionou quatro consumidores do n8n para a resposta enxuta das rotas de configurações, que seleciona no SQL apenas os campos necessários ao robô.
- **Como testar:** Consultar as rotas com e sem view=bot usando uma configuração com imagens grandes. Conferir a redução do payload, a correspondência de horários e endereço, o Pix na rota privada e a ausência de Pix e segredos na pública. Após reiniciar o n8n, conferir os endpoints de saúde e prontidão e acompanhar execuções naturais e os logs de memória.
- **Tags:** memória, heap, configurações

### #139 Encaminhamento de produto não notificava administradores

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.528 · origem historico
- **Onde:** n8n · fluxo de encaminhamento de produto
- **O que aconteceu:** O cliente recebia a confirmação de encaminhamento, mas nenhum atendente era avisado e as mensagens seguintes eram interrompidas durante a pausa de duas horas.
- **Causa:** A busca inconclusiva criava uma pausa com o identificador bot-product-specialist, que não acionava o relay administrativo.
- **Correção:** O workflow passou a usar bot-handoff-request para acionar o relay administrativo existente. A entidade e o histórico ativo foram atualizados juntos, com uma guarda contra a reintrodução do identificador anterior.
- **Como testar:** Usar o caso de busca inconclusiva por caneta para iPad para rastrear a execução até o nó Controle Bot - Bloqueado?. Rodar o teste focado do mutador e conferir o alinhamento entre a entidade e o histórico ativo do workflow.
- **Tags:** handoff, notificações, produtos

### #140 Áudio do atendente não pausava o bot

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.546 · origem historico
- **Onde:** n8n · Handoff - Registrar manual
- **O que aconteceu:** Após o atendente enviar um áudio pelo WhatsApp Web, o bot ainda podia responder automaticamente ao cliente.
- **Causa:** O nó exigia texto para registrar a pausa. Eventos de áudio sem legenda chegavam com conversation vazio e terminavam antes de Handoff - Persistir manual.
- **Correção:** O registro manual passou a aceitar mídia e outros conteúdos sem texto, a gravar uma descrição interna quando não há legenda e a renovar a pausa de duas horas para o atendimento humano.
- **Como testar:** Usar um evento de áudio real sem legenda com fromMe=true, source=web e messageType=audioMessage para verificar a persistência da pausa. Rodar os 11 cenários direcionados de texto, mídia e exclusões.
- **Tags:** handoff, áudio, WhatsApp

### #129 Bot não reconhecia a seleção numérica após a lista

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.411 · origem historico
- **Onde:** n8n · pós-lista de celulares
- **O que aconteceu:** Ao responder 7 à lista oficial, o cliente recebia texto livre em vez do cartão do celular escolhido.
- **Causa:** O classificador enviava a ação escolher_item, mas o executor esperava selecionar_item_lista.
- **Correção:** O executor passou a aceitar os dois nomes de ação e a responder com o cartão oficial, incluindo memória, preço no PIX, parcelamento em 12x e cores.
- **Como testar:** Enviar a lista oficial e responder 7. Confirmar que o bot envia o cartão do item escolhido com preço no PIX e parcelamento em 12x.
- **Tags:** seleção, celulares, catálogo

### #130 Bot perdia o contexto depois de enviar a lista

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.411 · origem historico
- **Onde:** n8n · persistência do estado da conversa
- **O que aconteceu:** O bot perdia o contexto entre mensagens e podia responder incorretamente a perguntas como “Forma de pagamento”.
- **Causa:** A rota principal da lista chegava a Dividir mensagens sem passar pela persistência do estado. A normalização do telefone também deixava caracteres que não eram dígitos.
- **Correção:** Todas as rotas de envio passaram a persistir o estado antes de dividir as mensagens. O telefone persistido voltou a conter apenas dígitos.
- **Como testar:** Confirmar no workflow que apenas Estado Conversa - Restaurar entra diretamente em Dividir mensagens.
- **Tags:** estado, contexto, telefone

### #131 Número residual fazia “Sim” disparar seleção inválida

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.411 · origem historico
- **Onde:** n8n · pós-lista de celulares
- **O que aconteceu:** Ao responder “Sim” depois da lista, o cliente podia receber uma resposta de seleção inadequada.
- **Causa:** Um número residual do classificador ainda era usado quando a ação atual era indefinido.
- **Correção:** O executor passou a ignorar números residuais quando a ação atual é indefinido.
- **Como testar:** Testar “Sim” com um número residual no resultado do classificador e confirmar que nenhuma seleção é disparada.
- **Tags:** classificador, seleção, contexto

### #132 Busca por Poco sem marca bloqueava o atendimento automático

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.412 · origem historico
- **Onde:** n8n · busca de smartphones e handoff
- **O que aconteceu:** Após perguntar “Valor do m6pro”, o cliente ficou sem resposta ao enviar “M7 pro”.
- **Causa:** O fluxo não reconhecia m6pro como modelo de smartphone. A consulta inconclusiva acionava o handoff automático por duas horas, bloqueando a mensagem seguinte antes do classificador.
- **Correção:** O fluxo passou a reconhecer modelos Poco das famílias M, X e C mesmo sem a marca. Se o modelo estiver indisponível, informa isso e envia a lista atual uma única vez, sem acionar handoff.
- **Como testar:** Testar “Valor do m6pro” e confirmar a lista selecionável sem handoff. Enviar “M7 pro” e conferir o cartão oficial com 12x. Testar “capa para M7 pro” e confirmar o fluxo de acessórios.
- **Tags:** Poco, estoque, handoff

### #133 Bot perdia o modelo recomendado ao responder sobre garantia

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.409 · origem historico
- **Onde:** n8n · consulta de garantia
- **O que aconteceu:** Ao perguntar sobre garantia depois de aceitar uma recomendação, o cliente podia receber uma resposta que não correspondia às variantes do celular em foco.
- **Causa:** O fluxo não mantinha o modelo recomendado em foco para consultar a garantia.
- **Correção:** O fluxo passou a manter o modelo em foco e a consultar as políticas de garantia das variantes corretas.
- **Como testar:** Após aceitar a recomendação do Redmi Note 14S, perguntar “Tem garantia também né”. Conferir o tratamento de políticas diferentes entre variantes e testar a resposta sem contexto.
- **Tags:** garantia, contexto, variantes

### #134 Consulta de garantia perdia o contexto da recomendação

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.422 · origem historico
- **Onde:** n8n · consulta de garantia
- **O que aconteceu:** Ao perguntar sobre garantia depois de aceitar uma recomendação, o cliente podia receber uma resposta que não correspondia às variantes do celular em foco.
- **Causa:** O fluxo não mantinha o modelo recomendado em foco para consultar a garantia.
- **Correção:** O fluxo passou a manter o modelo em foco e a consultar as políticas de garantia das variantes corretas.
- **Como testar:** Após aceitar a recomendação do Redmi Note 14S, perguntar “Tem garantia também né”. Conferir o tratamento de políticas diferentes entre variantes e testar a resposta sem contexto.
- **Tags:** garantia, contexto, variantes

### #136 Bot inventava condições de garantia sem confirmar o modelo

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.516 · origem historico
- **Onde:** n8n · agente de atendimento
- **O que aconteceu:** O cliente podia receber informações inventadas sobre prazo ou cobertura da garantia.
- **Causa:** A IA podia informar condições de garantia mesmo sem ter confirmado o modelo exato.
- **Correção:** O fluxo passou a impedir que a IA invente prazo ou cobertura quando o modelo exato não estiver confirmado.
- **Tags:** garantia, modelo, IA

### #137 Eventos vazios do WhatsApp ativavam atendimento manual

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.526 · origem historico
- **Onde:** n8n · acionamento do atendimento manual
- **O que aconteceu:** Uma conversa podia entrar em atendimento manual sem uma mensagem de atendente.
- **Causa:** Eventos do WhatsApp sem conteúdo podiam acionar o atendimento manual.
- **Correção:** O fluxo passou a impedir que eventos vazios ativem o atendimento manual.
- **Como testar:** Executar o dry run das correções do workflow.
- **Tags:** WhatsApp, eventos, handoff

### #138 Resposta de parcelamento perdia o celular selecionado

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.526 · origem historico
- **Onde:** n8n · cotação de parcelamento
- **O que aconteceu:** Ao perguntar sobre parcelamento, o cliente podia receber uma resposta sem a tabela real de 1x a 12x ou sem referência ao modelo escolhido.
- **Causa:** O fluxo de parcelamento não garantia o uso da tabela real nem a preservação do modelo em foco.
- **Correção:** O fluxo passou a responder com a tabela real de 1x a 12x e a manter o modelo já escolhido.
- **Como testar:** Executar o dry run das correções do workflow.
- **Tags:** parcelamento, preços, contexto

### #122 Bloqueio do cliente impedia comando de liberação do admin

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.377 · origem historico
- **Onde:** n8n · Controle Bot - Comando Admin
- **O que aconteceu:** O administrador enviava o comando LIBERAR, mas a execução parava na verificação de bloqueio sem processar o comando.
- **Causa:** O nó Registrar Entrada seguia diretamente para Buscar Controle, deixando Buscar Admin Global sem entrada.
- **Correção:** Restaurou a ligação de Registrar Entrada para Buscar Admin Global e Comando Admin. Comandos autorizados passaram a ser processados antes da pausa global e do bloqueio individual.
- **Como testar:** Enviar LIBERAR ZZZZ9999 do WhatsApp do administrador para o número oficial e confirmar a resposta no aparelho. Verificar no teste regressivo que clientes bloqueados continuam sem resposta automática.
- **Tags:** admin, bloqueio, roteamento

### #123 Comparação de celulares perdia o filtro de RAM

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.404 · origem historico
- **Onde:** n8n · comparação de celulares
- **O que aconteceu:** Pedidos como «12 de RAM» podiam perder o filtro de memória, inclusive em continuações curtas.
- **Causa:** O fluxo não reconhecia a quantidade de RAM sem a unidade GB e não reaproveitava o termo do classificador em continuações curtas.
- **Correção:** Passou a reconhecer expressões como «12 de RAM» e a usar o termo do classificador para preservar o filtro na continuação.
- **Como testar:** Enviar «Poco qualquer modelo contanto que seja 12 de Ram» e verificar que os três modelos Poco de 12 GB são selecionados e que o Poco X7 Pró de 8 GB fica de fora. Testar também uma continuação curta e confirmar que o filtro permanece.
- **Tags:** RAM, comparação, contexto

### #124 Comparação confundia família de celulares com modelo exato

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.404 · origem historico
- **Onde:** n8n · comparação de celulares
- **O que aconteceu:** Um pedido amplo por celulares Poco com determinada memória podia ser tratado como busca por um modelo específico, sem retornar a seleção esperada da família.
- **Causa:** O fluxo não distinguia adequadamente as famílias Poco e Redmi dentro da Xiaomi nem separava pedidos por família e memória de buscas por modelo exato.
- **Correção:** Passou a tratar Poco e Redmi como famílias distintas da Xiaomi e a manter a busca ampla quando o cliente informa família e memória.
- **Como testar:** Enviar «Poco qualquer modelo contanto que seja 12 de Ram» e verificar que aparecem Poco M7 Pró 5G, Poco X7 Pró 5G e Poco X8 Pró 5G nas variantes de 12 GB, sem aparelhos Redmi.
- **Tags:** catálogo, família, busca

### #125 Resposta da IA repetia a comparação estruturada

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.404 · origem historico
- **Onde:** n8n · comparação de celulares
- **O que aconteceu:** O cliente recebia uma redação da IA que repetia a comparação de celulares.
- **Causa:** A redação da IA era mantida mesmo quando o fluxo já tinha uma lista estruturada de comparação.
- **Correção:** Passou a usar a lista determinística como resposta final, suprimiu a redação repetida da IA e manteve a pergunta de escolha em mensagem separada.
- **Como testar:** Executar o teste de supressão da redação da IA quando existe uma lista estruturada.
- **Tags:** comparação, duplicação, IA

### #126 Bot enviava mensagens extras antes da lista de preços

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.405 · origem historico
- **Onde:** n8n · resposta do catálogo de celulares
- **O que aconteceu:** Ao perguntar «Quais são os preços dos celulares?», o cliente recebia duas mensagens da IA antes da lista oficial.
- **Causa:** O fluxo anexava mensagens geradas pela IA mesmo quando o catálogo determinístico estava disponível.
- **Correção:** Deu prioridade ao catálogo e passou a enviar apenas os blocos da lista oficial e a pergunta final prevista.
- **Como testar:** Enviar «Quais são os preços dos celulares?» e verificar que a lista oficial chega sem mensagens da IA antes dela.
- **Tags:** catálogo, preços, IA

### #127 Marca reconhecida exigia confirmação antes de mostrar celulares

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.405 · origem historico
- **Onde:** n8n · seleção de marca no catálogo
- **O que aconteceu:** Ao responder «Realme», o cliente recebia uma pergunta de confirmação e só via a lista da marca depois de responder positivamente.
- **Causa:** O fluxo tratava o nome de uma marca reconhecida como uma resposta ambígua.
- **Correção:** Passou a abrir imediatamente a lista correspondente quando reconhece uma marca de smartphone.
- **Como testar:** Após pedir os preços dos celulares, responder «Realme» e verificar que a lista da marca chega sem pedido de confirmação.
- **Tags:** catálogo, marca, confirmação

### #128 Pedido de outro modelo retornava resposta abreviada e imagem extra

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.406 · origem historico
- **Onde:** n8n · continuação por modelo
- **O que aconteceu:** Ao pedir também o Poco M7 Pró 5G, o cliente recebia uma frase abreviada sem o preço no cartão em 12x nem as características no padrão oficial, além de uma imagem avulsa junto da ficha técnica.
- **Causa:** A continuação caía no atalho de recuperação de ficha técnica, que gerava a resposta abreviada e acrescentava a imagem avulsa.
- **Correção:** Redirecionou continuações com modelo identificado para a busca e o formatador oficial, preservando o nome identificado e a ficha técnica e removendo a imagem avulsa adicional.
- **Como testar:** Após consultar o Poco X8 Pró 5G, enviar «Me envia também do Poco M7 Pró 5G» e verificar que chegam o cartão oficial e a ficha técnica, sem a frase abreviada ou a imagem adicional.
- **Tags:** catálogo, continuação, formatação, imagem

### #115 Chamadas HTTP sem timeout explícito prendiam o atendimento

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.369 · origem historico
- **Onde:** n8n · nós HTTP do bot
- **O que aconteceu:** Quando um serviço externo deixava de responder, o bot podia aparentar estar travado por até cinco minutos, com risco de acúmulo de execuções.
- **Causa:** As chamadas HTTP comuns não tinham um limite de tempo explícito.
- **Correção:** Foram definidos limites de 30 segundos para chamadas comuns e de 15 segundos para o ViaCEP. A transcrição de áudio e a geração de cards mantiveram o limite de 120 segundos.
- **Como testar:** Executar o teste estático n8n-harden-http-timeouts-static.test.cjs, rodar o patch em dry-run e conferir os 25 nós HTTP com timeout.
- **Tags:** timeout, HTTP, n8n

### #116 Falhas transitórias da OpenAI podiam interromper o atendimento

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.370 · origem historico
- **Onde:** n8n · OpenAI Chat Model e OpenAI Classificador
- **O que aconteceu:** O atendimento podia terminar após uma falha breve ou um limite temporário da OpenAI.
- **Causa:** O modelo principal e o classificador não tinham a política de novas tentativas que já existia no modelo de vendas.
- **Correção:** Os três modelos passaram a usar até três tentativas de inferência com intervalo de cinco segundos.
- **Como testar:** Executar n8n-harden-ai-model-retries-static.test.cjs, rodar o patch em dry-run e conferir a configuração dos três modelos.
- **Tags:** OpenAI, retry, classificação

### #117 Classificação inesperada deixava o cliente sem resposta

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.371 · origem historico
- **Onde:** n8n · Switch Especialistas
- **O que aconteceu:** O atendimento podia terminar silenciosamente, sem resposta ao cliente nem erro técnico.
- **Causa:** O Switch descartava itens cuja classificação não correspondia a nenhuma das 13 regras.
- **Correção:** Foi adicionada a saída Atendimento geral (fallback), que encaminha classificações sem correspondência para o Agente Geral - Atendimento.
- **Como testar:** Executar n8n-add-specialist-fallback-static.test.cjs e conferir que a saída 13 aponta para o agente geral e que as saídas 0 a 12 foram preservadas.
- **Tags:** classificação, fallback, roteamento

### #118 Correção de aniversário era tratada como agradecimento

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.372 · origem historico
- **Onde:** n8n · controlador de conversa e fluxo de handoff
- **O que aconteceu:** Após receber parabéns na data errada e informar 11/10, o cliente recebeu uma resposta de agradecimento e a correção não chegou à equipe.
- **Causa:** Faltava uma regra determinística para reconhecer correções de data após os parabéns. O classificador retornou fallback e o agente geral interpretou a mensagem como agradecimento.
- **Correção:** O controlador passou a reconhecer a correção, preservar a data no contexto, pedir desculpas pelo envio incorreto e encaminhar o caso à equipe pelo handoff persistente, que pausa o bot por duas horas.
- **Como testar:** Rodar a regressão com a correção 11/10 após os parabéns e verificar que um agradecimento comum continua no atendimento geral.
- **Tags:** aniversário, classificação, handoff

### #119 Resposta de encaminhamento humano repetia e contradizia informações

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.372 · origem historico
- **Onde:** n8n · fluxo de encaminhamento humano
- **O que aconteceu:** Ao pedir um atendente, o cliente recebia uma resposta que repetia a promessa de chamar alguém e fazia afirmações contraditórias sobre a disponibilidade da equipe.
- **Causa:** O texto genérico do encaminhamento repetia a promessa e incluía informações conflitantes sobre disponibilidade.
- **Correção:** A resposta genérica foi reescrita em duas frases curtas e objetivas.
- **Como testar:** Validar o novo texto da resposta ao pedido genérico de atendimento humano.
- **Tags:** handoff, mensagens, atendimento

### #120 Retirada podia indicar loja fechada por falha na consulta

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.374 · origem historico
- **Onde:** n8n · fluxo de retirada
- **O que aconteceu:** O bot podia dizer que a loja estava fechada quando a consulta ao expediente falhava.
- **Causa:** Uma regressão do task runner após a atualização do n8n impedia os Code nodes de ler configurações da loja. O fluxo tratava a falha na consulta como loja fechada.
- **Correção:** A leitura protegida das configurações foi movida para um nó HTTP Request. Quando o expediente não pode ser consultado, o bot pede confirmação humana.
- **Como testar:** Executar os testes estáticos de retirada e da consulta HTTP. Na validação controlada, seguir lista → opção 18 → foto → quantidade → retirada → “Hoje por volta das 15h” e conferir awaiting_payment_method com pickupTime=15:00.
- **Tags:** retirada, expediente, runner

### #121 Pedido genérico de compra acionava atendimento humano indevidamente

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.375 · origem historico
- **Onde:** n8n · classificação de intenção e handoff
- **O que aconteceu:** Ao dizer “Gostaria de fazer uma compra”, o cliente era encaminhado para atendimento humano, e o bot ficava pausado para o contato.
- **Causa:** A regra de encaminhamento aceitava uma intenção genérica de compra sem pedido explícito para falar com uma pessoa.
- **Correção:** O handoff passou a exigir intenção explícita de falar com uma pessoa. Para pedidos genéricos, o bot pergunta se o cliente quer a lista de celulares ou procura um produto específico. A pausa indevida do contato afetado foi liberada.
- **Como testar:** Executar n8n-generic-purchase-handoff-static.test.cjs para verificar a regra de classificação e a rota dedicada, e rodar o patch em dry-run.
- **Tags:** compras, classificação, handoff

### #107 Bot perdia escolhas em pedidos de várias fotos

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.363 · origem historico
- **Onde:** n8n · fluxo de vendas
- **O que aconteceu:** Ao enviar “Número 15,16”, o cliente podia deixar de receber uma das fotos ou ter um pedido iniciado automaticamente.
- **Causa:** O fluxo não preservava todas as opções de uma seleção numerada múltipla.
- **Correção:** Preservar todas as escolhas e enviar as fotos dos modelos selecionados sem criar pedido.
- **Como testar:** Executar a regressão de seleção múltipla com “Número 15,16” e verificar o envio das duas fotos sem criação de pedido.
- **Tags:** fotos, seleção, vendas

### #108 Bot não reconhecia códigos curtos de celulares

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.363 · origem historico
- **Onde:** n8n · fluxo de vendas
- **O que aconteceu:** Mesmo falando explicitamente de celular, o cliente podia usar um código como C71, A15 ou G54 e o bot não o interpretar como modelo.
- **Causa:** A identificação de modelos não tratava códigos alfanuméricos curtos como modelos no contexto explícito de celulares.
- **Correção:** Reconhecer códigos curtos como modelos quando o cliente se referir explicitamente a um celular.
- **Como testar:** Executar o dry-run com C71, A15, Note 15 Pro+, uma consulta de acessório para C71 e uma busca genérica.
- **Tags:** modelos, classificação, celulares

### #109 Bot confundia as fichas do Poco C71 e Realme C71

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.363 · origem historico
- **Onde:** n8n · especialista de vendas
- **O que aconteceu:** Ao perguntar pelo C71, o cliente podia receber especificações de outro aparelho com o mesmo código.
- **Causa:** O código C71 é compartilhado por dois modelos e a consulta ambígua não era resolvida antes de usar a ficha.
- **Correção:** Manter as fichas separadas, pedir confirmação quando houver ambiguidade e fornecer ao especialista somente os campos de especificações permitidos do cadastro.
- **Como testar:** Executar o dry-run com C71 e verificar que o bot pede confirmação antes de apresentar a ficha.
- **Tags:** modelos, ambiguidade, especificações

### #110 Perguntas coloquiais sobre almoço não acionavam o fluxo de horário

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.364 · origem historico
- **Onde:** n8n · classificador
- **O que aconteceu:** Perguntas como “Vcs sai pra o almoço que horas?” podiam seguir sem a classificação de consulta de horário.
- **Causa:** A classificação não dava prioridade determinística a perguntas diretas sobre horário formuladas com abreviações comuns.
- **Correção:** Dar prioridade às consultas diretas de horário e preservar no fluxo de vendas frases contextuais como “Eu ia depois do almoço”.
- **Como testar:** Executar o dry-run e verificar que a pergunta direta cai em horario_loja e que a frase contextual permanece em vendas_produtos.
- **Tags:** horário, classificação, almoço

### #111 Bot informava horários sem confirmar a configuração da loja

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.364 · origem historico
- **Onde:** n8n · nós de horário e especialista de vendas
- **O que aconteceu:** O cliente podia receber um horário fixo quando a consulta falhava ou uma resposta de vendas sem vínculo com o horário cadastrado.
- **Causa:** Os nós de horário recorriam a uma agenda fixa na falha da consulta, e o especialista não usava business_hours como fonte única.
- **Correção:** Usar exclusivamente business_hours da configuração pública da empresa e, se a consulta falhar, pedir confirmação humana sem informar horários.
- **Como testar:** No dry-run, verificar que o almoço cadastrado aparece como 12:00 a 14:00 e que uma falha simulada da API produz uma resposta sem horários.
- **Tags:** horário, configuração, contingência

### #112 Bot apresentava fichas técnicas contraditórias entre variantes do mesmo aparelho

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.367 · origem historico
- **Onde:** n8n · especialista de vendas
- **O que aconteceu:** O cliente podia receber especificações diferentes para o mesmo aparelho ao consultar variantes de RAM ou armazenamento.
- **Causa:** As características comuns do aparelho não vinham de uma ficha central por modelo.
- **Correção:** Consultar a ficha central do modelo para as características comuns. Para o Poco X7 Pro, usar bateria de 6000 mAh, carregamento de 90 W e câmera principal de 50 MP.
- **Como testar:** Executar os testes da fonte de especificações e o dry-run contra o workflow ativo, conferindo a ficha confirmada do Poco X7 Pro.
- **Tags:** cadastro, variantes, especificações

### #113 Bot perdia o contexto de vendas entre mensagens

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.367 · origem historico
- **Onde:** n8n · fluxo de vendas
- **O que aconteceu:** Após receber uma lista ou uma pergunta de confirmação, o cliente podia responder com um número e o bot perder a referência às opções anteriores.
- **Causa:** O estado da lista comercial e da desambiguação não era restaurado entre execuções do workflow.
- **Correção:** Persistir salesPostList e pendingDeviceClarification na API com MySQL, restaurar esse estado entre execuções e aceitar respostas pelo número da opção apresentada.
- **Como testar:** Executar o dry-run de persistência e verificar se uma resposta numérica em outra execução recupera a opção apresentada anteriormente.
- **Tags:** contexto, persistência, desambiguação

### #94 Bot repetia a saudação na mesma resposta

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.319 · origem historico
- **Onde:** n8n · fluxo de conversa do bot
- **O que aconteceu:** O cliente via a mesma saudação, como “Bom dia”, mais de uma vez na resposta.
- **Causa:** O fluxo permitia repetir a saudação dentro da mesma resposta.
- **Correção:** Suprime repetições de “Bom dia”, “Boa tarde” e “Boa noite” na mesma resposta.
- **Tags:** saudação, repetição

### #95 Bot não reconhecia confirmação curta de foto

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.319 · origem historico
- **Onde:** n8n · fluxo de confirmação de foto
- **O que aconteceu:** Depois de o bot oferecer a foto de um produto identificado, responder “sim” podia deixar o cliente sem a imagem solicitada.
- **Causa:** O fluxo não associava uma resposta afirmativa curta à oferta de foto do produto já identificado.
- **Correção:** Vincula a confirmação curta à oferta de foto e envia primeiro o blueprint com marca d’água, seguido da foto real disponível.
- **Como testar:** Simular o fluxo com um produto identificado, a oferta de foto e a resposta “sim”.
- **Tags:** foto, confirmação, contexto

### #96 Pedido de foto da lista perdia o blueprint

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.320 · origem historico
- **Onde:** n8n · fluxo de mídia da lista de produtos
- **O que aconteceu:** Ao pedir “Foto do 2” para o Realme Note 70, o cliente recebeu três fotos comuns sem o blueprint que constava no catálogo.
- **Causa:** O estado temporário descartava o campo blueprintImageUrl ao salvar as variações de cor.
- **Correção:** Preserva blueprintImageUrl e consulta o SKU para recuperar o blueprint de variações antigas. Se a consulta falhar, mantém as fotos conhecidas. Envia o blueprint primeiro e limita a galeria complementar a uma foto real.
- **Como testar:** Executar os testes estático e comportamental de blueprint e estado temporário.
- **Tags:** blueprint, catálogo, variações

### #97 Legenda vazia fazia a Evolution rejeitar a imagem

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.320 · origem historico
- **Onde:** n8n · divisor de mensagens de mídia
- **O que aconteceu:** Uma tentativa de enviar a segunda imagem falhou com HTTP 400 na Evolution.
- **Causa:** O divisor convertia a legenda vazia em um objeto, que virava “[object Object]”.
- **Correção:** Mantém a legenda vazia como texto vazio ao dividir as mensagens.
- **Como testar:** Executar os testes estático e comportamental com uma legenda vazia.
- **Tags:** imagem, legenda, Evolution

### #98 Número do modelo era interpretado como limite de preço

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.322 · origem historico
- **Onde:** n8n · My workflow
- **O que aconteceu:** Buscas por modelos como POCO X8 Pro, iPhone 15, Redmi Note 14 e Galaxy S25 podiam retornar resultados filtrados por um orçamento que o cliente não informou.
- **Causa:** O parser interpretava os números nos nomes dos modelos como limites de preço.
- **Correção:** Corrige o parser para distinguir números do modelo de valores de orçamento.
- **Como testar:** Reexecutar a execução isolada 9061 e verificar orçamento zero e duas configurações do POCO X8 Pro.
- **Tags:** busca, modelo, orçamento

### #99 Busca por modelo exato herdava orçamento antigo

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.322 · origem historico
- **Onde:** n8n · My workflow
- **O que aconteceu:** Um limite de compra informado antes podia ocultar resultados quando o cliente pedia um modelo exato sem informar orçamento na mensagem atual.
- **Causa:** A busca pelo modelo exato reaproveitava o orçamento anterior.
- **Correção:** Desconsidera o orçamento antigo nas buscas por modelo exato quando a mensagem atual não informa um limite de compra.
- **Como testar:** Executar os testes estáticos de respostas de vendas e a reexecução isolada 9061, que confirmou orçamento zero.
- **Tags:** busca, memória, orçamento

### #100 Consulta sem resultados gerava aviso indevido de indisponibilidade

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.322 · origem historico
- **Onde:** n8n · My workflow
- **O que aconteceu:** O bot dizia ao cliente que um produto estava indisponível quando a consulta não retornava itens.
- **Causa:** Frases fixas tratavam a ausência de resultados como confirmação de indisponibilidade.
- **Correção:** Remove as frases fixas de indisponibilidade e encaminha consultas inconclusivas para conferência humana. A IA redige a resposta com base no histórico e no estado da consulta.
- **Como testar:** Reexecutar a execução isolada 9061 e verificar a ausência da frase gravada de indisponibilidade.
- **Tags:** estoque, catálogo, atendimento

### #101 Busca por modelo específico omitia blueprint disponível

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.336 · origem historico
- **Onde:** n8n · fluxo de busca por modelo específico
- **O que aconteceu:** Ao pedir “Realme C71”, o cliente recebeu apenas texto e orçamento, embora o modelo tivesse um blueprint oficial ativo na API.
- **Causa:** O fluxo de busca por modelo específico não anexava o blueprint oficial disponível.
- **Correção:** Anexa o blueprint oficial após a resposta textual quando a busca confirma exatamente um modelo, usando URLs dos domínios oficiais do Mercado do Vale.
- **Como testar:** Executar o teste estático do blueprint e da ordem de mídia.
- **Tags:** blueprint, catálogo, modelo

### #102 Pergunta sobre entrega recebia política de pagamento

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.337 · origem historico
- **Onde:** n8n · Parse Classificacao e Resolver Acao de Conversacao
- **O que aconteceu:** Ao perguntar “Quais são suas opções de entrega?”, o cliente recebeu a política de pagamento.
- **Causa:** Uma alteração removeu a intenção entrega_frete do classificador ativo.
- **Correção:** Restaura entrega_frete e aplica regras determinísticas para encaminhar perguntas de entrega, frete, envio, motoboy e retirada à rota consultar_entrega. Perguntas que também citam uma forma de pagamento seguem pela rota de pagamento.
- **Como testar:** Executar o teste estático com a frase do incidente e com variações de entrega, frete e retirada.
- **Tags:** entrega, frete, classificação

### #103 Referência indefinida interrompia processamento do catálogo

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.346 · origem historico
- **Onde:** n8n · Vendas - Contexto Produtos
- **O que aconteceu:** O fluxo de vendas falhava ao montar o contexto de produtos, registrando “specificDeviceModelRequest is not defined”.
- **Causa:** O nó usava specificDeviceModelRequest como propriedade abreviada sem declarar a variável.
- **Correção:** Mapeia explicitamente a propriedade a partir de base.specificDeviceModelRequest e mantém esse mapeamento no patch idempotente.
- **Como testar:** Executar node tmp-tests/n8n-ai-natural-sales-responses-static.test.mjs e verificar que o teste exige o mapeamento explícito.
- **Tags:** catálogo, runtime, modelo

### #104 Filtro confundia rede 5G com memória RAM

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.353 · origem historico
- **Onde:** n8n · fluxo de catálogo de celulares
- **O que aconteceu:** Ao pedir celulares 5G, o cliente podia receber modelos 4G ou resultados filtrados por memória RAM.
- **Causa:** O filtro confundia “5G” com “5 GB de RAM” e não usava o campo de rede para excluir aparelhos identificados como 4G.
- **Correção:** Interpreta 5G como requisito de rede móvel, consulta o campo estruturado de rede, exclui aparelhos explicitamente 4G e combina o requisito com os demais filtros.
- **Como testar:** Executar node tmp-tests/n8n-phone-5g-brand-chunks-static.test.mjs e ensaiar a busca com o catálogo real.
- **Tags:** 5G, catálogo, filtros

### #93 Saudação retomava produto de uma conversa antiga

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.319 · origem historico
- **Onde:** n8n · memória do bot
- **O que aconteceu:** Ao voltar depois de mais de duas horas e mandar apenas uma saudação, o cliente podia receber uma resposta sobre um produto da conversa anterior.
- **Causa:** A chave de memória e o histórico recente atravessavam o intervalo de inatividade.
- **Correção:** Inicia um novo contexto após mais de duas horas de inatividade, rotaciona a chave de memória e limita o histórico enviado ao workflow ao contexto atual.
- **Como testar:** Executar os testes unitários da janela de contexto e da chave de memória.
- **Tags:** memória, contexto, saudação

### #89 Pedido explícito de lista exigia confirmação redundante

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.289 · origem historico
- **Onde:** n8n · fluxo da lista de celulares
- **O que aconteceu:** O cliente pedia a lista de celulares e precisava confirmar o pedido antes de recebê-la.
- **Causa:** O fluxo encaminhava um pedido explícito de lista para uma etapa de confirmação.
- **Correção:** O fluxo passou a enviar a lista diretamente quando o cliente a solicita.
- **Como testar:** Executar node tmp-tests/n8n-phone-catalog-followup-and-memory-static.test.mjs.
- **Tags:** catálogo, confirmação, WhatsApp

### #90 Mensagens rápidas divididas faziam o bot perder pedido de catálogo

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.289 · origem historico
- **Onde:** n8n · fluxo da lista de celulares
- **O que aconteceu:** Ao dividir o pedido de catálogo em mensagens rápidas, o cliente podia ficar sem a lista solicitada.
- **Causa:** O fluxo não preservava o pedido de catálogo quando a frase chegava em mensagens rápidas separadas.
- **Correção:** O fluxo passou a preservar a solicitação de catálogo nesse formato.
- **Como testar:** Executar node tmp-tests/n8n-preserve-rapid-greeting-static.test.mjs.
- **Tags:** catálogo, mensagens, WhatsApp

### #91 Busca de fotos de celulares colidia com acessórios

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.289 · origem historico
- **Onde:** n8n · recuperação de fotos por modelo e cor
- **O que aconteceu:** Um pedido de foto de celular podia encontrar uma película ou outro acessório.
- **Causa:** A busca de fotos não restringia os resultados à categoria de smartphones.
- **Correção:** A recuperação de fotos passou a buscar apenas na categoria de smartphones.
- **Como testar:** Executar node tmp-tests/n8n-model-color-photo-fallback-static.test.mjs e node tmp-tests/n8n-fix-model-color-photo-fallback.cjs --self-test.
- **Tags:** fotos, smartphones, acessórios

### #92 Bot repetia a saudação na mesma mensagem

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.289 · origem historico
- **Onde:** n8n · saudação central
- **O que aconteceu:** O cliente recebia saudações duplicadas como «Boa tarde Boa tarde».
- **Causa:** A montagem da mensagem podia incluir a mesma saudação duas vezes.
- **Correção:** O fluxo passou a eliminar saudações duplicadas.
- **Como testar:** Executar node tmp-tests/n8n-central-greeting-time-static.test.mjs.
- **Tags:** saudação, duplicação, WhatsApp

### #80 Bot ignorava fotos cadastradas por modelo e cor

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.283 · origem historico
- **Onde:** n8n · Vendas - Contexto Produtos
- **O que aconteceu:** O bot dizia que não havia foto do Wp58 Pró laranja, embora o catálogo tivesse quatro fotos válidas.
- **Causa:** O fluxo consultava apenas product.images, que estava vazio. As fotos estavam na galeria de modelo e cor.
- **Correção:** A API passou a resolver as galerias em lote por modelo, empresa e cor e a expor model_color_images e resolved_images em /products. O nó usa esses campos quando o SKU não tem fotos próprias, com limite de três imagens e URLs HTTPS do diretório público da API.
- **Como testar:** Pedir a foto de um SKU com product.images=[] e galeria de modelo e cor disponível. Confirmar que o bot gera o envio de imagem.
- **Tags:** fotos, catálogo, SKU

### #81 Pergunta de entrega bloqueava pedidos de foto

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.284 · origem historico
- **Onde:** n8n · Vendas - Verificar Pos Lista
- **O que aconteceu:** Ao pedir uma foto durante a escolha entre entrega e retirada, o cliente recebia novamente a pergunta sobre entrega.
- **Causa:** O ramo awaiting_fulfillment retornava antes do tratamento de pedir_foto, embora o classificador reconhecesse a intenção.
- **Correção:** O fluxo passou a atender o pedido explícito de foto antes da pergunta de entrega ou retirada e a preservar a etapa comercial para a retomada da compra.
- **Como testar:** Em awaiting_fulfillment, pedir explicitamente uma foto e verificar que o tratamento de mídia ocorre antes da pergunta de entrega ou retirada.
- **Tags:** fotos, entrega, estado

### #82 Listas antigas guardavam variantes sem fotos resolvidas

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.284 · origem historico
- **Onde:** n8n · Vendas - Verificar Pos Lista
- **O que aconteceu:** O cliente podia ficar sem a foto de uma variante selecionada em uma lista antiga, mesmo com imagens disponíveis no catálogo.
- **Causa:** O estado criado antes da v1.2.283 guardava a variante com images=[] e sem os campos de imagens resolvidas.
- **Correção:** Quando a variante armazenada não tem imagem pública, o fluxo consulta o SKU em /products, aproveita resolved_images e model_color_images e guarda a variante atualizada no estado da conversa.
- **Como testar:** Verificar que o fluxo consulta /products pelo SKU somente quando a variante armazenada não tem imagem pública.
- **Tags:** fotos, catálogo, estado, SKU

### #83 Consulta de fotos usava recursos indisponíveis no runner

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.285 · origem historico
- **Onde:** n8n · recuperação de fotos de listas antigas
- **O que aconteceu:** O bot informava que a foto estava indisponível, embora a API retornasse quatro imagens para o SKU correto.
- **Causa:** O Code node usava fetch e AbortSignal, indisponíveis no sandbox do task runner do n8n 2.35.7.
- **Correção:** A consulta passou a usar helpers.httpRequest, fornecido pelo task runner.
- **Como testar:** Executar o ramo completo com um mock de helpers.httpRequest e confirmar que ele gera a mensagem de imagem. Verificar que um produto divergente não fornece a foto e que o código não usa fetch nem AbortSignal nesse ramo.
- **Tags:** fotos, HTTP, sandbox

### #84 Lista expirada prendia pedido de foto em confirmação

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.286 · origem historico
- **Onde:** n8n · recuperação de fotos após a lista
- **O que aconteceu:** O bot repetia a confirmação do item e não mostrava a foto, mesmo depois que o cliente respondia com o número solicitado.
- **Causa:** O estado salesPostList havia expirado. O fluxo recuperava o modelo, a cor ou o número do item, mas voltava à mesma confirmação por depender do estado da lista.
- **Correção:** O fluxo passou a consultar o catálogo pelo modelo e pela cor recuperados. Uma resposta numérica logo após a confirmação só reaproveita um SKU exato de um link recente. Quando há ambiguidade, o bot pede modelo e cor.
- **Como testar:** Simular os formatos das execuções 8071 e 8072 com salesPostList expirado. Cobrir busca por modelo e cor, número vinculado a SKU exato, resultado ambíguo, falha HTTP e URLs de imagem permitidas.
- **Tags:** fotos, contexto, expiração, catálogo

### #85 Pergunta sobre vídeo recebia resposta de entrega

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.287 · origem historico
- **Onde:** n8n · fluxo de vendas
- **O que aconteceu:** Depois de ver a foto do item 35, o cliente perguntava se havia vídeo e recebia uma pergunta sobre entrega ou retirada do pedido, que estava no item 36.
- **Causa:** O fluxo não registrava o último produto mostrado como contexto de mídia separado do item do pedido. A etapa de entrega ou retirada interceptava a pergunta sobre vídeo.
- **Correção:** O fluxo passou a registrar o último produto mostrado, priorizar números de item explícitos e consultar o catálogo pelo SKU e ID exatos. O Agente Geral recebe os campos de vídeo e responde sem alterar o pedido ou a etapa comercial.
- **Como testar:** Com o pedido no item 36 e a última foto no item 35, perguntar se há vídeo e confirmar que a consulta usa somente o SKU do item 35. Repetir com uma pergunta explícita sobre o item 36 e com falha de consulta. Conferir que o rascunho permanece igual nos três casos.
- **Tags:** vídeo, contexto, entrega, pedido

### #86 Bot afirmava que todo link de produto tinha vídeo

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.287 · origem historico
- **Onde:** n8n · Agente Geral
- **O que aconteceu:** O cliente podia receber a informação de que o link continha vídeo, embora o produto não tivesse vídeo cadastrado.
- **Causa:** O fluxo usava uma afirmação genérica sobre os links sem verificar video_url e marketing_video_url para o produto.
- **Correção:** A afirmação genérica foi removida. O Agente Geral passou a receber os campos de vídeo consultados no catálogo, com disponibilidade desconhecida em caso de falha na consulta.
- **Como testar:** Verificar que o SKU RN704256P está sem video_url e marketing_video_url e que uma falha na consulta resulta em disponibilidade desconhecida.
- **Tags:** vídeo, catálogo, disponibilidade

### #87 Resposta de preço fazia o bot perder preferências anteriores

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.288 · origem historico
- **Onde:** n8n · filtros do catálogo de celulares
- **O que aconteceu:** Ao responder apenas «1500,00», o cliente podia receber uma lista que desconsiderava o pedido anterior de câmera boa.
- **Causa:** As preferências não eram acumuladas e persistidas entre as mensagens como critérios de uma mesma busca.
- **Correção:** O fluxo passou a persistir as preferências separadamente do histórico comum e a combinar os filtros por interseção com os campos estruturados do catálogo.
- **Como testar:** Pedir um celular com câmera boa e depois informar apenas «1500,00». Verificar que a busca conserva o critério de câmera e aplica também o limite de preço.
- **Tags:** filtros, memória, catálogo

### #88 Normalizador falhava ao iniciar os filtros estruturados

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.289 · origem historico
- **Onde:** n8n · filtros do catálogo de celulares
- **O que aconteceu:** O fluxo falhava ao processar os filtros estruturados da lista de celulares.
- **Causa:** Havia um erro na inicialização do normalizador usado pelos filtros estruturados.
- **Correção:** A inicialização do normalizador foi corrigida.
- **Como testar:** Executar node tmp-tests/n8n-phone-catalog-followup-and-memory-static.test.mjs.
- **Tags:** filtros, normalização, catálogo

### #68 Fluxo perdia a intenção de localização já classificada

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.244 · origem historico
- **Onde:** n8n · Loja - Localizacao
- **O que aconteceu:** Um pedido de localização podia deixar de seguir para a resposta com o endereço e o mapa da loja.
- **Causa:** A intenção já classificada não era preservada no encaminhamento.
- **Correção:** Preservar a intenção e encaminhar o atendimento ao fluxo que consulta o endpoint oficial de dados da empresa.
- **Como testar:** Executar n8n-location-concurrency-core.test.cjs e n8n-location-concurrency-static.test.mjs.
- **Tags:** localização, intenção, atendimento

### #69 Blocos do catálogo eram enviados em paralelo

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.251 · origem historico
- **Onde:** n8n · Loop - Enviar mensagens em ordem
- **O que aconteceu:** O cliente podia receber os blocos do catálogo fora de ordem no WhatsApp.
- **Causa:** O caminho de envio permitia que todos os blocos chegassem à Evolution em paralelo.
- **Correção:** Restaurar o loop com Split In Batches v3 de um item, usar a saída loop para o envio e iniciar o próximo lote após Handoff - Registrar bot enviado.
- **Como testar:** Executar n8n-fix-catalog-order-and-model-match-static.test.mjs e verificar que done fica sem conexão, loop chega ao verificador e o caminho pós-envio retorna ao loop.
- **Tags:** WhatsApp, catálogo, ordenação

### #61 Task Runner caía antes da busca e resposta no WhatsApp

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.225 · origem historico
- **Onde:** n8n · Task Runner JavaScript do fluxo de vendas
- **O que aconteceu:** Algumas mensagens eram classificadas corretamente pela IA, mas o cliente ficava sem a lista de produtos e sem resposta no WhatsApp.
- **Causa:** O processo JavaScript do Task Runner caía com Cannot assign to read only property 'prependListener' of object '#<Socket>'.
- **Correção:** Os serviços n8n e Task Runner foram atualizados juntos para as imagens oficiais 2.33.7, com versões fixadas no Docker Swarm.
- **Como testar:** Confirmar as imagens 2.33.7, os dois serviços em 1/1 e o health público em HTTP 200. Executar de forma controlada o fluxo de lista de celulares e verificar que o runner segue ativo e que os logs novos não registram a assinatura da queda.
- **Tags:** n8n, runner, WhatsApp, vendas

### #62 Primeira resposta usava saudação inadequada para Petrolina

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.227 · origem historico
- **Onde:** n8n · primeiro contato do fluxo de vendas
- **O que aconteceu:** O cliente podia receber uma saudação inadequada ao horário de Petrolina ou iniciar a conversa sem receber saudação.
- **Causa:** A lógica do primeiro contato não garantia a saudação local quando o cliente começava a conversa sem cumprimentar.
- **Correção:** A primeira resposta passou a usar a saudação correta de Petrolina mesmo sem cumprimento do cliente e a incluir o primeiro nome somente quando confiável.
- **Como testar:** Executar node tmp-tests/n8n-first-contact-brand-greeting-static.test.cjs.
- **Tags:** n8n, WhatsApp, saudação

### #66 Nova busca no WhatsApp falhava antes de enviar a lista

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.230 · origem historico
- **Onde:** n8n · Vendas - Verificar Pos Lista
- **O que aconteceu:** O cliente pedia uma nova busca e ficava sem resposta, pois o fluxo falhava antes de gerar e enviar a lista.
- **Causa:** O caminho nova_busca chamava buildContinueItem antes de sua inicialização, gerando Cannot access 'buildContinueItem' before initialization.
- **Correção:** O helper foi convertido em uma declaração de função disponível antes da chamada. O workflow ativo e seu histórico foram atualizados.
- **Como testar:** Executar node tmp-tests/n8n-post-list-build-continue-order-static.test.mjs e simular, em modo somente leitura, o caminho nova_busca no workflow ativo.
- **Tags:** n8n, WhatsApp, busca, JavaScript

### #42 Confirmação de contato dependia de nó antigo

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.29 · origem historico
- **Onde:** n8n · Contato - Preparar
- **O que aconteceu:** A confirmação do contato podia falhar no caminho atual do atendimento.
- **Causa:** A confirmação ainda dependia do nó antigo Mensagem parece nome?, fora do caminho atual.
- **Correção:** Passou a usar o nó Contato - Preparar para a confirmação.
- **Como testar:** Executar node tmp-tests/n8n-location-concurrency-static.test.mjs.
- **Tags:** n8n, contato, nome, confirmação

### #44 Bot repetia aviso de encaminhamento ao atendente

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.32 · origem historico
- **Onde:** n8n · encaminhamento para atendimento humano
- **O que aconteceu:** O cliente podia receber “Vou chamar um atendente” a cada nova mensagem.
- **Causa:** O encaminhamento automático respondia sem persistir antes a pausa do bot.
- **Correção:** Passou a persistir uma pausa de duas horas antes de enviar o primeiro aviso e a manter o bot em silêncio nas mensagens seguintes durante a pausa.
- **Como testar:** Executar node tmp-tests/n8n-handoff-name-idle-repetition-static.test.mjs.
- **Tags:** n8n, encaminhamento, atendimento, repetição

### #45 Bot aceitava respostas comuns como nome do cliente

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.32 · origem historico
- **Onde:** n8n · convite de nome
- **O que aconteceu:** Respostas como “Aguardando”, “Fechar pedido” e “Ok” podiam ser interpretadas como nome.
- **Causa:** O convite podia continuar ativo após uma resposta que não era um nome e aceitava expressões comuns da conversa.
- **Correção:** Limitou a validade do convite a dez minutos, passou a cancelá-lo após uma resposta não nominal e a rejeitar as expressões citadas.
- **Como testar:** Responder ao convite com “Aguardando”, “Fechar pedido” ou “Ok” e verificar que o texto não é aceito como nome.
- **Tags:** n8n, cadastro, nome, validação

### #46 Aviso de encaminhamento incluía pedido de nome

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.32 · origem historico
- **Onde:** n8n · encaminhamento para atendimento humano
- **O que aconteceu:** Ao receber o aviso de encaminhamento a um atendente, o cliente também podia receber um pedido de nome na mesma mensagem.
- **Causa:** O fluxo podia anexar o convite de nome à mensagem de encaminhamento.
- **Correção:** Removeu o convite de nome da mensagem de encaminhamento humano.
- **Como testar:** Executar node tmp-tests/n8n-handoff-name-idle-repetition-static.test.mjs.
- **Tags:** n8n, atendimento, encaminhamento, nome

### #47 Confirmações de horário de entrega não chegavam ao atendente

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.32 · origem historico
- **Onde:** n8n · atendimento de entrega
- **O que aconteceu:** Um pedido de confirmação do horário de entrega podia ficar com o bot sem chegar a um atendente.
- **Causa:** O fluxo não encaminhava confirmações de horário de entrega ao atendimento humano.
- **Correção:** Passou a encaminhar essas confirmações ao atendente.
- **Tags:** n8n, entrega, horário, atendimento

### #48 Pedidos de simulação recebiam política genérica de pagamento

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.32 · origem historico
- **Onde:** n8n · atendimento de vendas
- **O que aconteceu:** Ao pedir uma simulação, o cliente recebia novamente a política genérica de pagamento.
- **Causa:** O fluxo usava a resposta genérica de pagamento para pedidos de simulação.
- **Correção:** Ajustou o tratamento dos pedidos de simulação para parar de repetir a política genérica.
- **Tags:** n8n, simulação, pagamento, vendas

### #37 Bot perdia contexto de respostas automáticas e humanas

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.28 · origem historico
- **Onde:** n8n · classificação, atendimento e vendas
- **O que aconteceu:** O bot podia agir como se respostas anteriores não tivessem acontecido e voltar a pedir o nome do cliente.
- **Causa:** O contexto dos agentes não incluía todas as respostas determinísticas e humanas recentes.
- **Correção:** Passou a fornecer as 12 mensagens recentes, em ordem, antes da mensagem atual. O convite de nome é suprimido quando já consta nesse histórico.
- **Como testar:** Executar node tmp-tests/n8n-persistent-handoff-context-core.test.cjs e node tmp-tests/n8n-persistent-handoff-context-static.test.mjs.
- **Tags:** n8n, contexto, histórico, nome

### #38 Execução concorrente apagava a pausa do atendimento humano

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.28 · origem historico
- **Onde:** n8n · encaminhamento para atendimento humano
- **O que aconteceu:** O bot podia voltar a responder enquanto um atendente ainda cuidava da conversa.
- **Causa:** O mecanismo anterior guardava a pausa em Workflow Static Data e permitia que uma execução antiga e concorrente a apagasse.
- **Correção:** Passou a registrar no MySQL uma pausa de duas horas ao receber uma resposta manual pelo webhook e a estendê-la de forma atômica.
- **Como testar:** Executar node tmp-tests/n8n-persistent-handoff-context-core.test.cjs e node tmp-tests/n8n-persistent-handoff-context-static.test.mjs.
- **Tags:** n8n, atendimento, concorrência, pausa

### #39 Pedido de endereço era encaminhado ao atendimento humano

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.29 · origem historico
- **Onde:** n8n · classificação de intenção
- **O que aconteceu:** Ao pedir o endereço, o cliente podia ser encaminhado a um atendente sem receber a localização da loja.
- **Causa:** A intenção localizacao_loja e a ação consultar_localizacao_loja precisavam ser restauradas. O classificador podia interpretar o pedido como solicitação de atendimento humano.
- **Correção:** Restaurou a intenção e a ação, deu prioridade à detecção de pedidos de endereço e reutilizou o especialista que consulta os dados oficiais e monta o link do Google Maps.
- **Como testar:** Enviar “Me passa seu endereço” e verificar se o bot responde com a localização e o link do Google Maps.
- **Tags:** n8n, localização, endereço, classificação

### #40 Execuções antigas podiam enviar respostas fora de ordem

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.29 · origem historico
- **Onde:** n8n · registro e envio de respostas
- **O que aconteceu:** O cliente podia receber uma resposta sobre uma mensagem anterior depois de já ter enviado outra.
- **Causa:** O fluxo podia registrar ou enviar uma resposta sem verificar se outra mensagem do cliente havia chegado.
- **Correção:** Passou a comparar o ID em processamento com o ID da mensagem mais recente antes de registrar ou enviar a resposta e a descartar execuções antigas.
- **Como testar:** Executar node tmp-tests/n8n-location-concurrency-core.test.cjs e node tmp-tests/n8n-location-concurrency-static.test.mjs.
- **Tags:** n8n, concorrência, mensagens, ordem

### #41 Convite de nome chegava antes da resposta principal

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.29 · origem historico
- **Onde:** n8n · convite de nome
- **O que aconteceu:** O cliente recebia o pedido opcional de nome antes da resposta à sua pergunta.
- **Causa:** O fluxo enviava o convite antes da resposta principal.
- **Correção:** Moveu o envio do convite para depois da resposta principal.
- **Como testar:** Executar node tmp-tests/n8n-location-concurrency-core.test.cjs e node tmp-tests/n8n-location-concurrency-static.test.mjs.
- **Tags:** n8n, nome, atendimento, ordem

### #16 Follow-up de inatividade era repetido

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.80 · origem historico
- **Onde:** n8n · Novo Bot, retomada por inatividade
- **O que aconteceu:** O cliente podia receber outro follow-up após uma mensagem automática de inatividade.
- **Causa:** A retomada não usava como referência a última mensagem normal do bot e podia disparar com `idle-followup` ou `idle-close` como última mensagem.
- **Correção:** Usou a última mensagem normal do bot como referência e bloqueou novos follow-ups quando a última mensagem era `idle-followup` ou `idle-close`.
- **Como testar:** Executar `node tmp-tests/n8n-admin-client-control-static.test.mjs`.
- **Tags:** n8n, inatividade, follow-up

### #17 Mensagem de encerramento por inatividade não era enviada

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.80 · origem historico
- **Onde:** n8n · Novo Bot, encerramento por inatividade
- **O que aconteceu:** O cliente ficava sem receber a mensagem de encerramento por inatividade.
- **Causa:** O registro não detalha a causa da falha de envio.
- **Correção:** Restaurou o envio da mensagem de encerramento por inatividade.
- **Como testar:** Executar `node tmp-tests/n8n-admin-client-control-static.test.mjs`.
- **Tags:** n8n, inatividade, encerramento

### #18 Bot aguardava a IA para responder sobre aparelho indisponível

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.82 · origem historico
- **Onde:** n8n · Novo Bot, busca de produtos
- **O que aconteceu:** Quando a busca retornava apenas acessórios, o cliente podia ficar aguardando uma resposta clara sobre a disponibilidade do aparelho.
- **Causa:** O fluxo dependia de texto gerado pela IA para responder nesse cenário de catálogo.
- **Correção:** Passou a avisar diretamente que o aparelho não foi encontrado e a oferecer celulares de outras marcas ou atendimento humano.
- **Como testar:** Executar `node tmp-tests/autoresponder-unavailable-device-static.test.mjs`.
- **Tags:** catálogo, celulares, estoque

### #19 Bot listava produtos ao receber apenas uma marca

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.83 · origem historico
- **Onde:** n8n · Novo Bot, busca por marca
- **O que aconteceu:** Ao digitar apenas “Samsung” ou “Motorola”, o cliente podia receber uma lista de produtos antes de confirmar que procurava celulares.
- **Causa:** O fluxo não esclarecia a categoria desejada quando recebia uma marca sem contexto.
- **Correção:** Passou a perguntar se o cliente procura celulares. Após a confirmação, consulta a categoria de smartphones e lista os aparelhos disponíveis.
- **Como testar:** Validar `pendingDeviceClarification` e `requestedDeviceBrand` no `workflow_entity` e no `workflow_history` ativo do workflow `SkrkB4vyKVDnQ68t`.
- **Tags:** n8n, marcas, celulares

### #20 Pontuação isolada gerava respostas inventadas sobre localização

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.83 · origem historico
- **Onde:** n8n · agente geral
- **O que aconteceu:** Ao enviar uma mensagem como “?”, o cliente podia receber uma resposta inventada sobre endereço ou cidade.
- **Causa:** Mensagens compostas apenas por pontuação eram processadas pelo agente geral sem uma regra específica.
- **Correção:** Adicionou uma regra para mensagens compostas apenas por pontuação.
- **Como testar:** Validar a `Regra para mensagem so com pontuacao` no `workflow_entity` e no `workflow_history` ativo do workflow `SkrkB4vyKVDnQ68t`.
- **Tags:** n8n, pontuação, localização

### #23 Comandos administrativos podiam ficar sem confirmação

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.86 · origem historico
- **Onde:** n8n · nó de resposta dos comandos admin
- **O que aconteceu:** O administrador podia enviar um comando pelo WhatsApp e ficar sem confirmação quando a API retornava sem texto.
- **Causa:** O nó de resposta dependia do texto retornado pela API e não tinha uma mensagem alternativa.
- **Correção:** Adicionou confirmações aos comandos e uma resposta local no n8n para retornos sem texto.
- **Como testar:** Executar `node tmp-tests/n8n-admin-client-control-static.test.mjs`.
- **Tags:** WhatsApp, comandos, confirmação

### #10 Consulta de CEP falhava silenciosamente no fluxo de entrega

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.22 · origem historico
- **Onde:** n8n · consulta de CEP no fluxo de entrega
- **O que aconteceu:** A consulta não retornava o endereço pelo CEP durante o atendimento.
- **Causa:** A consulta usava fetch dentro de um nó Code, onde a chamada podia falhar silenciosamente.
- **Correção:** A consulta foi migrada para um nó HTTP Request do n8n.
- **Como testar:** Executar n8n-active-sales-post-list-node-readonly.cjs para validar o fluxo ativo.
- **Tags:** n8n, CEP, entrega

### #11 Workflow ativo podia executar uma versão antiga

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.22 · origem historico
- **Onde:** n8n · fluxo ativo de vendas
- **O que aconteceu:** O bot podia atender usando uma versão anterior do fluxo de vendas.
- **Causa:** Os identificadores versionId e activeVersionId estavam desalinhados.
- **Correção:** Os dois identificadores foram alinhados para apontar para a versão ativa do workflow.
- **Como testar:** Executar n8n-active-sales-post-list-node-readonly.cjs para validar o fluxo ativo.
- **Tags:** n8n, workflow, versionamento

## API (44)

### #209 Garantia do fabricante Realme exibia prazo incorreto

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.876 · origem historico
- **Onde:** API · autoresponder de garantia
- **O que aconteceu:** O Realme 14 5G aparecia com três meses de garantia do fabricante. O prazo da marca era de um ano.
- **Causa:** A API usava o prazo da categoria ao informar a garantia do fabricante Realme.
- **Correção:** A garantia do fabricante Realme passou a usar o prazo cadastrado na marca. A API passou a exibir 365 dias como “1 ano”.
- **Como testar:** Executar autoresponder-realme-warranty-brand-days.test.cjs e conferir que o Realme 14 5G aparece com “1 ano pelo fabricante”.
- **Tags:** garantia, Realme, fabricante

### #176 API recusava salvar o estado da oferta PayJoy

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.662 · origem historico
- **Onde:** API · persistência do estado da conversa (server.js)
- **O que aconteceu:** O cliente perguntava sobre boleto, mas a resposta com a oferta PayJoy não era entregue. Para a loja, a execução aparecia como bem-sucedida no n8n.
- **Causa:** O publicador anterior atualizava apenas vps_server.js e vps_server.cjs, e a verificação conferia o CJS inativo. O server.js executado pelo PM2 ainda rejeitava payjoyByJid com HTTP 400, e o workflow interrompia a resposta porque o estado não havia sido salvo.
- **Correção:** Adicionou payjoyByJid à lista de chaves permitidas no server.js ativo. Os publicadores passaram a considerar os três arquivos de entrada e a identificar pelo PM2 qual deles está em execução.
- **Como testar:** Confirmar apiSupportsPayjoy=true para o arquivo em execução. Na rota de persistência, usar expectedRevision=Number.MAX_SAFE_INTEGER com os estados awaiting_link_confirmation e awaiting_result e verificar HTTP 409 sem escrita. Uma chave desconhecida deve continuar retornando HTTP 400.
- **Tags:** PayJoy, persistência, PM2, WhatsApp

### #177 Coleção Smartphones exibia produto legado de R$ 0,01

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.690 · origem historico
- **Onde:** API · feed do catálogo Meta (metaCatalogFeedServer.cjs)
- **O que aconteceu:** A coleção Smartphones mostrava um produto antigo de R$ 0,01 em vez de reunir os modelos atuais.
- **Causa:** A coleção ainda usava uma seleção manual do grupo legado após a importação do catálogo atual.
- **Correção:** O feed passou a exportar a hierarquia de categorias em product_type e a identificar os produtos atuais com custom_label_0=sistema_mdv. A coleção passou a usar o filtro automático Celulares > Smartphones, e os itens manuais antigos foram ocultados.
- **Como testar:** Verificar no feed o product_type hierárquico e a origem sistema_mdv. Conferir na Meta que o filtro da coleção reconhece os modelos atuais e abrir o catálogo no WhatsApp Web para confirmar a exibição dos produtos e preços atuais.
- **Tags:** catálogo, Meta, smartphones, WhatsApp

### #168 Print PayJoy interrompia atendimento no Instagram e Messenger

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.655 · origem historico
- **Onde:** API · metaAttendanceReplies/Media e n8n · Adaptador Meta PayJoy
- **O que aconteceu:** A conversa parava depois que o cliente enviava o print da aprovação PayJoy. Perguntas posteriores sobre a entrada não aproveitavam os dados aprovados.
- **Causa:** O fluxo Meta não encaminhava a imagem ao leitor PayJoy nativo nem mantinha a aprovação na memória durável da conversa.
- **Correção:** Baixa imagens de CDN permitida com limites de tamanho e tempo, converte a imagem para binário e reutiliza o leitor e a calculadora PayJoy. Persiste a aprovação na memória Meta e usa os campos aprovados para responder sobre a entrada, preservando aparelho, revisão e pausa humana.
- **Como testar:** Ensaiar o webhook real com conversas sintéticas separadas no Instagram e no Messenger, passando por catálogo, escolha, link, print aprovado, pergunta sobre entrada e pausa humana, com zero envios Meta.
- **Tags:** Meta, PayJoy, imagem, memória

### #171 Imagem indisponível mantinha aprovação PayJoy anterior

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.656 · origem historico
- **Onde:** API · metaAttendanceReplies
- **O que aconteceu:** Uma aprovação antiga podia continuar valendo depois que o cliente enviava uma nova imagem indisponível.
- **Causa:** A indisponibilidade da imagem não acionava o tratamento padrão nem invalidava a aprovação anterior.
- **Correção:** Encaminha imagens indisponíveis ao tratamento padrão e invalida a aprovação anterior.
- **Tags:** Meta, PayJoy, imagem, aprovação

### #146 Painel WhatsApp exibia saldo pré-pago incorreto da OpenAI

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.613 · origem historico
- **Onde:** API · Financeiro OpenAI
- **O que aconteceu:** A loja via no painel WhatsApp uma estimativa incorreta do saldo pré-pago da OpenAI.
- **Causa:** O sistema estimava o saldo subtraindo gastos de créditos antigos, sem uma API pública documentada para obter o saldo real.
- **Correção:** A estimativa foi removida. O painel passou a indicar saldo desconhecido e a exibir um link para o faturamento.
- **Tags:** OpenAI, saldo, faturamento

### #114 Evento antigo podia prevalecer sobre o contexto mais recente

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.368 · origem historico
- **Onde:** API · estado conversacional do bot
- **O que aconteceu:** Mensagens próximas, atrasadas ou duplicadas podiam deixar o atendimento com contexto desatualizado. Uma execução antiga também podia repor contexto após a limpeza administrativa.
- **Causa:** A revisão de gravação detectava conflitos, mas não determinava qual mensagem era mais recente nem invalidava execuções iniciadas antes da limpeza.
- **Correção:** Versionar cada evento na entrada do workflow com horário em microssegundos e desempate pela execução do n8n. Na API, bloquear a linha do cliente durante a decisão de gravação, preservar o evento mais recente e invalidar eventos anteriores à limpeza.
- **Como testar:** Executar as regressões de concorrência de localização e reprocessamento de eventos antigos. Verificar que eventos atrasados ou duplicados não sobrescrevem o contexto atual e que a limpeza invalida eventos antigos em execução.
- **Tags:** concorrência, contexto, idempotência

### #70 Publicação de Status era marcada como presa prematuramente

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.259 · origem historico
- **Onde:** API · publicação de Status via WAHA
- **O que aconteceu:** A loja podia ver uma tentativa de publicação marcada como presa enquanto o WAHA ainda processava a requisição.
- **Causa:** A limpeza de envios em andamento podia classificar a tentativa como presa antes de expirar o timeout HTTP.
- **Correção:** Impedir a marcação antes do fim do timeout HTTP e definir a espera padrão de publicação em 90 segundos.
- **Como testar:** Executar node tmp-tests/whatsapp-status-campaign-vps-static.test.mjs.
- **Tags:** WhatsApp, Status, WAHA, timeout

### #71 CDN não armazenava imagens legadas com nome baseado em hash

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.266 · origem historico
- **Onde:** API · cache de imagens estáticas
- **O que aconteceu:** Imagens legadas de produtos com nome derivado de SHA-256 eram servidas com CDN-Cache-Control: no-store.
- **Causa:** A regra de cache não reconhecia os nomes legados derivados de SHA-256 como identificadores de conteúdo imutável.
- **Correção:** Aplicar cache imutável às imagens legadas com nome baseado em hash e manter a proteção para os demais arquivos legados.
- **Como testar:** Executar node tmp-tests/vps-static-image-cache.test.mjs e confirmar CDN-Cache-Control: public, max-age=31536000, immutable na resposta da imagem legada do produto.
- **Tags:** imagem, CDN, cache, SHA-256

### #72 Open Graph omitia tipo e dimensões da imagem

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.266 · origem historico
- **Onde:** API · HTML público de produto
- **O que aconteceu:** O HTML público do produto não informava às prévias de compartilhamento o tipo MIME, a largura e a altura da imagem.
- **Causa:** Os metadados Open Graph do produto não incluíam essas propriedades da imagem.
- **Correção:** Incluir o tipo MIME e as dimensões reais da imagem no Open Graph.
- **Como testar:** Executar node tmp-tests/vps-seo-produto-fastify-static.test.mjs e confirmar og:image:type, og:image:width e og:image:height no HTML público do produto.
- **Tags:** Open Graph, imagem, WhatsApp

### #73 Mídias de campanhas de Status podiam se intercalar

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.267 · origem historico
- **Onde:** API · campanhas de Status via WAHA
- **O que aconteceu:** Vídeos de campanhas diferentes podiam aparecer misturados na sequência de Status.
- **Causa:** Os lotes de mídias de campanhas diferentes podiam ser enviados em paralelo.
- **Correção:** Serializar os lotes e definir um intervalo padrão de oito segundos entre mídias aceitas pelo WAHA.
- **Como testar:** Executar node tmp-tests/whatsapp-status-color-videos-order.test.mjs e node tmp-tests/whatsapp-status-campaign-vps-static.test.mjs.
- **Tags:** WhatsApp, Status, campanhas, ordenação

### #74 Autoatendimento usava rotas administrativas genéricas

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.271 · origem historico
- **Onde:** API · customerSelfServiceServer.cjs
- **O que aconteceu:** Operações como atualizar perfil e avatar usavam rotas administrativas genéricas.
- **Causa:** As operações de autoatendimento compartilhavam rotas genéricas da administração.
- **Correção:** Criar caminhos próprios para as operações de cliente e vincular cada operação à identidade autenticada.
- **Como testar:** Executar node tmp-tests/customer-self-service-permissions-static.test.mjs e node tmp-tests/customer-profile-self-update-static.test.mjs.
- **Tags:** autoatendimento, permissões, autenticação

### #76 Falha no checkout podia deixar estoque reservado

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.271 · origem historico
- **Onde:** API · checkout Mercado Pago
- **O que aconteceu:** Após uma falha de pagamento, o pedido podia ficar sem registro e o estoque permanecer reservado.
- **Causa:** O tratamento anterior de falhas não garantia o registro do pedido e a liberação da reserva de estoque.
- **Correção:** Registrar o pedido e liberar a reserva quando o checkout falhar.
- **Tags:** checkout, pagamento, estoque

### #56 Status anunciava parcela em 12 vezes sem taxa

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.195 · origem historico
- **Onde:** API · envio de campanhas de Status
- **O que aconteceu:** O Status mostrava um valor de parcela menor que o correto para pagamento em 12 vezes no cartão.
- **Causa:** O backend procurava a taxa pelo campo method, que estava nulo nos registros atuais. A tabela era identificada por channel. Ao não encontrar a taxa, o cálculo assumia zero.
- **Correção:** O envio passou a buscar em payment_fees a taxa de 12 vezes do canal presencial, aplicá-la ao total e só então dividir por 12. Se a taxa estiver ausente, o envio falha explicitamente.
- **Como testar:** Executar node tmp-tests/whatsapp-status-campaign-vps-static.test.mjs e node tmp-tests/whatsapp-status-campaign-helper.test.mjs.
- **Tags:** WhatsApp, Status, parcelamento, taxas

### #59 Pedido de lista de celulares inscrevia cliente automaticamente

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.214 · origem historico
- **Onde:** API · listas de transmissão do WhatsApp
- **O que aconteceu:** O cliente era inscrito na lista de transmissão ao pedir a lista atual de celulares, sem aceitar o convite.
- **Causa:** O pedido da lista de celulares era tratado como consentimento para inscrição.
- **Correção:** O cadastro passou a exigir a resposta explícita SIM ao convite contextual.
- **Como testar:** Executar node tmp-tests/whatsapp-broadcast-contextual-invite-static.test.mjs e npm.cmd run test:autoresponder:whatsapp.
- **Tags:** WhatsApp, transmissão, consentimento

### #60 Mensagens com números eram confundidas com escolhas da lista

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.214 · origem historico
- **Onde:** API · tratamento de convites de transmissão do WhatsApp
- **O que aconteceu:** Com um convite pendente, o bot interpretava mensagens normais contendo números como escolhas da lista de transmissão.
- **Causa:** O tratamento do convite interpretava números de mensagens normais como respostas de seleção.
- **Correção:** O fluxo deixou de interpretar números de mensagens normais como escolha enquanto existe um convite contextual pendente.
- **Como testar:** Executar node tmp-tests/whatsapp-broadcast-contextual-invite-static.test.mjs e npm.cmd run test:autoresponder:whatsapp.
- **Tags:** WhatsApp, transmissão, mensagens

### #63 Eventos antigos entravam na fila após reconexão

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.227 · origem historico
- **Onde:** API · webhook de entrada do n8n
- **O que aconteceu:** Após a reconexão, o atendimento voltava a receber eventos antigos para processamento.
- **Causa:** Eventos antigos reproduzidos após reconexão eram aceitos antes de entrar na fila.
- **Correção:** Eventos antigos reproduzidos após reconexão passaram a ser descartados antes de entrar na fila do n8n.
- **Como testar:** Executar node tmp-tests/n8n-stale-webhook-guard-static.test.mjs.
- **Tags:** n8n, webhook, reconexão, fila

### #49 Campanhas de Status disparadas três horas antes

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.150 · origem historico
- **Onde:** API · agendamento de campanhas de Status
- **O que aconteceu:** A loja via campanhas de Status saírem três horas antes do horário programado.
- **Causa:** O cálculo dos horários não usava o fuso America/Sao_Paulo.
- **Correção:** O agendamento passou a calcular os horários no fuso America/Sao_Paulo.
- **Como testar:** Executar node tmp-tests/whatsapp-status-campaign-vps-static.test.mjs e node tmp-tests/whatsapp-status-campaign-helper.test.mjs.
- **Tags:** WhatsApp, Status, agendamento, fuso

### #50 Campanhas vencidas de Status disparadas com atraso

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.150 · origem historico
- **Onde:** API · executor de campanhas de Status
- **O que aconteceu:** Campanhas de Status eram publicadas após o vencimento.
- **Causa:** Campanhas vencidas ainda podiam ser selecionadas para envio.
- **Correção:** O executor passou a ignorar campanhas vencidas.
- **Como testar:** Executar node tmp-tests/whatsapp-status-campaign-vps-static.test.mjs.
- **Tags:** WhatsApp, Status, agendamento

### #51 Campanha de categoria deixava modelos elegíveis de fora

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.150 · origem historico
- **Onde:** API · campanhas de Status por categoria
- **O que aconteceu:** A campanha de Status não publicava todos os modelos elegíveis da categoria, e a quantidade planejada podia divergir do estoque.
- **Causa:** A seleção e a contagem não refletiam todos os modelos elegíveis disponíveis em estoque.
- **Correção:** A campanha passou a publicar todos os modelos com estoque, preço e imagem e a recalcular a quantidade conforme o estoque disponível.
- **Como testar:** Executar node tmp-tests/whatsapp-status-campaign-vps-static.test.mjs e node tmp-tests/whatsapp-status-campaign-helper.test.mjs.
- **Tags:** WhatsApp, Status, categoria, estoque

### #52 Status ignorava produtos vinculados por categoria adicional

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.151 · origem historico
- **Onde:** API · seleção de produtos para campanhas de Status
- **O que aconteceu:** Produtos em estoque ligados à categoria apenas por um vínculo adicional ficavam fora da campanha e da quantidade planejada.
- **Causa:** A seleção considerava somente a categoria principal do produto.
- **Correção:** A seleção passou a reconhecer a categoria principal e as adicionais, e a quantidade planejada passou a refletir todos os modelos elegíveis em estoque.
- **Como testar:** Executar node tmp-tests/whatsapp-status-campaign-vps-static.test.mjs.
- **Tags:** WhatsApp, Status, categoria, estoque

### #53 Campanha de categoria pai ignorava subcategorias

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.152 · origem historico
- **Onde:** API · seleção de produtos para campanhas de Status
- **O que aconteceu:** A campanha de Smartphones deixava de incluir modelos elegíveis cadastrados nas subcategorias.
- **Causa:** A seleção não percorria a árvore abaixo da categoria pai.
- **Correção:** Campanhas de categoria pai passaram a incluir recursivamente as subcategorias, com suporte às categorias adicionais dos produtos.
- **Como testar:** Executar node tmp-tests/whatsapp-status-campaign-vps-static.test.mjs.
- **Tags:** WhatsApp, Status, categoria

### #55 Rota de progresso falhava para campanha de categoria completa

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.154 · origem historico
- **Onde:** API · rota de progresso de campanhas de Status
- **O que aconteceu:** O painel não conseguia consultar o progresso da campanha de categoria completa.
- **Causa:** A consulta usava DISTINCT com uma ordenação incompatível no MySQL.
- **Correção:** A consulta passou a usar EXISTS, restaurando a rota de progresso e evitando produtos duplicados ao considerar categorias adicionais.
- **Como testar:** Executar node tmp-tests/whatsapp-status-campaign-vps-static.test.mjs.
- **Tags:** WhatsApp, Status, MySQL, categoria

### #43 Agendador enviava mensagens de inatividade durante atendimento humano

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.32 · origem historico
- **Onde:** API · agendador de inatividade do WhatsApp
- **O que aconteceu:** O cliente podia receber lembretes ou encerramentos por inatividade enquanto conversava com um atendente.
- **Causa:** O agendador aceitava mensagens manuais como gatilho e podia enviar durante uma pausa de atendimento humano.
- **Correção:** Removeu mensagens manuais dos gatilhos e passou a bloquear lembretes e encerramentos enquanto human_handoff_until estiver ativo.
- **Como testar:** Executar node tmp-tests/n8n-handoff-name-idle-repetition-static.test.mjs.
- **Tags:** WhatsApp, inatividade, atendimento, pausa

### #30 Campanha de Status registrava sucesso sem confirmação

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.11 · origem historico
- **Onde:** API · campanha de Status do WhatsApp
- **O que aconteceu:** O painel marcava o produto como enviado e avançava a rotação da campanha mesmo quando a Evolution não confirmava o envio.
- **Causa:** O registro de sucesso não exigia uma chave de mensagem válida para status@broadcast.
- **Correção:** Passou a exigir a chave válida para registrar sucesso. Timeout ou resposta sem confirmação são registrados como falha e mantêm a rotação na posição atual. O timeout padrão passou de 30 para 90 segundos.
- **Como testar:** Fazer um envio controlado para um único contato. Se a Evolution receber a solicitação sem confirmar status@broadcast, verificar que o envio fica como falha e a rotação não avança.
- **Tags:** WhatsApp, Status, confirmação, timeout

### #31 Timeline do Status pulava etapas do envio

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.13 · origem historico
- **Onde:** API · timeline da campanha de Status
- **O que aconteceu:** O painel não mostrava etapas como configuração, carregamento da audiência, payload, requisição, resposta e timeout.
- **Causa:** A referência a sanitizeStatusDebugText apontava para uma função indefinida, fazendo a gravação de etapas com detalhes textuais falhar silenciosamente.
- **Correção:** Corrigiu o nome da função de sanitização usada pela timeline.
- **Como testar:** Executar node tmp-tests/whatsapp-status-campaign-vps-static.test.mjs.
- **Tags:** WhatsApp, Status, timeline, sanitização

### #32 Bot repetia lembretes e encerramentos por inatividade

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.14 · origem historico
- **Onde:** API · agendador de inatividade do WhatsApp
- **O que aconteceu:** O cliente podia receber novamente um lembrete ou encerramento já entregue.
- **Causa:** O agendador não reservava o envio antes de chamar a Evolution. Uma resposta expirada ou um reinício da API permitia que outra execução repetisse o envio.
- **Correção:** Passou a reservar lembretes e encerramentos de forma atômica antes de chamar a Evolution. Só a execução que obtém a reserva pode enviar.
- **Como testar:** Executar node tmp-tests/n8n-bot-idle-idempotency-static.test.mjs.
- **Tags:** WhatsApp, inatividade, duplicidade, concorrência

### #33 Audiência do Status usava números sem JID completo

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.15 · origem historico
- **Onde:** API · audiência da campanha de Status
- **O que aconteceu:** A audiência preparada para o envio do Status podia conter telefones em formato numérico simples.
- **Causa:** A montagem da audiência deixava números simples sem normalização para JIDs completos.
- **Correção:** Passou a converter os números simples para o formato numero@s.whatsapp.net.
- **Como testar:** Executar node tmp-tests/whatsapp-status-audience-jid-static.test.mjs.
- **Tags:** WhatsApp, Status, audiência, JID

### #34 Audiência do Status ficou no formato incorreto para a Evolution

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.16 · origem historico
- **Onde:** API · audiência da campanha de Status
- **O que aconteceu:** A requisição de envio do Status passava JIDs completos no campo de audiência que a Evolution 2.3.7 esperava receber como números.
- **Causa:** A API enviava JIDs completos, embora a Evolution 2.3.7 espere números e faça a conversão internamente.
- **Correção:** Restaurou o formato numérico da audiência e manteve a exclusão de grupos e identificadores @lid.
- **Como testar:** Fazer um envio manual controlado com a audiência reduzida configurada para o teste.
- **Tags:** WhatsApp, Status, audiência, Evolution

### #36 Prévia do produto podia mostrar imagem de outra variante

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.25 · origem historico
- **Onde:** API · Open Graph da página de produto
- **O que aconteceu:** A prévia do link compartilhado podia mostrar uma imagem que não correspondia ao modelo e à cor selecionados.
- **Causa:** A seleção da imagem Open Graph não priorizava a imagem específica da variante.
- **Correção:** Passou a priorizar a imagem do modelo e da cor selecionados.
- **Como testar:** Executar node tmp-tests/product-whatsapp-share-static.test.mjs.
- **Tags:** produto, imagem, variante, compartilhamento

### #24 Endpoints legados apontavam para uma instância antiga do WhatsApp

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.87 · origem historico
- **Onde:** API · /autoresponder/whatsapp/*
- **O que aconteceu:** As operações legadas podiam tentar usar uma instância antiga que aparecia fechada ou em conexão.
- **Causa:** O fallback fixo apontava para a instância antiga `mercado_do_vale`.
- **Correção:** Removeu a instância antiga da Evolution e passou a usar `EVOLUTION_INSTANCE_NAME`, `EVOLUTION_API_INSTANCE` ou a instância oficial `botmercadodovale` como padrão.
- **Como testar:** Executar `node tmp-tests/autoresponder-evolution-typing-presence-static.test.mjs` e consultar `fetchInstances` para confirmar que apenas `botmercadodovale` está aberta no número oficial.
- **Tags:** WhatsApp, Evolution, instância

### #25 Endpoints legados usavam uma chave antiga da Evolution

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.88 · origem historico
- **Onde:** API · /autoresponder/whatsapp/*
- **O que aconteceu:** As operações legadas do WhatsApp ainda usavam a credencial antiga da Evolution.
- **Causa:** A chave antiga estava fixa no código.
- **Correção:** Passou a ler `EVOLUTION_API_KEY` ou `EVOLUTION_GLOBAL_API_KEY` e a retornar uma falha quando nenhuma chave está configurada.
- **Como testar:** Executar `node tmp-tests/autoresponder-evolution-typing-presence-static.test.mjs` e fazer um `GET` autenticado em `/autoresponder/whatsapp/state`, esperando `botmercadodovale` com `state: open`.
- **Tags:** Evolution, credenciais, WhatsApp

### #27 Desconexão falhava na troca de número do WhatsApp

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.91 · origem historico
- **Onde:** API · serviço de troca de número do WhatsApp
- **O que aconteceu:** A loja não conseguia desconectar o número atual pelo fluxo guiado.
- **Causa:** A chamada de logout usava um método HTTP incompatível com a Evolution API.
- **Correção:** Alterou a chamada para `DELETE /instance/logout/{instanceName}`.
- **Como testar:** Executar `node tmp-tests/whatsapp-number-switch-backend-static.test.mjs`.
- **Tags:** WhatsApp, desconexão, Evolution

### #21 Backend legado oferecia acessórios no lugar do aparelho indisponível

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.83 · origem historico
- **Onde:** API · backend legado do bot
- **O que aconteceu:** O cliente podia receber sugestões de acessórios como substitutos do celular que procurava.
- **Causa:** O backend legado tratava acessórios relacionados como substitutos de aparelhos indisponíveis.
- **Correção:** Ajustou o backend legado para excluir acessórios das sugestões de aparelhos substitutos.
- **Como testar:** Executar `node tmp-tests/autoresponder-unavailable-device-static.test.mjs`.
- **Tags:** catálogo, acessórios, estoque

### #22 Nono dígito impedia reconhecimento do administrador no WhatsApp

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.85 · origem historico
- **Onde:** API · /n8n-bot/admin-command e n8n · comandos admin
- **O que aconteceu:** Um administrador cadastrado podia ter seus comandos rejeitados quando a Evolution enviava o número em outro formato.
- **Causa:** A autorização não tratava como equivalentes os JIDs brasileiros com e sem o nono dígito.
- **Correção:** Usou aliases de telefone e JID na API e aplicou a mesma equivalência no workflow antes de encaminhar o comando.
- **Como testar:** Executar `node tmp-tests/n8n-admin-client-control-static.test.mjs`.
- **Tags:** WhatsApp, administrador, JID

### #13 Totem informava envio de comprovante quando o WhatsApp falhava

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.62 · origem historico
- **Onde:** API · envio de comprovante do Totem Pix
- **O que aconteceu:** O Totem exibia “Comprovante enviado” mesmo quando o envio via WhatsApp falhava.
- **Causa:** O servidor marcava o comprovante como enviado sem validar o retorno da Evolution API.
- **Correção:** O servidor passou a validar o retorno do envio, e o Totem passou a exibir um erro em caso de falha.
- **Como testar:** Executar pdv-totem-backend-contract-static.test.mjs.
- **Tags:** Totem, comprovante, WhatsApp

### #14 Comprovante do Totem era recusado pela Evolution

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.63 · origem historico
- **Onde:** API · sendDeliveryWhatsappText
- **O que aconteceu:** O cliente não recebia o comprovante via WhatsApp, e a Evolution retornava HTTP 401.
- **Causa:** Sem a tabela whatsapp_settings no banco da VPS, o envio recorria a uma rotina legada que usava a instância mercado_do_vale e uma chave antiga fixa no código.
- **Correção:** O envio transacional passou a usar getN8nBotEvolutionSettings(), com EVOLUTION_API_KEY e a instância botmercadodovale. O fallback legado foi removido desse caminho.
- **Como testar:** Executar pdv-totem-backend-contract-static.test.mjs e confirmar que a instância botmercadodovale autentica com HTTP 200 e state: open.
- **Tags:** Evolution, comprovante, autenticação

### #15 Envios longos de Status passavam pelo domínio público

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.75 · origem historico
- **Onde:** API · envio de Status WhatsApp
- **O que aconteceu:** Publicações demoradas no Status do WhatsApp podiam atingir o tempo limite.
- **Causa:** Os envios passavam pelo Cloudflare do domínio público do bot, e o serviço tinha um tempo limite menor.
- **Correção:** O serviço passou a preferir o endereço interno da Evolution, configurado em EVOLUTION_STATUS_SERVER_URL, e o tempo limite padrão foi ampliado para 180 segundos.
- **Como testar:** Confirmar HTTP 200 em /chat/findContacts/botmercadodovale pela Evolution interna e executar whatsapp-status-campaign-helper.test.mjs e whatsapp-status-campaign-vps-static.test.mjs.
- **Tags:** WhatsApp, Status, timeout

### #7 Pedidos de celulares consultavam uma categoria vazia

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.1.77 · origem historico
- **Onde:** API · catálogo do autoresponder
- **O que aconteceu:** O cliente podia ficar sem resultados ao pedir celulares pelo WhatsApp, embora houvesse aparelhos em estoque.
- **Causa:** Alguns caminhos do autoresponder consultavam a categoria Celulares, que estava vazia no admin. O estoque estava na categoria Smartphones.
- **Correção:** Os fluxos de catálogo, templates, busca por ferramenta, seleção numerada e orçamento passaram a consultar Smartphones e a usar essa categoria na resposta e no registro da conversa.
- **Como testar:** Executar o teste estático autoresponder-complete-phone-list-distinct-models-static.test.mjs, que cobre a normalização da categoria.
- **Tags:** WhatsApp, catálogo, smartphones

### #8 Lista completa de celulares repetia variações de poucos modelos

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.1.77 · origem historico
- **Onde:** API · listagem por categoria do autoresponder
- **O que aconteceu:** Ao pedir a lista completa, o cliente recebia poucas opções de modelos, com várias versões dos mesmos aparelhos.
- **Causa:** A busca limitava as linhas antes de agrupá-las por modelo, permitindo que variações do mesmo aparelho consumissem o limite.
- **Correção:** A busca passou a consultar mais linhas, agrupá-las por modelo e aplicar o limite aos modelos distintos.
- **Como testar:** Executar o teste estático autoresponder-complete-phone-list-distinct-models-static.test.mjs.
- **Tags:** WhatsApp, catálogo, listagem

### #9 Pedido genérico de celulares recebia uma resposta curta fixa

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.1.78 · origem historico
- **Onde:** API · webhook do autoresponder
- **O que aconteceu:** Ao perguntar “tem celulares?”, o cliente recebia uma resposta curta com informações incompletas do catálogo.
- **Causa:** Um atalho no webhook respondia antes do planejamento pela IA. A VPS também executava uma cópia de vps_server.cjs que ainda não incluía a normalização de categoria publicada em vps_server.js.
- **Correção:** O atalho foi removido, o planejador passou a consultar Smartphones via catalog_search e o tamanho da lista passou a considerar a mensagem original. Os dois arquivos do servidor foram sincronizados.
- **Como testar:** Executar autoresponder-ai-first-catalog-static.test.mjs e autoresponder-complete-phone-list-distinct-models-static.test.mjs.
- **Tags:** WhatsApp, catálogo, IA

### #1 Alterações nas configurações da loja não persistiam

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · origem historico
- **Onde:** API · /company-settings
- **O que aconteceu:** Ao recarregar a página, a loja via os valores antigos das configurações, sem aviso de erro ao salvar.
- **Causa:** A rota PATCH não existia, o CORS não liberava esse método, o vpsClient enviava um cabeçalho diferente do esperado pela autenticação e o GET podia devolver dados antigos do cache.
- **Correção:** Foi criada a rota PATCH com uma lista de campos permitidos, o método foi liberado no CORS, o vpsClient passou a enviar x-sync-key, o servidor passou a aceitar também x-api-key e o GET passou a usar Cache-Control: no-store.
- **Como testar:** Testar o preflight OPTIONS com Access-Control-Request-Method: PATCH, conferir o cabeçalho de autenticação enviado pelo vpsClient e verificar o Cache-Control do GET.
- **Tags:** configurações, autenticação, CORS, cache

### #4 Webhook do Bling podia atualizar o estoque do produto errado

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · origem historico
- **Onde:** API · GET /products
- **O que aconteceu:** Ao receber um evento sem SKU, a loja podia ver o estoque alterado em outro produto.
- **Causa:** A rota ignorava o filtro bling_id e, com limit=1, retornava o primeiro produto ativo em ordem alfabética.
- **Correção:** A consulta passou a filtrar os produtos pelo bling_id informado.
- **Tags:** Bling, estoque, filtro

### #5 Atualização de estoque falhava em eventos do Bling sem SKU

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · origem historico
- **Onde:** API · PATCH /products/stock
- **O que aconteceu:** A baixa de estoque podia falhar quando o evento do Bling trazia apenas o ID do produto.
- **Causa:** A rota exigia SKU e dependia de uma consulta adicional para obtê-lo quando o evento não incluía o código.
- **Correção:** A rota passou a aceitar bling_id ou sku como identificador do produto.
- **Tags:** Bling, estoque, SKU

## site (14)

### #145 Cadastro de modelos travava com armazenamento local cheio

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.613 · origem historico
- **Onde:** site · Cadastro de modelos
- **O que aconteceu:** A tela de cadastro de modelos deixava de funcionar quando o armazenamento local do navegador estava cheio.
- **Causa:** A falha ao gravar uma preferência opcional no localStorage interrompia o funcionamento da tela.
- **Correção:** A tela passou a tratar a falha de gravação da preferência e continuar funcionando.
- **Como testar:** Executar o teste de quota do localStorage e verificar se a tela continua funcionando com o armazenamento cheio.
- **Tags:** cadastro, localStorage, quota

### #67 Arte de produto exibia UUID interno no subtítulo

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.244 · origem historico
- **Onde:** site · arte de marketing de produto
- **O que aconteceu:** O subtítulo da arte podia mostrar um identificador interno no lugar da versão comercial do produto.
- **Causa:** A seleção do subtítulo permitia usar o UUID interno como versão do produto.
- **Correção:** Priorizar a versão comercial das características estruturadas e impedir a exibição do UUID no subtítulo.
- **Como testar:** Executar product-marketing-artwork-static.test.mjs.
- **Tags:** arte, produto, UUID

### #75 Checkout expunha credencial do Mercado Pago no navegador

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.271 · origem historico
- **Onde:** site · checkout Mercado Pago
- **O que aconteceu:** A credencial do gateway ficava exposta no navegador durante o checkout.
- **Causa:** A integração com o Mercado Pago era executada no navegador.
- **Correção:** Mover as integrações do checkout com o Mercado Pago para a API.
- **Como testar:** Executar node tmp-tests/checkout-card-payment-server-static.test.mjs.
- **Tags:** checkout, Mercado Pago, credencial

### #77 Opção Mercado Pago desalinhada no carrinho

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.274 · origem historico
- **Onde:** site · carrinho
- **O que aconteceu:** A opção Mercado Pago aparecia desalinhada no carrinho.
- **Causa:** O registro não especifica a causa técnica do desalinhamento.
- **Correção:** Ajustar o alinhamento da opção Mercado Pago no carrinho.
- **Tags:** carrinho, Mercado Pago, alinhamento

### #78 Checkout perdia dados selecionados no carrinho

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.274 · origem historico
- **Onde:** site · carrinho e checkout
- **O que aconteceu:** Garantia, indicação e entrega podiam ser perdidas ao abrir o checkout.
- **Causa:** A transição do carrinho para o checkout não preservava esses dados.
- **Correção:** Preservar garantia, indicação e entrega ao abrir o checkout.
- **Como testar:** Executar node tmp-tests/cart-checkout-delivery-static.test.mjs.
- **Tags:** carrinho, checkout, entrega, garantia

### #79 Frete faltava no total e no registro do pedido

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.274 · origem historico
- **Onde:** site · checkout Mercado Pago
- **O que aconteceu:** O checkout do Mercado Pago não incluía o frete no total exibido nem nos dados gravados do pedido.
- **Causa:** O checkout não integrava o CEP, o endereço e o cálculo de frete ao total e aos dados do pedido.
- **Correção:** Disponibilizar CEP, endereço e cálculo de frete no checkout e incluir o frete no total e no pedido persistido.
- **Como testar:** Executar node tmp-tests/cart-checkout-delivery-static.test.mjs.
- **Tags:** checkout, frete, Mercado Pago, pedido

### #57 Card administrativo mostrava imagem genérica apesar de foto própria

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.197 · origem historico
- **Onde:** site · card administrativo de produto
- **O que aconteceu:** A loja via no card uma imagem de modelo e cor mesmo quando o produto tinha imagem específica cadastrada.
- **Causa:** A imagem de fallback por modelo e cor tinha prioridade sobre a imagem específica do produto.
- **Correção:** O card passou a priorizar as imagens específicas do produto e usar o fallback por modelo e cor quando necessário.
- **Como testar:** Executar node tmp-tests/admin-product-card-compact-image-fallback-static.test.mjs.
- **Tags:** produtos, imagens, administração

### #54 Painel mostrava 1 como total da campanha de categoria

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.153 · origem historico
- **Onde:** site · painel de campanhas de Status
- **O que aconteceu:** O painel mostrava o mínimo de 1 no lugar da quantidade real de modelos elegíveis.
- **Causa:** A rota de progresso não informava a origem e a categoria da campanha, e o painel usava o mínimo de 1.
- **Correção:** A rota passou a retornar a origem e a categoria, e o painel passou a calcular e exibir o total real de modelos elegíveis.
- **Como testar:** Executar node tmp-tests/whatsapp-status-campaign-vps-static.test.mjs.
- **Tags:** WhatsApp, Status, painel, contagem

### #35 Compartilhamento de produto usava URL com UUID interno

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.25 · origem historico
- **Onde:** site
- **O que aconteceu:** Ao compartilhar um produto pelo WhatsApp a partir de uma página aberta por UUID, o cliente podia enviar o endereço com o identificador interno.
- **Causa:** O compartilhamento podia reaproveitar o endereço pelo qual a página havia sido aberta.
- **Correção:** Passou a usar a URL pública baseada no slug no WhatsApp e a URL canônica no Facebook.
- **Como testar:** Executar node tmp-tests/product-whatsapp-share-static.test.mjs.
- **Tags:** produto, compartilhamento, WhatsApp, URL

### #26 QR Code não aparecia na troca de número

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.90 · origem historico
- **Onde:** site · Centro WhatsApp, troca de número
- **O que aconteceu:** A loja podia ficar sem ver o QR Code necessário para conectar o novo número.
- **Causa:** O fluxo não interpretava o base64 sem prefixo de imagem nem alguns formatos aninhados da resposta da Evolution.
- **Correção:** Passou a exibir QR Codes em base64 sem prefixo e a aceitar formatos como `qrcode.base64` e `data.qrcode`.
- **Como testar:** Executar com `node` os testes estáticos `whatsapp-number-switch-backend-static.test.mjs`, `whatsapp-number-switch-service-static.test.mjs` e `whatsapp-number-switch-panel-static.test.mjs` em `tmp-tests/`.
- **Tags:** WhatsApp, QR, Evolution

### #28 Página do WhatsApp exibia controles de conexão duplicados

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.91 · origem historico
- **Onde:** site · Centro WhatsApp
- **O que aconteceu:** A loja via dois conjuntos de botões para conectar ou desconectar o WhatsApp.
- **Causa:** O painel antigo de conexão continuava visível junto ao fluxo guiado.
- **Correção:** Removeu o painel antigo da página de WhatsApp.
- **Como testar:** Executar `node tmp-tests/whatsapp-connection-center-static.test.mjs`.
- **Tags:** WhatsApp, painel, conexão

### #29 QR Code sumia durante a conexão do WhatsApp

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.92 · origem historico
- **Onde:** site · Centro WhatsApp, troca de número
- **O que aconteceu:** A imagem do QR Code desaparecia enquanto a Evolution ainda estava conectando.
- **Causa:** A atualização automática do status apagava o QR Code exibido.
- **Correção:** Guardou o QR Code em um estado próprio da tela e passou a orientar a geração de outro código quando o WhatsApp informa expiração.
- **Como testar:** Executar `node tmp-tests/whatsapp-number-switch-panel-static.test.mjs`.
- **Tags:** WhatsApp, QR, atualização

### #2 Painel de horários podia salvar a mesma alteração várias vezes

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · origem historico
- **Onde:** site
- **O que aconteceu:** Uma edição no painel de textos de horário podia disparar salvamentos duplicados.
- **Causa:** O debounce guardava o temporizador em useState e podia ler o valor de uma renderização anterior, deixando de cancelar o temporizador pendente.
- **Correção:** O temporizador passou a ser guardado em useRef para que o cancelamento use sempre a referência atual.
- **Tags:** horários, debounce, salvamento

### #6 Botão Enviar teste podia falhar e ocultar o erro

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.1.73 · origem historico
- **Onde:** site
- **O que aconteceu:** Ao clicar em Enviar teste nos templates de WhatsApp, a loja podia ficar sem o envio e sem a mensagem real do erro.
- **Causa:** O painel não importava a função de envio e ocultava a mensagem original em caso de falha.
- **Correção:** O painel passou a importar a função de envio e a exibir a mensagem real do erro.
- **Como testar:** Executar node tmp-tests/whatsapp-automation-template-test-send-static.test.mjs.
- **Tags:** WhatsApp, templates, envio, erros

## PDV (6)

### #143 Falha no WhatsApp podia repetir a baixa de estoque

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.574 · origem historico
- **Onde:** PDV
- **O que aconteceu:** A loja podia ter o estoque baixado novamente para a mesma venda após uma falha no WhatsApp.
- **Causa:** Uma falha no envio podia provocar a repetição de uma baixa local já concluída.
- **Correção:** Uma falha de WhatsApp após a conclusão das baixas locais não repete a baixa.
- **Como testar:** Simular uma falha no transporte de WhatsApp depois da baixa e verificar que o estoque é baixado apenas uma vez.
- **Tags:** PDV, WhatsApp, estoque

### #141 Confirmação de venda enviada antes da baixa de estoque

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.574 · origem historico
- **Onde:** PDV
- **O que aconteceu:** O cliente podia receber a confirmação pelo WhatsApp mesmo com a gravação de itens ou a baixa de estoque pendente.
- **Causa:** O envio da confirmação podia começar antes de o PDV gravar os itens e concluir todas as baixas locais.
- **Correção:** A confirmação só é enviada após a gravação dos itens e a conclusão das baixas locais. Se alguma dessas etapas falhar, o PDV bloqueia o envio, registra inventory_not_finalized e mantém a venda em needs_review.
- **Como testar:** Usar o serviço real com transporte de WhatsApp simulado. Verificar vendas com estoque pendente, carrinhos numéricos e mistos, falhas na gravação ou na baixa e vendas apenas com itens serializados ou sem controle de estoque.
- **Tags:** PDV, WhatsApp, estoque

### #142 Termo automático de garantia gerado para venda com pendências

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.574 · origem historico
- **Onde:** PDV
- **O que aconteceu:** A loja podia gerar automaticamente o termo de garantia de uma venda ainda pendente.
- **Causa:** A geração automática do termo não era bloqueada quando a venda tinha pendências.
- **Correção:** Bloqueou a geração automática do termo para vendas com pendências.
- **Como testar:** Executar a regressão do termo de garantia e verificar que uma venda com pendências não gera o termo automaticamente.
- **Tags:** PDV, garantia, pendências

### #105 PDV selecionava outra unidade após bipar IMEI ou serial

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.363 · origem historico
- **Onde:** PDV
- **O que aconteceu:** Ao bipar um aparelho de um produto com várias unidades, o operador podia ficar com outra unidade selecionada.
- **Causa:** A seleção não preservava a unidade correspondente ao identificador bipado.
- **Correção:** Manter selecionada a unidade com correspondência exata e pedir confirmação do identificador antes de adicionar o aparelho ao carrinho.
- **Como testar:** Validar a seleção e a confirmação ao bipar o IMEI ou serial de uma das várias unidades do mesmo produto.
- **Tags:** pdv, imei, seleção

### #106 IMEI ou serial duplicado selecionava a primeira unidade

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.363 · origem historico
- **Onde:** PDV
- **O que aconteceu:** Ao bipar um identificador duplicado, o PDV selecionava a primeira unidade encontrada, que podia ser diferente do aparelho em mãos.
- **Causa:** A busca aceitava a primeira correspondência mesmo quando havia mais de uma unidade com o mesmo identificador.
- **Correção:** Bloquear a seleção quando o IMEI ou serial estiver duplicado.
- **Como testar:** Validar o bloqueio ao bipar um identificador duplicado.
- **Tags:** pdv, imei, duplicidade

### #12 Totem mantinha alerta de Pix após pagamento aprovado

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.62 · origem historico
- **Onde:** PDV
- **O que aconteceu:** O Android podia continuar exibindo “Pix aguardando no Totem” após a aprovação e repetir o alerta para o mesmo Pix.
- **Causa:** O monitor nativo não restringia os alertas a Pix pendentes nem cancelava a notificação ao receber a aprovação ou ficar sem Pix ativo.
- **Correção:** O monitor passou a acordar e notificar apenas para Pix pendente. A notificação passou a ser cancelável, a sumir quando o Pix é aprovado ou deixa de estar ativo e a ser emitida uma vez por Pix.
- **Como testar:** Executar android-totem-pix-static.test.mjs.
- **Tags:** Totem, Pix, notificação

## cadastro (4)

### #210 Produtos tinham marca em texto sem vínculo no cadastro

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.876 · origem historico
- **Onde:** cadastro · produtos e marcas
- **O que aconteceu:** A marca constava como texto no produto, mas o sistema não a reconhecia como marca cadastrada.
- **Causa:** Os produtos tinham o nome da marca em products.brand e o campo brand_id vazio.
- **Correção:** Foram vinculados 2.276 produtos às marcas correspondentes. Outros 73 ficaram sem vínculo porque suas marcas não existiam no cadastro.
- **Tags:** cadastro, produtos, marcas

### #211 Taxa de débito sumia da tela de taxas

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.876 · origem historico
- **Onde:** cadastro · taxas de pagamento
- **O que aconteceu:** A tela agrupava as linhas de pagamento em uma parcela e deixava de exibir a linha de débito.
- **Causa:** O campo method estava vazio em payment_fees, impedindo que a tela distinguisse as formas de pagamento.
- **Correção:** O campo method foi preenchido pela ordem de gravação. As primeiras linhas foram identificadas como Pix, débito e crédito em uma parcela. As parcelas a partir de 2x foram identificadas como crédito. O valor cadastrado para débito permaneceu em 0%.
- **Tags:** taxas, débito, pagamentos

### #195 Variantes Redmi Pad 2 cadastradas como Pad 6

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.845 · origem historico
- **Onde:** cadastro
- **O que aconteceu:** As variantes Verde, Roxo e Preto de 8 GB/256 GB apareciam no cadastro como Pad 6.
- **Causa:** Os SKUs PADX0001-01/02/03 estavam associados ao modelo Pad 6.
- **Correção:** Os três SKUs foram associados ao modelo Redmi Pad 2 e receberam nomes com modelo, tamanho da tela, cor, memória, armazenamento e SKU.
- **Tags:** tablet, cadastro, SKU

### #65 Título SEO incorreto no cadastro do POCO C81 Pro

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.227 · origem historico
- **Onde:** cadastro
- **O que aconteceu:** O produto POCO C81 Pro tinha um título SEO incorreto.
- **Causa:** O valor incorreto estava gravado na base de produção.
- **Correção:** O título SEO foi corrigido diretamente na base de produção.
- **Tags:** SEO, cadastro, produtos

## Evolution (2)

### #188 Instância Evolution aberta parava de receber mensagens

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.819 · origem historico
- **Onde:** Evolution
- **O que aconteceu:** O WhatsApp aparecia com a instância `open`, mas o robô deixava de receber mensagens ao vivo aproximadamente a cada 50 minutos.
- **Causa:** Um bug da Baileys 7.0.0-rc.9 deixava stanzas `<status>` sem confirmação.
- **Correção:** A VPS recebeu o patch `mdv-status-ack-v1` no container `evolution_api` e passou a usar a imagem fixa `mdv/evolution-api:2.3.7-statusack`.
- **Tags:** WhatsApp, Baileys, recebimento

### #64 Socket travado interrompia a Evolution

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.227 · origem historico
- **Onde:** Evolution
- **O que aconteceu:** A conexão da Evolution ficava travada, interrompendo o atendimento no WhatsApp.
- **Causa:** A Evolution entrava em um estado de socket travado identificado por uma assinatura conhecida.
- **Correção:** Um watchdog externo passou a recuperar a Evolution ao detectar a assinatura confirmada, com trava, intervalo entre tentativas e validação após a recuperação.
- **Como testar:** Verificar se o timer systemd mdv-evolution-watchdog.timer está ativo.
- **Tags:** Evolution, WhatsApp, socket, recuperação

## WhatsApp (1)

### #178 Ícone do catálogo estava oculto no WhatsApp

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.690 · origem historico
- **Onde:** WhatsApp · catálogo comercial
- **O que aconteceu:** O cliente não via o ícone para abrir o catálogo comercial no WhatsApp.
- **Causa:** O catálogo já estava vinculado ao número comercial, mas a configuração de exibição do ícone estava desativada.
- **Correção:** Ativou a exibição do ícone do catálogo no WhatsApp.
- **Como testar:** Recarregar o Gerenciador do WhatsApp e verificar se a configuração de exibição do ícone permanece ativa.
- **Tags:** catálogo, visibilidade, WhatsApp

## Evolution / n8n (1)

### #135 Bot não processava o texto editado no WhatsApp

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.516 · origem historico
- **Onde:** Evolution / n8n · entrada de mensagens
- **O que aconteceu:** Ao editar uma mensagem no WhatsApp, o cliente não tinha o novo texto considerado pelo bot.
- **Causa:** O webhook não recebia MESSAGES_UPDATE e o fluxo não normalizava o texto substituto antes do classificador e do agente.
- **Correção:** O webhook passou a receber MESSAGES_UPDATE. O fluxo normaliza o texto editado e ignora atualizações sem texto, como confirmações de leitura ou entrega.
- **Como testar:** Executar as fixtures de mensagem normal, mensagem editada e atualização sem texto. Confirmar que o webhook inclui MESSAGES_UPDATE.
- **Tags:** WhatsApp, edição, webhook

## site e API (1)

### #58 Slugs duplicados podiam abrir o produto ou a variação errada

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · versão v1.2.197 · origem historico
- **Onde:** site e API · abertura de produto e busca por slug
- **O que aconteceu:** Ao selecionar uma variação ou abrir um endereço de produto, o cliente podia chegar a outro cadastro com o mesmo slug.
- **Causa:** Slugs compartilhados eram usados para resolver o destino, inclusive quando a URL já tinha um UUID. A busca por slug não priorizava os cadastros adequados à venda.
- **Correção:** Cards agregados passaram a abrir a variação selecionada pelo identificador seguro, URLs com UUID passaram a preservar esse identificador e a busca por slug passou a priorizar produtos ativos, não arquivados, vendáveis e recentes.
- **Como testar:** Executar node tmp-tests/public-product-route-target.test.mjs, node tmp-tests/product-parent-shared-slug-static.test.mjs e node tmp-tests/product-duplicate-slug-active-priority-static.test.mjs.
- **Tags:** produtos, variações, slug, UUID

## Bling (1)

### #3 Falha na renovação do token Bling deixava estoque parado sem aviso

- **Situação:** 🟢 Corrigido · 1x · última 2026-11-21 · origem historico
- **Onde:** Bling
- **O que aconteceu:** O webhook recebia eventos, mas o estoque da loja não era atualizado e o painel não alertava sobre a desconexão.
- **Causa:** Quando o refresh token expirava ou era invalidado, o webhook continuava usando o access token antigo. A consulta ao Bling retornava 401, e a proteção contra zerar o estoque impedia a atualização.
- **Correção:** Quando a renovação retorna 400 ou 401, o webhook limpa o access token no Supabase e deixa de usá-lo. O painel exibe um banner informando que o Bling está desconectado e o webhook de estoque está parado.
- **Tags:** estoque, webhook, OAuth, alerta
