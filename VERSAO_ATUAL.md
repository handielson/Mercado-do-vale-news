# Versao Atual

```text
version: v1.1.28-banner-background-color
date: 2026-06-15
status: published
release_vps: /var/www/mdv-site/releases/20260615-212330-v1128-banner-background-color
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- O cadastro/edicao de banners agora tem campo de cor de fundo.
- O preview do admin aplica a cor escolhida nas bordas da arte.
- O carrossel publico usa `background_color` no letterbox quando a imagem esta em `object-contain`.
- A API VPS aceita e persiste `background_color`, criando a coluna defensivamente quando necessario.
- Protecao de regressao cobre tipo, formulario, carrossel, servico e rotas VPS de banner.

## Como Recuperar

Use a tag/versao `v1.1.28-banner-background-color` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-15-v1.1.28-banner-background-color.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260615-212330-v1128-banner-background-color`.
- Esta versao altera frontend/admin e API VPS; publicar site e reiniciar API.
