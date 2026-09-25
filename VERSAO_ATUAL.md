# v1.2.482-parcelamento-cartao-12x

Data: 25/09/2026
Status: ready
Branch: main
Tag: v1.2.482-parcelamento-cartao-12x
Release VPS: pendente

## Alterações

- Perguntas como “Em 10x sairia a quanto?” são tratadas antes da busca de produtos.
- Quando o cliente já escolheu o celular, o sistema usa o produto salvo e envia a tabela de 1x a 12x no cartão.
- A escolha posterior da parcela é registrada no fluxo de compra.
- Sem produto selecionado, o bot pede o modelo antes de calcular, evitando respostas aleatórias.

## Arquivos

- vps_server.js
- tmp-tests/autoresponder-installment-inquiry-static.test.mjs

## Validações

- node --check vps_server.js
- node --check vps_server.cjs
- node tmp-tests/autoresponder-installment-inquiry-static.test.mjs
- git diff --check
