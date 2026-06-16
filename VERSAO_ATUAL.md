# Versao Atual

```text
version: v1.1.36-product-bling-prefill
date: 2026-06-16
status: published
release_vps: /var/www/mdv-site/releases/20260616-083350-v1136-product-bling-prefill
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Corrige o cadastro de novas unidades/produtos clonados quando flags do MySQL chegam como `0/1`.
- Normaliza `is_gift`, `is_combo`, `is_virtual`, `track_inventory` e `exclude_from_seo` para boolean antes da validacao do formulario.
- O vinculo automatico por SKU no Bling agora reaproveita EANs, `model_id` e nome do modelo do produto local ja vinculado.
- O cadastro em massa preserva modelo/EAN por item ao montar os produtos base e as unidades serializadas.
- Adiciona guardas de regressao para o erro `Expected boolean, received number` e para o preenchimento de EAN/modelo via Bling.

## Como Recuperar

Use a tag/versao `v1.1.36-product-bling-prefill` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-16-v1.1.36-product-bling-prefill.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260616-083350-v1136-product-bling-prefill`.
- Esta versao altera o frontend/admin de produtos e o arquivo publico de versao; publicar site.
