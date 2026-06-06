# Instalacao dry-run na VPS - Archive AutoResponder

Procedimento para instalar o pacote do archive na VPS mantendo execucao remota em dry-run.

## Execucao local

```powershell
node tools/install-autoresponder-archive-vps-dry-run.cjs
```

## Variaveis

- `VPS_ROOT_PASSWORD`
- `AUTORESPONDER_ARCHIVE_INSTALL_APPLY=1`
- `AUTORESPONDER_ARCHIVE_DRY_RUN=1`
- `AUTORESPONDER_ARCHIVE_DELETE_ENABLED=0`

## Garantias

- Nao ativa crontab.
- Nao reinicia PM2.
- Nao apaga logs.
- Nao habilita delete.
- Valida `sha256sum`, permissao do shell wrapper e `node --check`.
