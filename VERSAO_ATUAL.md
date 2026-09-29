# v1.2.507-shopee-duas-contas-pf

Data: 2026-09-29. Status: pronta para publicacao. Branch: main.
Tag: v1.2.507-shopee-duas-contas-pf
Release principal: /var/www/mdv-site/releases/20260929-013625-v1-2-507-shopee-duas-contas-pf

As contas Shopee `M` (Mercado do Vale) e `G` (Glaucia) passam a operar de forma independente no painel, publicacao, pedidos, financeiro, vinculos de produtos, preco e estoque.

A conta `M` preserva o fluxo empresarial existente com NF-e do Bling. A conta `G`, cadastrada como pessoa fisica, nao chama NF-e/Bling e gera etiqueta mais comprovante de separacao 90 x 100 mm no mesmo padrao aprovado do Mercado Livre. Se a Shopee exigir documento fiscal nessa conta, o fluxo para para intervencao em vez de emitir a nota da empresa.

O webhook identifica a conexao pelo `shop_id`, e atualizacoes de preco e estoque usam o vinculo e as credenciais da loja correspondente. Contas desconhecidas nao caem silenciosamente na loja principal.

Validacoes: testes comportamentais e estaticos de conta M/G, estoque, webhook, vinculos e impressao; sintaxe da API e do agente local; trava contra Supabase; build do painel; PDF ficticio 90 x 100 mm inspecionado visualmente. Nenhum pedido real ou impressao fisica foi usado na validacao.
