# v1.2.472-shopee-full-contador

Data: 24/09/2026
Status: ready
Branch: main
Tag: v1.2.472-shopee-full-contador
Release VPS: /var/www/mdv-site/releases/20260924-234720-v12472-shopee-full-contador

## Alterações

- O Espaço do Contador registra série NF-e exclusiva do Full Shopee, CFOPs de venda, frete, conferência do A1, regra fiscal, armazém, percentual de tributos por grupo/produto e conciliação dos XMLs.
- A matriz distingue remessa ao armazém, venda, retorno/devolução e entrega não concluída. Os cenários novos começam desativados, sem códigos tributários presumidos.
- A configuração fica armazenada nas rotas da administração e do contador, preservando matrizes antigas.

## Limites

- O cadastro não altera a conta Shopee, não emite NF-e do Full e não ativa tributação ou emissão real. O contador deve validar os campos e configurar a Shopee.

## Validação

- `npm.cmd run test:company-fiscal`
- `npm.cmd run test:accountant-portal`
- `node --check vps_server.js` e `node --check vps_server.cjs`
- `npm.cmd run build`
- `git diff --check`
