# v1.2.475-notas-navegacao

Data: 25/09/2026
Status: ready
Branch: main
Tag: v1.2.475-notas-navegacao
Release VPS: /var/www/mdv-site/releases/20260925-025000-v12475-notas-navegacao

## Alterações

- A lista de notas fiscais permite buscar por número, pedido, tipo ou canal e carregar 50 por vez.
- O aviso de cobertura pede ao contador que confirme se todos os emissores foram importados, sem afirmar que o histórico do Bling ainda está ausente.

## Validação

- `npm.cmd run test:accountant-portal`
- `node tmp-tests/accountant-revenue-browser.mjs`
- `npm.cmd run build`
- `git diff --check`
