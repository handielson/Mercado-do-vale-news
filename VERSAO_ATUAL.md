# Versao Atual

```text
version: v1.1.61-catalog-visibility-datetime
date: 2026-06-18
status: published
release_vps: /var/www/mdv-site/releases/20260618-103819-v1161-catalog-visibility
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Produtos agora podem ficar ativos para venda/PDV e ocultos apenas do site publico.
- Admin > Produtos exibe botao de olho para alternar a visibilidade no site.
- Cards de produto mostram o selo `Oculto no site` quando a flag esta ativa.
- Catalogo publico, pagina direta do produto, mensagem de categoria e PDF ignoram produtos ocultos.
- VPS cria e persiste `products.hide_from_catalog`.
- Endpoint focado `PATCH /products/:id/catalog-visibility` altera apenas a visibilidade do site.
- O endpoint generico `/table-data` normaliza timestamps ISO UTC para `YYYY-MM-DD HH:mm:ss`, evitando erro MySQL ao salvar campos personalizados.

## Como Recuperar

Use a tag/versao `v1.1.61-catalog-visibility-datetime` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-18-v1.1.61-catalog-visibility-datetime.md
```

## Publicacao

- Release VPS publicada: `/var/www/mdv-site/releases/20260618-103819-v1161-catalog-visibility`.
- Esta versao altera comportamento visivel no frontend/admin; site VPS publicado.
- Esta versao altera rotas e normalizacao da API VPS; API VPS publicada/reiniciada.
