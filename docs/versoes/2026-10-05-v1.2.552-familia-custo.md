# v1.2.552-familia-custo

Data: 2026-10-05. Status: publicado e validado. Branch: main.
Tag: v1.2.552-familia-custo. Commit de codigo: 004a4289 (inclui b47e0e27).
Release: /var/www/mdv-site/releases/20261005-225900-v12552-familia-custo

Ficha do pai organizada por abas, custo da familia, edicao completa do filho em janela e heranca opcional de custo. Selecionar todos marca os seis campos de copia unica, sem alterar a opcao de custo. Escopo e arquivos detalhados no registro v1.2.551-familia-custo.

A primeira conferencia visual encontrou uma referencia a funcionalidade local nao publicada no texto de salvamento. Restaurado o texto compativel com o pacote isolado e publicado novo build antes do encerramento. Demais alteracoes locais de estoque, fiscal e calculadoras ficaram preservadas fora da release.

Validacoes concluidas: build npm isolado e trava Supabase; 3 testes de contrato da familia (transacao, concorrencia e JSON); sintaxe dos servidores e teste de moeda. API reiniciada com PM2 online, status ok e mysql.ok=true. Home e ficha HTTP 200; VERSION.json corresponde a esta release. Navegador autenticado confirmou custo do pai, lista de variacoes, edicao do filho em janela e os seis campos marcados pelo Selecionar todos. Configuracao encerrada sem gravar dados comerciais.

Evidencia visual: C:/Users/Nitro/AppData/Local/Temp/mdv-familia-publicada-v12552.png

Pendencias: testar gravacao e propagacao em produto teste; heranca continua dos outros campos (hoje copia unica). Auditoria de limpeza preservou 34 worktrees com trabalho pendente; apenas o checkout limpo desta publicacao foi removido. Main sincronizada com origin/main, com alteracoes locais anteriores preservadas.
