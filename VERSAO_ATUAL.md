# Versao Atual

```text
version: v1.1.60-catalog-memory-order
date: 2026-06-18
status: published
release_vps: /var/www/mdv-site/releases/20260618-100026-v1160-catalog-memory-order
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- A mensagem copiada de categoria divide os produtos por marca.
- As marcas ficam em ordem alfabetica.
- Dentro de cada marca, os produtos ficam em ordem alfabetica e, em empate de nome, do menor para o maior preco.
- A leitura de RAM e armazenamento foi centralizada em `utils/productSpecUtils.ts`.
- Produtos novos seguem o padrao canonico `specs.ram` e `specs.storage`.
- Produtos antigos continuam com fallback para aliases como `memoria_ram`, `armazenamento`, `capacidade` e `memoria_interna`, evitando `N/A/N/A`.
- O orcamento copiado tambem usa a mesma fonte unica de memoria.

## Como Recuperar

Use a tag/versao `v1.1.60-catalog-memory-order` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-18-v1.1.60-catalog-memory-order.md
```

## Publicacao

- Release VPS publicada: `/var/www/mdv-site/releases/20260618-100026-v1160-catalog-memory-order`.
- Esta versao altera comportamento visivel no frontend/admin; site VPS publicado.
- API nao alterada nesta versao.
