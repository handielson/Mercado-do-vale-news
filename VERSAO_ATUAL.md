# Versao Atual

```text
version: v1.1.14-mobile-controls-shell-cls
date: 2026-06-15
status: published
release_vps: /var/www/mdv-site/releases/20260614-224954-v1114-pagespeed
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- O shell inline do `index.html`, exibido antes do JavaScript carregar, agora reserva a linha mobile de controles do catalogo.
- O fallback React do catalogo tambem reserva os controles de filtros/compartilhamento antes dos chips de colecoes.
- A ordem do shell foi alinhada ao catalogo real mobile: banner, check-in, controles, colecoes e grid.
- A pagina inicial antecipa a busca dos banners publicos do catalogo para reduzir a descoberta tardia da imagem LCP.
- O servico de banners reutiliza uma requisicao em voo/cache curto quando o carrossel monta logo depois do warm-up.
- A API VPS agora gera derivados WebP/AVIF em uploads de produtos, banco de imagens e banners.
- O deploy da API garante `sharp` na VPS antes de reiniciar o PM2, para os derivados serem gerados de verdade.
- A entrega amplia o teste estatico de CLS para impedir a regressao da linha `Filtros / Compartilhar Catalogo`.
- A entrega adiciona uma guarda estatica para impedir regressao do warm-up de banners.
- A entrega tambem cobre a geracao/cache de derivados e a dependencia remota necessaria no deploy da API.

## Como Recuperar

Use a tag/versao `v1.1.14-mobile-controls-shell-cls` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-15-v1.1.14-mobile-controls-shell-cls.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260614-224954-v1114-pagespeed`.
- A mesma versao tambem inclui publicacao da API VPS para gerar derivados WebP/AVIF em novos uploads.
