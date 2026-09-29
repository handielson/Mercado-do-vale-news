# v1.2.509-vendas-marketplaces

Data: 2026-09-29. Status: pronta para publicacao. Branch: main.
Tag: v1.2.509-vendas-marketplaces
Release principal: /var/www/mdv-site/releases/20260929-125525-v1-2-509-vendas-marketplaces

A tela `/admin/sales` passa a reunir as vendas do PDV, Shopee MV, Shopee G, Mercado Livre e TikTok Shop, ordenadas por data e identificadas por canal. Os marketplaces possuem detalhes somente leitura e falhas isoladas: a indisponibilidade de um canal nao impede a exibicao dos demais.

Os indicadores de faturamento, custo e lucro real continuam restritos ao PDV, pois os carregadores de marketplace nao fornecem custo real comparavel. Shopee consulta separadamente a conta principal e as conexoes adicionais; TikTok e Mercado Livre usam paginacao oficial.

A API sera publicada pelo modo seletivo `--sales-marketplaces-only`, que troca somente o runtime ativo `server.js` e `services/mercadoLivreServer.cjs`, preservando a automacao local de publicacao Shopee G em execucao.

Validacoes: testes focados da listagem e do deploy seletivo; testes de vendas, Mercado Livre e TikTok; verificacao de sintaxe; build de producao; validacao publica do site, versao e API.
