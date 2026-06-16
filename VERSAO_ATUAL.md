# Versao Atual

```text
version: v1.1.38-product-bling-linked-hydrate
date: 2026-06-16
status: published
release_vps: /var/www/mdv-site/releases/20260616-090221-v1138-product-bling-linked-hydrate
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Corrige o preenchimento de EAN e modelo quando o formulario ja abre com `bling_id` vinculado.
- O formulario agora hidrata dados locais pelo `bling_id` existente em vez de pular o preenchimento automatico.
- O salvamento tambem tenta hidratar EAN/modelo antes de montar o payload, mesmo quando o Bling ja estava vinculado.
- O cadastro em massa preserva todos os EANs normalizados (`link.eans`) e nao apenas `link.ean`.
- Mantem a leitura de `ean` e `alternative_eans` retornados pela API VPS, alem de `eans`.
- Mantem a correcao anterior das flags booleanas do clone/prefill para evitar `Expected boolean, received number`.
- Atualiza a guarda de regressao para cobrir o estado "Bling ja vinculado, campos visiveis vazios".

## Como Recuperar

Use a tag/versao `v1.1.38-product-bling-linked-hydrate` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-16-v1.1.38-product-bling-linked-hydrate.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260616-090221-v1138-product-bling-linked-hydrate`.
- Esta versao altera o frontend/admin de produtos e o arquivo publico de versao; publicar site.
