# v1.2.517-marketplace-sales-cache-stock

Data: 2026-09-29. Status: pronta para publicacao. Branch: main.
Tag: v1.2.517-marketplace-sales-cache-stock
Release principal: `/var/www/mdv-site/releases/20260929-202147-v1-2-517-marketplace-sales-cache-stock`.

As vendas de marketplace ficam salvas no navegador por cinco minutos. A tela mostra a ultima lista imediatamente e busca uma versao nova em segundo plano; o botao Atualizar ignora o cache.

Nos detalhes da Shopee, o sistema procura o produto interno pelo SKU e, se necessario, pelo nome e pela variacao. Assim a foto e os locais com saldo voltam a aparecer mesmo quando o retorno do marketplace nao traz o identificador interno.
