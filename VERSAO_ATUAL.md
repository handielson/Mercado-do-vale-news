# Versao Atual

```text
version: v1.1.59-catalog-share-imei-search
date: 2026-06-18
status: published
release_vps: /var/www/mdv-site/releases/20260618-093739-v1159-catalog-share-imei-search
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- A mensagem copiada de categoria do catalogo divide os produtos por marca.
- Dentro de cada marca, os produtos sao ordenados do menor para o maior preco.
- O orçamento copiado pelo carrinho admin usa o cabecalho `Orçamento`.
- O orçamento copiado inclui o link publico de cada produto abaixo do item.
- A busca admin por IMEI agora mantem as unidades serializadas encontradas pela VPS anexadas ao produto hidratado, para o filtro local nao descartar o resultado.

## Como Recuperar

Use a tag/versao `v1.1.59-catalog-share-imei-search` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-18-v1.1.59-catalog-share-imei-search.md
```

## Publicacao

- Release VPS publicada: `/var/www/mdv-site/releases/20260618-093739-v1159-catalog-share-imei-search`.
- Esta versao altera comportamento visivel no frontend/admin; site VPS publicado.
- API nao alterada nesta versao.
