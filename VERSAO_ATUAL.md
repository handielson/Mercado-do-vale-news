# v1.2.508-shopee-vinculos-contas

Data: 2026-09-29. Status: pronta para publicacao. Branch: main.
Tag: v1.2.508-shopee-vinculos-contas
Release principal: /var/www/mdv-site/releases/20260929-025000-v1-2-508-shopee-vinculos-contas

O painel Shopee agora varre o catalogo da conta selecionada antes de formar a fila de publicacao. A leitura paginada identifica o SKU principal e os SKUs de cada variacao, registra os vinculos encontrados na conta correta e mostra todos os produtos que nao serao reenviados.

A correspondencia automatica e deliberadamente conservadora: somente SKU exato e unico. Anuncios sem SKU local correspondente ou com SKU ambiguo ficam intocados para revisao manual. Um vinculo da conta `M` nao bloqueia o envio para a conta `G`, e vice-versa.

A fila de envio em massa permanece bloqueada ate a varredura terminar e aceita somente produtos `not_synced`, com estoque publicavel e sem `shopee_item_id` naquela conta. Tambem foi incluido o comando seguro `npm run shopee:publish-one -- --sku <SKU> --connection <M|G>` para testes unitarios de publicacao, inclusive produtos com variacao, imagens e video.

Validacoes: reconciliacao real das contas M e G por SKU exato; testes do scanner e da protecao da fila; testes de publicacao simples/variacao, busca e exibicao dos selos; verificacao de sintaxe; build de producao e validacao publica da versao.
