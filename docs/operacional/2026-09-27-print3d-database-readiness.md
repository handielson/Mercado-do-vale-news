# Preparação do banco da Loja 3D — 27/09/2026

## Resultado

- Auditoria inicial executada somente com consultas agregadas.
- Backup integral protegido criado na VPS, com dump completo, dump de schema e SHA-256.
- Backup restaurado em MySQL 8.4 descartável local.
- Migrations 028–051 homologadas sobre a cópia fiel do banco operacional.
- Migrations operacionais 028–030, 033–038 e 040–051 aplicadas no banco principal.
- Migrations previamente presentes 031, 032 e 039 foram preservadas.
- API e MySQL permaneceram saudáveis.
- Todas as flags `MDV_PRINT3D_*_ENABLED` permaneceram desligadas.

## Proteções e evidências

Backup de referência: `/var/www/mdv-api/.deploy-backups/print3d-db-preflight-20260927230906023-4587bf`.

Antes e depois da aplicação:

| Medida | Antes | Depois |
|---|---:|---:|
| Produtos | 2.771 | 2.771 |
| Pedidos | 9 | 9 |
| Banners | 2 | 2 |
| Total em `products.stock_quantity` | 18.847 | 18.847 |
| Linhas por local | 3.787 | 3.787 |
| Total em locais | 19.627 | 19.627 |

## Pendências de dados

- Existem 27 grupos de SKU duplicado entre produtos legados: 8 formados somente por produtos com unidades serializadas, 18 mistos e 1 sem unidades serializadas. Não criar índice único global sem tratar a compatibilidade com esses registros.
- Existem 2 produtos legados com `stock_quantity = -1`.
- Existem 396 produtos cujo total central diverge da soma dos locais: em 53 o central é maior em 113 unidades; em 343 os locais são maiores em 633 unidades. Apenas 12 desses produtos possuem unidades serializadas; 384 não possuem, portanto a divergência não pode ser atribuída principalmente ao fluxo de IMEI.
- Existem 9 produtos com estoque central positivo e nenhuma quantidade distribuída por local, totalizando 9 unidades.
- Ainda não existem produtos marcados como 3D, ofertas por site ou saldos de filamentos/insumos para inicializar.

Essas divergências não foram corrigidas automaticamente. Antes de cadastrar saldos 3D ou ativar checkout, deve-se identificar a origem de cada grupo e escolher a fonte correta por fluxo, preservando unidades serializadas e histórico de movimentos.

## Ferramentas

- `scripts/audit-print3d-production.cjs`: auditoria agregada sem retornar produtos ou dados pessoais.
- `scripts/prepare-print3d-database.cjs`: backup integral e restauração efêmera para homologação.
- `scripts/apply-print3d-production-migrations.cjs`: plano/aplicação protegida com backup obrigatório, trava e comparação antes/depois.
