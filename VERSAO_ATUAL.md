# v1.2.479-synology-quickconnect

Data: 25/09/2026
Status: ready
Branch: main
Tag: v1.2.479-synology-quickconnect
Release VPS: /var/www/mdv-site/releases/20260925-054739-v12479-synology-quickconnect

## Alterações

- O backup pode usar `MDV_SYSTEM_BACKUP_SYNOLOGY_URL` sem alterar o endereço Synology das outras integrações.
- A VPS usa o QuickConnect funcional para o backup, pois o túnel anterior retorna erro 1033 antes do envio.
- O pacote local permanece intacto até confirmação dos arquivos no NAS. A política de retenção da versão anterior continua em vigor.

## Validação

- `npm.cmd run test:system-backup-admin`
- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node --check deploy-vps-server-only.cjs`
- `node scripts/assert-no-supabase-runtime.cjs`
- `npm.cmd run build`
- `git diff --check`
