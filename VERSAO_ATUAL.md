# Versao Atual

```text
version: v1.1.19-banner-upload-stock
date: 2026-06-15
status: published
release_vps: /var/www/mdv-site/releases/20260615-114108-v1119-banner-upload-stock
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- O upload de banner no admin deixa de passar pelo `/api/vps-proxy` e envia o multipart direto para a VPS.
- O erro `{"error":"file required"}` ao adicionar novo banner e evitado porque o campo `file` chega inteiro na rota `/banners/upload`.
- O carrossel publico filtra banners vinculados a produto: se o produto e todas as variacoes por `parent_id`/`model_id` estiverem sem estoque vendavel, o banner nao aparece.
- As guardas estaticas cobrem o upload direto e a filtragem de banners por disponibilidade de produto.
- A entrega preserva as correcoes de imagem do admin publicadas na `v1.1.18`.

## Como Recuperar

Use a tag/versao `v1.1.19-banner-upload-stock` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-15-v1.1.19-banner-upload-stock.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260615-114108-v1119-banner-upload-stock`.
- Esta versao altera apenas o frontend; a API VPS nao precisa ser reiniciada.
