# Versao Atual

```text
version: v1.1.6-retire-import-hub
date: 2026-06-14
status: published
release_vps: /var/www/mdv-site/releases/20260614-191500-v116-retire-import-hub
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Central manual `Importacao & Sync VPS` removida do admin.
- Rota `/admin/import` removida.
- Item `Importacao & Sync VPS` removido do menu `Sistema`.
- Paginas `DataImportExportPage` e `ModelImportPage` removidas.
- Componentes e servico exclusivos do hub removidos: `LegacySalesImportTab` e `dataSyncService`.
- Teste estatico novo garante que o hub manual aposentado nao volte por acidente.

## Como Recuperar

Use a tag/versao `v1.1.6-retire-import-hub` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-14-v1.1.6-retire-import-hub.md
```
