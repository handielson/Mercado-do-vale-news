# Versao Atual

```text
version: v1.1.75-shopee-products-table
date: 2026-06-21
status: published
release_vps: /var/www/mdv-site/releases/20260621-001612-v1175-shopee-products-table
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Cria a tabela `shopee_products` na migracao da VPS.
- Corrige o erro `ER_NO_SUCH_TABLE` que impedia as abas `Produtos` e `Envio em massa` da Shopee de carregarem os produtos.
- Mantem indices para busca por produto local, item Shopee, variacao/modelo, status e data da ultima sincronizacao.

## Como Recuperar

Use a tag/versao `v1.1.75-shopee-products-table` ou o arquivo:

`docs/versoes/2026-06-21-v1.1.75-shopee-products-table.md`
