# v1.2.504-shopee-multiloja

Data: 2026-09-28. Status: pronta para publicacao. Branch: main.
Tag: v1.2.504-shopee-multiloja
Release principal: /var/www/mdv-site/releases/20260928-231010-v1-2-504-shopee-multiloja

O painel passa a permitir criar lojas Shopee adicionais, nomea-las e iniciar a autorizacao OAuth para cada titular. Os tokens e o identificador de cada loja ficam isolados da conexao principal e nao sao exibidos pela interface.

Esta etapa nao envia, altera ou exclui produtos. A vinculacao de um mesmo produto a mais de uma loja sera tratada em uma proxima entrega, com selecao explicita da loja de destino.

Validacoes: verificacao estatica das duas variantes da API, sintaxe dos servidores e build do painel.
