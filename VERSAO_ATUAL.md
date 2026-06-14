# Versao Atual

```text
version: v1.1.3-legacy-customer-purchases
date: 2026-06-14
status: published
release_vps: /var/www/mdv-site/releases/20260614-181727-v113-legacy-customer-purchases
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Tabela VPS `legacy_customer_purchases` para guardar compras antigas como historico informativo.
- Importacao das vendas antigas do Supabase para a VPS sem movimentar estoque, caixa, crediario, cashback ou Bling.
- Reconciliacao das compras antigas pelo CPF para apontarem ao cliente correto na VPS.
- Aba de compras do cliente passa a mostrar `Historico do sistema antigo` separado dos pedidos atuais.
- Compras legadas aparecem com selo `Informativo`, total, data, pagamento e itens quando existirem.

## Como Recuperar

Use a tag/versao `v1.1.3-legacy-customer-purchases` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-14-v1.1.3-legacy-customer-purchases.md
```
