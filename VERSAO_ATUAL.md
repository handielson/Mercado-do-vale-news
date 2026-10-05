# v1.2.550-ml-preco-calculadora

Data: 2026-10-05. Branch: main. Tag: v1.2.550-ml-preco-calculadora
Release: /var/www/mdv-site/releases/20261005-233500-v12550-ml-preco-calculadora

Consulta do preco padrao e de venda no anuncio de cada filho. Calculadora existente usa categoria, tipo e logistica do anuncio, custo atual do SKU e tarifas oficiais consultadas. Sugestao preenche o novo preco; envio e explicito, protegido contra preco desatualizado, automacao e efeitos em promocao/variacoes compartilhadas.

Publicacao isolada: cartao Mercado Livre na ficha do pai e atalho no filho. Organizacao local das abas, ajustes fiscais e de estoque permanecem fora desta entrega. Nenhum preco de anuncio foi alterado durante a validacao.

Validacoes: testes focados, sintaxe dos servidores, build completo e verificacao publica apos deploy.

## Validacao da publicacao

Site/API publicados: /var/www/mdv-site/releases/20261005-233500-v12550-ml-preco-calculadora. API reiniciada online, status HTTP 200/mysql.ok=true; VERSION publico confirmou v1.2.550. Ficha publica do pai OIS063 renderizou o cartao e abriu a calculadora. Consulta autenticada de MLB5255291875 retornou preco padrao/venda R$25,00. Cotacao do SKU OIS063B bloqueada corretamente por custo de compra ausente/zero; custo positivo e nova cotacao permanecem pendentes. Nenhum preco ou estoque alterado.

15 testes focados passaram, incluindo autenticacao das rotas, e build completo passou. Worktree isolada de publicacao removida; 34 worktrees antigas preservadas (dirty/not_merged_into_origin_main), conforme auditoria C:/Users/Nitro/AppData/Local/Temp/mdv-v12550-cleanup.json. Main sincronizada; trabalhos locais preexistentes restaurados e copia recuperavel mantida no stash archive-prepublish-v12550-trabalhos-pendentes.
