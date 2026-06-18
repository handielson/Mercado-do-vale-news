# Versao Atual

```text
version: v1.1.68-sales-cost-customer-specs
date: 2026-06-18
status: published
release_vps: /var/www/mdv-site/releases/20260618-201014-v1168-sales-cost-customer-specs
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- O detalhe da venda recalcula automaticamente custo total e lucro usando os custos atuais dos produtos e unidades serializadas.
- O recálculo deixa de reutilizar o `cost_total` antigo e avisa que os valores historicos serao substituidos.
- Nomes de clientes sao normalizados na leitura e na gravacao, independentemente da origem.
- O metadado interno `bling_name_sync` deixa de aparecer na ficha tecnica publica do produto.
- Guardas de regressao cobrem os tres comportamentos.

## Como Recuperar

Use a tag/versao `v1.1.68-sales-cost-customer-specs` ou o arquivo:

`docs/versoes/2026-06-18-v1.1.68-sales-cost-customer-specs.md`