# Versao Atual

```text
version: v1.1.41-pdv-receipt-warranty-summary
date: 2026-06-16
status: published
release_vps: /var/www/mdv-site/releases/20260616-103015-v1141-pdv-receipt-warranty-summary
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Inclui os dados do cliente no recibo gerado pelo modal de venda finalizada no PDV.
- Fecha o modal de sucesso antes de abrir o termo de garantia, evitando que o termo fique escondido sem acao aparente.
- Corrige o ajuste final de pagamento no cartao para manter separados valor base, taxa cobrada do cliente e taxa da operadora.
- Recalcula o lucro real do resumo financeiro quando a venda tem custos detalhados de operadora.
- Atualiza a guarda de regressao do PDV para cobrir recibo com cliente, termo de garantia visivel e resumo financeiro.

## Como Recuperar

Use a tag/versao `v1.1.41-pdv-receipt-warranty-summary` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-16-v1.1.41-pdv-receipt-warranty-summary.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260616-103015-v1141-pdv-receipt-warranty-summary`.
- Esta versao altera o frontend/admin de vendas/PDV e o arquivo publico de versao; publicar site.
