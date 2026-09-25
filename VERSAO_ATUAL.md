# v1.2.473-contador-navegacao

Data: 25/09/2026
Status: ready
Branch: main
Tag: v1.2.473-contador-navegacao
Release VPS: /var/www/mdv-site/releases/20260925-020811-v12473-contador-navegacao

## Alterações

- O resumo abre pelas vendas concluídas e separa claramente notas cadastradas de notas emitidas no Bling ainda não importadas.
- O quadro mostra mês, tipo e canal sem rolagem vertical interna; notas exibem disponibilidade de PDF e XML conforme o arquivo original.
- Vendas podem ser buscadas e abertas em painel lateral com fechamento visível e pela tecla Esc.
- A página administrativa deixa de falhar quando exibe o alerta fiscal.

## Validação

- `npm.cmd run test:accountant-portal`
- `npm.cmd run test:company-fiscal`
- `node tmp-tests/accountant-revenue-browser.mjs`
- `node --check vps_server.js` e `node --check vps_server.cjs`
- `npm.cmd run build`
- `git diff --check`
