# v1.2.478-synology-backup-primary

Data: 25/09/2026
Status: ready
Branch: main
Tag: v1.2.478-synology-backup-primary
Release VPS: /var/www/mdv-site/releases/20260925-053941-v12478-synology-backup-primary

## Alterações

- O backup confirma integridade na VPS e envia o pacote ao Synology sem criar outra cópia temporária do arquivo grande.
- Cada parte, manifesto e hash são verificados no NAS antes de excluir o pacote da VPS. Se o envio falhar, o pacote local permanece para nova tentativa.
- Retenção de 30 dias no Synology, com pelo menos três conjuntos recentes protegidos; a VPS mantém até três pacotes completos de contingência.
- O painel informa se a cópia local ainda existe. O deploy da API é restrito a esses arquivos, sem migrations fiscais.

## Validação

- `npm.cmd run test:system-backup-admin`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node --check deploy-vps-server-only.cjs`
- `node scripts/assert-no-supabase-runtime.cjs`
- `npm.cmd run build`
- `git diff --check`
