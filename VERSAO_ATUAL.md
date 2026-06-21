# Versao Atual

```text
version: v1.1.76-shopee-image-upload-jpeg
date: 2026-06-21
status: published
release_vps: /var/www/mdv-site/releases/20260621-003218-v1176-shopee-image-upload-jpeg
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Converte imagens WebP, AVIF, GIF, BMP e TIFF para JPEG antes de enviar para o `upload_image` da Shopee.
- Mantem JPEG, JPG e PNG sendo enviados diretamente.
- Corrige o erro `product.error_param: image is invalid or not supported` ao exportar produto com imagem WebP.
- Aplica a mesma protecao no upload direto do catalogo e no fluxo `add_item` da API Shopee Actions.

## Como Recuperar

Use a tag/versao `v1.1.76-shopee-image-upload-jpeg` ou o arquivo:

`docs/versoes/2026-06-21-v1.1.76-shopee-image-upload-jpeg.md`
