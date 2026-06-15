# Versao Atual

```text
version: v1.1.10-catalog-loading-shell
date: 2026-06-15
status: published
release_vps: /var/www/mdv-site/releases/20260615-004615-v1110-catalog-loading-shell
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- A inicializacao publica do catalogo usa um shell de carregamento com o mesmo formato da home, em vez do skeleton generico de produto.
- O banner inicial reserva proporcao `21/9` durante o carregamento para evitar telas vazias e troca brusca antes do conteudo real.
- As secoes do catalogo reaproveitam o skeleton do card de produto, mantendo altura e grade mais proximas do layout final.
- A entrega inclui teste estatico para impedir o retorno do fallback generico no catalogo.

## Como Recuperar

Use a tag/versao `v1.1.10-catalog-loading-shell` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-15-v1.1.10-catalog-loading-shell.md
```
