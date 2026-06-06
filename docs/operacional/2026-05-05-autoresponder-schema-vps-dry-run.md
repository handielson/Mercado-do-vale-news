# Schema dry-run na VPS - AutoResponder

Procedimento para preparar a instalacao idempotente do schema AutoResponder na VPS quando o dry-run indicar ausencia de tabelas, por exemplo `Table 'mercadodovale.autoresponder_logs' doesn't exist`.

## Execucao

```powershell
node tools/install-autoresponder-schema-vps-dry-run.cjs
```

## Variaveis

- `AUTORESPONDER_SCHEMA_INSTALL_APPLY=1`
- `VPS_ROOT_PASSWORD`

## Garantias

- Nao define token de webhook.
- Nao ativa crontab.
- Nao reinicia PM2.
- Nao apaga dados.
- Nao executa `DROP TABLE` ou `DELETE FROM`.
