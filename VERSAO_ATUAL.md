# v1.2.572-protecao-precos

Data: 2026-10-07. Branch: main. Tag: v1.2.572-protecao-precos.
Release VPS: /var/www/mdv-site/releases/20261008-021538-protecao-precos
Status: publicada e validada em producao.

Consultas publicas de produtos removem custo e precos comerciais. Administrador autenticado conserva custo; contas comerciais autenticadas conservam revenda/atacado. Chave de transporte nao concede perfil comercial. Respostas privadas nao entram no cache anonimo; catalogo acompanha troca de sessao. API publicada seletivamente com backup, sem alteracoes de valores ou estoque. Detalhes em docs/versoes/2026-10-07-v1.2.572-protecao-precos.md.

Codigo f4917c0b e tag enviados a origin/main. API seletiva publicada com backup /var/www/mdv-api/backups/product-read-privacy-1791425875510 e reinicio mdv-api. Status HTTP 200 e mysql.ok=true. Lista, ID e slug anonimos, tanto API direta quanto proxy, omitem campos privados e enviam no-store; administrador autenticado conserva custo e precos comerciais. Site HTTP 200, VERSION exata, catalogo e ficha administrativa renderizados sem erros de console. Evidencia .local/protecao-precos-publicado.png. Auditoria/aplicacao de limpeza: zero remocoes, 34 worktrees bloqueadas preservadas (25 dirty, 9 not_merged_into_origin_main), lista no registro da versao. Main sincronizado, quatro arquivos Shopee preexistentes preservados. Deploy oficial agora inclui o modulo de privacidade e modo seletivo com backup; skill nao precisou de alteracao.

## Release anterior

# v1.2.571-banner-whatsapp

Data: 2026-10-07. Branch: main. Tag: v1.2.571-banner-whatsapp.
Release VPS: /var/www/mdv-site/releases/20261008-011734-banner-whatsapp
Status: publicada e validada em producao.

Formulario do banner oferece WhatsApp, numero da loja editavel, mensagem do cliente e link automatico. Telefone vem de company-settings; link e salvo no contrato externo existente, sem novo schema. Links wa.me/api.whatsapp.com recuperam numero e texto ao editar. Atalho para Quero um celular no boleto. Cliente precisa enviar a mensagem. Sem envio de WhatsApp, alteracao do bot ou deploy da API.

Testes de link com DDD 55, pais, mensagem com acentos/emoji/quebra de linha, rejeicao de numero invalido, parser de URL e corpo real do salvamento. Regressao de nome interno e imagens/links. Build com trava Supabase aprovado. Avisos conhecidos de fetchPriority no render React e Browserslist antigo nao bloqueiam validacao. Previa local isolada confirmou atualizacao automatica do link; nenhum banner real salvo.

Quatro arquivos preexistentes de impressao Shopee preservados fora do escopo.

Codigo f170670e e tag enviados a origin/main. Deploy oficial confirmou release ativa; home HTTP 200, VERSION exata. Navegador autenticado confirmou recuperacao do link existente no Banner Payjoy, WhatsApp selecionado, numero e mensagem corretos. Novo Banner carregou telefone do cadastro da empresa; atalho gerou URL com a mensagem esperada. Formulario cancelado, nenhum banner gravado e nenhuma mensagem enviada. Console sem erros. Evidencia: .local/banner-whatsapp-publicado.png. API sem deploy/restart. Auditoria/aplicacao segura: zero remocoes, 34 worktrees bloqueadas preservadas; lista abaixo. Main sincronizado; quatro arquivos preexistentes Shopee fora do escopo. Sem atualizacao da skill por nao haver nova licao operacional.

## Release anterior

# v1.2.570-banner-nome-interno

Data: 2026-10-07. Branch: main. Tag: v1.2.570-banner-nome-interno.
Release VPS: /var/www/mdv-site/releases/20261008-010747-banner-nome-interno
Status: publicada e validada em producao.

O nome obrigatorio identifica o banner no painel e continua como texto alternativo da imagem. Nao aparece sobre a arte, nem gera gradiente escuro. Previa segue a mesma regra. Texto sobre a imagem continua opcional. Links e dados dos banners preservados; somente frontend, sem deploy da API.

Validacoes: render real do formulario e carrossel, imagem sem titulo/gradiente quando texto opcional vazio; texto escolhido preservado. Regressoes de links, imagem responsiva e cor de fundo. Build com trava Supabase. Aviso preexistente de fetchPriority no render SSR React; nao bloqueia testes.

Quatro arquivos preexistentes de impressao Shopee fora do escopo.

Codigo 6d803f99 e tag enviados a origin/main. Deploy oficial confirmou release ativa; home HTTP 200 e VERSION exata. Navegador confirmou banners sem titulo sobreposto e formulario com Nome do banner (uso interno), sem erro de console. Formulario de teste cancelado sem criar ou editar banner. Evidencia: .local/banner-nome-interno-publicado.png. API nao publicada/reiniciada. Auditoria/aplicacao segura: zero remocoes, 34 worktrees bloqueadas preservadas; lista abaixo no registro da versao. Main sincronizado; quatro arquivos preexistentes Shopee preservados. Sem atualizacao de skill por nao haver nova licao operacional.

## Release anterior

# v1.2.569-secoes-publicas

Data: 2026-10-07. Branch: main. Tag: v1.2.569-secoes-publicas.
Release VPS: /var/www/mdv-site/releases/20261008-004437-secoes-publicas
Status: publicada e validada em producao.

Home le as secoes habilitadas do cadastro do painel via projecao publica sem user_id, respeitando ordem e filtros. Corrige Smartphones ausente porque a vitrine usava tres secoes fixas. Lista vazia respeitada; fallback padrao somente em falha.

Testes comportamentais de leitura e rota, acesso publico somente GET, patch seletivo idempotente, regressoes da area, sintaxe e build aprovados. Deploy do site e API seletivo; sem migration ou dados comerciais alterados. Detalhes e arquivos em docs/versoes/2026-10-07-v1.2.569-secoes-publicas.md. Quatro arquivos preexistentes Shopee fora do escopo.


Codigo ef6b5960 e tag enviados a origin/main. API publicada seletivamente com backup /var/www/mdv-api/backups/catalog-sections-1791420338538; mdv-api reiniciada e mysql.ok=true. Rota publica via proxy retornou Smartphones primeiro, filtro da categoria e limite 10. Site ativo na release registrada; home HTTP 200 e VERSION correspondente. Navegador sem login confirmou Smartphones antes de Mais Recentes, com dez cards de celulares. Evidencia: .local/secoes-smartphones-publicado.png. Logs nao fatais de fetchSafe GET sem detalhes observados durante carregamento; nao impediram renderizacao da secao. Nenhuma secao, produto, preco ou estoque alterado na validacao.

Auditoria/aplicacao segura: zero candidatos/remocoes, 34 worktrees bloqueadas preservadas. Main sincronizado; quatro arquivos preexistentes Shopee preservados. Sem atualizacao da skill por nao haver nova licao de publicacao.

## Release anterior: v1.2.568-secoes-responsavel

Data: 2026-10-07. Branch: main. Tag: v1.2.568-secoes-responsavel.
Release VPS: /var/www/mdv-site/releases/20261008-003037-secoes-responsavel
Status: publicada e validada tecnicamente em producao.

Corrige ER_NO_DEFAULT_FOR_FIELD ao criar secao: o service envia user_id da sessao VPS atual. O formulario nao define o responsavel; sessao ausente impede o POST e orienta novo login. Sem schema, migration ou mudanca da API.

Validacoes: teste do corpo real da criacao com transporte simulado, incluindo responsavel, filtros, cache e sessao ausente; regressoes de categorias e carregamento; build com trava Supabase. Publicacao somente do site. Quatro arquivos preexistentes de impressao Shopee preservados fora do commit.

Arquivos: services/catalogSectionsService.ts, tmp-tests/catalog-sections-service-vps-crud-static.test.mjs, public/VERSION.json, VERSAO_ATUAL.md, docs/versoes/2026-10-07-v1.2.568-secoes-responsavel.md.


Codigo 00f87edb e tag enviados a origin/main. Deploy atomico do site confirmou release ativa. Home, configuracao do catalogo e VERSION responderam HTTP 200; VERSION corresponde a v1.2.568-secoes-responsavel e ao caminho registrado. API existente mysql.ok=true, sem deploy/restart. Navegador autenticado carregou a aba Secoes com Mais Recentes, Destaques e Mais Vendidos; console observado sem erros. Nenhuma secao real foi criada ou reordenada na validacao: gravacao coberta pelo teste do corpo real com transporte simulado, pendente de conferencia de um salvamento real pelo operador.

Auditoria e aplicacao segura da limpeza: zero candidatos/remocoes; 34 worktrees bloqueadas preservadas (25 dirty, 9 not_merged_into_origin_main). Main sincronizado; quatro arquivos preexistentes da impressao Shopee preservados fora dos commits. Sem nova licao operacional para alterar a skill.

## Release anterior: v1.2.567-venda-payjoy-informativo

Data: 2026-10-07. Branch: main. Tag: v1.2.567-venda-payjoy-informativo.
Release VPS: /var/www/mdv-site/releases/20261007-194449-venda-payjoy-informativo
Status: publicada e validada em producao.

PDV permite marcar Venda via PayJoy, opcional e desmarcada inicialmente. Identificacao nas vendas, pesquisa, detalhes, previa/comprovante e historico do aparelho vendido. Gravada em sales.notes na API VPS/MySQL existente. Formas de pagamento, valores, taxas, estoque e financeiro permanecem iguais; nenhum schema ou integracao PayJoy. Deploy somente do site.

Validacoes: regressao do marcador e notas, igualdade de valores/totais e HTML real do recibo; agregador, servico de vendas, normalizacao monetaria, finalizacao, estoque e comprovantes. Sintaxe das entradas de servidor e build com trava Supabase. Detalhes em docs/versoes/2026-10-07-v1.2.567-venda-payjoy-informativo.md. Quatro arquivos preexistentes da impressao Shopee ficam fora desta entrega.

Codigo b08e66c1 e tag enviados a origin/main. Release ativa confirmada por SSH; home, PDV e VERSION HTTP 200 com versao correspondente. API existente mysql.ok=true, sem deploy/restart. Navegador: checkbox inicialmente false, marcacao exibe linha na previa sem alterar valores; desmarcada ao final, nenhuma venda criada ou impressao feita. Evidencia .local/payjoy-venda-publicada.png. Sem erro fatal; avisos de company_id e resumo do caixa HTTP 500 (coluna s.status ausente) registrados como pendencia em rota nao alterada. Auditoria/aplicacao segura preservou 34 worktrees bloqueadas (25 dirty, 9 not_merged_into_origin_main), zero candidatos/remocoes; lista no registro da versao. Main sincronizado, quatro arquivos Shopee preexistentes preservados.

## Release anterior: v1.2.566-catalogo-produto-exato

Data: 2026-10-07. Branch: main. Tag: v1.2.566-catalogo-produto-exato.
Release VPS: /var/www/mdv-site/releases/20261007-164237-catalogo-produto-exato
Status: publicada e validada em producao.

Clique no card resolve o ID da variacao selecionada antes de restaurar seu endereco legivel. Grupos filtrados podem omitir outras cores com o mesmo slug; isso nao pode abrir outro SKU. Busca por ID sem resultado nao usa fallback aproximado. API existente e dados comerciais preservados; deploy somente do site. Arquivos locais da impressao Shopee no Lenovo fora deste commit.

Validacoes: handler real do card com busca filtrada, selecao de cor e produto sem slug; guardas de rota, estado do card e estoque; sintaxe das entradas e build com trava Supabase. Dois testes gerais ja falham no HEAD anterior (prefixo de cache e breadcrumb mobile). Detalhes em docs/versoes/2026-10-07-v1.2.566-catalogo-produto-exato.md.

Codigo 9f8c87fe e tag enviados a origin/main. Site ativo na release registrada, home e VERSION HTTP 200 com versao correspondente; API existente mysql.ok=true, sem deploy/restart. Clique publicado da busca abriu RN15P8256P preto no endereco legivel com cor e memoria, console sem erros; aviso preexistente de company_id. Evidencia .local/catalogo-produto-exato-publicado.png. Auditoria/aplicacao segura preservou 34 worktrees bloqueadas (25 dirty, 9 not_merged_into_origin_main), zero candidatos/remocoes; lista no registro da versao. Main sincronizado, somente quatro arquivos preexistentes da impressao Shopee permanecem locais. Nenhum cadastro, preco, estoque ou pedido alterado.

## Release anterior: v1.2.565-status-sistema

Data: 2026-10-07. Branch: main. Tag: v1.2.565-status-sistema.
Release VPS: /var/www/mdv-site/releases/20261007-134615-status-sistema
Status: publicada e validada em producao.

Central em /admin/settings/system-status com 22 indicadores em quatro grupos, busca, filtro por atencao, atualizacao manual e automatica a cada 60 segundos enquanto a aba esta visivel. Distingue funcionamento verificado, autorizacao armazenada e configuracao. Falha de uma fonte nao derruba as demais nem preserva o verde anterior. Links para configuracoes e tela legada de VPS.

Consulta administrativa de saude da mesma sessao WAHA usada pelos Status, somente GET, com autenticacao, cache de 30 segundos e timeout. Nao expõe dados da conta, credenciais ou erros brutos. Atendimento WhatsApp e publicacao de Status separados. Telegram, e-mail e Google Agenda aparecem explicitamente sem monitoramento. Nenhuma publicacao de midia, alteracao de agendamento, schema ou credenciais nesta entrega.

Validacoes: 22 testes focados, sintaxe, guarda de baixa por local, previa local com dados de teste e layout mobile; build aprovado com trava Supabase e bundle sem dependencia operacional legada; verificacao publicada aprovada. Deploy API seletivo com backup, validacao de sintaxe antes da troca e rollback. Demais modulos e entradas preservados.

Codigo 6794a49b e tag enviados a origin/main. Site ativo na release registrada; home, pagina e VERSION HTTP 200 e versao correspondente. API seletiva mdv-api online, mysql.ok=true; backup /var/www/mdv-api/backups/system-status-1791381144257. Nova rota autenticada HTTP 200 WORKING/conectado; sem autenticacao 401. Tela publicada conferida com 22 indicadores, busca, filtros, atualizacao de 60 segundos, console limpo e mobile sem transbordamento. Backup parcial sinalizado; Telegram, e-mail e Agenda Google explicitamente sem monitoramento. Nenhum envio de midia ou alteracao de agendamento. Auditoria/aplicacao segura preservou 34 worktrees bloqueadas (25 dirty, 9 not_merged_into_origin_main), sem candidatos/remocoes. Main limpo e sincronizado apos registro final. Detalhes e lista completa dos bloqueios em docs/versoes/2026-10-07-v1.2.565-status-sistema.md.

## Release anterior: v1.2.564-busca-celulares

Data: 2026-10-07. Branch: main. Tag: v1.2.564-busca-celulares.
Release VPS: /var/www/mdv-site/releases/20261007-130616-busca-celulares
Status: publicada e validada em producao.

Pesquisa do catalogo deixa de descartar categorias com menos de tres modelos. Redmi 15 e Redmi 15C retornavam pela API, mas suas secoes com um modelo eram omitidas entre capas e peliculas. Produtos sem categoria tambem permanecem nos resultados. Grade sem pesquisa ou com categoria selecionada preservada. Mudanca somente frontend.

Validacoes: tres testes da busca (falharam antes da correcao), guardas de agrupamento e filtro por categoria, sintaxe dos servidores e build com trava Supabase. Busca publicada mostra Redmi 15 e Redmi 15C. Sem erros no console; aviso existente de fallback do company_id. Evidencia .local/redmi-pesquisa-publicada.png. Codigo 0f9fbd93 e tag enviados a origin/main; release ativa, home e VERSION HTTP 200, API existente mysql.ok=true sem deploy/restart.

Antes do deploy, retomadas a pedido do operador apenas sete entregas WhatsApp de 07/10 recusadas com HTTP 422 por sessao desconectada. Todas publicadas: quatro confirmadas pelo provedor e tres verificadas visualmente no WhatsApp Web apos timeout do WAHA, sem reenviar. As tres foram reconciliadas como published, provider ID NULL e published_at como horario da reconciliacao. Backups /var/www/mdv-api/backups/whatsapp-retry-oct7-1791378447291.json e /var/www/mdv-api/backups/whatsapp-reconcile-oct7-1791378921523.json. Outros registros, Instagram e tentativas preservados; sessao WORKING. Timeout permanece limitacao operacional. Auditoria e limpeza segura preservaram 34 worktrees bloqueadas, zero candidatos/remocoes. Main limpo e sincronizado apos o registro final. Detalhes em docs/versoes/2026-10-07-v1.2.564-busca-celulares.md.

## Release anterior: v1.2.563-cancelar-dia

Data: 2026-10-06. Branch: main. Tag: v1.2.563-cancelar-dia.
Release VPS: /var/www/mdv-site/releases/20261006-210618-cancelar-dia
Status: publicada e validada em producao.

Calendario exibe botao com lixeira e texto Cancelar publicacoes deste dia no rodape do cartao. Painel e cartoes respeitam largura disponivel, sem esconder a acao na rolagem horizontal. Stories usam endpoint autenticado cancel-items: cancela somente entregas pendentes dos IDs escolhidos, preserva outros dias e publicacoes realizadas, bloqueia publicacao em andamento e IDs desatualizados. Tabelas dinamicas canceladas nao regeneram, e suas paginas devem ser canceladas em conjunto. Cancelar pendentes na area de tabelas continua cancelando o lote inteiro.

Validacoes: 35 testes focados, test:marketing-calendar, sintaxe e build com trava Supabase. Deploy seletivo de modulos com backup, sem mudanca de schema. Validacao MySQL em tabelas temporarias e calendario publicado concluida, sem cancelar registros reais durante teste.

Codigo c2a2d3b1 e tag enviados a origin/main. Site ativo na release registrada, home e VERSION HTTP 200 com versao correspondente. API mdv-api online, mysql.ok=true; backup /var/www/mdv-api/backups/phone-price-list-1791320850666. Teste na VPS confirmou cancelamento de um dia, preservacao dos demais e publicados, bloqueio de IDs externos e envio em andamento, ausencia de regeneracao apos cancelar e encerramento do ultimo dia. Registros reais e estados das unidades preservados. Calendario publicado no dia 9 conferido em painel estreito: botao visivel sem transbordamento horizontal, console sem erros/avisos. Evidencia local: .local/cancelar-dia-publicado.png. Auditoria preservou 34 worktrees bloqueadas (25 dirty, 9 not_merged_into_origin_main), nenhum candidato seguro a remocao.

## Release anterior: v1.2.562-cancelamento-visivel

Data: 2026-10-06. Branch: main. Tag: v1.2.562-cancelamento-visivel.
Release VPS: /var/www/mdv-site/releases/20261006-201723-cancelamento-visivel
Status: publicada e validada em producao.

Area de tabelas mantem a lista de agendamentos sempre visivel, sem precisar expandir o formulario de um novo lote. Cancelar pendentes continua disponivel para lotes aguardando aprovacao, aprovados ou publicando. Alteracao somente frontend; nenhum deploy/restart da API necessario.

Antes do deploy, a pedido do operador, cancelados os dois agendamentos ativos (Tabela de celulares, 72 entregas, e Story avulso, 6 entregas) pela API canonica. Releitura confirmou zero agendamentos Stories ativos, zero horarios semanais e nenhuma campanha WhatsApp ativa. Historico preservado. Validacoes: 13 testes focados, sintaxe e build com trava Supabase.

Codigo 79362dbb e tag enviados a origin/main. Site ativo na release registrada; home e VERSION HTTP 200, versao correspondente. Painel recarregado mostrou Agendamentos sem expandir formulario, dois lotes Cancelados, console sem erros/avisos. API nao publicada nem reiniciada nesta entrega. Releitura das entregas: 72+6 canceladas, nenhuma entrega pendente ou processando. Auditoria preservou 34 worktrees bloqueadas (25 dirty, 9 not_merged_into_origin_main), zero candidatas seguras. Main limpo e sincronizado.

## Release anterior: v1.2.561-tabelas-diarias

Data: 2026-10-06. Branch: main. Tag: v1.2.561-tabelas-diarias.
Release VPS: /var/www/mdv-site/releases/20261006-190333-tabelas-diarias
Status: publicada e validada em producao.

Novos agendamentos de tabelas guardam marcas, formato e tipo de preco. A cada horario, o worker consulta o estoque e os precos atuais pelo gerador canonico e substitui as paginas antes de qualquer envio ao Instagram ou WhatsApp. Ambos usam a mesma geracao. Ocultos e indisponiveis ficam fora; sem estoque, a ocorrencia e cancelada. Falha de geracao bloqueia a previa antiga e tenta novamente em cinco minutos. Uma tabela adicional guarda o estado por ocorrencia e permite variar o numero de paginas. Agendamentos antigos devem ser recriados.

Validacoes: 35 testes focados, sintaxe e build com trava Supabase. Deploy seletivo preserva demais modulos e entradas da API, cria somente a tabela adicional e faz backup antes da troca. Rollback restaura codigo; tabela adicional compativel permanece sem alterar dados antigos. Validacao do fluxo em tabelas temporarias na VPS, sem Stories reais.

Codigo a6924da9 e tag enviados a origin/main. Site ativo na release acima; home e VERSION HTTP 200, versao correspondente. API mdv-api online, mysql.ok=true. Backup /var/www/mdv-api/backups/phone-price-list-1791313566135. Teste MySQL com tabelas temporarias: 2, 1 e 0 paginas por ocorrencia, mesma midia para dois destinos, cancelamento por estoque vazio, falha com retry e bloqueio da previa antiga, sem repetir geracao. Agendamentos reais e estados das unidades preservados; zero publicacoes reais. Painel recarregado: 27 configuracoes, 6 artes, console sem erros/avisos. Auditoria: nenhum candidato seguro, 34 worktrees historicas preservadas por sujeira ou commits nao integrados. Checkout principal limpo em main.

## Release anterior: v1.2.560-unidades-ocultas-schema

Data: 2026-10-06. Branch: main. Tag: v1.2.560-unidades-ocultas-schema.
Release VPS: /var/www/mdv-site/releases/20261006-184620-unidades-ocultas-schema
Status: publicada e validada em producao.

Ocultar aparelho falhava com WARN_DATA_TRUNCATED porque units.status era ENUM legado sem hidden. Migracao idempotente acrescenta somente hidden, preservando valores anteriores, default, collation e nulabilidade. VARCHAR compativel permanece intacto. Inicializacao do servidor e operacao de visibilidade passam pela mesma guarda. Deploy seletivo faz backup de codigo e metadados, e verifica contagens por status antes e depois.

Validacoes: 16 testes focados aprovados, sintaxe, baixa por local e build com trava Supabase. Plano de producao: backup, ampliar ENUM, verificar estados inalterados, teste hide/restore dentro de transacao com rollback. Nenhum aparelho sera ocultado permanentemente apenas para validar. O operador pode repetir a tentativa apos a correcao; uma configuracao continua na tabela enquanto houver outra unidade disponivel.

Codigo 14585c61 e tag enviados a origin/main. API mdv-api online; backup /var/www/mdv-api/backups/unit-status-schema-1791312480881. ENUM passou a incluir hidden; contagens por status preservadas durante migracao. Teste real do helper na unidade indicada pelo operador: hidden e restore aceitos, exclusao da disponibilidade da tabela enquanto oculta, rollback confirmado com status, notas e estoque originais. /status mysql.ok=true, home e VERSION HTTP 200 com versao correspondente. Painel Marketing renderizado sem erros ou avisos no console. Auditoria preservou 34 worktrees historicas (25 dirty, 9 not_merged_into_origin_main), nenhum candidato seguro.

## Release anterior: v1.2.559-marketing-agrupamento-modelo

Data: 2026-10-06. Branch: main. Tag: v1.2.559-marketing-agrupamento-modelo.
Release VPS: /var/www/mdv-site/releases/20261006-183031-marketing-agrupamento-modelo
Status: publicada e validada em producao.

Gerador de tabelas passa a agrupar por marca, model_id, RAM fisica e armazenamento. Cores da mesma configuracao com nomes distintos deixam de aparecer repetidas. Nome exibido vem do modelo cadastrado; produtos sem model_id preservam agrupamento por nome e memoria. Configuracoes diferentes e modelos diferentes permanecem separados. Maior preco entre cores disponiveis, filtros de estoque e selecao explicita do bot preservados. Vale para cards com fotos e listas nos tres tipos de preco.

Validacoes: teste reproduziu a falha antes da correcao; 28 testes focados passaram, sintaxe e build com trava Supabase. Deploy seletivo da API com backup e site para nova versao. Nenhum cadastro, preco, estoque ou agendamento alterado.

Codigo efebaf33 e tag enviados a origin/main. Site ativo na release acima, home e VERSION HTTP 200 com versao correspondente. API mdv-api online, mysql.ok=true, backup /var/www/mdv-api/backups/phone-price-list-1791311488134. Previews POCO nos dois formatos e tres tipos de preco: oito configuracoes, sem avisos. Lista visual conferida em producao: X8 Pro aparece apenas em 8/256 (R$ 2.660,00) e 12/512 (R$ 2.630,00). Painel carregado sem erros ou avisos no console. Auditoria preservou 34 worktrees historicas (25 dirty e 9 not_merged_into_origin_main), nenhum candidato seguro.

## Release anterior: v1.2.558-marketing-dois-formatos

Data: 2026-10-06. Branch: main. Tag: v1.2.558-marketing-dois-formatos.
Release VPS: /var/www/mdv-site/releases/20261006-180545-marketing-dois-formatos
Status: publicada e validada em producao.

Restaurado o seletor Formato da arte no gerador de tabelas. Com imagens dos celulares reutiliza os cards originais de seis aparelhos por pagina com preco a vista no Pix e e a opcao inicial. Lista de modelos e precos preserva ate 14 configuracoes por pagina e os tres tipos de preco. Previa automatica e regeneracao ao agendar usam o mesmo formato selecionado. A API existente ja suporta ambos; somente o site precisa de deploy.

Validacoes: 29 testes focados aprovados; build com trava Supabase e sintaxe dos servidores. Nenhuma alteracao de produtos, precos, estoque ou agendamentos.

Codigo c067a882 e tag enviados a origin/main. Site ativo na release acima; home e VERSION HTTP 200 com versao correspondente; API existente saudavel, mysql.ok=true. Painel autenticado gerou seis artes com fotos e 30 configuracoes, com todas as imagens carregadas; alternancia para lista e cartao validada. Retorno aos cards restaurou Pix, sem erros ou avisos no console. Auditoria preservou 34 worktrees historicas (25 dirty, 9 not_merged_into_origin_main), sem candidatos seguros. API nao precisou de deploy ou restart.

## Release anterior: v1.2.557-marketing-tabelas

Data: 2026-10-06. Branch: main. Tag: v1.2.557-marketing-tabelas.
Release VPS: /var/www/mdv-site/releases/20261006-164255-marketing-tabelas
Status: publicada e validada em producao.

Marketing com visao geral e menu por tarefa: Criar, Planejar, Agendar e Revisar.
Tabelas de celulares em area propria, com Xiaomi, POCO e realme; sem preco, preco a vista no Pix ou parcelas e total no cartao. Formato de lista aprovado, ate 14 configuracoes por pagina. Geracao usa estoque e precos atuais; cartao reutiliza taxas presenciais cadastradas, ate 12x. Stories pontuais separados da programacao semanal do Instagram. Geracao antiga de cards do bot preservada.

Validacoes: 35 testes aprovados, um teste n8n fora do escopo ignorado; dinheiro, baixa por local de estoque, sintaxe, navegacao desktop/celular e build com trava Supabase. Nove artes conferidas com dados reais por leitura. Sem migrations, alteracoes comerciais ou envios de mensagens.

API: deploy seletivo --phone-price-list-only, com backup, protecao contra divergencia nos modulos e patch apenas da dependencia de cartao nas entradas de servidor. Preserva os demais fluxos da API.

Codigo 8a54f7cb enviado a origin/main com a tag da release. Site ativo no caminho acima; API mdv-api reiniciada e online, backup /var/www/mdv-api/backups/phone-price-list-1791305288174. Home e VERSION HTTP 200, versao correspondente, /status mysql.ok=true. Geracao autenticada dos tres tipos para Xiaomi, POCO e realme retornou nove PNGs 1080x1920 e 30 configuracoes, sem avisos. Painel administrativo renderizado em producao; troca entre Pix, cartao e sem preco conferida, sem erros ou avisos no console. Auditoria preservou 34 worktrees historicas: 25 dirty e 9 not_merged_into_origin_main; nenhum candidato a remocao.

## Release anterior: v1.2.556-familia-smartphone-automatica

Data: 2026-10-06. Branch: main. Tag: v1.2.556-familia-smartphone-automatica.
Release VPS: /var/www/mdv-site/releases/20261006-160727-familia-smartphone-automatica
Status: publicada e validada tecnicamente. Confirmacao operacional controlada pendente.

Na confirmacao por foto, a API cria ou reutiliza o pai do modelo e empresa e vincula as variacoes elegiveis sem pai. Trava transacional do modelo evita pais duplicados entre confirmacoes simultaneas. Preserva custos, precos, estoque, IMEIs e vinculos externos dos filhos. Pais incompatíveis ou multiplos bloqueiam a operacao.

Validacoes: 12 testes da familia e 12 testes de vinculo Bling, suite de confirmacao por foto, sintaxe e build com trava Supabase. Simulacao do Redmi 17 por leitura identificou quatro filhos elegiveis; nenhum cadastro foi alterado.

Publicacao concluida: codigo 0e504d74 enviado a origin/main e tag. API publicada com --photo-intake-only e PM2 online; backup /var/www/mdv-api/backups/photo-intake-1791302913927. Hashes do helper e da rota iguais aos arquivos locais. Helper instalado consultado em transacao somente leitura: quatro filhos elegiveis do Redmi 17. /status confirmou mysql.ok=true. Home HTTP 200, VERSION correspondente, painel Produtos renderizado com a nova versao e nenhum erro de console observado. Nenhum produto, estoque ou IMEI foi gravado para validar. Auditoria preservou 34 worktrees historicas bloqueadas por dirty ou not_merged_into_origin_main.

Deploy seletivo da API: --photo-intake-only. Sem migration nem ajustes de estoque. Outros caminhos de cadastro e agrupamento retroativo dos quatro Redmi 17 permanecem pendentes no checklist.

## Release anterior: v1.2.555-pdv-log-bloqueios

Data: 2026-10-06. Branch: main. Tag: v1.2.555-pdv-log-bloqueios.
Release VPS: /var/www/mdv-site/releases/20261006-142420-pdv-log-bloqueios
Status: publicada e validada. Codigo: c66daf4a, enviado a origin/main; tag v1.2.555-pdv-log-bloqueios.

Diagnostico JSON na API por operacao, tentativa, etapa, tempo de espera, conexao MySQL e resultado do rollback; registra recuperacao e descarte de conexao. Sem SQL, notas ou dados do cliente. Logger indisponivel nao impede rollback ou provoca baixa duplicada. Contrato HTTP e limites de repeticao preservados.

Validacoes: teste comportamental de recuperacao e diagnostico, patch seletivo e preflight; regressoes PDV, prioridade, finalizacao e sincronizacao de canais; sintaxe e build com trava Supabase. Nenhuma migration ou alteracao de estoque nesta publicacao. A venda B11B6196 ja foi conferida, com status success e saldos 29/2 preservados.

Autoajuste: preflight reconhece os helpers de estoque como API; deploy seletivo aceita o hash exato da v1.2.554 e continua rejeitando divergencias.

API mdv-api reiniciada e online; /status confirmou mysql.ok=true. Backup: /var/www/mdv-api/backups/pdv-stock-recovery-1791296819339. Hash do helper publicado igual ao local; contrato de diagnostico exercitado com pool simulado sem acesso ao banco. Home HTTP 200 e VERSION correspondente; painel autenticado carregou, sem erros de console observados, e B11B6196 continuou concluida. Nenhum saldo/venda alterado. Auditoria de worktrees preservou 34 trabalhos historicos bloqueados para limpeza.

## Release anterior: v1.2.554-pdv-baixa-segura

Data: 2026-10-06. Branch: main. Tag: v1.2.554-pdv-baixa-segura.
Release VPS: /var/www/mdv-site/releases/20261006-140147-pdv-baixa-segura
Status: publicada e validada. Codigo: a7996863, enviado a origin/main; tag v1.2.554-pdv-baixa-segura.

Baixa numerica do PDV com idempotencia por venda/produto, rollback e ate tres tentativas para timeout/deadlock. Travas limitadas a venda, produto e seus saldos. Itens repetidos agrupados; erros identificam SKU, produto e quantidade.

Detalhes da venda oferecem conferencia administrativa dos movimentos. Evidencia explicita do Bling permite registrar baixa externa ja refletida no saldo sem descontar novamente. Preserva erro original, responsavel e outras pendencias. Quantidades parciais ou excedentes bloqueiam a conferencia.

Publicacao seletiva nas tres entradas do servidor e dois helpers, com backup e bloqueio por divergencia. Sem migrations ou alteracoes de saldos/vendas. B11B6196 aguarda registro da conferencia.

Validacoes: rollback, concorrencia, idempotencia, reconciliacao, patch seletivo, regressoes de prioridade/finalizacao/unidades, sintaxe e build com trava Supabase. Compilador TypeScript completo indisponivel.

API mdv-api reiniciada e online; /status confirmou mysql.ok=true. Backup: /var/www/mdv-api/backups/pdv-stock-recovery-1791295525420. Home e VERSION HTTP 200; versao/release conferidos. Tela autenticada da venda B11B6196 consultou movimentos (pelicula 0 local, fone 1 local), exigindo evidencia e mantendo registro bloqueado sem preenchimento. Sem erros fatais no console observado. Nenhuma conferencia ou baixa gravada. Auditoria de worktrees executada; trabalhos historicos sujos/nao incorporados preservados.

## Release anterior: v1.2.553-familias-imei

Data: 2026-10-06. Branch: main. Tag: v1.2.553-familias-imei.
Release VPS: /var/www/mdv-site/releases/20261006-034340-familias-imei

Familias organizadas por memoria e cor no painel. Nome publico usa sempre o pai. Painel separa aparelhos disponiveis, vendidos e ocultos. Ocultar preserva historico; reativar no PDV exige confirmacao e depois a confirmacao existente do IMEI. Vendidos e unidades vinculadas a pedidos nao podem ser reativados.

API publicada seletivamente, com backup das tres entradas de servidor e do helper, sem migrations ou alteracoes de parametros fiscais. Validacoes: testes de familia, agrupamento, identificadores, visibilidade, PDV, parcelamento, DANFE, patch seletivo e build com trava Supabase. Conferencia publica obrigatoria apos deploy.

Pendencias: validar gravacao e venda completa usando produto teste; aprovar piloto Poco X8 antes de aplicar familias aos demais modelos; revisar pais antigos vazios. Nenhum aparelho real sera reativado nem venda concluida nesta publicacao. Alteracoes locais anteriores de fiscal, estoque, calculadoras e outros modulos ficam fora desta release.

Publicacao concluida: commit de codigo 07a37ec5 enviado a origin/main; tag v1.2.553-familias-imei. API mdv-api online, mysql.ok=true. Backup: /var/www/mdv-api/backups/families-units-1791258501749. Home e VERSION HTTP 200; versao e release conferidos. Navegador autenticado confirmou painel agrupado, acesso a ocultos e PDV carregado. Dois rascunhos de ocultacao da previa local nao foram enviados a producao.
