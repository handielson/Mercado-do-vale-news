# v1.2.670-layout-compra-imei

Data: 22/10/2026. Branch: main. Tag: v1.2.670-layout-compra-imei.
Release: /var/www/mdv-site/releases/20261022-203119-layout-compra-imei.

Removida a barra horizontal superior dos modelos e a largura minima de 1500 px; a tabela usa colunas ajustadas ao espaco disponivel. Na lista de aparelhos, lapis ao lado do custo abre o editor no proprio campo, sem coluna de acoes vazia. Identificadores quebram linha e botoes se acomodam ao espaco.

Validacao: guarda de layout, 20 testes de grupos/rota, navegador verificando editor dentro da celula de custo e build com travas. Somente site; dados comerciais preservados.

## Historico anterior

# v1.2.669-compra-por-imei

Data: 22/10/2026. Branch: main. Tag: v1.2.669-compra-por-imei.
Release: /var/www/mdv-site/releases/20261022-201639-compra-por-imei.

Botao Editar compra por IMEI no painel de precos dos modelos e Editar compra na lista de unidades do produto. Permite pesquisar IMEI/serial, corrigir somente o custo da unidade e atualizar a media. Preserva os precos de venda e rascunhos nao salvos.

Validacao: 20 testes de grupos/rota de unidades, navegador com fixtures e build com travas. Publicacao apenas do site, usando PUT /units/:id existente, sem restart, migration ou gravacao comercial durante validacao.

## Historico anterior

# v1.2.668-custo-medio-estoque

Data: 22/10/2026. Branch: main. Tag: v1.2.668-custo-medio-estoque.
Release: /var/www/mdv-site/releases/20261022-194036-custo-medio-estoque.

Resumo dos grupos de precos exibe Custo medio em estoque, usando os custos individuais disponiveis ou o custo do produto ponderado pela quantidade para estoque sem unidades individuais. Sem estoque ou custo conhecido, mostra Nao informado. Nao altera custos, precos ou quantidades.

Validacao: 19 testes de grupos, teste de navegador, wiring, sintaxe e build. API seletiva antes do site; resultados publicos registrados na nota da entrega.

## Historico anterior

# v1.2.667-versao-cadastro-foto

Data: 22/10/2026. Branch: main. Tag: v1.2.667-versao-cadastro-foto.
Release: /var/www/mdv-site/releases/20261022-192328-versao-cadastro-foto.

Cadastro por foto permite selecionar a versao comercial cadastrada e usa esse valor na consulta de precos, confirmacao e finalizacao. Global e sem versao continuam separados. Trocar versao invalida a confirmacao anterior; o produto final conserva a versao escolhida. Dados ficam no JSON existente, sem coluna nova.

Validacao: suites de cadastro por foto, grupos de precos e finalizacao, sintaxe e build com travas. API seletiva --photo-intake-only antes do site, sem migration ou teste com gravacao comercial. Conferencias publicas e backup na nota da entrega.

## Historico anterior

# v1.2.666-pesquisa-modelo-foto

Data: 22/10/2026. Branch: main. Tag: v1.2.666-pesquisa-modelo-foto.
Release: /var/www/mdv-site/releases/20261022-185448-pesquisa-modelo-foto.

Modelo do sistema no cadastro por foto permite pesquisar pelo nome, ignorando acentos e caixa, e selecionar com mouse ou teclado. Mantem o ID do cadastro e exige Associar modelo para efetivar. Reutiliza SearchableSelect, preservando seletores existentes de cores e filamentos.

Validacao: nove testes focados e build com travas; verificacao publica registrada na nota. Somente site, sem API, migration ou gravacao comercial nesta publicacao.

## Historico anterior

# v1.2.665-painel-precos-modelo

Data: 22/10/2026. Branch: main. Tag: v1.2.665-painel-precos-modelo.
Release: /var/www/mdv-site/releases/20261022-183347-painel-precos-modelo.

O link de precos por configuracao abre o editor mesmo quando a consulta inicial falhou e o tipo do modelo ainda e desconhecido. O editor consulta novamente e permite recarregar em caso de erro; a tabela antiga vazia fica restrita a modelos confirmados como nao celulares.

Validacao: guarda de regressao do estado desconhecido, testes dos grupos de precos e build. Somente site, sem gravacao de precos ou restart de API. Validacoes publicas na nota da entrega.

## Historico anterior

# v1.2.664-selecao-campos-foto

Data: 22/10/2026. Branch: main. Tag: v1.2.664-selecao-campos-foto.
Release: /var/www/mdv-site/releases/20261022-174127-selecao-campos-foto.

Campos de texto da conferencia do cadastro por foto, incluindo IMEIs, serie, EAN e SKU opcional, selecionam todo o conteudo ao clicar ou receber foco pelo teclado.

Validacao: guarda de selecao no teste existente de navegacao, regressoes do cadastro por foto e build com travas. Publicacao somente do site; nenhum dado comercial alterado. Resultados publicos na nota da entrega.

## Historico anterior

# v1.2.663-catalogo-sem-timeout

Data: 22/10/2026. Branch: main. Tag: v1.2.663-catalogo-sem-timeout.
Release: /var/www/mdv-site/releases/20261022-135000-v12663-catalogo-sem-timeout.

Pedidos de lista completa de celulares com estoque, precos e parcelas ja confirmados seguem direto ao envio em tres mensagens, sem depender do Especialista - Vendas. Consultas que exigem interpretacao continuam na IA. A falha do cliente final 0750 foi causada por timeout de 10 minutos no modelo depois de o catalogo estar pronto; a lista foi enviada manualmente e confirmada em tres partes, com estado de escolha por numero preservado.

Validacao: quatro testes focados, reproducao da execucao 57171 ate os tres payloads de envio e 117 regressoes comerciais do candidato exato. Workflow ativo, site versionado e saude publica conferidos na nota da entrega.

## Historico anterior

# v1.2.662-payjoy-runtime-ativo

Data: 22/10/2026. Branch: main. Tag: v1.2.662-payjoy-runtime-ativo.
Release: /var/www/mdv-site/releases/20261022-111018-payjoy-runtime-ativo.

Correcao da falta de resposta sobre boleto: o workflow gerava a resposta, mas a API ativa server.js rejeitava payjoyByJid. O publicador anterior atualizava somente vps_server.js/cjs e a prova verificava cjs inativo. Agora inclui os tres entrypoints autorizados e prova consulta o pm_exec_path real do processo mdv-api.

Delta de producao restrito a uma chave na allowlist do server.js, com backup, sintaxe e restart pelo publicador existente. Sem mudar mensagem, divisao do link, workflow, memoria ou pausa manual. Testes reproduzem o falso positivo e verificam runtime, idempotencia e preservacao. Validacao HTTP usa revisao impossivel para assegurar rollback sem gravar conversa.

Publicacao concluida: commit funcional 51f0a4e7/tag enviados; somente server.js remoto alterado. Estado PayJoy aceito pelo runtime ativo, API/MySQL saudaveis, pausa manual e hash do workflow preservados. 17 testes focados, contrato de API e117 comerciais aprovados; site/build/version/navegador validados. Dez preexistentes preservados; limpeza0 removidos/35 bloqueadas detalhadas na nota.

## Historico anterior

# v1.2.661-payjoy-reutilizar-entrada

Data: 21/10/2026. Branch: main. Tag: v1.2.661-payjoy-reutilizar-entrada.
Release: /var/www/mdv-site/releases/20261021-225631-payjoy-reutilizar-entrada.

Perguntas sobre entrada usam o valor aprovado e o percentual ja lidos da PayJoy tambem no WhatsApp. O fluxo prioriza a calculadora existente antes da coleta de cor/retirada, preservando o SKU, memoria, cor e etapa. Reutilizacao exige aprovacao valida e nao ignora novos valores explicitos.

Validacao: 117 regressoes comerciais, 14 testes WhatsApp, 20 Meta, contrato da API e ensaio nativo isolado com fotografia sintetica e turnos separados. Publicacao seletiva de tres nos do workflow, com backup e verificacao do estado publicado. Nenhuma mensagem real enviada; pausa manual protegida preservada.

## Historico anterior

# v1.2.660-payjoy-foto-contexto

Data: 21/10/2026. Branch: main. Tag: v1.2.660-payjoy-foto-contexto.
Release: /var/www/mdv-site/releases/20261021-223650-payjoy-foto-contexto.

O WhatsApp preserva a nova imagem antes de hidratar o contexto da API. A decisao PayJoy ocorre depois da verificacao de pausa. O contrato existente passa a persistir PayJoy tambem para WhatsApp, com revisao e ordem do evento. Sem contexto, o bot pede esclarecimento; falhas de conversao ou leitura chegam ao fallback existente. Historico recente autoriza somente ler a nova imagem, nunca recuperar valores financeiros.

Validacao: 117 regressoes comerciais, 13 testes focados e oito ensaios nativos do modelo com dados sinteticos e sem envio de WhatsApp. Publicacao seletiva da chave de estado na API e patch guardado do workflow; pausa manual do atendimento investigado conferida sem altera-la.

## Historico anterior

# v1.2.659-entrega-observacao

Data: 20/10/2026. Branch: main. Tag: v1.2.659-entrega-observacao.
Release: /var/www/mdv-site/releases/20261021-000700-entrega-observacao.

A conclusao da entrega aceita observacao preenchida como justificativa para endereco e rota pendentes. Mantem exigencias de saida registrada, entregador, cliente, telefone, valor e pagamento. A justificativa segue registrada no lancamento do entregador.

API publicada seletivamente com backup dos entrypoints e preservacao dos demais blocos. Sem concluir entregas reais ou enviar mensagens nos testes.

## Historico anterior

# v1.2.658-compartilhar-familia-espacamento

Data: 19/10/2026. Branch: main. Tag: v1.2.658-compartilhar-familia-espacamento.
Release MDV: /var/www/mdv-site/releases/20261019-192539-compartilhar-familia-espacamento.

A area de compartilhamento oferece Variacao selecionada ou Familia completa para todos os canais existentes. Selecionar outra variacao restaura o modo individual. A mensagem inclui linhas em branco entre titulo, caracteristicas, memoria, pagamento, cores, moedas e link, e ao redor dos separadores. Mantem o formatador do catalogo e a separacao por preco, inclusive quando duas cores da mesma memoria custam valores diferentes.

Validacao: testes de comportamento e integracao do seletor; exemplo real do Note 70 com quatro blocos de preco; normalizacao monetaria e build. Publicacao apenas do site.

## Historico anterior

# v1.2.657-compartilhamento-variacao

Data: 19/10/2026. Branch: main. Tag: v1.2.657-compartilhamento-variacao.
Release MDV: /var/www/mdv-site/releases/20261019-191847-compartilhamento-variacao.

O compartilhamento da pagina do produto respeita a variacao selecionada e seu link. Sem selecao, separa a familia por memoria e preco, agrupando as cores correspondentes. Reutiliza os blocos do catalogo e o formatador monetario em reais, com parcelas e moedas vinculadas ao valor de cada configuracao.

Validacao: seis suites de compartilhamento, familia, cores, rotas e precos; normalizacao monetaria; build com travas de segredos e runtime legado. Publicacao apenas do site, sem alterar API ou dados comerciais.

## Historico anterior

# v1.2.656-meta-payjoy-contexto

Data: 19/10/2026. Branch: main. Tag: v1.2.656-meta-payjoy-contexto.
Release MDV: /var/www/mdv-site/releases/20261019-175000-v12656-meta-payjoy.

O fluxo PayJoy tem prioridade quando o bot aguarda a cor do aparelho: perguntas sobre a entrada usam a aprovacao persistida e preservam a escolha. Novos prints em conversas iniciadas antes da correcao podem seguir ao leitor por contexto recente e confiavel da loja, sem recuperar valores do historico. Imagens indisponiveis seguem ao tratamento canonico e invalidam aprovacao anterior.

## Historico anterior

# v1.2.655-meta-payjoy-prints

Data: 19/10/2026. Branch: main. Tag: v1.2.655-meta-payjoy-prints.
Release MDV: /var/www/mdv-site/releases/20261019-171500-v12655-meta-payjoy.

O Instagram e o Messenger encaminham prints PayJoy ao leitor nativo existente. O resultado persiste por conversa, com revisao e validade, para calcular a entrada sobre o valor aprovado e continuar com o aparelho escolhido. Downloads limitados a PNG/JPEG/WebP de CDNs permitidas, sem redirecionamento e ate 8 MiB. Pausas humanas e globais prevalecem; imagens ilegíveis ou indisponíveis pedem confirmacao, sem inventar valores. Sem reenvio de conversas antigas ou alteracao do estado WhatsApp.

## Historico anterior

# v1.2.654-atendimento-n8n

Data: 19/10/2026. Branch: main. Tag: v1.2.654-atendimento-n8n.
Release MDV: /var/www/mdv-site/releases/20261019-123700-v12654-atendimento-n8n.

O atendimento n8n passa a recuperar falhas do classificador com resposta segura, sem consumir confirmação de compra ou cadastro. A política de aparelhos usados, a interpretação do resultado PayJoy, a validação de cadastro e a escolha de entrega/retirada receberam correções e testes de regressão. O candidato foi composto sobre a versão ativa de 119 nós, validado com 117 testes e ensaios nativos do n8n 2.43.8 com dados sintéticos.

## Historico anterior

# v1.2.653-orcamento-familia-seo

Data: 19/10/2026. Branch: main. Tag: v1.2.653-orcamento-familia-seo.
Release MDV: /var/www/mdv-site/releases/20261019-134500-v12653-orcamento-familia-seo.

Orcar sem escolher cor preserva a familia e suas variacoes. A mensagem inclui todas as parcelas quando nenhuma foi escolhida. A previa social prioriza a imagem do pai; os dados estruturados preservam a imagem da variacao.

API publicada seletivamente pelos blocos de imagens SEO e HTML do produto, preservando integracoes remotas. Sem migracoes ou mudancas de dados comerciais.

## Historico anterior

# v1.2.652-whatsapp-webhook-ack

Data: 18/10/2026. Branch: main. Tag: v1.2.652-whatsapp-webhook-ack.
Release MDV: /var/www/mdv-site/releases/20261018-152433-v12652-whatsapp-ack.

Preserva o ACK imediato do WhatsApp ao compor o atendimento Meta e bloqueia candidatos sem o contrato de resposta.

O workflow ja recebeu a recuperacao emergencial autorizada. Esta entrega versiona a protecao no gerador e no validador; a reaplicacao deve confirmar o mesmo hash sem reiniciar n8n/runner. As nove falhas comerciais preexistentes permanecem separadas.

## Historico anterior

# v1.2.651-meta-validacao-contexto

Data: 18/10/2026. Branch: main. Tag: v1.2.651-meta-validacao-contexto.
Release MDV: /var/www/mdv-site/releases/20261018-123300-v12651-meta-contexto.

Exige prova real de continuidade e pausa humana nos dois canais antes de ativar novas respostas Meta.

## Historico anterior

# v1.2.650-meta-webhook-auth

Data: 18/10/2026. Branch: main. Tag: v1.2.650-meta-webhook-auth.
Release MDV: /var/www/mdv-site/releases/20261018-122600-v12650-meta-auth.

Valida o retorno 403 do Header Auth do n8n antes de liberar a entrada autenticada do atendimento Meta.

## Historico anterior

# v1.2.649-meta-atendimento-respostas

Data: 18/10/2026. Branch: main. Tag: v1.2.649-meta-atendimento-respostas.
Release MDV: /var/www/mdv-site/releases/20261018-122000-v12649-meta-atendimento.

Conecta novas mensagens do Direct e Messenger ao nucleo comercial do WhatsApp, com memoria por canal e fila de envio persistente.

A ativacao exclui eventos historicos. Pausa humana e global sao reavaliadas antes de cada envio. Resultado ambiguo nao e reenviado. Comentarios continuam em observacao; Marketplace depende da Pagina conectada.

## Historico anterior

# v1.2.648-meta-atendimento-piloto

Data: 17/10/2026. Branch: main. Tag: v1.2.648-meta-atendimento-piloto.
Release MDV: /var/www/mdv-site/releases/20261017-180000-v12648-meta-atendimento.

Prepara a caixa de entrada de Direct, Messenger e comentarios Meta, em observacao e com envios bloqueados. O receptor valida o corpo bruto com HMAC, grava o lote antes de confirmar e mantem os canais separados. Nao conecta o n8n nem envia mensagens. Marketplace depende de mensagens entregues a Pagina conectada; perfis pessoais nao estao incluidos.

## Historico anterior

# v1.2.647-n8n-memory-container

Data: 17/10/2026. Branch: main. Tag: v1.2.647-n8n-memory-container.
Release MDV: /var/www/mdv-site/releases/20261017-171500-v12647-n8n-memory-container.

Torna deterministica a recuperacao da memoria PostgreSQL: os containers principal e de banco agora sao localizados pelo rotulo exato do servico Docker Swarm. Isso impede que o runner seja confundido com o container principal durante uma reaplicacao idempotente.

## Histórico anterior

# v1.2.646-n8n-memory-readiness

Data: 17/10/2026. Branch: main. Tag: v1.2.646-n8n-memory-readiness.
Release MDV: /var/www/mdv-site/releases/20261017-170500-v12646-n8n-memory-readiness.

Conclui a recuperacao da memoria PostgreSQL do bot e torna a rotina operacional idempotente. Depois de alterar a credencial para `n8n-db`, health e readiness sao aguardados separadamente com timeout; um `502` transitório durante a inicializacao nao encerra a publicacao prematuramente. Se o host ja estiver correto, a verificacao preserva os servicos sem novo reinicio.

## Histórico anterior

# v1.2.645-n8n-memory-db-host

Data: 17/10/2026. Branch: main. Tag: v1.2.645-n8n-memory-db-host.
Release MDV: /var/www/mdv-site/releases/20261017-165936-v12645-n8n-memory-db-host.

As memorias `Memoria Vendas` e `Memoria de contexto postggress` passam a acessar o PostgreSQL pelo alias interno estavel `n8n-db`, evitando o endereco inacessivel da rede compartilhada apos reinicios do Docker Swarm. A rotina cria backup criptografado com permissao restrita, altera somente o host da credencial existente, remove copias temporarias descriptografadas, reinicia n8n e runner em ordem e valida health/readiness. Execucoes de clientes que falharam nao sao repetidas.

## Histórico anterior

# v1.2.644-tiktok-stock-protection

Data: 17/10/2026. Branch: main. Tag: v1.2.644-tiktok-stock-protection.
Release MDV: /var/www/mdv-site/releases/20261017-110207-v12644-tiktok-stock-protection.

Pedidos confirmados no TikTok passam a reservar imediatamente o estoque local por pedido e SKU, sem duplicar a baixa quando webhook e polling entregam o mesmo evento. O saldo absoluto posterior do Bling absorve a reserva provisoria, cancelamentos restauram apenas baixas ainda nao absorvidas e falhas ao atualizar o TikTok permanecem em fila persistente versionada. Um polling por data de atualizacao e uma reconciliacao periodica cobrem webhooks atrasados ou perdidos. O formato real do TikTok, com uma unidade por `line_item` e sem campo `quantity`, esta protegido por teste. O saldo operacional existente nao e alterado pela publicacao.

## Histórico anterior

# v1.2.643-shopee-anatel-condicional

Data: 17/10/2026. Branch: main. Tag: v1.2.643-shopee-anatel-condicional.
Release MDV: /var/www/mdv-site/releases/20261017-131315-shopee-anatel-condicional.

Na publicacao e edicao de anuncios Shopee, o painel exige a declaracao sobre Bluetooth, Wi-Fi ou RF quando a categoria retorna esse atributo. Ao selecionar Sim, exige o numero de licenca Anatel; ao selecionar Nao, nao envia uma licenca antiga. O envio aguarda os atributos da categoria e preserva esses campos mesmo em modelos estritos e tentativas de recuperacao. Nenhum numero de licenca e inventado. Somente o site sera publicado.

## Histórico anterior

# v1.2.642-unit-visibility

Data: 17/10/2026. Branch: main. Tag: v1.2.642-unit-visibility.
Release MDV: /var/www/mdv-site/releases/20261017-125000-v1642-unit-visibility.

Restaura a ação de ocultar e reativar aparelhos nas três entradas da API. O deploy seletivo altera apenas esse trecho, inclui os dois módulos de visibilidade e preserva outros ajustes da VPS. Testes impedem que uma publicação futura deixe as entradas divergentes. Nenhum aparelho é alterado pela publicação.

## Histórico anterior

# v1.2.641-shopee-filelink

Data: 17/10/2026. Branch: main. Tag: v1.2.641-shopee-filelink-verificado.
Release MDV: /var/www/mdv-site/releases/20261017-124500-v1641-shopee-filelink-verificado.

Etiquetas Shopee usam create_shipping_document_job com package_list, consulta de job_status e download_shipping_document_job. A API baixa o media_link sem expor a URL assinada, aceita PDF direto durante a transicao e preserva a impressao A4/termica. Jobs pendentes sao retomados por conta/pacote/tipo; links vencidos sao renovados com o mesmo job. 49 testes e preflight remoto seletivo aprovados. Publicacao aplica somente os blocos da integracao e o novo modulo, com backup e rejeicao de drift. O agente atual recebe o PDF pela mesma rota; o caminho legado foi atualizado no codigo-fonte sem incluir ajustes locais preexistentes de documento PF. Conferir validacao publica na nota da versao.

## Histórico anterior

# v1.2.640-precos-whatsapp

Data: 15/10/2026. Branch: main. Tag: v1.2.640-precos-whatsapp.
Release MDV: /var/www/mdv-site/releases/20261015-181600-v1640-precos-whatsapp.

O bot interpreta "6 gigas e 128 de armazenamento" como 6GB/128GB, preserva a lista durante mensagens simultaneas e somente a considera apresentada apos a confirmacao do envio pelo WhatsApp. "Valores?" e "No Pix, menor valor?" seguem para cotacao dos modelos em contexto, com caracteristicas verificadas, memoria, preco Pix, cartao 12x com total, cores e separadores. Nao promete desconto extra. Sete nos de codigo mudam, sem alterar conexoes. Doze testes focados e vinte de vendas passaram no candidato; a verificacao de producao consta na nota desta versao.

## Histórico anterior

# v1.2.639-visita-loja-maps

Data: 15/10/2026. Branch: main. Tag: v1.2.639-visita-loja-maps.
Release MDV: /var/www/mdv-site/releases/20261015-200722-v1639-visita-loja-maps.

O bot reconhece perguntas sobre visitar a loja para conferir aparelhos e usa o ramo de localizacao ja existente. A resposta informa o endereco cadastrado, link do Google Maps, horario regular do dia quando disponivel e pede o modelo para conferir estoque antes da visita. A regra nao captura perguntas de entrega, frete ou retirada de pedido. Quatro nos existentes mudaram, sem alterar conexoes; workflow e historico ativo foram verificados. Nao houve reenvio ao cliente 5234.

## Histórico anterior

# v1.2.638-catalogo-whatsapp-3-partes

Data: 15/10/2026. Branch: main. Tag: v1.2.638-catalogo-whatsapp-3-partes.
Release MDV: /var/www/mdv-site/releases/20261015-195134-v1638-catalogo-whatsapp-3-partes.

O compartilhamento do catálogo pelo site mostra modelo, características confirmadas, memória, preço à vista no Pix, cartão em 12x com total e cores na mesma linha. Cores do mesmo modelo e memória com preços diferentes ficam em blocos próprios para não atribuir o menor preço a todas. Listas longas são divididas em três mensagens completas, com numeração preservada e marca repetida quando a divisão cai dentro dela. Os botões WhatsApp e Copiar avançam uma parte por vez nos três pontos de compartilhamento. Nove testes focados e o build do site passaram. Somente o site é publicado; API e n8n não mudam nesta entrega.

## Histórico anterior

# v1.2.637-celulares-memoria

Data: 15/10/2026. Branch: main. Tag: v1.2.637-celulares-memoria.
Release MDV: /var/www/mdv-site/releases/20261015-133500-v1637-celulares-memoria.

No WhatsApp, cada numero da lista de celulares identifica um modelo com RAM e armazenamento definidos. As cores da mesma configuracao continuam juntas. A selecao por numero e cor preserva SKU, memoria e preco exatos; listas antigas agrupadas ainda exigem desambiguacao. O mutador de publicacao testa o candidato exato antes de gravar e confere o mesmo hash depois da leitura do n8n. Candidato f2e827d19bea0e8adc78469827be2a257569c996128a1c85787f83127a361a57, 87 testes aprovados antes e depois, build aprovado. Publicado: commit funcional 2f6578cd/tag enviados a main, workflow/historico alinhados, n8n/runner/banco 1/1, site/VERSION 637 e API/MySQL saudaveis. O timeout do especialista de vendas e a renovacao da chave REST sao investigacoes separadas desta correcao.

## Histórico anterior

# v1.2.636-imagens-pai-previa

Data: 15/10/2026. Branch: main. Tag: v1.2.636-imagens-pai-previa.
Release MDV: /var/www/mdv-site/releases/20261015-122600-v1636-imagens-pai-previa.

A API retorna as fotos do pai no catalogo compacto/completo e nos detalhes. O card prioriza a capa do pai inclusive ao escolher cor; quando o pai nao tem fotos, usa o filho. A pagina de detalhe aceita o mesmo endereco publico reconhecido pela previa. Open Graph usa JPEG separado e versionado sem alterar os originais. 33 testes e leitura real MySQL aprovados. Publicado: commit 5eba910e e tag enviados a main; API seletiva com backup e reinicio mdv-api concluido, MySQL saudavel e site/VERSION 636 confirmados. Card real manteve a foto do pai ao selecionar Preto; alias do suporte abriu o produto correto e previa retornou JPEG de 28.445 bytes com HTTP 200. Protecao obrigatoria no publicador das tres entradas. Alteracoes preexistentes e 35 worktrees bloqueadas preservadas. Sem alteracao do n8n.

## Histórico anterior

# v1.2.635-modelo-configuracao

Data: 15/10/2026. Branch: main. Tag: v1.2.635-modelo-configuracao.
Release MDV: /var/www/mdv-site/releases/20261015-120500-v1635-modelo-configuracao.

4G/5G deixam de virar RAM. A falta de 8GB/256GB oferece primeiro o mesmo modelo em 6GB/128GB disponivel, com aviso da diferenca. Nova mensagem sobre o modelo reavalia a memoria e preserva rede e contexto. Sem reserva ou venda automatica. 84 testes e 10 cenarios nativos reais aprovados no candidato 0099b60d7899b03cc400dcd0b3506550f93a58ae567a542a08f4b396b67d3a15. Publicado: commit 492fe22d e tag enviados a main; workflow e historico alinhados, 84 testes repetidos e leitura apos reinicio confirmou o hash nativo. Site/VERSION 635 e catalogo sem erros, n8n/banco/runner 1/1, API/MySQL saudaveis sem deploy/reinicio. Alteracoes preexistentes e 35 worktrees bloqueadas preservadas.

## Histórico anterior

# v1.2.634-payjoy-continuidade

Data: 15/10/2026. Branch: main. Tag: v1.2.634-payjoy-continuidade.
Release MDV: /var/www/mdv-site/releases/20261015-112900-v1634-payjoy-continuidade.

Pedidos como “me passa esse site” apos explicacao PayJoy seguem para o link oficial configurado. Referencia contextual recente, decisao semantica validada e preservacao de duvidas, recusas e humano. Cinco nos existentes, sem alteracao do grafo ou modelos. 71 testes locais e 20 cenarios nativos com chamadas reais aprovados no candidato 4f8af0756eb441102f300cec8d8be8eee2216f6388eab5d2ab08e6655f0e1051. Publicado: commit 9343e9e2 e tag enviados a main; fluxo ativo e historico conferidos com o mesmo hash, 71 testes repetidos apos gravacao e nova leitura apos reinicio. Site/VERSION 634 e catalogo sem erros conferidos, n8n e runner 1/1, link oficial configurado valido e API/MySQL saudaveis sem deploy/reinicio. Alteracoes preexistentes e 35 worktrees bloqueadas preservadas.

## Histórico anterior

# v1.2.633-fotos-tres-mensagens

Data: 15/10/2026. Branch: main. Tag: v1.2.633-fotos-tres-mensagens.
Release MDV: /var/www/mdv-site/releases/20261015-112153-v1633-fotos-tres-mensagens.

A resposta sobre fotos de todos os modelos passa a enviar três mensagens: explicação, link do catálogo e convite para escolher um modelo. Texto e link preservados. Apenas Vendas - Verificar Pos Lista muda no workflow; dois separadores de linha viram separadores de mensagem. 63 testes e fixtures de fotos/catálogo aprovados no candidato 31dc49a57e8a80b5f998136a87354e22a29dcbaecae86c2346bc94f118caa4db. Publicado: commit 9a1694f9/tag enviados a main; workflow e histórico conferidos com mesmo hash após reinício, 63 testes repetidos e health/readiness ok. Site e VERSION 633 confirmados, catálogo renderizado; API saudável sem deploy/reinício. Outras correções pendentes e 35 worktrees bloqueadas preservadas.

## Histórico anterior

# v1.2.632-n8n-responses-fix

Data: 15/10/2026. Branch: main. Tag: v1.2.632-n8n-responses-fix.
Release MDV: /var/www/mdv-site/releases/20261015-111233-v1632-n8n-responses-fix.

Corrige HTTP 400 do classificador após a migração: três modelos explicitam Responses e usam reasoning.effort, preservando GPT-6 Luna. O teste anterior simulava incorretamente o padrão da API; agora executa o Tools Agent V3 instalado e inspeciona o corpo efetivamente enviado. 61 testes de vendas, seis da migração e oito cenários reais passaram no candidato 1ef08bb887e985f859976d81f673002d4cc86baf790af7816b5d5b720b33c88f. Publicado: commit 1d9d5e0a/tag enviados a main; entidade/histórico com mesmo hash, n8n/runner 1/1, health/readiness aprovados e oito cenários reais repetidos sobre o readback. Site e VERSION 632 confirmados; catálogo renderiza sem erros no console. API saudável sem deploy/reinício. As sete correções de atendimento preparadas anteriormente continuam fora desta entrega; alterações preexistentes e 35 worktrees bloqueadas foram preservadas.

## Histórico anterior

# v1.2.631-n8n-gpt6-luna

Data: 14/10/2026. Branch: main. Tag: v1.2.631-n8n-gpt6-luna.
Release MDV: /var/www/mdv-site/releases/20261014-231800-v1631-n8n-gpt6-luna.

Quatro nós de IA usam gpt-6-luna: conversa, classificação, vendas e leitura PayJoy. Visão nativa 2.3 usa Responses e limite de saída compatível; parser aceita retorno novo e legado e recusa dados incompletos/erro. Sessenta e um testes do contrato, seis de migração, suíte PayJoy e oito testes reais nativos passaram antes da publicação. Candidato testado: 929ea50086ffac24cab632231dc3aece71b4774f99e95b66370ecbeb032bd116. Publicação concluída: commit 5428f86e e tag enviados, histórico ativo conferido com mesmo hash, n8n/runner 1/1 e site/VERSION 631 confirmados. Credenciais, conexões e áudio preservados. Seis arquivos preexistentes e 35 worktrees bloqueadas preservados.

## Histórico anterior

# v1.2.630-pdv-bipagem

Data: 14/10/2026. Branch: main. Tag: v1.2.630-pdv-bipagem.
Release MDV: /var/www/mdv-site/releases/20261014-225800-v1630-pdv-bipagem.

Após adicionar um produto comum ao carrinho, o PDV devolve o foco à busca e seleciona o código inteiro. A próxima bipagem substitui o anterior. Teste executa o handler existente com duas leituras, rejeição por estoque e confirmação obrigatória de IMEI. Publicação somente do site concluída: commit 9b5abaa1 e tag enviados a main; build e quatro guardas aprovados. VERSION.json e chunk atualizado confirmados em produção; PDV renderiza a busca. API saudável, sem reinício. Seis arquivos preexistentes e 35 worktrees bloqueadas preservados.

## Histórico anterior

# v1.2.629-entregas-painel

Data: 14/10/2026. Branch: main. Tag: v1.2.629-entregas-painel.
Release MDV: /var/www/mdv-site/releases/20261014-224700-v1629-entregas-painel.
Android Entregas permanece 1.1.5, versionCode 9.

Corrige ReferenceError na API do painel de entregas: o período continuava no retorno depois de sua definição ter sido removida. O aplicativo apresentava o erro como falha de conexão. Teste executa o handler completo para administrador e entregador, com cinco filtros, e reproduziu o erro antes da correção. Publicação corretiva concluída: commit 979078b4 e tag enviados, API seletiva e site publicados. 45 testes e build aprovados; painel autenticado respondeu HTTP 200 em Hoje, Todas e Mês, com resumo e responsáveis. Sem necessidade de reinstalar o APK.

## Histórico anterior

# v1.2.628-vendas-entregas

Data: 14/10/2026. Branch: main. Tag: v1.2.628-vendas-entregas.
Release MDV: /var/www/mdv-site/releases/20261014-223500-v1628-vendas-entregas.
Android Entregas: 1.1.5, versionCode 9, instalado no Realme RMX5011. Publicação concluída.

Vendas preservam produto, memória, cor e valor exatos; perguntas não consomem campos de cadastro/endereço e mensagens concorrentes exigem revisão e reprocessamento. Encaminhamento à equipe só é confirmado com evidência. Entregas usam o dia comercial de Petrolina nos filtros; conclusão exige saída prévia, preserva a data em repetições e protege avisos concorrentes/incertos. O app fecha os detalhes após a API confirmar a entrega e volta ao painel inicial. Base do painel 1.1.4 recuperada e preservada. Commit funcional 7cee11f2 e tag enviados a main. API seletiva, workflow/histórico e site publicados e conferidos; APK instalado e abertura verificada. 61 testes do bot, 39 de entregas, quatro do publicador e builds aprovados. Seis arquivos preexistentes e 35 worktrees bloqueadas preservados. Detalhes e limites na nota.

## Histórico anterior

# v1.2.627-gcode3d-domain

Data: 14/10/2026. Branch: main. Tag: v1.2.627-gcode3d-domain.
Release MDV: /var/www/mdv-site/releases/20261014-220100-gcode3d-domain-verified.
Release 3D: /var/www/print3d-site/releases/20261014-220101-gcode3d-domain-verified.

Delegação DNS liberada para carlos/jill Cloudflare. Certificado próprio emitido para gcode3d.com.br e www, com renovação automática. API seletiva e Nginx publicados; Cloudflare Completo (estrito) salvo e confirmado. Prévia administrativa passa a usar o endereço canônico retornado pelo servidor. Preserva manutenção pública, a entrega de agrupamento por modelo v1.2.626 e alterações preexistentes. Validação final registrada na nota.

## Histórico anterior

# v1.2.626-celular-modelo-unico

Data: 14/10/2026. Branch: main. Tag: v1.2.626-celular-modelo-unico.
Release MDV: /var/www/mdv-site/releases/20261014-203032-celular-modelo-unico.

WhatsApp agrupa smartphones pelo modelo vinculado, com configuracoes de memoria separadas e cores reunidas. API expoe model_name do cadastro atual. Nome Poco X8 Pro 5G padronizado no modelo, 13 produtos e textos publicos relacionados; sem alteracao de estoque, precos, SKU ou vinculos.

Replay offline da execucao 40580 passou: 107 produtos de entrada, duas entradas do mesmo Poco reduzidas a uma familia. Testes de memoria fisica, cores, preco, filtros, fallback, idempotencia, estado e guardas de publicacao aprovados. Publicacao seletiva da API altera apenas smartphoneModelSpecs.mjs; workflow muda somente Vendas - Contexto Produtos.

Site gerado isoladamente a partir da tag publicada v1.2.624-extrato-entrada-saida com a versao atual, para preservar a migracao gcode3d preparada e ainda pendente. Detalhes e evidencias na nota desta entrega.

Publicado: commit funcional 3c8d29d2/tag principal e commit de site bdbcb731/tag -site enviados. API somente modulo de nome canônico, workflow somente Contexto Produtos; readback/idempotencia, servicos e endpoints aprovados. Codigo publicado com dados reais gera um Poco X8 Pro 5G 8GB/256GB, quatro cores, R$ 2.660,00. Site isolado ativo e navegador validado. Pendencia legada de teste amplo do publicador e 35 worktrees bloqueadas detalhadas na nota; seis preexistentes preservados.

## Historico anterior e entrega pendente

# v1.2.625-gcode3d-domain — preparada, aguardando DNS

Data: 14/10/2026. Branch: main. Tag preparada: v1.2.625-gcode3d-domain-prepared.
Site principal/3D e API: corte público pendente. Produção permanece na entrega anterior até validação de DNS e HTTPS.

gcode3d.com.br registrado/pago e zona independente Free criada na Cloudflare; A raiz/www direto para VPS, sem CNAME para o domínio antigo. Nameservers carlos/jill salvos no Registro.br, em transição obrigatória de cerca de duas horas. Bootstrap ACME instalado sem alterar o site antigo. Canonical, links, prévia, ações de conta, sitemap e CORS atualizados nas fontes. Certificado próprio e novos vhosts preparados; 3dmv somente redirecionamento opcional no estado final. Onze testes, três guardas e builds principal/3D aprovados; bundles sem URLs antigas. Não cancelar o domínio antigo antes da validação final. Runbook e estado completo em docs/operacional/2026-10-14-gcode3d-domain-migration.md.

## Histórico anterior

# v1.2.624-extrato-entrada-saida

Data: 14/10/2026. Branch: main. Tag: v1.2.624-extrato-entrada-saida.
Release: /var/www/mdv-site/releases/20261014-181235-extrato-entrada-saida.

Extrato diferencia entradas em verde e saídas em vermelho, com setas e rótulos. Fotografia inicial, reservas e alterações sem movimento ficam neutras. Saldo por local não representa deslocamento físico do aparelho. Dezoito testes e build aprovados; publicação somente do site. Fechamento na nota da entrega.

## Histórico anterior

# v1.2.623-extrato-aparelhos

Data: 14/10/2026. Branch: main. Tag: v1.2.623-extrato-aparelhos.
Release: /var/www/mdv-site/releases/20261014-150101-extrato-aparelhos.

Diário passa a apresentar extrato resumido com data, aparelho, ocorrência e situação. Impressão e WhatsApp usam o resumo por padrão, com opção de incluir dados completos. Datas originais e fotografia da implantação distinguidas; saldos por local permanecem contexto do produto. Dezessete testes e build aprovados. Publicação somente do site concluída: commit ef821972 e tag em main, site/VERSION correspondentes, tabela e preparação do WhatsApp validadas no Chrome, sem erros. Seis arquivos preexistentes e 34 worktrees bloqueados preservados. Detalhes na nota da entrega.

## Histórico anterior

# v1.2.622-diario-aparelhos

Data: 14/10/2026. Branch: main. Tag: v1.2.622-diario-aparelhos.
Release: /var/www/mdv-site/releases/20261014-144155-diario-aparelhos.

Diário permanente por unidade física e atalho de histórico no card do produto, ao lado dos locais de estoque. Impressão e compartilhamento consultam todas as páginas; históricos longos geram TXT completo para anexar ao WhatsApp. Registros existentes identificados como fotografia da implantação, preservando a data original nos dados. Sem edição/exclusão na aplicação.

MySQL 8 real: eventos de cadastro, alteração, saída e remoção; rollback e proteção imutável aprovados em schema isolado. Clone do schema operacional validado, backup verificado e 20 triggers instalados com 244 registros iniciais e 162 referências existentes. Totais comerciais preservados. Publicação concluída: commit 1c8fcb2e e tag em main, API online/mysql saudável, site/VERSION correspondentes e atalho validado no Chrome autenticado. Dezenove testes, integração MySQL e build aprovados. Seis arquivos preexistentes e 34 worktrees bloqueados preservados. Detalhes na nota da entrega.

## Histórico anterior

# v1.2.621-estoque-finance-status

Data: 14/10/2026. Branch: main. Tag: v1.2.621-estoque-finance-status-r1.
Release: /var/www/mdv-site/releases/20261014-141311-estoque-finance-status.

Consultar distribuicao nao cria saldo ou movimentos. Materializacao explicita usa unidades disponiveis quando serializadas. Rota Finance registrada no runtime JS e modulo incluido no deploy. Status exige leitura operacional da sessao antes do envio; timeout apos POST fica incerto sem reenvio automatico. Recuperacao somente da sessao de Status autorizada. Sem ajuste de saldo ou instalacao do diario. Testes focados, build e sintaxe aprovados; fechamento na nota da entrega.

Publicacao concluida: commit98e0907a e tagr1 enviados a main. Site/VERSION publicos correspondentes; API online/mysql.ok=true, Finance privado200. Sessao Status recuperada apos sincronizacao e leitura funcional. 47 testes e build do checkout isolado aprovados. Cinco resultados incertos sem reenvio, saldos preservados. Limpeza removeu um checkout, arquivou um gerenciado e preservou34 bloqueados. Diario ainda local, sem migration.

## Historico anterior

# v1.2.620-catalogo-mensagem-familia

Data: 13/10/2026. Branch: main. Tag: v1.2.620-catalogo-mensagem-familia.
Release: /var/www/mdv-site/releases/20261013-201458-catalogo-mensagem-familia.

Copiar Mensagem e compartilhamento WhatsApp usam o agrupamento canonico dos cards do catalogo. Variacoes com nomes divergentes na mesma familia entram no mesmo bloco por memoria; nome do pai tem prioridade quando disponivel. Cadastros, precos e estoque preservados. Oito testes focados e build aprovados. Publicacao somente do site; API e 3DMV sem deploy.

Publicacao concluida: commit e567a782 e tag enviados a main, VERSION.json publico correspondente e homepage HTTP 200. Chrome confirmou copia com um bloco e quatro cores, sem erros no console. Auditoria removeu zero worktrees e preservou 34 bloqueadas, listadas na nota. Seis arquivos preexistentes fora do escopo.

## Historico anterior

# v1.2.619-tiktok-estoque-cancelamento

Data: 13/10/2026. Branch: main. Tag: v1.2.619-tiktok-estoque-cancelamento.
Release: /var/www/mdv-site/releases/20261013-152616-v1-2-619-tiktok-estoque-cancelamento.

Cancelamentos, devolucoes e reembolsos do TikTok agora identificam os SKUs do pedido e reaplicam no marketplace o estoque autoritativo do Mercado do Vale. Pedidos normais nao recebem reposicao. A correcao impede que uma unidade devolvida automaticamente pelo TikTok reapareca para venda quando o saldo local continua zerado.

O incidente TT370C foi confirmado sem escrita manual: estoque local e duas localizacoes em zero; pedido anterior cancelado; unidade restaurada no anuncio; nova venda em 11/10; Bling posteriormente informou saldo fisico -3. O TikTok ja esta novamente zerado. Teste focado e sintaxe dos servidores aprovados; publicacao e validacao final registradas na nota da entrega.

Publicacao concluida: commit funcional 204b0007 e tag enviados a main; API reiniciada e `online`, status HTTP 200 com MySQL saudavel. Site ativo na release registrada e `VERSION.json` publico correspondente. Auditoria removeu zero worktrees e preservou 34 bloqueadas; seis arquivos preexistentes de impressao/Shopee ficaram fora do escopo.

## Historico anterior

# v1.2.618-payjoy-conhecimento-pagamentos

Data: 12/10/2026. Branch: main. Tag: v1.2.618-payjoy-conhecimento-pagamentos.
Release: /var/www/mdv-site/releases/20261013-004529-v1-2-618-payjoy-conhecimento-pagamentos.

Conhecimento oficial PayJoy e regras do Mercado do Vale alimentam classificador e atendimento geral. Dúvidas sobre o link, incluindo como funciona, chegam à IA sem reiniciar a oferta. Lista de pagamentos com emojis inclui boleto via PayJoy e oferece o link da análise, mantendo consentimento. Prints, cálculo em centavos e pausa humana preservados.

Publicação concluída: commit funcional a2e2b6fb e tag enviados a main, workflow ativo e histórico alinhados, nove testes sobre leitura publicada e health/readiness 200. Site com release/VERSION correspondentes e catálogo real sem erro fatal. API e 3DMV sem deploy; mysql.ok=true. Limpeza: zero removidas, 34 bloqueadas preservadas e listadas na nota. Seis arquivos preexistentes fora do escopo.

## Historico anterior

# v1.2.617-n8n-segredo-removido

Data: 12/10/2026. Branch: main. Tag: v1.2.617-n8n-segredo-removido.
Release: /var/www/mdv-site/releases/20261012-234206-n8n-segredo-removido.

Configuracao sensivel MCP removida do Git, preservada localmente e ignorada. Exemplo sem chave, hook pre-commit e guarda no prebuild impedem nova inclusao de tokens n8n literais. Historico e revogacao da antiga conta Cloud permanecem pendentes.

## Historico anterior

# v1.2.616-payjoy-interpretacao-ia

Data: 12/10/2026. Branch: main. Tag: v1.2.616-payjoy-interpretacao-ia.
Release: /var/www/mdv-site/releases/20261012-222327-payjoy-interpretacao-ia.

PayJoy usa interpretacao contextual no classificador existente para aceitar respostas naturais como oi sim, sem repetir permissao. Recusas, duvidas, humano, resultados e entrada/prints preservados. Fluxo ja aplicado, historico alinhado e servicos saudaveis. Site recebe registro da versao; API e 3DMV sem deploy.

## Historico anterior

# v1.2.615-catalogo-familias-cores

Data: 12/10/2026. Branch: main. Tag: v1.2.615-catalogo-familias-cores.
Release: /var/www/mdv-site/releases/20261012-214845-catalogo-familias-cores.

Card publico usa a foto do pai sem cor selecionada e a foto da cor ao selecionar; segundo clique desmarca. Cor aparece apenas no seletor. Painel recebe resumo disponivel por memoria e lista de cores, com lapis em cada variacao. Previa local encaminha a sessao administrativa sem compartilhar autenticacao entre requisicoes.

Poco X8 e Poco C85 organizados em pais unicos; nome PC858256R corrigido para Poco C85. Historicos, precos e unidades preservados. Publicacao somente do site; sem deploy ou restart da API.

## Historico anterior

# v1.2.614-familia-note14s

Data: 12/10/2026. Branch: main. Tag: v1.2.614-familia-note14s.
Release: /var/www/mdv-site/releases/20261012-201156-familia-note14s.

Pai generico unico do Redmi Note 14S, quatro variacoes ativas e galeria coerente com a variacao selecionada.
15 unidades e historicos preservados; tres duplicados inativos. Pai com foto e video proprios, variações com mídias próprias. Sem restart da API.

## Historico anterior

# v1.2.613-modelos-midias-openai-payjoy

Data: 12/10/2026. Branch: main. Tag: v1.2.613-modelos-midias-openai-payjoy.
Release: /var/www/mdv-site/releases/20261012-193852-modelos-midias-openai-payjoy.

Midias do pai no modelo, custos oficiais OpenAI e aprovacao PayJoy com leitura de print e calculo da entrada.

API seletiva para financeiro; PayJoy ja ativo. Testes e build aprovados. Fechamento na nota da versao.

## Historico anterior

# v1.2.612-estoque-relatorio

Data: 12/10/2026. Branch: main. Tag: v1.2.612-estoque-relatorio.
Release MDV: /var/www/mdv-site/releases/20261012-163430-estoque-relatorio.

Gestao de Estoque recebe filtros responsivos, campos mais largos, resumo geral recolhivel e area de impressao com escolha explicita Sem valores / Com valores. Relatorio por categoria e subcategorias apresenta estoque disponivel, seriais, IMEI 1/2 e marcacao de conferencia; custos e venda a vista sao opcionais.

Consulta usa historico de unidades da VPS para status e quantidades serializadas, preserva legado e pagina todos os produtos. Compra usa custo da unidade com fallback ao produto; media ponderada por produto/variacao considera unidades disponiveis com custo informado. Venda usa preco efetivo de varejo com promocao ativa.

Testes focados, guardas do inventario, sintaxe e build aprovados. Layout verificado em desktop e celular sem transbordamento; filtro real Smartphones + Disponivel + estoque positivo encontra 53 produtos/variacoes. Deploy apenas do site; nenhuma gravacao de estoque, preco ou venda. Fechamento na nota da versao.

Publicacao concluida: commit funcional d0d2fc12 e tag enviados a main; release ativa e VERSION.json publico conferidos. Catalogo real renderizado sem erro fatal, login admin carregado e chunk de estoque com layout/relatorio correto. API saudavel, mysql.ok=true, sem restart. Auditoria e limpeza: 0 removidos, 34 bloqueados preservados e listados na nota; seis arquivos preexistentes fora do escopo. Evidencias em .local, logs no TEMP.

## Historico anterior

# v1.2.611-parcelamento-via-boleto

Data: 12/10/2026. Branch: main. Tag: v1.2.611-parcelamento-via-boleto.
Release MDV: /var/www/mdv-site/releases/20261012-154150-parcelamento-via-boleto.

Perguntas gerais de parcelamento apresentam cartao ate 12x e Via Boleto: financiamento de celulares PayJoy, com boleto ou Pix e condicoes conforme proposta apos analise. Oferta do link grava awaiting_link_confirmation; somente confirmacao envia o link e agenda analysis_check. Perguntas especificas sobre cartao preservam a resposta existente.

Patch restrito a Pagamento - Politica no workflow SkrkB4vyKVDnQ68t. Preserva confirmacao PayJoy, prioridade de usados, conexoes e demais nos. Publicacao reutiliza o mutador existente com --installment-options; backup, verificacao de drift, entidade/historico ativo e retomada dos servicos.

Validacoes: testes focados sobre export ativo, confirmacoes/negativas, URL oficial, limites da proposta, cartao especifico e isolamento; dry-run remoto e sintaxe dos entrypoints aprovados. Publicacao e verificacoes finais registradas na nota da entrega.

Site recebe a versao; API e site 3DMV sem deploy. Nenhuma mensagem de teste enviada ao cliente.

Publicacao concluida: commit funcional 0c0d5232 e tag enviados; workflow atualizado e alinhado, servicos 1/1 e healthz HTTP 200. Site ativo no release registrado, VERSION.json correto e catalogo real renderizado sem erro fatal. API saudavel, mysql.ok=true. Auditoria e limpeza: 0 removidos, 34 bloqueadas preservadas e detalhadas na nota; somente seis preexistentes fora do escopo.

## Historico anterior

# v1.2.610-custo-final-unidade

Data: 11/10/2026. Branch: main. Tag: v1.2.610-custo-final-unidade.
Release MDV: /var/www/mdv-site/releases/20261011-232624-custo-final-unidade.
Status: publicada e validada. Commit: 184122f1.

Resumo do cadastro 3D apresenta um unico campo destacado: Custo final por unidade. Usa minimumUnitSaleCents do calculador canonico, incluindo filamento, energia, maquina, mao de obra, insumos, custos fixos e imposto informado, rateados pelos produtos completos. Trata-se do minimo para cobrir custos e imposto, sem margem de lucro; o imposto e estimado sobre esse minimo. Nao altera preco de venda nem o custo de producao gravado no produto.

Detalhamento do calculo fica recolhido abaixo do campo. Quando existe tempo de impressao mas falta tarifa de energia ou potencia, mostra Aguardando energia, sem apresentar o parcial como custo final. Mostra a orientacao para completar o campo faltante; zero nao e substituido por tarifa inventada.

Escopo: componente do cadastro e protecao regressiva. Sem mudanca na API, dados, arquivos, formulas ou tarifas salvas.

Validacoes: 20 testes focados passaram, incluindo renderizacao real do editor com todos os custos, imposto zero/positivo e energia pendente. Previa local confirmou valor unitario R$ 0,54 para exemplo de 24 unidades, 3h48 e tarifa R$ 1,00/kWh. Build local aprovado. Build versionado e verificacao publica seguem no fechamento.

Arquivos da entrega:
- components/products/Print3dRegistrationEditor.tsx
- tmp-tests/print3d-registration.test.mjs
- public/VERSION.json
- VERSAO_ATUAL.md
- docs/versoes/2026-10-11-v1.2.610-custo-final-unidade.md

## Fechamento da publicacao

Publicado e validado em 11/10/2026. Commit de codigo: 184122f1. Tag v1.2.610-custo-final-unidade enviada ao origin; main sincronizada. Site ativo: /var/www/mdv-site/releases/20261011-232624-custo-final-unidade. API e site 3DMV nao publicados nem reiniciados.

20 testes focados aprovados antes da publicacao; build versionado e build oficial do deploy aprovados. Guardas de runtime sem Supabase e rotas aprovadas; nenhum rastro de Supabase no bundle. Home e novo cadastro HTTP 200; VERSION.json confere versao e release. API /status saudavel, mysql.ok=true.

Navegador autenticado confirmou o rascunho existente Mini Esqueleto, com tarifa R$ 1,00/kWh ja salva pelo operador: custo final R$ 0,54 por unidade para 24 produtos, incluindo imposto informado de 6%. Detalhamento confirmou R$ 11,96 de producao, R$ 0,77 de imposto e R$ 12,73 de lote. Remover a tarifa apenas no formulario temporario mostrou Aguardando energia; valor original restaurado e tela fechada sem salvar. Nao foram alterados registros, arquivos ou tarifas no banco. Evidencia: .local/publish-610-final-unit-cost.png.

Sem erro fatal de console; aviso preexistente de companyContext usa ID padrao VPS. Avisos de Browserslist e tempos de plugins nao impediram build. Helper de credenciais Git nao impediu push. Skill publish-vps seguida sem alterar seus arquivos. Logs temporarios removidos ao concluir; evidencia de producao e previa local mantidas.

Preexistentes preservados fora do commit: docs/print3d-production.md, scripts/shopee-auto-print.cjs, docs/operacional/2026-10-07-shopee-glaucia-impressao-lenovo.md, scripts/prepare-shopee-personal-account-update.cjs, tmp-tests/fixtures/print3d-plate-ui.stl e tmp-tests/shopee-personal-account-update.test.cjs.

Auditoria e limpeza obrigatorias: 0 candidatos, 0 removidos; 34 worktrees bloqueadas preservadas:
- C:/tmp/mdv-model-fix-clean — dirty
- C:/tmp/mdv-phone-filter — dirty
- C:/tmp/mdv-publish-surgical-20260612-b — dirty
- C:/tmp/mdv-refactor-repair-20260612 — dirty
- C:/tmp/mdv-virtual-ram-deploy — dirty
- C:/Users/Nitro/Documents/Codex/2026-10-02/task/ml-local-preview — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-phone-memory-filter-20260801 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-price-followup-20260716 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-product-search-specialist-20260725 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-remove-generic-freight-example-20260718 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/sale-message-order-number-20260716 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mdv-perf-main — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-admin-app — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-displays-pix — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-sales-push-20260728 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-integrate — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-reformulation — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/meta-smartphones-sem-preco-20260825 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/new-model-regressions — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdp-model-shortcut-publish — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdv-sale-repair-publish — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-autoresponder-editable — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-family-page-jump — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-receipt-private-payment-20260613 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-sales-summary-20260613 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-whatsapp-order — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/repair-refactor-product-build — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/signed-warranty-synology — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/system-backup-admin-20260613 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-bulk-release-20260727 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-shop-foundation — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-n8n-context-handoff-fix — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-publish-novo-bot — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-status-contacts-fix — dirty

## Historico anterior

# v1.2.609-rascunhos-json

Data: 11/10/2026. Branch: main. Tag: v1.2.609-rascunhos-json.
Release MDV: /var/www/mdv-site/releases/20261011-231242-rascunhos-json.
Status: publicada e validada. Commit: e9241ac3.

Correcao da lista administrativa de rascunhos: mysql2 ja interpreta colunas do tipo JSON retornadas por JSON_EXTRACT. O endpoint tentava JSON.parse novamente sobre UUID, titulo e datas simples, causando HTTP 500. A consulta leve agora projeta os oito campos como CHAR, mantendo a serializacao JSON ate a unica decodificacao. Titulos parecidos com JSON preservam seu tipo e conteudo; revisao e flags preservam numero/booleano/null.

O teste antigo simulava somente strings JSON serializadas; o fixture agora reproduz a decodificacao automatica real do driver, e o teste novo falha antes da correcao. Inclui UUID, datas, titulos numericos, true, null, aspas, listas, Unicode e booleanos ausentes/falsos. Nao retorna snapshots na lista.

Publisher seletivo aceita a baseline revisada do modulo de rascunhos da release v1.2.607, a versao atual ou instalacao ausente. Rejeita drift desconhecido; preflight e repeticao testados. Preserva entrypoints remotos e integracoes, com backup, sintaxe, rollback e healthcheck pelo fluxo oficial.

Escopo: modulo autenticado de rascunhos e publisher; site atualizado para a versao. Nenhuma gravacao ou migration no banco, arquivo de rascunho ou flag de producao. Rascunhos existentes preservados.

Validacoes locais: 38 testes focados de rascunhos, publisher, familia e cadastro 3D; sintaxe dos servidores, modulo e publisher. Build e verificacao publica seguem no fechamento.

Arquivos da entrega:
- services/productFormDraftsServer.cjs
- scripts/deploy-product-registration.cjs
- tmp-tests/product-form-drafts.test.cjs
- tmp-tests/deploy-product-registration.test.cjs
- public/VERSION.json
- VERSAO_ATUAL.md
- docs/versoes/2026-10-11-v1.2.609-rascunhos-json.md

## Fechamento da publicacao

Publicado e validado em 11/10/2026. Commit: e9241ac3. Tag v1.2.609-rascunhos-json enviada ao origin; main sincronizada. Site ativo: /var/www/mdv-site/releases/20261011-231242-rascunhos-json. Site 3DMV preservado.

API publicada seletivamente: somente services/productFormDraftsServer.cjs mudou no runtime. mdv-api reiniciada com healthcheck aprovado. Backup: /var/www/mdv-api/backups/product-form-drafts-1791760478300. Nenhum entrypoint remoto, migration, flag, banco ou arquivo privado alterado. API /status HTTP 200 com mysql.ok=true; lista anonima HTTP 401.

Lista autenticada foi conferida antes com o erro 500 e depois com o rascunho existente disponivel para continuar. Novo reload confirmou versao 609, card Mini Esqueleto com a mesma data de atualizacao e nenhum erro ou aviso de console. Sem salvar, arquivar ou excluir registros. Evidencia: .local/publish-609-drafts.png.

38 testes focados passaram; testes novos reproduziram falha antes do ajuste. Sintaxe, preflight seletivo, build local e build do deploy aprovados. Home HTTP 200 e VERSION.json correspondente. Guardas de runtime sem Supabase e rotas aprovadas; nenhum rastro de Supabase no bundle. Avisos conhecidos: Browserslist e tempos de plugins sem falha; helper de credenciais Git nao impediu push.

Autoajuste operacional aplicado no publisher do repositorio e seu teste: baseline revisada para atualizar modulo existente sem sobrescrever drift. Skill publish-vps executada sem modificar seus arquivos. Temporarios de build/deploy/auditoria removidos ao concluir; evidencia mantida.

Preexistentes preservados: docs/print3d-production.md, scripts/shopee-auto-print.cjs, docs/operacional/2026-10-07-shopee-glaucia-impressao-lenovo.md, scripts/prepare-shopee-personal-account-update.cjs, tmp-tests/fixtures/print3d-plate-ui.stl e tmp-tests/shopee-personal-account-update.test.cjs.

Auditoria e limpeza obrigatorias: 0 candidatos, 0 removidos; 34 worktrees bloqueadas preservadas:
- C:/tmp/mdv-model-fix-clean — dirty
- C:/tmp/mdv-phone-filter — dirty
- C:/tmp/mdv-publish-surgical-20260612-b — dirty
- C:/tmp/mdv-refactor-repair-20260612 — dirty
- C:/tmp/mdv-virtual-ram-deploy — dirty
- C:/Users/Nitro/Documents/Codex/2026-10-02/task/ml-local-preview — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-phone-memory-filter-20260801 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-price-followup-20260716 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-product-search-specialist-20260725 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-remove-generic-freight-example-20260718 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/sale-message-order-number-20260716 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mdv-perf-main — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-admin-app — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-displays-pix — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-sales-push-20260728 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-integrate — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-reformulation — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/meta-smartphones-sem-preco-20260825 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/new-model-regressions — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdp-model-shortcut-publish — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdv-sale-repair-publish — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-autoresponder-editable — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-family-page-jump — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-receipt-private-payment-20260613 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-sales-summary-20260613 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-whatsapp-order — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/repair-refactor-product-build — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/signed-warranty-synology — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/system-backup-admin-20260613 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-bulk-release-20260727 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-shop-foundation — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-n8n-context-handoff-fix — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-publish-novo-bot — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-status-contacts-fix — dirty

## Historico anterior

# v1.2.608-cadastro-3d-menus

Data: 11/10/2026. Branch: main. Tag: v1.2.608-cadastro-3d-menus.
Release MDV: /var/www/mdv-site/releases/20261011-230349-cadastro-3d-menus.
Status: publicada e validada em producao. Commit da release: de0753ee.

Cadastro 3D: impressoras sugeridas com Bambu Lab A1 preenchida, filamentos com amostras de cor e inclusao de novos IDs cadastrados, duracoes HH:MM inclusive acima de 24h, insumos editaveis por lote, custos fixos, imposto estimado e energia. A referencia editavel da A1 e 95 W medios para PLA em 220 V, conforme https://wiki.bambulab.com/en/a1/manual/faq. Consumo em kWh = W / 1000 x horas; custo usa a tarifa informada. Custos e consumos salvos continuam preservados. Copia do pai permanece independente.

Peso em kg com preenchimento de tres casas decimais ao digitar. Menus de produtos agrupados em Cadastro, Sites e vendas, Midia e impressao; abas do formulario em grade responsiva sem rolagem horizontal.

Catalogo solicita produtos compactos e invalida o cache anterior, mantendo informacoes comerciais dos cartoes. No preview local, filamentos centrais e pendentes sao combinados por ID sem alterar registros ou aprovacoes; esse servico e exclusivo do ambiente local.

Escopo: frontend/painel MDV e servico de preview local versionado. API e site 3DMV preservados; nenhum deploy de API, migration ou alteracao de flags.

Validacoes: 80 testes focados (cadastro, custos, rascunhos, familia, filamentos, medidas, menus e catalogo), suite money, sintaxe de localPrint3dFilaments.cjs e servidores existentes. Build e validacao de producao seguem no fechamento.

Arquivos da entrega:
- components/products/Print3dProductEntry.tsx
- components/products/Print3dRegistrationEditor.tsx
- components/products/ProductForm.tsx
- components/products/sections/ProductSpecifications.tsx
- pages/admin/products/ProductListPage.tsx
- services/catalogSectionsService.ts
- services/localPrint3dFilaments.cjs
- services/print3dRegistration.ts
- tmp-tests/catalog-public-image-fallback-static.test.mjs
- tmp-tests/catalog-public-regressions-static.test.mjs
- tmp-tests/catalog-sections-cache-validity.test.cjs
- tmp-tests/local-print3d-filaments.test.cjs
- tmp-tests/print3d-measurements.test.cjs
- tmp-tests/print3d-product-entry.test.cjs
- tmp-tests/print3d-product-specifications-render.test.cjs
- tmp-tests/print3d-registration.test.mjs
- tmp-tests/product-create-feedback.test.cjs
- tmp-tests/product-list-actions.test.cjs
- utils/print3dMeasurements.js
- public/VERSION.json
- VERSAO_ATUAL.md
- docs/versoes/2026-10-11-v1.2.608-cadastro-3d-menus.md

## Fechamento da publicacao

Publicado e validado em 11/10/2026. Commit de codigo: de0753ee. Tag v1.2.608-cadastro-3d-menus enviada ao origin; main sincronizada. Release ativa: /var/www/mdv-site/releases/20261011-230349-cadastro-3d-menus. Site 3DMV preservado.

80 testes focados e suite money aprovados; build de validacao e build oficial do deploy aprovados. Guardas de runtime sem Supabase e rotas Nginx aprovadas; bundle sem dependencia Supabase. Home, produtos e novo cadastro 3D HTTP 200; VERSION.json confere a versao e release. API nao publicada nem reiniciada; /status HTTP 200 com mysql.ok=true.

Navegador integrado autenticado confirmou catalogo com produtos reais, os tres grupos do menu, grade de abas com scrollWidth=clientWidth=927, A1 preenchida, 95 W, duracoes HH:MM, energia, imposto e insumos. Lista de filamentos de producao mostrou os sete cadastrados com cores. Sem erros de console; aviso preexistente de companyContext usa ID padrao VPS. Nao foram gravados produtos, rascunhos ou uploads de teste.

Avisos conhecidos: Browserslist desatualizado e tempos de plugins, sem falha no build. Helper local de credenciais Git nao impediu push. Skill publish-vps executada sem alteracao. Evidencias mantidas em .local/publish-608-production.png e .local/publish-608-parameters.png. Logs temporarios desta publicacao removidos ao concluir.

Preexistentes preservados fora do commit: docs/print3d-production.md, scripts/shopee-auto-print.cjs, docs/operacional/2026-10-07-shopee-glaucia-impressao-lenovo.md, scripts/prepare-shopee-personal-account-update.cjs, tmp-tests/fixtures/print3d-plate-ui.stl e tmp-tests/shopee-personal-account-update.test.cjs.

Auditoria e limpeza obrigatorias: 0 candidatos, 0 removidos; 34 worktrees bloqueadas preservadas:
- C:/tmp/mdv-model-fix-clean — dirty
- C:/tmp/mdv-phone-filter — dirty
- C:/tmp/mdv-publish-surgical-20260612-b — dirty
- C:/tmp/mdv-refactor-repair-20260612 — dirty
- C:/tmp/mdv-virtual-ram-deploy — dirty
- C:/Users/Nitro/Documents/Codex/2026-10-02/task/ml-local-preview — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-phone-memory-filter-20260801 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-price-followup-20260716 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-product-search-specialist-20260725 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-remove-generic-freight-example-20260718 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/sale-message-order-number-20260716 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mdv-perf-main — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-admin-app — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-displays-pix — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-sales-push-20260728 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-integrate — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-reformulation — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/meta-smartphones-sem-preco-20260825 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/new-model-regressions — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdp-model-shortcut-publish — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdv-sale-repair-publish — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-autoresponder-editable — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-family-page-jump — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-receipt-private-payment-20260613 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-sales-summary-20260613 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-whatsapp-order — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/repair-refactor-product-build — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/signed-warranty-synology — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/system-backup-admin-20260613 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-bulk-release-20260727 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-shop-foundation — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-n8n-context-handoff-fix — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-publish-novo-bot — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-status-contacts-fix — dirty


## Historico anterior

# v1.2.607-rascunhos-placas-precos

Data: 11/10/2026. Branch: main. Tag: v1.2.607-rascunhos-placas-precos.
Release MDV: /var/www/mdv-site/releases/20261011-214056-rascunhos-placas-precos.
Status: publicada e validada em producao. Commit da release: 3b0d49bc.

Rascunhos compartilhados do cadastro incompleto de produtos, com lista para continuar em qualquer computador e controle de revisao contra sobrescrita concorrente. Salvar rascunho preserva formulario, variacoes, arquivos e parametros sem criar produto ou estoque. Concluir e arquivar preservam o registro privado.

Cadastro 3D com Arquivos e URL, Parametros e placas e Precos. Custo por produto completo vem do calculo canonico, em centavos. O operador informa os precos de venda. Copiar a base privada do pai cria configuracoes independentes nos filhos, preservadas inclusive na edicao detalhada da variacao. Variacoes continuam na ultima etapa e a familia e salva junta.

API seletiva: modulo de rascunhos e gancho autenticado nos entrypoints remotos, com backup, verificacao de sintaxe, rollback e healthcheck. Sem migrations nem mudancas nas flags de producao 3D. JSON usa admin_preferences existente; arquivos privados em /var/www/mdv-api/private/product-form-drafts. O backup integral existente da API inclui essa pasta e o backup MySQL inclui admin_preferences. Deploys preservam o diretorio.

Escopo: painel/site MDV e API. Site 3DMV e trabalhos preexistentes de Shopee e documentacao/fixture nao entram nesta publicacao.

Validacoes locais: 37 testes focados, suite money, sintaxe dos servidores, diff sem erros. Build e verificacao publica seguem no registro de fechamento abaixo.

Arquivos da entrega:
- components/products/Print3dRegistrationEditor.tsx
- components/products/ProductFamilyEditor.tsx
- components/products/ProductForm.tsx
- components/products/sections/ProductPricing.tsx
- deploy-vps-server-only.cjs
- docs/operacional/rascunhos-cadastro-produtos.md
- docs/print3d-production.md
- infra/nginx/mdv-site-production.conf
- infra/nginx/mdv-site-staging.conf
- layouts/AdminLayout.tsx
- pages/admin/products/ProductDraftsPage.tsx
- pages/admin/products/ProductFormPage.tsx
- pages/admin/products/ProductListPage.tsx
- routes/index.tsx
- scripts/deploy-product-registration.cjs
- services/print3dRegistration.ts
- services/productFormDrafts.ts
- services/productFormDraftsServer.cjs
- tmp-tests/deploy-product-registration.test.cjs
- tmp-tests/family-registration.test.mjs
- tmp-tests/print3d-registration.test.mjs
- tmp-tests/product-create-feedback.test.cjs
- tmp-tests/product-form-drafts.test.cjs
- tmp-tests/product-form-serialized-units-static.test.mjs
- vps_server.cjs
- public/VERSION.json
- VERSAO_ATUAL.md
- docs/versoes/2026-10-11-v1.2.607-rascunhos-placas-precos.md

## Fechamento da publicacao

Publicado e validado em 11/10/2026. Commit da release: 3b0d49bc. Tag v1.2.607-rascunhos-placas-precos enviada ao origin; main sincronizada.

API seletiva reiniciada; backup de recuperacao: /var/www/mdv-api/backups/product-form-drafts-1791755040721. Status HTTP 200 com mysql.ok=true; rascunhos anonimos HTTP 401. Nenhuma migration ou flag alterada. Site completo publicado na release acima; home e lista de rascunhos HTTP 200, VERSION.json confere. As rotas Nginx ativas ja abrangem /admin/products/drafts pelo padrao de produtos; nao foi necessario recarregar Nginx.

Chrome autenticado conferiu lista de rascunhos sem falhas, abas Arquivos e URL, Parametros e placas, Precos e Variacoes por ultimo, base do pai e arquivos por placa. Sem gravar produtos, rascunhos ou uploads de teste em producao. Edicao independente, custos e retomada com arquivos foram verificados localmente. Sem erro de console; aviso preexistente de companyContext usa ID padrao VPS. Build: aviso Browserslist desatualizado, sem falha; guardas de runtime/editor aprovadas. Aviso local do helper de credenciais Git nao impediu push do commit/tag. Publicacao executada pela skill publish-vps; sem atualizacao da skill.

Temporarios de build/deploy/auditoria removidos; evidencia de tela mantida em .local/publish-607-production.png. Alteracoes preexistentes preservadas: docs/print3d-production.md (somente os novos paragrafos desta entrega foram stageados), scripts/shopee-auto-print.cjs, docs/operacional/2026-10-07-shopee-glaucia-impressao-lenovo.md, scripts/prepare-shopee-personal-account-update.cjs, tmp-tests/fixtures/print3d-plate-ui.stl e tmp-tests/shopee-personal-account-update.test.cjs.

Auditoria obrigatoria: 0 candidatos, 0 removidos e 34 worktrees bloqueadas preservadas:
- C:/tmp/mdv-model-fix-clean — dirty
- C:/tmp/mdv-phone-filter — dirty
- C:/tmp/mdv-publish-surgical-20260612-b — dirty
- C:/tmp/mdv-refactor-repair-20260612 — dirty
- C:/tmp/mdv-virtual-ram-deploy — dirty
- C:/Users/Nitro/Documents/Codex/2026-10-02/task/ml-local-preview — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-phone-memory-filter-20260801 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-price-followup-20260716 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-product-search-specialist-20260725 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-remove-generic-freight-example-20260718 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/sale-message-order-number-20260716 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mdv-perf-main — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-admin-app — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-displays-pix — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-sales-push-20260728 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-integrate — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-reformulation — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/meta-smartphones-sem-preco-20260825 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/new-model-regressions — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdp-model-shortcut-publish — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdv-sale-repair-publish — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-autoresponder-editable — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-family-page-jump — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-receipt-private-payment-20260613 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-sales-summary-20260613 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-whatsapp-order — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/repair-refactor-product-build — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/signed-warranty-synology — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/system-backup-admin-20260613 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-bulk-release-20260727 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-shop-foundation — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-n8n-context-handoff-fix — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-publish-novo-bot — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-status-contacts-fix — dirty

## Historico

# v1.2.606-variacoes-ultima-etapa

Data: 11/10/2026. Branch: main. Tag: v1.2.606-variacoes-ultima-etapa.
Release MDV: /var/www/mdv-site/releases/20261011-204442-variacoes-ultima-etapa.
Status: publicada e validada em produção. Commit da release: a922f922.

Variações como última aba, depois do cadastro completo do pai e dos dados fiscais. Fotos, descrição e canais do pai vêm antes. Os arquivos de produção dos filhos ficam junto das variações. O botão Salvar família e variações mantém o salvamento conjunto existente, sem exigir cadastro prévio do pai. Produtos simples e filhos avulsos mantêm suas abas de produção, estoque e preços.

Seletor de cores dos produtos filtrável, com amostra antes do nome tanto na lista como na seleção. RGB personalizado e quadriculado das cores translúcidas preservados. O campo continua gravando o nome cadastrado; atualização com falha mantém a lista anterior e permite nova tentativa. Clique no campo ainda focado reabre as opções.

Publicação exclusiva do painel/site MDV. API, dados comerciais e site 3DMV permanecem na release anterior. Seis arquivos preexistentes de Shopee/documentação/fixture ficam fora do escopo.

Validações: 45 testes focados aprovados, incluindo navegação do pai com/sem 3D, filhos avulsos, salvamento/retry da família, amostras de cores, teclado e atualização. 45 testes e build aprovados, com guardas de Supabase e do editor alcançável. Site e cadastro HTTP 200, VERSION.json correspondente à release, API saudável com mysql.ok=true sem reinício. Chrome autenticado confirmou a última aba e as amostras reais das cores, sem salvar produtos ou arquivos e sem erros de console. Aviso preexistente de contexto da empresa usa o ID padrão VPS. Browserslist desatualizado é aviso do build. Main sincronizada; seis alterações preexistentes fora do escopo preservadas. Auditoria: zero resíduos removidos e 34 worktrees bloqueadas preservadas, listadas na nota desta versão. Nenhuma mudança na skill foi necessária.

Arquivos da entrega:
- components/products/ProductForm.tsx
- components/products/selectors/ColorSelect.tsx
- components/ui/SearchableSelect.tsx
- tmp-tests/filament-color-select.test.mjs
- tmp-tests/product-create-feedback.test.cjs
- public/VERSION.json
- VERSAO_ATUAL.md
- docs/versoes/2026-10-11-v1.2.606-variacoes-ultima-etapa.md

## Histórico

# v1.2.605-cadastro-variacoes

Data: 11/10/2026. Branch: main. Tag: v1.2.605-cadastro-variacoes.
Release MDV: /var/www/mdv-site/releases/20261011-195330-cadastro-variacoes.
Release 3DMV: /var/www/print3d-site/releases/20261011-195330-cadastro-variacoes.
Status: publicada e validada em producao. Commit da release: 9b28cdde.

Cadastro de familias e variacoes na mesma tela: atributos, SKU complementar imutavel, EAN proprio, fotos/video com envio ao Synology e campos individuais ou herdados. Capa do pai com fallback de filho para familias antigas. Descricao HTML resolvida pela API nos dois sites, preservando o valor original no editor.

Fichas privadas por SKU/revisao, lote com varias placas, consumo e tempo por placa, custos em centavos, anexos e link de origem. Ativacao autorizada apenas de MDV_PRINT3D_RECIPES_ENABLED; pedidos, pagamentos e producao automatica permanecem desligados. Schema existente, sem migration ou gravacao comercial de teste.

171 testes focados/regressivos e guardas aprovados, alem de money e filtro admin TypeScript. Builds isolados, deploy seletivo, status autenticados e Chrome de producao conferidos. Ambos VERSION.json correspondem a esta release; API com mysql.ok=true. Defesa adicional exige o editor de variacoes no bundle realmente alcancavel. Alteracoes Shopee e documento/fixture preexistentes fora do escopo.

Fichas e arquivos privados habilitados; acesso anonimo retorna 401. Editor conferido com tres placas para dez produtos, sem salvar dados de teste. Upload real ao NAS nao executado nesta validacao. Checkout temporario limpo removido, recuperavel pelo commit; 34 worktrees bloqueados preservados. Main sincronizada com origin/main, com seis arquivos preexistentes fora do escopo mantidos.

Detalhes: docs/versoes/2026-10-11-v1.2.605-cadastro-variacoes.md.

## Historico

# v1.2.604-filamentos-amostras

Data: 11/10/2026. Branch: main. Tag: v1.2.604-filamentos-amostras.
Release: /var/www/mdv-site/releases/20261011-162111-filamentos-amostras.
Status: publicada e validada em producao. Commit da release: 387811d9.

Amostras antes dos nomes no seletor filtravel de cores dos filamentos, na lista e no valor selecionado. Cor simples e degrade de duas ou tres cores usam a mesma lista cadastrada e os tons personalizados. Contratos de estoque e custos preservados.

Publicacao exclusiva do painel/site MDV, com build isolado; sem API, migration, gravacao comercial ou aprovacao de rascunhos. Detalhes: docs/versoes/2026-10-11-v1.2.604-filamentos-amostras.md.

28 testes aprovados, build isolado e Chrome de producao conferidos. Checkout temporario removido; 76 alteracoes preexistentes e 34 worktrees bloqueados preservados.

## Historico

# v1.2.603-cores-translucidas

Data: 11/10/2026. Branch: main. Tag: v1.2.603-cores-translucidas.
Release: /var/www/mdv-site/releases/20261011-160009-cores-translucidas.
Status: publicada e validada. Commit/tag da release: 8f7b8864 / v1.2.603-cores-translucidas.

13 sugestoes de cores translucidas na paleta compartilhada, com amostra quadriculada. Hexadecimal do cadastro tem prioridade; tons personalizados e registros antigos preservados. Azul e Azul Translucido continuam identidades distintas no estoque. Sugestoes exigem cadastro explicito e nao geram registros automaticamente. Atualizacao de cores ignora cache antigo sem apagar a lista em caso de falha.

Publicacao exclusiva do painel/site MDV, sem API, migration, aprovacao de rascunhos ou gravacao comercial. Build isolado para nao incluir os outros trabalhos locais. Detalhes: docs/versoes/2026-10-11-v1.2.603-cores-translucidas.md.

28 testes e build isolado aprovados. Home/painel HTTP 200, VERSION.json correspondente e API com mysql.ok=true. Chrome autenticado confirmou as 13 sugestoes, Azul Translucido e tons personalizados, sem salvar testes ou erros de console. Checkout de publicacao removido; 34 worktrees antigas bloqueadas preservadas. Main sincronizada; 76 alteracoes preexistentes fora do escopo mantidas.

## Historico

# v1.2.602-filamentos-degrade

Data: 11/10/2026. Branch: main. Tag: v1.2.602-filamentos-degrade.
Release: /var/www/mdv-site/releases/20261011-153123-filamentos-degrade.
Status: publicada e validada. Commit/tag da release: 073abe71 / v1.2.602-filamentos-degrade.

Marca digitavel/filtrante e degrade de duas ou tres cores registradas lado a lado. Custo e estoque pertencem a combinacao completa; registros antigos preservados. Deploy seletivo de dois modulos da API antes do painel. Nenhum novo schema, ativacao da producao 3D ou aprovacao de rascunhos. Alteracoes preexistentes de produtos permanecem fora do escopo.

Detalhes: docs/versoes/2026-10-11-v1.2.602-filamentos-degrade.md.

36 testes e build isolado aprovados. API seletiva reiniciada, mysql.ok=true, estoque e movimentos intactos (hash conferido), sem migration ou aprovacao de rascunhos. Home/painel HTTP 200 e VERSION.json correspondente. Chrome autenticado confirmou marca filtrante, tres cores na mesma linha e amostra degrade, sem salvar teste e sem erros. Worktree temporaria desregistrada e junction removida; exclusao dos residuos fisicos bloqueada pela politica do ambiente. 34 antigas bloqueadas preservadas. Main sincronizada; alteracoes preexistentes fora do escopo.

## Historico

# v1.2.601-filamentos-estoque

Data: 11/10/2026. Branch: main. Tag: v1.2.601-filamentos-estoque.
Release MDV: /var/www/mdv-site/releases/20261011-120000-filamentos-estoque.
Status: publicada e validada em produção. Commit/tag da release: 9307703f / v1.2.601-filamentos-estoque.

Página própria Filamentos e estoque: marca/material/cor compartilhados, custo por kg, entrada com quantidade em kg, data e canal de compra; controles compactos −/+, cores sempre visíveis, baixa Usado e Desativar retirando o saldo. Resumo agrupado por material + cor entre marcas. Ledger preservado e reenvios idempotentes. Rascunhos locais só são enviados por aprovação explícita.

Migração 054 aditiva autorizada com backup e conferência de integridade. Flag MDV_PRINT3D_FILAMENT_STOCK_ENABLED independente; módulo completo de produção 3D permanece desligado. Publicação seletiva da API e build isolado, sem incluir as mudanças preexistentes de produtos, placas e Shopee.

49 testes aprovados (26 focados e 23 de estoque/produção existente), build do commit isolado, API online/mysql.ok=true, rota sem sessão 401, homepage e painel HTTP 200 e VERSION.json correto. Chrome confirmou listas reais, amostra da cor, entrada acima de 1 kg e campos data/canal, sem salvar cadastro de teste e sem erros de console. Backup SQL/env: /var/www/mdv-api/backups/print3d-filaments-1791730518173; backup código: /var/www/mdv-api/backups/print3d-filaments-code-1791730537723. Nginx recebeu somente a rota nova, com backup e nginx -t aprovado. Rascunhos não enviados. Auditoria removeu a worktree limpa desta publicação e preservou 34 antigas bloqueadas, listadas no registro da versão. Main sincronizada; mudanças preexistentes preservadas.

## Histórico

# v1.2.600-sku-nome-automatico

Data: 10/10/2026. Branch: main. Tag: v1.2.600-sku-nome-automatico.
Release MDV: /var/www/mdv-site/releases/20261010-211100-sku-nome-automatico.
Release 3DMV: /var/www/print3d-site/releases/20261010-211100-sku-nome-automatico.
Status: publicada e validada em produção. Commit da release: da63f435.

SKU automático para novos cadastros com campo vazio: quatro letras reconhecíveis e quatro números sequenciais por prefixo. Nome persistido em texto simples, por exemplo Vaso decorativo - VASO0003. Reserva de SKU na mesma conexão da transação; SKUs existentes e manuais preservados. Preview consulta o catálogo e os rascunhos locais, sem publicar ao salvar; aprovação recusada mantém o rascunho. Deploy API seletivo com backup, preservando drift remoto. 44 testes e guardas Bling/PDV aprovados. Quatro arquivos Shopee preexistentes fora do escopo.

Ambos os sites ativos com VERSION.json correto e HTTP 200; painel de cadastro renderizado no Chrome sem erros de console. API server.js online, mysql.ok=true; hash do módulo SKU instalado igual ao local e execução isolada confirmou nome/SKU sem gravação comercial. Backup API: /var/www/mdv-api/backups/product-auto-sku-1791677437608. Manutenção pública 3DMV preservada. Auditoria final: nenhum resíduo removido; 34 worktrees bloqueados preservados e listados no registro da versão. Main sincronizada com origin/main; somente as quatro alterações Shopee preexistentes permanecem.

## Histórico

# v1.2.599-medidas-3d-mm

Data: 10/10/2026. Branch: main. Tag: v1.2.599-medidas-3d-mm.
Release MDV: /var/www/mdv-site/releases/20261010-235533-medidas-3d-mm.
Release 3DMV: /var/www/print3d-site/releases/20261010-235533-medidas-3d-mm.
Status: publicada e validada em produção. Commit da release: b4f6faaa.

Altura, largura e profundidade em mm na aba Características e nos anúncios dos dois sites. Um único conjunto de medidas: dimensions em cm no contrato interno, convertido na interface; peso em kg. API pública envia as medidas existentes, sem duplicar campos ou alterar descrição do pai. Preview conserva rascunhos locais até aprovação. 40 testes e dois builds aprovados. Releases MDV e 3DMV ativas; ambos os domínios respondem 200 com VERSION.json correto. Dois módulos da API publicados seletivamente com backup; mdv-api online e mysql.ok=true. Navegador confirmou os quatro campos e prévia 35/20/12 mm sem salvar produto. Manutenção pública 3DMV mantida. Quatro arquivos Shopee preexistentes preservados. Auditoria: zero removidos, 34 bloqueados preservados (lista no registro desta versão).

## Histórico

# v1.2.598-atalho-categoria

Data: 10/10/2026. Branch: main. Tag: v1.2.598-atalho-categoria.
Release: /var/www/mdv-site/releases/20261010-233645-atalho-categoria.
Status: publicada e validada em produção. Commit da release: 9332d9ec.

Atalho + de categoria abre a página completa Nova Categoria em outra aba, preservando o produto em preenchimento. Removido o cadastro rápido antigo com formulário aninhado. Atualizar lista ignora cache; hierarquia e IDs preservados. Sete testes e build aprovados, homepage HTTP 200 e VERSION.json correto. Navegador confirmou clique, nova aba, nome/categoria preservados e ausência de erros de console. API não reiniciada; status saudável/mysql.ok=true. Nenhum produto ou categoria salvo. Quatro arquivos Shopee preexistentes fora da release. Auditoria: zero removidos, 34 bloqueados preservados (lista no registro desta versão).

## Histórico

# v1.2.597-materiais-3d

Data: 10/10/2026. Branch: main. Tag: v1.2.597-materiais-3d.
Release: /var/www/mdv-site/releases/20261010-232931-materiais-3d.
Status: publicada e validada em produção. Commit da release: a1647a47.

Cadastro compartilhado de 15 tipos de material e novas inclusões no campo Material. Nova rota /admin/print3d/material-types separada da rota existente /admin/print3d/materials (estoque de filamentos). Teste registra ambos os módulos Fastify juntos para impedir duplicidade de rota. Nenhum produto, SKU, preço ou estoque alterado.

24 testes aprovados (17 focados + 7 de produção existente), build sem runtime Supabase, homepage HTTP 200 e VERSION.json correto. API seletiva reiniciada; /status ok=true/mysql.ok=true e rota sem sessão retorna 401. Chrome confirmou 15 opções, seleção PLA e modal Novo material sem erros de console; nenhum produto ou material de teste salvo. Backup API: /var/www/mdv-api/backups/print3d-materials-1791675025682. Main sincronizada; quatro arquivos Shopee preexistentes preservados. Auditoria: zero removidos, 34 worktrees bloqueados preservados. Skill publish-vps atualizada com a lição de conflitos entre registradores de rota e validada.

## Histórico

# v1.2.596-materiais-3d

Data: 10/10/2026. Branch: main. Tag: v1.2.596-materiais-3d.
Release: /var/www/mdv-site/releases/20261010-232309-materiais-3d.
Status: substituída pela v1.2.597; API restaurada do backup após detectar conflito de rota.

Material nos produtos 3D passa a ser selecionável, com 15 tipos conhecidos e cadastro compartilhado de novos materiais. Fonte de verdade: API/MySQL em admin_preferences; valores legados preservados. Sem migration, alteração de SKU, estoque, preços ou produtos reais. API seletiva com backup, verificações de sintaxe e preservação de código remoto.

Validações: 16 testes focados; sintaxe dos servidores e preflight seletivo aprovados. Alterações Shopee preexistentes fora da release.

## Histórico

# v1.2.595-categorias-hierarquia

Data: 10/10/2026. Branch: main. Tag: v1.2.595-categorias-hierarquia.
Release: /var/www/mdv-site/releases/20261010-231129-categorias-hierarquia.
Status: publicada e validada em produção. Commit da release: a42fd9db.

Seletor de categoria no cadastro de produtos mostra grupos de categorias e subcategorias com caminho completo. A hierarquia vem de parent_id da API, sem alterar categorias, vínculos ou SKUs. Ordem cadastrada preservada. Relações legadas inválidas não escondem opções.

Validações: cinco testes de hierarquia, seis testes da entrada Produto 3D e build. Homepage HTTP 200, VERSION.json correto e API saudável com mysql.ok=true. Navegador confirmou 17 grupos, subcategorias em múltiplos níveis e seleção por ID preservado. Deploy apenas do painel, sem reiniciar API. Mudanças Shopee preexistentes fora do escopo. Auditoria: nenhum worktree removido; 34 bloqueados preservados.

## Histórico

# v1.2.594-produto-3d-entry

Data: 10/10/2026. Branch: main. Tag: v1.2.594-produto-3d-entry.
Release: /var/www/mdv-site/releases/20261010-230200-v12594-produto-3d-entry.
Status: publicada e validada em produção. Commit da release: 81e7b318.

Botão Produto 3D na lista central abre novo cadastro já marcado ou pesquisa o SKU existente para conferência. O cadastro central continua responsável pelo SKU. Após salvar uma variante vendável, o operador segue para ficha e arquivos; produtos pai seguem para suas variações. No localhost, a edição existente mantém o rascunho local.

Validação: seis testes de fluxo; sintaxe dos servidores; build sem runtime Supabase; homepage HTTP 200 e VERSION.json correto; API saudável com mysql.ok=true. Navegador confirmou cadastro novo com impressão 3D marcada e abertura do SKU SFKU3XMVB sem mudar seu identificador. Publicação somente do painel, sem reinício da API ou alteração de produtos reais. Auditoria: zero worktrees removidos, 34 bloqueados preservados (lista no registro desta versão). Alterações Shopee preexistentes preservadas fora da release.

## Histórico

# v1.2.593-phone-brands-dynamic

Data: 09/10/2026. Branch: main. Tag: v1.2.593-phone-brands-dynamic.
Release: /var/www/mdv-site/releases/20261009-203847-phone-brands-dynamic.
Status: publicada e validada em producao.

Gerador passa a oferecer Todas as marcas (automatico) e Marcas especificas a partir dos celulares elegiveis consultados na mesma fonte de estoque/precos. Receita automatica e preservada nas futuras geracoes; receitas legadas continuam especificas ate reparo explicito. Ocultos, pais, combos, vendidos e acessorios continuam excluidos. Bot com selecao explicita e calculos de preco permanecem compativeis.

Reparo autorizado: somente 22 ocorrencias futuras ainda nao geradas/iniciadas nos dois agendamentos conferidos; altera apenas recipe, com backup restrito, transacao e releitura. Horarios, canais e itens ja enviados preservados. Dry-run executado.

Validacao: 33 testes passaram e 1 opcional ignorado; guardas do calendario e sintaxe dos tres servidores passaram. Deploy API seletivo --dynamic-price-tables-only preserva personalizacoes remotas e recusa divergencia da baseline.

Quatro arquivos Shopee preexistentes fora do escopo.

Publicacao concluida: commit b3ac4c17 e tag enviados a main. API seletiva reiniciada e online; /status HTTP 200/mysql.ok=true. Site e VERSION.json HTTP 200. Preview autenticado real: 24 configuracoes, quatro marcas e quatro tabelas, incluindo Oukitel. Chrome apos reload sem cache renderizou catalogo real, complemento e Ver todos, sem erros de console.

22 ocorrencias futuras nos dois agendamentos conferidos foram alteradas transacionalmente para Todas as marcas. Releitura validada por ocorrencia; segunda execucao em dry-run encontrou zero legadas restantes. Nenhuma publicacao reenviada. Backup receitas: /var/www/mdv-api/backups/phone-brands-recipes-1791578537569.json. Backup API: /var/www/mdv-api/backups/phone-price-list-1791578481069.

Auditoria apply: 0 removidos; 34 bloqueados preservados.

## Historico

# v1.2.592-n8n-memoria

Data: 09/10/2026. Branch: main. Tag: v1.2.592-n8n-memoria.
Release: /var/www/mdv-site/releases/20261009-201153-n8n-memoria.
Status: publicada e validada em producao.

Rotas company-settings existentes recebem modo optativo view=bot com projecao SQL de horarios, endereco e Pix; nao leem imagens/templates/credenciais de integracao nesse modo. Modo padrao continua igual e sanitizacao publica permanece obrigatoria. Quatro chamadas do workflow ativo passam ao modo enxuto; conexoes, conversas e politicas preservadas. Heap do processo principal n8n passa de aproximadamente 4 GB para 6 GB mantendo os outros argumentos e limite de concorrencia 10/pool 10.

Publicacao concluida: b2632b14, 7f9dfcd0 e 4c740f6f enviados a main, com tag da versao e tag de guardas. Site e VERSION.json HTTP 200; API seletiva reiniciada, status ok=true/mysql.ok=true. Respostas reais privadas/publicas caem de 690552/346014 bytes para 1366/1396 bytes, com valores projetados iguais e auth 401 preservada. Quatro consultas do fluxo ativo atualizadas; main/runner 1/1, health/readiness 200, heap efetivo 6240 MiB. Seis execucoes naturais bem-sucedidas e zero erros fatais de memoria no intervalo inicial de 17:25:35 a 17:27:53. Causa exata do crescimento de memoria ainda nao isolada; validacao curta nao comprova estabilidade prolongada.

Testes de rotas, patch/CAS, replicas exatas, configuracoes de retirada e estoque, sintaxe, schema real e build passaram. Backups restritos com checksums validados; nenhuma conversa reexecutada. Primeira tentativa encontrou espera falsa por nomes semelhantes de servicos; bot restaurado antes da reaplicacao, sem escrita de workflow naquela tentativa. Auditoria apply preservou 34 worktrees bloqueados e removeu zero; quatro arquivos Shopee preexistentes fora do escopo. Runbooks n8n/publicacao atualizados e validados. Detalhes e todos os caminhos em docs/versoes/2026-10-09-v1.2.592-n8n-memoria.md.

## Release anterior: v1.2.591-bling-refresh-safe

Data: 09/10/2026. Branch: main. Tag: v1.2.591-bling-refresh-safe.
Release: /var/www/mdv-site/releases/20261009-193318-bling-refresh-safe.

Renovacao da API nao devolve token antigo apos falha HTTP/configuracao ou resposta invalida. Credenciais preservadas em erro; novo token usado apenas apos salvar. Deploy seletivo altera somente refreshBlingStoredAccessTokenVps e preserva outras customizacoes remotas.

Publicacao concluida: 413a0156 e tag enviados a main. 122 testes passaram; build e sintaxe API validados. API publicada seletivamente com backup e restart; status ok=true/mysql.ok=true. Site e VERSION.json HTTP 200. Handler remoto corresponde ao local e rejeita 503 simulado. Chrome confirmou catalogo real/complemento/Ver todos; 401 limitado a auth/me sem sessao. Sem renovacao real forcada. Auditoria apply: 0 removidos, 34 bloqueados preservados, listados na nota da versao. Quatro arquivos Shopee preexistentes preservados.

## Historico

# v1.2.590-operational-failures

Data: 09/10/2026. Branch: main. Tag: v1.2.590-operational-failures.
Release: /var/www/mdv-site/releases/20261009-185649-operational-failures.

PDV propaga falhas de consulta das unidades e limpa resultados anteriores. Confirmacao por foto exige salvamento bem-sucedido. Lista de campanhas WhatsApp carrega todas as paginas de 200 registros. Somente frontend; nenhum dado comercial alterado. Testes de falha reproduzidos antes da correcao e passando depois.

Publicacao concluida: fd7240bf e tag enviados a main; 79 testes centrais, suites de familias, precos, pagamentos e estoque passaram. Build sem runtime Supabase. Site e versao HTTP 200, API saudavel sem restart. Chrome confirmou PDV/busca, cadastro por foto, marketing, complemento e Ver todos; console sem erros. Bling confirmou leitura bem-sucedida, sem renovacao forcada. Auditoria apply: 0 removidos, 34 bloqueados preservados; caminhos/reasons na nota da versao. Quatro arquivos Shopee preexistentes preservados.

## Historico

# v1.2.589-system-regressions

Data: 09/10/2026. Branch: main. Tag: v1.2.589-system-regressions.
Release ativa: /var/www/mdv-site/releases/20261009-183823-system-regressions.

Painel preserva hide_from_catalog; falhas temporarias do Bling preservam credenciais e nunca devolvem token vencido; fallback de URLs exige identificacao exata e unica; complemento salvo atualiza pai, filhos e cache administrativo, inclusive com consulta antiga em andamento. Suite npm.cmd run test:regressions centraliza as protecoes. API e dados comerciais nao fazem parte do deploy.

Publicacao concluida: commit 7c6b9140 e tag enviados a main; 68 testes da suite e 9 complementares passaram. Build sem runtime Supabase; homepage e VERSION.json HTTP 200; API ok=true e mysql.ok=true sem restart. Chrome confirmou Sabor iPhone no painel apos reload e link do pai abrindo C17P6256L com imagem e R$ 1300,00; console sem erros. Renovacao Bling validada com transporte simulado, sem renovar credenciais reais. Auditoria apply: 0 removidos e 34 bloqueados (25 dirty, 9 not_merged_into_origin_main), detalhados na nota da versao. Quatro arquivos Shopee preexistentes preservados.

## Historico

# v1.2.588-admin-title-complement

Data: 08/10/2026. Branch: main. Tag: v1.2.588-admin-title-complement.
Release: /var/www/mdv-site/releases/20261009-000947-admin-title-complement.

O hook administrativo descartava catalog_title_complement e parent_catalog_title_complement recebidos da API. Ambos agora sao preservados nos cards. Texto salvo no pai continua a fonte de verdade; nenhum dado foi regravado. API, consulta publica, precos e documentos permanecem intactos.

Testes do complemento, paginacao, busca serializada e cards de familia passaram. Build e publicacao pelo script oficial concluidos. Chrome confirmou Sabor iPhone no campo do C17 Plus apos reload e console sem erros. Commit baa22fd0 e tag enviados a main. API nao reiniciada. Auditoria: 0 removidos, 34 bloqueados (25 dirty, 9 not_merged_into_origin_main), caminhos registrados na nota da versao. Quatro arquivos preexistentes Shopee preservados.

## Historico

# v1.2.587-public-family-variation

Data: 08/10/2026. Branch: main. Tag: v1.2.587-public-family-variation.
Release: /var/www/mdv-site/releases/20261008-234548-public-family-variation.

Pagina publica usa o resolvedor publico para UUIDs e slugs; o pai e excluido antes do agrupamento de variacoes e nunca renderiza preco zero como opcao Padrao. Links antigos do pai com SKU tambem resolvem um filho publico. Filhos ocultos/inativos nao sao escolhidos. Painel continua acessando o pai por ID interno; nenhum dado comercial foi alterado.

14 testes focados, rotas publicas, SEO Fastify e estoque PDV passaram. Publicacao e validacao final concluidas; deploy seletivo preservou codigo remoto. Quatro arquivos preexistentes Shopee preservados fora do escopo.

## Publicacao validada

Commit c8eefe86 e tag v1.2.587-public-family-variation enviados a main. API publicada seletivamente com backup /var/www/mdv-api/backups/parent-public-link-1791503239385; restart mdv-api concluido; status ok=true e mysql.ok=true. Site ativo /var/www/mdv-site/releases/20261008-234548-public-family-variation; homepage HTTP 200 e VERSION.json correspondente. Build sem runtime Supabase.

Validacao sem credenciais: UUID, slug e endereco antigo com SKU do pai C17 resolvem o filho 10b2a984-c51a-45a6-8d41-5e0926dd1566, is_parent=0, preco 130000 centavos. Pais Poco X8 Pro e Redmi 17 tambem resolvem filhos com preco positivo. HTML do pai e endereco antigo retornam 200 com canonical do filho e sem oferta zero; UUID inexistente continua 410.

Chrome confirmou imagem, SKU C17P6256L e R$ 1300,00, apenas Laranja/Prata, sem opcao Padrao e sem erros no console. Troca para Prata e recarregamento mantiveram SKU C17P6256P e R$ 1300,00. Nenhum dado comercial alterado.

Worktrees: auditoria e apply concluido, 0 candidatos/0 removidos/34 bloqueados (25 dirty, 9 not_merged_into_origin_main). Quatro arquivos preexistentes Shopee preservados. Avisos CRLF, credential helper Git e timings do build nao impediram publicacao. Skill nao alterada.

Bloqueados preservados:
- C:/tmp/mdv-model-fix-clean — dirty
- C:/tmp/mdv-phone-filter — dirty
- C:/tmp/mdv-publish-surgical-20260612-b — dirty
- C:/tmp/mdv-refactor-repair-20260612 — dirty
- C:/tmp/mdv-virtual-ram-deploy — dirty
- C:/Users/Nitro/Documents/Codex/2026-10-02/task/ml-local-preview — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-phone-memory-filter-20260801 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-price-followup-20260716 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-product-search-specialist-20260725 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-remove-generic-freight-example-20260718 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/sale-message-order-number-20260716 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mdv-perf-main — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-admin-app — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-displays-pix — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-sales-push-20260728 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-integrate — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-reformulation — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/meta-smartphones-sem-preco-20260825 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/new-model-regressions — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdp-model-shortcut-publish — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdv-sale-repair-publish — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-autoresponder-editable — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-family-page-jump — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-receipt-private-payment-20260613 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-sales-summary-20260613 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-whatsapp-order — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/repair-refactor-product-build — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/signed-warranty-synology — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/system-backup-admin-20260613 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-bulk-release-20260727 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-shop-foundation — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-n8n-context-handoff-fix — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-publish-novo-bot — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-status-contacts-fix — dirty


## Registro anterior

# v1.2.586-parent-public-link

Data: 08/10/2026. Branch: main. Tag: v1.2.586-parent-public-link. Release: /var/www/mdv-site/releases/20261008-224025-parent-public-link.

Correcao geral da resolucao SEO de UUID/slug do pai: busca uma variacao publica elegivel, prioriza estoque e mantem rota canonica da variacao. O pai nao aparece como item vendavel separado. Produtos comuns e variacoes conservam precedencia; familias sem filhos elegiveis continuam indisponiveis. Nenhum cadastro comercial, estoque, preco ou schema foi alterado.

Deploy seletivo --parent-public-link-only insere apenas o fallback na funcao SEO dos servidores, com backup e rollback. Preflight detectou server.js remoto com resolver SEO mais rico ja existente; patch preserva essa implementacao, aceitando apenas os baselines verificados.

Validacoes: 10 testes, rotas publicas, SEO Fastify, guarda PDV e sintaxe. Publicacao e auditoria final pendentes de verificacao.

Arquivos:
- server.js
- vps_server.js
- vps_server.cjs
- deploy-vps-server-only.cjs
- scripts/deploy-parent-public-link.cjs
- tmp-tests/seo-parent-family.test.cjs
- public/VERSION.json
- VERSAO_ATUAL.md
- docs/versoes/2026-10-08-v1.2.586-parent-public-link.md

Arquivos Shopee preexistentes preservados fora do escopo.

## Publicacao validada

Commit 583b13be e tag v1.2.586-parent-public-link enviados a main. API publicada seletivamente; backup /var/www/mdv-api/backups/parent-public-link-1791499527265; restart mdv-api concluido, status ok=true e mysql.ok=true. Site ativo /var/www/mdv-site/releases/20261008-224025-parent-public-link, homepage HTTP 200, VERSION.json correspondente, build sem runtime Supabase.

URLs de tres pais (C17 Plus, Poco X8 Pro e Redmi 17) retornaram HTTP 200; UUID inexistente continua HTTP 410. Chrome confirmou o link reportado abrindo C17 Plus com Laranja e Prata; titulo e complemento do pai mantidos; sem erros no console. Nenhum dado comercial alterado.

Worktrees: 0 candidatos, 0 removidos, 34 bloqueados; {"dirty":25,"not_merged_into_origin_main":9}. Quatro arquivos preexistentes Shopee preservados. Skill nao alterada; modo seletivo especifico versionado no deploy oficial. Avisos conhecidos CRLF, Browserslist antigo e credential helper Git nao impediram publicacao.

Bloqueados preservados:
- C:/tmp/mdv-model-fix-clean — dirty
- C:/tmp/mdv-phone-filter — dirty
- C:/tmp/mdv-publish-surgical-20260612-b — dirty
- C:/tmp/mdv-refactor-repair-20260612 — dirty
- C:/tmp/mdv-virtual-ram-deploy — dirty
- C:/Users/Nitro/Documents/Codex/2026-10-02/task/ml-local-preview — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-phone-memory-filter-20260801 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-price-followup-20260716 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-product-search-specialist-20260725 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/n8n-remove-generic-freight-example-20260718 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/.worktrees/sale-message-order-number-20260716 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mdv-perf-main — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-admin-app — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-displays-pix — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/android-sales-push-20260728 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-integrate — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/autoresponder-reformulation — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/meta-smartphones-sem-preco-20260825 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/new-model-regressions — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdp-model-shortcut-publish — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/pdv-sale-repair-publish — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-autoresponder-editable — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-family-page-jump — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-receipt-private-payment-20260613 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-sales-summary-20260613 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/publish-whatsapp-order — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/repair-refactor-product-build — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/signed-warranty-synology — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/system-backup-admin-20260613 — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-bulk-release-20260727 — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale/.worktrees/tiktok-shop-foundation — not_merged_into_origin_main
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-n8n-context-handoff-fix — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-publish-novo-bot — dirty
- C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale-status-contacts-fix — dirty


Fechamento v1.2.613: commit 7cc7bf07 e tag em main, site/API publicados e validados. Custos oficiais autenticados, catalogo renderizado e n8n saudavel. Auditoria: zero removidos, 34 worktrees preservados; seis arquivos preexistentes fora do escopo. Detalhes na nota da versao.


Fechamento v1.2.614: commit 5b729077/tag em main, site publicado; preto validado com fotos proprias, videos em arquivos distintos e banco/MySQL saudavel. Auditoria preservou 34 worktrees e os seis preexistentes. Detalhes na nota desta versao.


Fechamento v1.2.615: commit funcional 86153590/tag enviados, site publicado e validado no catalogo e painel reais. API/MySQL saudaveis, sem restart. Auditoria: 0 removidos, 34 bloqueados preservados na nota; seis arquivos preexistentes fora do escopo.


Fechamento v1.2.616: commit 73758b95/tag enviados a main, site publicado e VERSION.json/catalogo real validados sem erro fatal. Workflow PayJoy ativo, API/MySQL e n8n saudaveis; sem novo restart. Limpeza: 0 removidos, 34 bloqueados preservados, listados na nota. Seis arquivos preexistentes fora do escopo.
