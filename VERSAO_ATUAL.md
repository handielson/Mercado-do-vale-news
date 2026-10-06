# v1.2.562-cancelamento-visivel

Data: 2026-10-06. Branch: main. Tag: v1.2.562-cancelamento-visivel.
Release VPS: /var/www/mdv-site/releases/20261006-201723-cancelamento-visivel
Status: preparada para publicacao.

Area de tabelas mantem a lista de agendamentos sempre visivel, sem precisar expandir o formulario de um novo lote. Cancelar pendentes continua disponivel para lotes aguardando aprovacao, aprovados ou publicando. Alteracao somente frontend; nenhum deploy/restart da API necessario.

Antes do deploy, a pedido do operador, cancelados os dois agendamentos ativos (Tabela de celulares, 72 entregas, e Story avulso, 6 entregas) pela API canonica. Releitura confirmou zero agendamentos Stories ativos, zero horarios semanais e nenhuma campanha WhatsApp ativa. Historico preservado. Validacoes: 13 testes focados, sintaxe e build com trava Supabase; painel e versao publica devem ser conferidos apos deploy.

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
