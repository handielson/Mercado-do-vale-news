# Integração de preço e estoque com o ERP

## Estado

A integração de leitura usa `MERCADO_LIVRE_ERP_READ_KEY`. Escritas usam `MDV_ERP_WRITE_KEY` com flags independentes:

- `MDV_ERP_PRICE_WRITE_ENABLED=1` anuncia `listing_price_write_v1` e protege a rota de preço.
- `MDV_ERP_STOCK_WRITE_ENABLED=1` anuncia `listing_stock_write_v1` e `user_product_stock_write_v1` e protege as rotas de estoque.

Os dois valores permanecem `0` em implantação seletiva padrão. A chave dedicada não substitui as flags. O catálogo e as consultas do ERP continuam sem projeção de saldo local do Mercado do Vale.

## Preço

`POST /mercado-livre/products/items/:itemId/price` exige `X-ERP-Write-Key` e a flag de preço. A solicitação inclui `parentId`, `priceCents`, `expectedPriceCents` e `confirm: true`; para anúncios legados com variações, inclui também `confirmAllVariations: true`.

Antes do PUT, a API confere vínculo e seller, relê o preço padrão e o preço de venda, consulta a automação de preço e valida canal, promoção e preços por quantidade. Só permite publicação ativa/pausada no canal `marketplace`, em BRL, sem automação, promoção ou preço B2B. O preço de um User Product/PxV é tratado por condição de venda: o PUT atinge somente o `item_id` conferido, sem propagar preço para os demais itens da família. Em anúncios legados com `variations[]`, todas recebem o mesmo valor somente após confirmação explícita do operador e igualdade dos preços atuais. Contextos mistos e variações com preços divergentes ficam bloqueados.

O envio usa `PUT /items/{item_id}` com somente `price` ou com IDs/preços de todas as variações. A API relê o anúncio para confirmar o valor persistido; se a resposta for ambígua ou o preço não conferir, exige nova consulta e não repete a escrita automaticamente. Uma repetição após resposta perdida retorna `alreadyCurrent` quando a leitura confirma que o preço alvo já está aplicado.

O endpoint dedicado `/items/{item_id}/prices/standard` ainda não está disponível. Para `dynamic_standard_price`, o Mercado Livre pode rejeitar ou ignorar `price` enviado com outros campos; a integração bloqueia anúncios com essa tag. Fontes oficiais: [API de preços](https://developers.mercadolivre.com.br/pt_br/api-de-precos) e [automação de preços](https://developers.mercadolivre.com.br/pt_br/api-docs-pt-br/automatizacoes-de-precos).

## Estoque

Estoque permanece separado do preço. Anúncios de origem única usam a rota de estoque tradicional; `warehouse_management` usa User Product, `x-version` e todas as localizações `seller_warehouse`, preservando `meli_facility`. Nenhuma dessas rotas grava o estoque operacional do Mercado do Vale; elas enviam solicitações ao Mercado Livre somente quando o respectivo gate está habilitado.

## Habilitação

O helper `scripts/mercado-livre-stock-write-deploy.cjs` mantém os gates de preço e estoque em zero por padrão no deploy seletivo `--mercado-livre-only`. A habilitação de preço requer `--enable-erp-price-write`; estoque requer separadamente `--enable-erp-stock-write`. Ambos exigem `MDV_ERP_WRITE_KEY` com 32–256 bytes. Não habilitar durante a migração: a chave/flags de escrita só podem ser configuradas depois da reconciliação e de autorização explícita para sincronização externa.

## Testes locais

```powershell
node --test tmp-tests/mercado-livre-listing-price.test.cjs tmp-tests/mercado-livre-listing-stock-write.test.cjs tmp-tests/mercado-livre-erp-read-key.test.cjs tmp-tests/mercado-livre-stock-write-deploy.test.cjs
npm run test:mercado-livre
```

Os testes usam respostas simuladas. Eles não validam uma escrita real na conta e não habilitam os gates.
