# Versao Atual

```text
version: v1.1.51-pdv-finalize-imei-layout
date: 2026-06-17
status: published
release_vps: /var/www/mdv-site/releases/20260617-104432-v1151-pdv-finalize-imei-layout
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Mantem o seletor de unidade serializada por radio, agora usando a largura completa do card do produto.
- Remove a barra horizontal do seletor de IMEI/serial e deixa os identificadores quebrarem dentro do espaco disponivel.
- Mostra o `IMEI 1` abaixo do aparelho no preview do recibo para conferencia antes de finalizar.
- Corrige o calculo de pagamento no preview do recibo para considerar `total_with_fee` em credito parcelado.
- Desbloqueia o botao `Finalizar Venda` quando o total pago com juros cobre o total da venda.

## Como Recuperar

Use a tag/versao `v1.1.51-pdv-finalize-imei-layout` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-17-v1.1.51-pdv-finalize-imei-layout.md
```

## Publicacao

- Release VPS publicada: `/var/www/mdv-site/releases/20260617-104432-v1151-pdv-finalize-imei-layout`.
- Esta versao altera somente frontend/admin/PDV; site publicado. A API VPS nao precisou de novo deploy.
