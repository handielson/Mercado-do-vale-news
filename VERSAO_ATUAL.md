# Versao Atual

```text
version: v1.1.13-inline-mobile-shell-cls
date: 2026-06-15
status: published
release_vps: /var/www/mdv-site/releases/20260615-012945-v1113-inline-mobile-shell-cls
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- O shell inline do `index.html`, exibido antes do JavaScript carregar, agora reserva a barra sticky mobile, check-in e chips.
- O shell inicial do catalogo agora tambem reserva a barra sticky de busca no mobile.
- O bloco inicial reserva o espaco do atalho/check-in antes da rota real carregar.
- O `CheckinWidget` nao retorna mais altura zero enquanto consulta o status do usuario.
- A entrega inclui teste estatico para impedir regressao no shell inline, no fallback React e no placeholder do check-in.

## Como Recuperar

Use a tag/versao `v1.1.13-inline-mobile-shell-cls` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-15-v1.1.13-inline-mobile-shell-cls.md
```
