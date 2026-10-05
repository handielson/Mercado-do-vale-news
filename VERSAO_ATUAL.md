# v1.2.548-bling-stock-webhook

Data: 2026-10-05. Branch: main. Tag: v1.2.548-bling-stock-webhook.
Release: /var/www/mdv-site/releases/20261005-183500-v12548-bling-stock-webhook. Status: publicada e validada; pendente evento real.

O Bling mostra Estoques como inativo por erros na operação. O handler antigo aguardava consultas de saldo e sincronização de canais antes de confirmar a entrega. Agora uma inbox MySQL persiste o evento antes da resposta HTTP 200 e um worker serializado processa os recebimentos. Falhas de persistência retornam 503; falhas de processamento permanecem pendentes com atraso progressivo e erro registrado. Recibos repetidos são deduplicados e recibos interrompidos pelo reinício são recuperados.

O processamento consulta o saldo atual do Bling, sem aplicar payload de saldo antigo quando a consulta falha. Chamadas internas de atualização usam loopback em vez do proxy público. Não há ajuste manual de saldo nem ativação do cron de aplicação.

Validação: teste MySQL isolado passou (2 testes), incluindo concorrência, retry e reinício; sintaxe dos servidores conferida. Produção: API saudável; homepage HTTP 200; VERSION pública confirmada. Estoques reativado no Bling e configuração persistida após reload. Teste sintético sem produto: resposta em 211 ms, recibo done com uma tentativa. Pendente acompanhar evento real de estoque e sua propagação aos canais.
