# Versao Atual

```text
version: v1.1.47-pdv-serialized-inventory-rebuild
date: 2026-06-16
status: published
release_vps: /var/www/mdv-site/releases/20260616-170149-v1147-pdv-serialized-inventory-rebuild
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Reconstrui a busca do PDV para produtos serializados aparecerem como um card agrupado por produto/SKU.
- Adicionei seletor interno de unidades disponiveis no modo `Nome / SKU`, com venda travada em quantidade 1.
- Mantive o modo `IMEI / Serial` direto para carrinho, usando a unidade exata encontrada por IMEI ou serial.
- Bloqueei a mesma unidade serializada de entrar duas vezes no carrinho.
- Adicionei endpoint VPS `/pdv/product-search` com produtos hidratados por unidades disponiveis em uma unica busca.
- Preservei a baixa de estoque generico apenas para itens nao serializados; itens serializados baixam a unidade escolhida.

## Dados Corrigidos Na VPS

- Nenhuma correcao direta de banco nesta release.
- Foi adicionado `scripts/audit-pdv-serialized-inventory.cjs` para auditoria read-only de specs legadas, unidades sem identificador e divergencia entre estoque e unidades.

## Como Recuperar

Use a tag/versao `v1.1.47-pdv-serialized-inventory-rebuild` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-16-v1.1.47-pdv-serialized-inventory-rebuild.md
```

## Publicacao

- Release VPS publicada: `/var/www/mdv-site/releases/20260616-170149-v1147-pdv-serialized-inventory-rebuild`.
- Esta versao altera frontend/admin/PDV e API VPS; site publicado e servidor VPS reiniciado.
