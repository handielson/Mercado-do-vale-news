# Versao Atual

```text
version: v1.1.5-retire-roadmap-page
date: 2026-06-14
status: published
release_vps: /var/www/mdv-site/releases/20260614-184607-v115-retire-roadmap-page
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Pagina estatica `Roadmap & Docs` removida do admin.
- Rota `/admin/settings/roadmap` removida.
- Item `Roadmap & Docs` removido do menu `Sistema`.
- Arquivo `pages/admin/settings/RoadmapPage.tsx` removido.
- Teste estatico novo garante que essa pagina interna obsoleta nao volte por acidente.

## Como Recuperar

Use a tag/versao `v1.1.5-retire-roadmap-page` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-14-v1.1.5-retire-roadmap-page.md
```
