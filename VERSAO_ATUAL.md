# v1.2.476-notas-contador

Data: 25/09/2026
Status: ready
Branch: main
Tag: v1.2.476-notas-contador
Release VPS: /var/www/mdv-site/releases/20260925-031424-v12476-notas-contador

## Alterações

- O filtro inicial do faturamento mostra NF-e e NFC-e autorizadas.
- Todas as notas cadastradas do período, inclusive as canceladas, aparecem em cartões após o resumo. A busca e o carregamento de 50 em 50 continuam disponíveis.
- Clicar em uma nota abre seus dados e gera o PDF sob demanda no painel lateral. A consulta SEFAZ, os downloads e a análise do contador ficam no mesmo painel.

## Validação

- `npm.cmd run test:accountant-portal`
- `npm.cmd run test:company-fiscal`
- `node tmp-tests/company-data-separation-static.test.mjs`
- `node tmp-tests/accountant-revenue-browser.mjs`
- `npm.cmd run build`
- `git diff --check`
