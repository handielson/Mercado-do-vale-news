# v1.2.481-payjoy-boleto

Data: 25/09/2026
Status: ready
Branch: main
Tag: v1.2.481-payjoy-boleto
Release VPS: /var/www/mdv-site/releases/20260925-110100-v12481-payjoy-boleto

## Alterações

- O bot oferece financiamento PayJoy para clientes que perguntam sobre boleto e usa o link configurável no painel.
- Após a análise, convida os aprovados à loja com a localização em outra mensagem; acolhe os não aprovados e orienta verificar nova tentativa em cerca de 15 dias.
- Perguntas sem resposta confirmada passam para atendimento humano. Lembretes únicos de 30 minutos e 15 dias respeitam respostas do cliente e o horário da loja.

## Validação

- `node --check vps_server.js`
- `node --check vps_server.cjs`
- `node tmp-tests/payjoy-server-static.test.cjs`
- `node tmp-tests/n8n-payjoy-workflow-patch.test.cjs`
- `node tmp-tests/n8n-admin-client-control-static.test.mjs`
- `npm.cmd run build`
- `git diff --check`
