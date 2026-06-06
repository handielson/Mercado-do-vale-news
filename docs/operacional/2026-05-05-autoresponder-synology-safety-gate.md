# Safety gate Synology

Este gate local falha fechado: enquanto qualquer confirmacao manual estiver ausente, o script retorna `blocked: true` e `ok: false`.

## Confirmacoes obrigatorias

- RAM/swap conferidos antes de qualquer acao em NAS ou tunnel.
- Tunel canonico `mdv-videos` conferido com uuid `7680ed44-a7a9-4700-a37e-2026b3653360`.
- DSM API conferida manualmente.
- Processo legado com `--token` confirmado como ausente.

## Garantias

- O script e read-only.
- Nao altera Synology.
- Nao reinicia tunnel.
- Nao altera DNS, crontab, PM2 ou limpeza de logs.

Use este gate apenas como bloqueio local antes de liberar escrita final no arquivo Synology.
