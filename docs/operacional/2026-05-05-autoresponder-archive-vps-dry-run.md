# Validacao VPS - Archive AutoResponder em dry-run

Documento de validacao operacional do archive na VPS em modo dry-run.

## Comandos

```bash
node --check /var/www/mdv-api/cron/archive-autoresponder-logs.cjs
node /var/www/mdv-api/cron/archive-autoresponder-logs.cjs --self-test
AUTORESPONDER_ARCHIVE_DRY_RUN=1 AUTORESPONDER_ARCHIVE_DELETE_ENABLED=0 node /var/www/mdv-api/cron/archive-autoresponder-logs.cjs YYYY-MM-DD
crontab -l
```

## Regras

- `AUTORESPONDER_ARCHIVE_DRY_RUN=1`
- `AUTORESPONDER_ARCHIVE_DELETE_ENABLED=0`
- NAO adicionar ainda entrada nova no crontab.
- O destino final esperado continua `/volume1/backups/autoresponder/YYYY/MM/DD.json.gz`.
- Em dry-run, a limpeza deve aparecer como `cleanup skipped`.
