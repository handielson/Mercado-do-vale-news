# Integração de preço e estoque com o ERP

## Estado

A integração de leitura usa `MERCADO_LIVRE_ERP_READ_KEY`. O GET autenticado de `/mercado-livre/settings` retorna `erpCapabilities` para as rotas implementadas e `erpWriteGates` para indicar se cada escrita está habilitada no servidor. A lista de capacidades não liga os gates. Escritas usam `MDV_ERP_WRITE_KEY` com flags independentes:

- `MDV_ERP_PRICE_WRITE_ENABLED` não habilita preço enquanto a API oficial standard não estiver disponível; o servidor mantém esse gate desligado.
- `MDV_ERP_STOCK_WRITE_ENABLED=1` anuncia `listing_stock_write_v1` e `user_product_stock_write_v1` e protege as rotas de estoque.

As flags permanecem `0` em implantação seletiva padrão, inclusive `MDV_ERP_PUBLISH_ENABLED`. A chave dedicada não substitui as flags. O catálogo e as consultas do ERP continuam sem projeção de saldo local do Mercado do Vale. As capacidades de estoque aparecem no contrato mesmo com `erpWriteGates.stock=false`; assim, o ERP distingue suporte de código de autorização operacional.

## Preparação de novos anúncios com dados do ERP

O contrato dedicado usa `POST /mercado-livre/erp/preparation/preview` autenticado por `X-ERP-Read-Key` e `POST /mercado-livre/erp/preparation/publish` autenticado por `X-ERP-Publish-Key`. O endpoint autenticado de configurações anuncia `erp_snapshot_authority_v1`, `listing_publish_preview_v1` e `listing_publish_v1` quando o código dessas rotas está presente; isso não liga a publicação. `erpWriteGates.publish` só fica verdadeiro quando `MDV_ERP_PUBLISH_ENABLED=1` e uma chave dedicada de 32–256 caracteres está configurada.

O snapshot validado fornece ao anúncio preço, custo e quantidade do ERP, identifica o produto do ERP e precisa corresponder ao SKU e aos campos confirmados no rascunho. A quantidade do anúncio é montada a partir desse snapshot. A implementação não consulta o saldo do produto no Mercado do Vale para decidir preço ou quantidade e não grava seu estoque. A prévia consulta o validador oficial `POST /items/validate` e as tarifas do Mercado Livre, sem criar anúncio. A publicação, quando habilitada e confirmada em etapa futura, cria o anúncio no Mercado Livre e registra somente o vínculo do anúncio no catálogo local; o gate permanece desligado durante a migração.

Fonte oficial da validação prévia: [Validador de publicações](https://developers.mercadolivre.com.br/pt_br/tendencias/validador-de-publicacoes).

## Preço

`POST /mercado-livre/products/items/:itemId/price` permanece indisponível e não é anunciado como capacidade. A função antiga conserva validações locais, mas sua rota responde 503 mesmo se a flag antiga de preço for definida. Não use o `PUT /items` para contornar a ausência da API standard de preços.

A reativação depende da API standard dedicada estar disponível e de uma implementação/testes específicos para preço por canal e por variação.

O endpoint dedicado `/items/{item_id}/prices/standard` ainda não está disponível. Desde 18/03/2026, um `PUT /items/{item_id}` somente com `price` é rejeitado; se `price` vier junto com outros atributos, pode ser ignorado. Por isso a rota do ERP permanece 503 mesmo se uma flag antiga de preço for definida, e `listing_price_write_v1` não é anunciada. Para `dynamic_standard_price`, a API também rejeita atualizações de preço; a integração bloqueia anúncios com essa tag. Fontes oficiais: [API de preços](https://developers.mercadolivre.com.br/devcenter/api-de-precos) e [automação de preços](https://developers.mercadolivre.com.br/pt_br/api-docs-pt-br/automatizacoes-de-precos).

## Estoque

Estoque permanece separado do preço. Anúncios de origem única usam a rota de estoque tradicional; `warehouse_management` usa User Product, `x-version` e todas as localizações `seller_warehouse`, preservando `meli_facility`. O GET tradicional também retorna condição e tipo de anúncio, para o ERP só permitir saldo zero quando confirmar `condition=new` e tipo diferente de `free`; ausência de qualquer evidência bloqueia a proposta. A API repete essa validação antes do PUT. Nenhuma dessas rotas grava o estoque operacional do Mercado do Vale; elas enviam solicitações ao Mercado Livre somente quando o respectivo gate está habilitado.

## Habilitação

O helper `scripts/mercado-livre-stock-write-deploy.cjs` mantém os gates em zero por padrão no deploy seletivo `--mercado-livre-only`. A opção `--enable-erp-price-write` é recusada até a API standard existir e sua integração ser implementada. Estoque requer separadamente `--enable-erp-stock-write` e `MDV_ERP_WRITE_KEY` com 32–256 bytes. Não habilitar durante a migração: a chave/flag de escrita só pode ser configurada depois da reconciliação e de autorização explícita para sincronização externa.

## Testes locais

```powershell
node --test tmp-tests/mercado-livre-listing-price.test.cjs tmp-tests/mercado-livre-listing-stock-write.test.cjs tmp-tests/mercado-livre-erp-read-key.test.cjs tmp-tests/mercado-livre-stock-write-deploy.test.cjs
npm run test:mercado-livre
```

Os testes usam respostas simuladas. Eles não validam uma escrita real na conta e não habilitam os gates.
