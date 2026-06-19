# Versao Atual

```text
version: v1.1.70-pdv-stock-location-fallback
date: 2026-06-19
status: published
release_vps: /var/www/mdv-site/releases/20260619-120736-v1170-pdv-stock-location-fallback
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Vendas PDV de produtos com estoque manual agora propagam falha de baixa por local para a auditoria da venda.
- Quando a loja/local principal nao tem saldo e a baixa sai de outro local, a venda registra o aviso `Produto ... tirado do local ...`.
- O detalhe da venda exibe os avisos de baixa fora da loja principal sem marcar a venda como erro.
- A API de baixa por prioridade retorna nomes/codigos de deposito e local usados para permitir auditoria humana.
- Guarda de regressao cobre a baixa por local, propagacao de erro e exibicao do aviso na venda.

## Como Recuperar

Use a tag/versao $version ou o arquivo:

`docs/versoes/2026-06-19-v1.1.70-pdv-stock-location-fallback.md`
