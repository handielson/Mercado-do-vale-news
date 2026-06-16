# Versao Atual

```text
version: v1.1.49-smartphone-serialized-units
date: 2026-06-16
status: published
release_vps: /var/www/mdv-site/releases/20260616-181000-v1149-smartphone-serialized-units
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Mantem a reconstrucao do PDV serializado da `v1.1.47`.
- Mantem o agrupamento por SKU publicado na `v1.1.48`.
- Agrupa smartphones no PDV por `model_id`, RAM, armazenamento e cor quando esses dados estao completos, mesmo quando o SKU legado esta errado.
- Evita que duplicados antigos de smartphones sem unidade aparecam como cards separados no PDV.
- Faz o card da lista de produtos mostrar IMEI/Serial vindos das unidades quando os identificadores nao estao mais em `product.specs`.
- Preserva os identificadores legados de `specs` apenas como fallback visual na lista de produtos.

## Dados Corrigidos Na VPS

- Reconstruidas 63 unidades de smartphones a partir dos IMEIs legados em `product.specs`.
- 7 itens foram recusados pela API porque o IMEI ja existia em `units`, sem duplicar cadastro.
- No caso da tela reportada, `RN15P8256T` ficou com 2 IMEIs disponiveis e `RN15P8256P` ficou com 1 IMEI disponivel.
- Foi adicionado `scripts/rebuild-smartphone-serialized-units.cjs` para dry-run, resumo e reconstrucao controlada desses smartphones.

## Como Recuperar

Use a tag/versao `v1.1.49-smartphone-serialized-units` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-16-v1.1.49-smartphone-serialized-units.md
```

## Publicacao

- Release VPS publicada: `/var/www/mdv-site/releases/20260616-181000-v1149-smartphone-serialized-units`.
- Esta versao altera frontend/admin/PDV e dados de unidades via API; site publicado. A API VPS nao precisou de novo deploy.
