# Versao Atual

```text
version: v1.1.55-pdv-merge-legacy-serial-units
date: 2026-06-17
status: published
release_vps: /var/www/mdv-site/releases/20260617-131425-v1155-pdv-merge-legacy-serial-units
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- A lista de unidades do PDV agora junta unidades reais e seriais legados vindos de produtos duplicados agrupados pelo mesmo SKU.
- O serial legado `AT2209900136`, que estava em outro registro `Athomics Inspire Lite` com SKU `rail`, passa a aparecer junto das unidades reais quando a busca e feita por nome.
- A deduplicacao compara Serial, IMEI 1 e IMEI 2 para nao mostrar duas vezes o mesmo aparelho quando o legado ja virou unidade real.
- Mantem a correcao anterior de cadastro serializado, abertura direta de venda pelo painel do modelo e protecao de nome local contra regressao do Bling.

## Como Recuperar

Use a tag/versao `v1.1.55-pdv-merge-legacy-serial-units` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-17-v1.1.55-pdv-merge-legacy-serial-units.md
```

## Publicacao

- Release VPS publicada: `/var/www/mdv-site/releases/20260617-131425-v1155-pdv-merge-legacy-serial-units`.
- Esta versao altera o agrupamento frontend do PDV; site VPS publicado.
