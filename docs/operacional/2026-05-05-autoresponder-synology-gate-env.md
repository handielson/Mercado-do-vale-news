# Comandos locais do safety gate

Este procedimento gera comandos PowerShell para liberar o safety gate do AutoResponder Synology somente quando a evidencia manual estiver completa.

## Garantias

- O script e somente leitura.
- Nao altera Synology.
- Nao define variaveis automaticamente.
- Nao reinicia tunnel, crontab, PM2 ou qualquer processo.
- Nao habilita limpeza destrutiva de arquivos.

## Uso local

```powershell
node tools\print-autoresponder-synology-gate-env.cjs docs\operacional\autoresponder-synology-manual-evidence.example.json
```

Quando todas as evidencias estiverem confirmadas, o script imprime comandos PowerShell para:

- `AUTORESPONDER_SYNOLOGY_RAM_SWAP_OK`
- `AUTORESPONDER_SYNOLOGY_TUNNEL_OK`
- `AUTORESPONDER_SYNOLOGY_DSM_API_OK`
- `AUTORESPONDER_SYNOLOGY_LEGACY_TOKEN_ABSENT`

Revise a saida antes de aplicar qualquer `$env:` no shell local.

## Fonte de verdade

O arquivo de evidencia deve apontar `source_of_truth` para `Synology.md` e confirmar o tunnel canonico:

- nome: `mdv-videos`
- uuid: `7680ed44-a7a9-4700-a37e-2026b3653360`

Se qualquer evidencia estiver incompleta, mantenha o safety gate bloqueado.
