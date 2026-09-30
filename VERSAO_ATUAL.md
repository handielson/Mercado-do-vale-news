# v1.2.524-dashboard-tabelas

Data: 2026-09-30. Status: pronta para publicacao. Branch: main.
Tag: v1.2.524-dashboard-tabelas
Release principal: `/var/www/mdv-site/releases/20260930-160135-v1-2-524-dashboard-tabelas`.

As tabelas de vendas do dashboard agora carregam todo o catalogo paginado, inclusive produtos alem do limite inicial de 2.000 registros.

Estoque zero real permanece como `0`; dados sem correspondencia aparecem como `—`. Ultima venda usa o preco praticado na transacao e ultima compra aproveita o custo registrado no item quando disponivel.
