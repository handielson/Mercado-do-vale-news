# v1.2.480-synology-tunnel-compact

Data: 25/09/2026
Status: ready
Branch: main
Tag: v1.2.480-synology-tunnel-compact
Release VPS: /var/www/mdv-site/releases/20260925-055744-v12480-synology-tunnel-compact

## Alterações

- O backup tenta primeiro o túnel local autenticado até o NAS e usa QuickConnect se esse caminho não responder.
- Uma transferência interrompida após validar o pacote volta a ficar pendente, preservando a cópia na VPS para reenvio.
- Novos pacotes incluem as releases atual e anterior do site e os dados da API, mas deixam de aninhar releases e backups históricos já preservados por outros meios.
- A política anterior continua: 30 dias no Synology e até três pacotes de contingência na VPS.

## Validação

- `npm.cmd run test:system-backup-admin`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node --check deploy-vps-server-only.cjs`
- `node scripts/assert-no-supabase-runtime.cjs`
- `npm.cmd run build`
- `git diff --check`
