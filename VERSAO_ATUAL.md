# Versao Atual

```text
version: v1.1.24-sales-financial-fields
date: 2026-06-15
status: published
release_vps: /var/www/mdv-site/releases/20260615-174834-v1124-sales-financial-fields
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Persiste no MySQL/VPS os campos financeiros completos da venda: subtotal, custo total, lucro, formas de pagamento detalhadas, entrega e descontos.
- Persiste nos itens da venda `unit_cost`, `product_sku`, desconto e subtotal para o modal nao perder custo/lucro.
- Corrige normalizacao de vendas antigas em reais para evitar valores multiplicados por 100.
- O modal de detalhes agora usa os helpers de apresentacao para total do item, pagamentos, custo total e lucro real.
- Adiciona migrações das colunas financeiras em `vps_server.js` e `vps_server.cjs`.

## Como Recuperar

Use a tag/versao `v1.1.24-sales-financial-fields` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-15-v1.1.24-sales-financial-fields.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260615-174834-v1124-sales-financial-fields`.
- Esta versao altera frontend e API VPS; site publicado e `mdv-api` reiniciado.
