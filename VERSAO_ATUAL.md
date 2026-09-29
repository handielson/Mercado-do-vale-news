# v1.2.511-vendas-refresh-seguro

Data: 2026-09-29. Status: pronta para publicacao. Branch: main.
Tag: v1.2.511-vendas-refresh-seguro
Release principal: /var/www/mdv-site/releases/20260929-161107-v1-2-511-vendas-refresh-seguro

A tabela de `/admin/sales` deixa de aguardar o historico completo dos marketplaces para aparecer. As vendas do PDV sao exibidas assim que ficam prontas, enquanto Shopee MV, Shopee G, Mercado Livre e TikTok Shop continuam carregando em segundo plano com estado visivel.

A atualizacao automatica espera qualquer carregamento ativo terminar e consulta apenas os dois dias mais recentes dos marketplaces, incorporando vendas novas ao historico ja carregado. Isso elimina a concorrencia que podia manter a tela em `Carregando vendas...`.

Esta entrega publica somente o site. A API nao sera reiniciada, e os arquivos e processos locais da automacao de anuncios Shopee G permanecem fora do commit e em execucao.

Validacoes: teste focado do carregamento progressivo e incremental, build de producao, ausencia de runtime Supabase e validacao publica do site, rota administrativa e versao.
