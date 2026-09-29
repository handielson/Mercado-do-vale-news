# v1.2.510-vendas-auto-refresh

Data: 2026-09-29. Status: pronta para publicacao. Branch: main.
Tag: v1.2.510-vendas-auto-refresh
Release principal: /var/www/mdv-site/releases/20260929-132207-v1-2-510-vendas-auto-refresh

A tabela de `/admin/sales` passa a distribuir suas oito colunas dentro da largura disponivel, sem barra de rolagem horizontal. Identificadores, canais e nomes extensos sao truncados visualmente, mantendo o valor completo no tooltip.

A listagem atualiza automaticamente a cada minuto para PDV, Shopee MV, Shopee G, Mercado Livre e TikTok Shop. Ao retornar para a aba, a consulta e imediata; abas ocultas nao fazem polling e eventos simultaneos de foco/visibilidade nao duplicam requisicoes.

Esta entrega publica somente o site. A API nao sera reiniciada, e os arquivos e processos locais da automacao de anuncios Shopee G permanecem fora do commit e em execucao.

Validacoes: teste focado da listagem consolidada, protecao do polling, build de producao, ausencia de runtime Supabase e validacao publica do site, rota administrativa e versao.
