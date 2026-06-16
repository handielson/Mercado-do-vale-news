# Versao Atual

```text
version: v1.1.37-product-bling-ean-model
date: 2026-06-16
status: published
release_vps: /var/www/mdv-site/releases/20260616-084951-v1137-product-bling-ean-model
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Corrige o preenchimento visual de EAN e modelo no formulario de novo produto/unidade vinculado ao Bling.
- O vinculo automatico agora le `ean` e `alternative_eans` retornados pela API VPS, alem de `eans`.
- Quando a API local retorna apenas `model_id`, o formulario busca o nome do modelo para preencher o campo visivel `Modelo`.
- Mantem a correcao anterior das flags booleanas do clone/prefill para evitar `Expected boolean, received number`.
- Atualiza a guarda de regressao para cobrir o formato real retornado por `/products?bling_id=...`.

## Como Recuperar

Use a tag/versao `v1.1.37-product-bling-ean-model` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-16-v1.1.37-product-bling-ean-model.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260616-084951-v1137-product-bling-ean-model`.
- Esta versao altera o frontend/admin de produtos e o arquivo publico de versao; publicar site.
