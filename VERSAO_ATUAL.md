# v1.2.471-nfce-serie-002

Data: 24/09/2026
Status: ready
Branch: main
Tag: v1.2.471-nfce-serie-002
Release VPS: /var/www/mdv-site/releases/20260924-231239-nfce-serie-002

## Alterações

- O contador pode cadastrar ou ajustar a série da NFC-e própria no Espaço do Contador, com justificativa e auditoria.
- A série 002 começa no número 1; o painel mostra a sequência registrada sem habilitar emissão real.

## Limites

- A revisão tributária do contador e a homologação fiscal continuam necessárias antes de emitir em produção.

## Validação

- `node --test tmp-tests/accountant-portal.test.cjs tmp-tests/fiscal-nfce-numbering.test.cjs tmp-tests/fiscal-nfce-routes.test.cjs`
- `npm.cmd run test:company-fiscal`
- `node --check vps_server.js` e `node --check vps_server.cjs`
- `npm.cmd run build`
- `git diff --check`
