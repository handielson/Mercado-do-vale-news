# Versao Atual

```text
version: v1.1.21-sales-delivery-person-state
date: 2026-06-15
status: published
release_vps: /var/www/mdv-site/releases/20260615-161859-v1121-sales-delivery-person-state
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Corrige crash em `/admin/sales` causado por `setDeliveryPersonName is not defined` no modal de detalhes da venda.
- Declara o estado `deliveryPersonName` e importa os servicos usados pelo modal, evitando globais nao declarados no bundle.
- Mantem os dados logisticos administrativos visiveis tambem para vendas com retirada na loja.
- Atualiza a guarda de regressao para cobrir o modal importado pelo chunk de vendas, nao apenas a pagina principal.

## Como Recuperar

Use a tag/versao `v1.1.21-sales-delivery-person-state` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-15-v1.1.21-sales-delivery-person-state.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260615-161859-v1121-sales-delivery-person-state`.
- Esta versao altera apenas o frontend; a API VPS nao precisa ser reiniciada.
