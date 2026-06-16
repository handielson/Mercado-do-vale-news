# Versao Atual

```text
version: v1.1.40-sale-receipt-print-hotfix
date: 2026-06-16
status: published
release_vps: /var/www/mdv-site/releases/20260616-095737-v1140-sale-receipt-print-hotfix
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Corrige o erro ao imprimir recibo na finalizacao da venda pelo PDV.
- Corrige o mesmo erro ao imprimir recibo pelo historico de vendas.
- Importa explicitamente `buildPaymentPresentation` no util de recibo, evitando `ReferenceError` em runtime.
- Define `escapeHtml` no recibo antes de escapar os rotulos de pagamento.
- Atualiza as guardas de regressao para impedir que o recibo volte a usar dependencias ausentes.

## Como Recuperar

Use a tag/versao `v1.1.40-sale-receipt-print-hotfix` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-16-v1.1.40-sale-receipt-print-hotfix.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260616-095737-v1140-sale-receipt-print-hotfix`.
- Esta versao altera o frontend/admin de vendas/PDV e o arquivo publico de versao; publicar site.
