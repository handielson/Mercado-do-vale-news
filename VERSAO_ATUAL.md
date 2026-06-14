# Versao Atual

```text
version: v1.1.4-retire-customer-migration
date: 2026-06-14
status: published
release_vps: /var/www/mdv-site/releases/20260614-183003-v114-retire-customer-migration
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Rota `/admin/migration` removida depois da migracao final de clientes.
- Item `Migracao` removido do menu admin.
- Paginas antigas `LegacyMigration` e `FieldMappingPage` removidas.
- Componentes exclusivos de migracao de cliente removidos de `components/migration`.
- Aba placeholder `Clientes (Migracao Legado)` removida da Central de Importacao.
- Teste estatico novo garante que o fluxo antigo de cliente nao volte por acidente.

## Como Recuperar

Use a tag/versao `v1.1.4-retire-customer-migration` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-14-v1.1.4-retire-customer-migration.md
```
