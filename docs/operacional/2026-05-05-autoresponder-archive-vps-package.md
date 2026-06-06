# Pacote VPS - Archive AutoResponder

Procedimento para preparar o pacote local de arquivos do archive antes da instalacao controlada na VPS.

## Geracao

```powershell
node tools/prepare-autoresponder-archive-vps-package.cjs
```

## Saidas

- `reports/autoresponder-archive-vps-package/manifest.json`
- `cron/archive-autoresponder-logs.cjs`
- `cron/archive-autoresponder-logs.sh`
- `docs/operacional/2026-05-05-autoresponder-archive-vps-dry-run.md`

## Instalacao manual prevista

- Enviar com `scp`.
- Conferir `sha256`.
- Copiar para `/var/www/mdv-api/cron/archive-autoresponder-logs.cjs`.
- Copiar para `/var/www/mdv-api/cron/archive-autoresponder-logs.sh`.
- Rodar `chmod +x /var/www/mdv-api/cron/archive-autoresponder-logs.sh`.
- Validar com `AUTORESPONDER_ARCHIVE_DRY_RUN=1`.

NAO ativar crontab nesta fase.
