# v1.2.547-bling-stock-lock

Data: 2026-10-05. Status: pronta para publicação. Branch: main.
Tag: `v1.2.547-bling-stock-lock`.
Release principal: `/var/www/mdv-site/releases/20261005-165818-v12547-bling-stock-lock`.

A reconciliação do saldo Bling deixou de bloquear a atualização dos metadados de depósito e local em outra conexão. O cron usa a API local para evitar o timeout do proxy público, impede execuções simultâneas e inicia em modo de conferência. A aplicação completa exige `BLING_RECONCILE_APPLY=true`, pois há divergências adicionais a revisar.

O ajuste dirigido do SSD240 (Bling 1, sistema 0 antes desta versão) deve ser validado após a publicação; esta versão não altera automaticamente os demais produtos.
