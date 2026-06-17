# Versao Atual

```text
version: v1.1.58-admin-product-serial-search
date: 2026-06-17
status: published
release_vps: /var/www/mdv-site/releases/20260617-181327-v1158-admin-product-serial-search
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- A busca da pagina admin de produtos passa a encontrar aparelhos por `IMEI 1`, `IMEI 2` e `Serial`, alem de nome, SKU, EAN e Bling ID.
- O filtro local considera identificadores salvos em `specs`, no proprio produto e em listas de `units`/`available_units`.
- Quando o produto ainda nao esta no cache da tela, a busca consulta as unidades serializadas por identificador e hidrata o produto correspondente pela VPS.
- O placeholder da busca foi atualizado para deixar claro que IMEI 1 e Serial podem ser pesquisados.

## Como Recuperar

Use a tag/versao `v1.1.58-admin-product-serial-search` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-17-v1.1.58-admin-product-serial-search.md
```

## Publicacao

- Release VPS publicada: `/var/www/mdv-site/releases/20260617-181327-v1158-admin-product-serial-search`.
- Esta versao altera a busca da pagina admin de produtos e servicos frontend; site VPS publicado.
