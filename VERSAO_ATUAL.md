# v1.2.544-bling-fiscal-auto

Data: 2026-10-04. Status: pronta para publicação. Branch: main.
Tag: v1.2.544-bling-fiscal-auto.
Release: /var/www/mdv-site/releases/20261004-160008-bling-fiscal-auto.

Sincronização temporária do Bling a cada 15 minutos, recuperando NF-e/NFC-e e XMLs dos últimos 90 dias. Confere cancelamentos, preserva notas canceladas, valida emitente/valor/XML e impede duplicação ou execuções concorrentes. Contabilidade soma somente notas autorizadas por data de emissão. O painel mostra conexão, execução, falhas e última conferência.

Sem migrations. Desativação: MDV_BLING_FISCAL_SYNC_ENABLED=0 e restart da API.

Validações: 62 testes fiscais/deploy, navegador da Contabilidade, testes monetários, build e sintaxe.

Detalhes: docs/versoes/2026-10-04-v1.2.544-bling-fiscal-auto.md.
