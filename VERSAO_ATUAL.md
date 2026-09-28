# v1.2.505-shopee-connections-proxy

Data: 2026-09-28. Status: pronta para publicacao. Branch: main.
Tag: v1.2.505-shopee-connections-proxy
Release principal: /var/www/mdv-site/releases/20260928-233743-v1-2-505-shopee-connections-proxy

Corrige o cadastro de lojas Shopee adicionais: o frontend e a API agora usam a rota `/shopee-connections`, compativel com o proxy administrativo que reserva o prefixo `/api`.

Esta correcao somente permite criar a conexao pendente e iniciar o OAuth. Nenhum produto e enviado, alterado ou excluido.

Validacoes: teste regressivo da rota multiloja, sintaxe das duas variantes da API, teste de estoque sugerido pelo preflight e build do painel.
