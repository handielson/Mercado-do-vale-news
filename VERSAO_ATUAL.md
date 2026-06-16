# Versao Atual

```text
version: v1.1.30-pdv-delivery-dynamic-value
date: 2026-06-15
status: published
release_vps: /var/www/mdv-site/releases/20260615-223831-v1130-pdv-delivery-dynamic-value
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- A entrega pela loja no PDV agora envia o valor digitado no campo `Valor da Entrega`.
- O valor digitado passa para `delivery_cost_store`, soma em `delivery_total` e alimenta o credito do entregador.
- A entrega hibrida segue enviando dinamicamente `Custo Loja + Custo Cliente`.
- Protecao de regressao cobre o fluxo de valor digitado ate o total de entrega/credito.

## Como Recuperar

Use a tag/versao `v1.1.30-pdv-delivery-dynamic-value` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-15-v1.1.30-pdv-delivery-dynamic-value.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260615-223831-v1130-pdv-delivery-dynamic-value`.
- Esta versao altera apenas o frontend do PDV; publicar site.
