# v1.2.470-csc-efisco

Data: 24/09/2026
Status: ready
Branch: main
Tag: v1.2.470-csc-efisco
Release VPS: /var/www/mdv-site/releases/20260924-194449-csc-efisco

## Alterações

- O cofre fiscal aceita o CSC alfanumérico e o formato com hífens exibido pelo e-Fisco, preservando o valor exato para o QR Code da NFC-e.
- O plano de publicação reconhece módulos de cofre no servidor e inclui o deploy da API.

## Limites

- Esta correção não emite notas nem libera a emissão em produção. A revisão tributária do contador continua necessária.

## Validação

- `node --test tmp-tests/fiscal-csc-vault.test.cjs`
- `node scripts/publish-vps-plan.cjs --self-test`
- `npm.cmd run test:company-fiscal`
- `node --check vps_server.js` e `node --check vps_server.cjs`
- `npm.cmd run build`
- `git diff --check`
