# v1.2.555-pdv-log-bloqueios

Data: 2026-10-06. Branch: main. Tag: v1.2.555-pdv-log-bloqueios.
Release VPS: /var/www/mdv-site/releases/20261006-142420-pdv-log-bloqueios
Status: preparada para publicacao.

Diagnostico JSON na API por operacao, tentativa, etapa, tempo de espera, conexao MySQL e resultado do rollback; registra recuperacao e descarte de conexao. Sem SQL, notas ou dados do cliente. Logger indisponivel nao impede rollback ou provoca baixa duplicada. Contrato HTTP e limites de repeticao preservados.

Validacoes: teste comportamental de recuperacao e diagnostico, patch seletivo e preflight; regressoes PDV, prioridade, finalizacao e sincronizacao de canais; sintaxe e build com trava Supabase. Nenhuma migration ou alteracao de estoque nesta publicacao. A venda B11B6196 ja foi conferida, com status success e saldos 29/2 preservados.

Autoajuste: preflight reconhece os helpers de estoque como API; deploy seletivo aceita o hash exato da v1.2.554 e continua rejeitando divergencias.

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
