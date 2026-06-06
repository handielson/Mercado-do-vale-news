# Teste de escrita controlada na VPS - Archive AutoResponder

Este procedimento valida escrita controlada do archive em caminho temporario da VPS, sem usar o caminho definitivo do Synology.

## Variaveis

- `AUTORESPONDER_ARCHIVE_WRITE_APPLY=1`
- `VPS_ROOT_PASSWORD`
- `AUTORESPONDER_SYNOLOGY_ARCHIVE_DIR=/tmp/mdv-autoresponder-archive-write-test`

## Execucao

```powershell
node tools/test-autoresponder-archive-vps-write.cjs
```

## Garantias

- Nao usa o caminho definitivo do Synology.
- Nao ativa crontab.
- Nao apaga logs.
- Mantem `AUTORESPONDER_ARCHIVE_DELETE_ENABLED=0`.
- Valida `gzip -t`, `sha256sum`, `JSON.parse` e `archive_date`.
