# v1.2.506-shopee-contas-mg

Data: 2026-09-29. Status: pronta para publicacao. Branch: main.
Tag: v1.2.506-shopee-contas-mg
Release principal: /var/www/mdv-site/releases/20260929-003309-v1-2-506-shopee-contas-mg

Os produtos vinculados a loja oficial Mercado do Vale passam a exibir o selo `M`; os vinculados a conta adicional da Glaucia exibem `G`. Um mesmo produto pode manter vinculos independentes nas duas lojas e exibir os dois selos.

Os vinculos existentes sao preservados como loja principal. A sincronizacao de estoque resolve as credenciais da conta correspondente antes de atualizar cada anuncio.

Tambem foi incluido o indicador visivel `Conectada` nas lojas Shopee adicionais autorizadas.

Validacoes: testes regressivos de multiloja, selos, vinculos e estoque; sintaxe das duas variantes da API; trava contra Supabase e build do painel.
