# Versao Atual

```text
version: v1.1.8-admin-products-compact-load
date: 2026-06-14
status: published
release_vps: /var/www/mdv-site/releases/20260614-201837-v118-admin-products-compact-load
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Listagem admin de produtos passa a buscar produtos da VPS com `compact: true`.
- Carga inicial/fallback usa paginas de 500 produtos em vez de 300 para reduzir chamadas sequenciais.
- O payload evita trazer listas completas de imagens/base64 na abertura da tela.
- Protecao estatica atualizada para impedir regressao para carga pesada sem `compact`.

## Como Recuperar

Use a tag/versao `v1.1.8-admin-products-compact-load` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-14-v1.1.8-admin-products-compact-load.md
```
