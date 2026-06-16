# Versao Atual

```text
version: v1.1.48-pdv-serialized-sku-grouping
date: 2026-06-16
status: published
release_vps: /var/www/mdv-site/releases/20260616-171407-v1148-pdv-serialized-sku-grouping
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Mantem a reconstrucao do PDV serializado da `v1.1.47`.
- Agrupa no PDV produtos duplicados pelo mesmo SKU, mesmo com caixa diferente (`RAIL`/`rail`), preferindo o cadastro que tem unidades disponiveis.
- Evita que o duplicado legado sem unidade apareca como card separado no PDV.
- Faz o card da lista de produtos mostrar IMEI/Serial vindos das unidades quando os identificadores nao estao mais em `product.specs`.
- Preserva os identificadores legados de `specs` apenas como fallback visual na lista de produtos.

## Dados Corrigidos Na VPS

- Nenhuma correcao direta de banco nesta release.
- Foi adicionado `scripts/audit-pdv-serialized-inventory.cjs` para auditoria read-only de specs legadas, unidades sem identificador e divergencia entre estoque e unidades.

## Como Recuperar

Use a tag/versao `v1.1.48-pdv-serialized-sku-grouping` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-16-v1.1.48-pdv-serialized-sku-grouping.md
```

## Publicacao

- Release VPS publicada: `/var/www/mdv-site/releases/20260616-171407-v1148-pdv-serialized-sku-grouping`.
- Esta versao altera frontend/admin/PDV; site publicado. A API VPS ja havia sido reiniciada na `v1.1.47`.
