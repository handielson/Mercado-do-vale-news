# Versao Atual

```text
version: v1.1.15-lcp-banner-discovery
date: 2026-06-15
status: published
release_vps: /var/www/mdv-site/releases/20260614-230651-v1115-lcp-banner-discovery
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- O HTML inicial agora pre carrega o AVIF responsivo do primeiro banner publico do catalogo.
- O shell inline do catalogo renderiza uma imagem real do banner LCP antes do React montar.
- O placeholder cinza do banner foi substituido por um `picture` com AVIF/WebP e fallback PNG, mantendo `fetchpriority="high"`.
- A entrega adiciona guarda estatica para impedir que o banner LCP volte a ser descoberto apenas depois do bundle.
- Esta versao complementa a `v1.1.14`, mantendo o shell mobile com controles reservados e o warm-up/cache curto dos banners.

## Como Recuperar

Use a tag/versao `v1.1.15-lcp-banner-discovery` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-15-v1.1.15-lcp-banner-discovery.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260614-230651-v1115-lcp-banner-discovery`.
- Esta versao altera apenas o frontend publico; a API VPS nao precisa ser reiniciada.
