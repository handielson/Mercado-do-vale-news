# Bling

Documento mestre da integracao com o Bling no Mercado do Vale.

Este arquivo descreve a estrutura dos webhooks, os campos sincronizados, as rotas internas, os contratos com a VPS, os pontos de diagnostico e os testes que protegem a integracao. A regra principal: alteracoes de produto vindas do Bling precisam refletir nome, valor e estoque no Supabase e na VPS.

## Arquivos principais

- `api/bling-webhook.ts`: receptor dedicado dos webhooks do Bling.
- `api/bling.ts`: rota agregadora para consultas, sincronizacoes manuais, reconciliacao, webhook legado e logs.
- `vps_server.cjs`: API da VPS que recebe atualizacoes de produto, estoque, nome e campos comerciais.
- `docs/operacional/bling-webhook-precos.md`: runbook curto para diagnostico de mudancas de produto via webhook.
- `tmp-tests/bling-webhook-regressions.test.mjs`: guarda regressiva do webhook.
- `tmp-tests/bling-sync-prices-vps-regression.test.mjs`: guarda regressiva da sincronizacao Supabase -> VPS.
- `tmp-tests/external-integrations-total-stock-static.test.mjs`: guarda regressiva de estoque total em integracoes externas.

## Rotas publicas e internas

### Webhook principal

```text
https://www.mercadodovale.com.br/api/bling-webhook
```

Essa e a rota preferencial para configurar no Bling. Ela aceita `POST` e processa eventos de produto e estoque.

### Webhook legado

```text
https://www.mercadodovale.com.br/api/bling?resource=webhook
```

Essa rota existe por compatibilidade. Ela encaminha para o mesmo handler de `api/bling-webhook.ts`, para evitar duas implementacoes divergentes.

### Logs recentes de webhook

```text
https://www.mercadodovale.com.br/api/bling?resource=webhook-logs
```

Consulta os registros salvos em `webhook_logs`. Use para confirmar se o evento chegou, qual payload veio do Bling e qual rota recebeu o webhook.

### Consulta direta na VPS

```text
https://api.xiaomipetrolina.com.br/products?search=SKU&status=all&limit=10&compact=true&_t=diag
```

Use `search`, `status=all` e `_t` em diagnosticos para evitar conclusoes erradas por cache ou por produtos inativos.

## Variaveis de ambiente

### Vercel/API

- `VITE_SUPABASE_URL` ou `SUPABASE_URL`: URL do Supabase.
- `SUPABASE_SERVICE_ROLE_KEY` ou `VITE_SUPABASE_ANON_KEY`: chave usada pela API para gravar no Supabase.
- `VITE_VPS_BASE_URL`: base da VPS. Fallback atual: `https://api.xiaomipetrolina.com.br`.
- `VPS_SYNC_KEY` ou `VITE_VPS_SYNC_KEY`: chave enviada para a VPS no header `x-sync-key`.
- `BLING_WEBHOOK_SECRET`: segredo para verificacao HMAC, quando configurado.

### Credenciais salvas no Supabase

A tabela `company_settings` guarda:

- `bling_access_token`
- `bling_refresh_token`
- `bling_token_expires_at`
- `bling_client_id`
- `bling_client_secret`

Quando o token expira, as rotas tentam renovar usando o `refresh_token`. Se a renovacao falhar com `400` ou `401`, o webhook limpa `bling_access_token` para expor a desconexao no admin e para parar de usar token antigo.

## Webhook: fluxo geral

1. Recebe `POST`.
2. Se o payload for Mercado Pago, despacha para `handleMercadoPagoWebhook`.
3. Le `event` ou `evento`.
4. Salva payload em `webhook_logs`.
5. Carrega credenciais do Bling em `company_settings`.
6. Renova token se necessario.
7. Classifica evento:
   - estoque: `event` contem `stock`, `estoque` ou `movimentacao`.
   - produto: `event` contem `product` ou `produto`.
8. Atualiza Supabase.
9. Atualiza VPS.
10. Responde `200`, mesmo em muitos casos de erro operacional, para evitar retries infinitos quando o problema e de dados/configuracao.

## Eventos de produto

Eventos de produto sao tratados quando o `event` contem `product` ou `produto`, por exemplo:

```json
{
  "event": "product.updated",
  "data": {
    "id": 16067598992,
    "codigo": "CA10PRE",
    "nome": "Capa de Silicone para Redmi 13 4G | Poco M6 4G",
    "preco": 14.99,
    "estoque": {
      "saldoFisicoTotal": 3
    }
  }
}
```

### Identificacao do produto

O webhook tenta identificar:

- `blingId`: `data.produto.id`, `dados.produto.id` ou `data.id`.
- `sku`: `data.produto.codigo`, `dados.produto.codigo` ou `data.codigo`.
- `nome`: `data.nome`, `data.name` ou detalhe buscado na API do Bling.
- `preco`: `data.preco`.

Se o SKU nao vier no payload, o webhook tenta:

1. buscar detalhe em `GET /produtos/{blingId}` no Bling, quando tem token valido;
2. buscar produto na VPS por `bling_id`.

Se nao resolver SKU, responde com `SKU not found for bling_id`.

### Nome

Campo de origem:

- `data.nome`
- `data.name`
- detalhe do produto no Bling, quando necessario
- nome atual na VPS como fallback

Destino:

- Supabase: `products.name`, filtrando por `bling_id`.
- VPS: `PATCH /products/name`.

Contrato VPS:

```json
{
  "sku": "CA10PRE",
  "name": "Capa de Silicone para Redmi 13 4G | Poco M6 4G"
}
```

### Valor

Campo de origem:

- `data.preco`

Regra:

- O Bling envia preco em reais, como `14.99`.
- O sistema local grava `price_retail` em centavos, como `1499`.
- Conversao usada: `Math.round(Number(preco) * 100)`.

Destino:

- Supabase: `products.price_retail`, filtrando por `bling_id`.
- VPS: `PATCH /products/prices-stock`.
- Quando o evento de preco vem de um produto pai do Bling, o webhook tambem atualiza
  as variacoes locais cujo `bling_parent_id` aponta para o `bling_id` do pai. O lote
  enviado para a VPS inclui o SKU do pai e os SKUs filhos, mas propaga somente
  `price_retail` para os filhos; estoque de pai nao e copiado para variacoes.

Contrato VPS:

```json
{
  "products": [
    {
      "sku": "CA10PRE",
      "price_retail": 1499
    }
  ]
}
```

### Estoque dentro de produto

O Bling pode mandar estoque junto no evento de produto. O webhook tenta ler, nesta ordem:

- `data.stock_quantity`
- `data.saldoFisicoTotal`
- `data.saldoFisico`
- `data.saldoVirtualTotal`
- `data.saldoVirtual`
- `data.estoque.saldoFisicoTotal`
- `data.estoque.saldoFisico`
- `data.estoque.saldoVirtualTotal`
- `data.estoque.saldoVirtual`
- `body.data.saldoFisicoTotal`
- `body.dados.saldoFisicoTotal`

Regra:

- converte para numero;
- trunca casas decimais;
- nunca deixa negativo: `Math.max(0, Math.trunc(Number(payloadStock)))`.

Destino:

- Supabase: `products.stock_quantity`, filtrando por `bling_id`.
- VPS: `PATCH /products/prices-stock`, no mesmo lote de valor quando aplicavel.

Contrato VPS:

```json
{
  "products": [
    {
      "sku": "CA10PRE",
      "stock_quantity": 3
    }
  ]
}
```

Quando nome, valor e estoque chegam juntos, o resultado esperado e:

```json
{
  "sku": "CA10PRE",
  "name": "Capa de Silicone para Redmi 13 4G | Poco M6 4G",
  "price_retail": 1499,
  "stock_quantity": 3
}
```

## Eventos de estoque

Eventos de estoque sao tratados quando o `event` contem:

- `stock`
- `estoque`
- `movimentacao`

Exemplos esperados:

```json
{
  "event": "stock.updated",
  "data": {
    "produto": {
      "id": 16067598992,
      "codigo": "CA10PRE"
    },
    "saldoFisicoTotal": 3
  }
}
```

ou:

```json
{
  "evento": "movimentacaoEstoque",
  "dados": {
    "produto": {
      "id": 16067598992,
      "codigo": "CA10PRE"
    },
    "saldoFisicoTotal": 3
  }
}
```

### Regra com token valido

Quando ha token valido, o webhook consulta o Bling:

```text
GET https://api.bling.com.br/Api/v3/estoques/saldos?idsProdutos[]=BLING_ID
```

Ele usa `saldoFisicoTotal` quando presente. Se nao vier, soma `saldoFisico` dos depositos retornados.

### Regra sem token

Quando nao ha token, o webhook usa `saldoFisicoTotal` do payload se ele existir.

Se nao houver token nem estoque no payload, a atualizacao e abortada.

### Fallback quando API falha

Se a API do Bling falha:

- se payload nao tem estoque, aborta;
- se payload retorna `0`, aborta para evitar zerar estoque por erro de API;
- se payload tem valor maior que zero, usa o payload como fallback.

Essa regra evita que instabilidade do Bling zere estoque indevidamente.

### Destinos do estoque

Supabase:

```ts
products.stock_quantity = stockQty
```

Filtro:

- por `bling_id`, quando existe;
- por `sku`, quando nao ha `bling_id`.

VPS:

```text
PATCH /products/stock
```

Contrato por `bling_id`:

```json
{
  "bling_id": 16067598992,
  "stock_quantity": 3
}
```

Contrato por SKU:

```json
{
  "sku": "CA10PRE",
  "stock_quantity": 3
}
```

## Contratos da VPS

### `PATCH /products/name`

Usado para nome vindo de `product.updated`.

```json
{
  "sku": "CA10PRE",
  "name": "Nome novo"
}
```

Atualiza:

- `products.name`
- `updated_at`

### `PATCH /products/stock`

Usado para eventos dedicados de estoque.

```json
{
  "sku": "CA10PRE",
  "stock_quantity": 3
}
```

ou:

```json
{
  "bling_id": 16067598992,
  "stock_quantity": 3
}
```

Atualiza:

- `products.stock_quantity`
- `updated_at`

### `PATCH /products/prices-stock`

Usado para sincronizacao comercial em lote. Aceita array direto ou objeto com `products`.

Contrato correto:

```json
{
  "products": [
    {
      "sku": "CA10PRE",
      "price_retail": 1499,
      "stock_quantity": 3
    }
  ]
}
```

Campos permitidos na VPS:

- `price_retail`
- `price_wholesale`
- `price_cost`
- `price_reseller`
- `price_promo`
- `promo_start`
- `promo_end`
- `stock_quantity`
- `status`
- `category_id`
- `track_inventory`

Importante: enviar `{ "sku": "...", "price_retail": 1499 }` direto nao atende o contrato atual da VPS. O formato correto e `{ "products": [...] }` ou array direto.

## Sincronizacao em lote

A rota:

```text
/api/bling?resource=sync-prices-vps&page=0
```

sincroniza dados ja salvos no Supabase para a VPS.

Ela nao consulta o Bling em tempo real. Ela existe para reconciliar ou reenviar dados locais para a VPS em lotes.

Campos importantes carregados do Supabase:

- `id`
- `name`
- `sku`
- `status`
- `category_id`
- `price_retail`
- `price_reseller`
- `price_wholesale`
- `price_cost`
- `stock_quantity`
- `track_inventory`
- `is_combo`
- `bling_id`
- `bling_parent_id`
- `parent_id`

Os campos de ligacao Bling (`bling_id`, `bling_parent_id`, `parent_id`) precisam ser preservados, porque o webhook depende deles para resolver produto depois.

## Reconciliacao

A rota:

```text
/api/bling?resource=reconcile
```

compara dados locais com dados atuais do Bling e monta/aplica um plano de mudancas. Ela e usada para corrigir divergencias que nao foram resolvidas por webhook em tempo real.

O fluxo de reconciliacao consulta:

- produtos no Bling;
- saldos de estoque no Bling;
- produtos locais no Supabase.

Quando aplica mudancas, tambem envia atualizacoes relevantes para a VPS, como estoque e nome.

## Logs e evidencias

### Webhook recebido

Consultar:

```text
https://www.mercadodovale.com.br/api/bling?resource=webhook-logs
```

Procurar:

- `event` ou `evento`
- `data.id`
- `data.codigo`
- `data.nome`
- `data.preco`
- `data.estoque`
- `_route`

### Log esperado em produto

```text
[bling-webhook] product -> SKU=CA10PRE name="Nome" price_retail=1499 stock_quantity=3 VPS=true
```

Se `VPS=false`, o Supabase pode ter sido atualizado, mas a VPS pode nao ter recebido.

### Log esperado em estoque

```text
[bling-webhook] stock -> SKU=CA10PRE blingId=16067598992 qty=3 source=api VPS=true
```

`source` pode ser:

- `api`: estoque veio da API do Bling.
- `payload_no_token`: nao havia token, entao usou payload.
- `payload_api_fallback`: API falhou, entao usou payload positivo.

## Diagnostico rapido

### Produto nao mudou nome, valor ou estoque

1. Consulte `webhook-logs`.
2. Confirme que chegou `product.updated`.
3. Confirme que o payload tem `id` ou `codigo`.
4. Confirme que o payload tem o campo esperado:
   - nome: `nome` ou `name`;
   - valor: `preco`;
   - estoque: `estoque.saldoFisicoTotal` ou equivalente.
5. Consulte a VPS por SKU com `status=all`.
6. Confira logs da Vercel para `VPS=true` ou `VPS=false`.
7. Se o Supabase mudou e a VPS nao mudou, investigar `VPS_SYNC_KEY`/`VITE_VPS_SYNC_KEY` e contrato do endpoint.
8. Se nada mudou, conferir `bling_id` no produto local.

### Estoque zerou ou nao mudou

1. Verifique se era evento de produto ou evento de estoque.
2. Em evento de estoque, veja `source` no log.
3. Se a API do Bling falhou e o payload era `0`, o webhook aborta de proposito.
4. Consulte diretamente o saldo no Bling, quando possivel.
5. Consulte a VPS e Supabase para comparar `stock_quantity`.

### Preco mudou no Bling mas nao na loja

1. Confirme `data.preco`.
2. Confirme conversao: `14.99` precisa virar `1499`.
3. Confirme que a VPS recebeu `/products/prices-stock` com `{ "products": [...] }`.
4. Consulte a VPS com:

```text
https://api.xiaomipetrolina.com.br/products?search=SKU&status=all&limit=10&compact=true&_t=diag
```

## Testes de regressao

Rodar depois de mexer em Bling/webhook/VPS:

```powershell
node tmp-tests\bling-webhook-regressions.test.mjs
node tmp-tests\external-integrations-total-stock-static.test.mjs
node tmp-tests\bling-sync-prices-vps-regression.test.mjs
npm.cmd run build
```

Se `npm.cmd run build` falhar no sandbox com erro de acesso ao `vite.config.ts`, repetir fora do sandbox com permissao elevada. Esse erro de acesso nao e necessariamente erro do codigo.

## Historico recente de bugs corrigidos

### Payload errado para `/products/prices-stock`

Sintoma:

- webhook recebia `product.updated`;
- `updated_at` mudava;
- preco continuava antigo na VPS.

Causa:

- o webhook enviava `{ sku, price_retail }` direto para `/products/prices-stock`;
- a VPS esperava array ou `{ products: [...] }`.

Correcao:

```ts
patchVps('/products/prices-stock', { products: [{ sku: resolvedSku, ...updates }] })
```

### Estoque dentro de `product.updated`

Sintoma:

- alteracao de produto podia trazer nome/valor/estoque no mesmo evento;
- o webhook de produto tratava nome e valor, mas estoque so era tratado em evento dedicado.

Correcao:

- `product.updated` agora le estoque do payload quando presente;
- normaliza em `stock_quantity`;
- grava no Supabase;
- envia para a VPS no batch `/products/prices-stock`.

## Regras de manutencao

- Nao criar segunda implementacao de webhook no legado; manter `api/bling?resource=webhook` como proxy para `api/bling-webhook.ts`.
- Sempre preservar compatibilidade com `VPS_SYNC_KEY` e `VITE_VPS_SYNC_KEY`.
- Nunca trocar o contrato de `/products/prices-stock` sem atualizar testes e VPS.
- Para preco, lembrar que Bling envia reais e o sistema guarda centavos.
- Para estoque, usar sempre estoque total em `products.stock_quantity`; nao misturar locais internos de estoque com integracoes externas.
- Produtos sem `bling_id` dependem de SKU e sao menos confiaveis para webhook.
- Ao mexer no webhook, atualizar este arquivo e o teste `tmp-tests/bling-webhook-regressions.test.mjs`.
