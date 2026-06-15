# Versao Atual

```text
version: v1.1.11-category-nav-cls
date: 2026-06-15
status: published
release_vps: /var/www/mdv-site/releases/20260615-005251-v1111-category-nav-cls
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- A navegacao desktop de categorias reserva altura minima antes dos dados chegarem da API.
- Essa reserva mira a principal causa de CLS apontada pelo PageSpeed: a barra `TODOS / FERRAMENTAS / SMARTWATCH...`.
- Mantem o shell inicial de carregamento do catalogo publicado na versao anterior.
- A entrega inclui teste estatico para impedir que a reserva de altura seja removida por refatoracao.

## Como Recuperar

Use a tag/versao `v1.1.11-category-nav-cls` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-15-v1.1.11-category-nav-cls.md
```
