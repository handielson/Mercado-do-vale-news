# v1.2.545-pgdas-history

Data: 2026-10-04. Status: pronta para publicação. Branch: main.
Tag: v1.2.545-pgdas-history.
Release: /var/www/mdv-site/releases/20261004-164053-pgdas-history.

O histórico declarado do PGDAS-D passa a alimentar o RBT12. Cada mês usa a receita declarada quando importada, incluindo serviços; os demais usam notas autorizadas. Faturamento corrente continua somando somente notas. A fonte é identificada por documento, competência e SHA256; os totais do extrato são conferidos antes da gravação.

Sem migrations. Snapshots imutáveis no diário fiscal existente, com isolamento por empresa, versão e trava transacional. Não altera notas, aprovação fiscal ou emissão.

Validações: 48 testes fiscais/histórico/deploy, navegador da Contabilidade, testes monetários, build e sintaxe.

Detalhes: docs/versoes/2026-10-04-v1.2.545-pgdas-history.md.
