# Versao Atual

```text
version: v1.1.22-sales-item-cost-view
date: 2026-06-15
status: published
release_vps: /var/www/mdv-site/releases/20260615-163507-v1122-sales-item-cost-view
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Corrige crash ao abrir detalhes de uma venda causado por `unitCost is not defined`.
- O modal de venda agora renderiza custo unitario, custo do item e lucro do item a partir de `itemView`, que e o objeto calculado por `buildSaleItemPresentation`.
- Atualiza a guarda de regressao para impedir que `unitCost`, `itemCost` e `itemProfit` voltem a ser usados como variaveis soltas no JSX.

## Como Recuperar

Use a tag/versao `v1.1.22-sales-item-cost-view` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-15-v1.1.22-sales-item-cost-view.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260615-163507-v1122-sales-item-cost-view`.
- Esta versao altera apenas o frontend; a API VPS nao precisa ser reiniciada.
