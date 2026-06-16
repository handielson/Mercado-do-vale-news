# Versao Atual

```text
version: v1.1.42-card-net-summary
date: 2026-06-16
status: published
release_vps: /var/www/mdv-site/releases/20260616-105331-v1142-card-net-summary
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Corrige o resumo financeiro para usar o valor base da venda, abatendo do total do cartao o acrescimo cobrado do cliente.
- Recupera vendas antigas em que `amount` foi gravado igual a `total_with_fee`, inferindo a base por `total_with_fee - fee_amount`.
- Mantem o total passado no cartao visivel em formas de pagamento, mas calcula `Total Pago` e `Lucro Real` pela base liquida.
- Corrige o lucro salvo em novas vendas para nao tratar o acrescimo do cliente como receita real.
- Atualiza a guarda de regressao do PDV para impedir que o resumo volte a somar o total do cartao com taxa.

## Como Recuperar

Use a tag/versao `v1.1.42-card-net-summary` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-16-v1.1.42-card-net-summary.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260616-105331-v1142-card-net-summary`.
- Esta versao altera o frontend/admin de vendas/PDV e o arquivo publico de versao; publicar site.
