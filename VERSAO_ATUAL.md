# Versao Atual

```text
version: v1.1.32-delivery-workers-shortcut
date: 2026-06-16
status: published
release_vps: /var/www/mdv-site/releases/20260616-045013-v1132-delivery-workers-shortcut
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- O dashboard admin agora tem o atalho "Entregadores" em Operacoes Diarias.
- O atalho abre `/admin/customers?delivery=1`, reaproveitando a lista de clientes.
- A lista de clientes reconhece `delivery=1`, abre os filtros e aplica `is_delivery_worker: true`.
- O filtro avancado ganhou o campo "Tipo" com Todos, Clientes e Entregadores.
- A tela mostra o indicador "Mostrando apenas entregadores" quando o filtro esta ativo.

## Como Recuperar

Use a tag/versao `v1.1.32-delivery-workers-shortcut` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-16-v1.1.32-delivery-workers-shortcut.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260616-045013-v1132-delivery-workers-shortcut`.
- Esta versao altera apenas frontend/admin; publicar site.
