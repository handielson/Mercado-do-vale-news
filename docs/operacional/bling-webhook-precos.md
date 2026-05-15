# Bling webhook - sincronizacao de produto

Documento operacional para diagnostico de alteracoes de nome, valor e estoque vindas do Bling.

## Rotas envolvidas

- Webhook principal: `https://www.mercadodovale.com.br/api/bling-webhook`
- Webhook legado compativel: `https://www.mercadodovale.com.br/api/bling?resource=webhook`
- Logs recentes: `https://www.mercadodovale.com.br/api/bling?resource=webhook-logs`
- API VPS de produto: `https://api.xiaomipetrolina.com.br/products`

## Comportamento esperado

Quando o Bling envia `product.updated`, o webhook atualiza os campos disponiveis no payload:

- `products.name` no Supabase e na VPS, quando `data.nome` ou `data.name` vem no payload.
- `products.price_retail` no Supabase, filtrando pelo `bling_id`.
- `products.price_retail` na VPS, chamando `PATCH /products/prices-stock` com o contrato em lote `{ "products": [{ "sku": "...", "price_retail": 1499 }] }`.
- Se o evento de preco for do produto pai do Bling, o webhook procura filhos locais
  por `bling_parent_id` e envia um lote com o SKU do pai e os SKUs das variacoes.
  Essa propagacao altera somente `price_retail`; estoque recebido no produto pai
  nao e replicado nos filhos.
- `products.stock_quantity` no Supabase e na VPS quando o payload de produto traz estoque (`estoque.saldoFisicoTotal`, `saldoFisicoTotal` ou campos equivalentes).

Exemplo:

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

Resultado esperado no sistema:

```json
{
  "sku": "CA10PRE",
  "name": "Capa de Silicone para Redmi 13 4G | Poco M6 4G",
  "price_retail": 1499,
  "stock_quantity": 3
}
```

## Diferenca entre webhook e sincronizacao em lote

O webhook e a rotina `sync-prices-vps` nao fazem a mesma coisa:

- `api/bling-webhook.ts` recebe eventos em tempo real do Bling. Para produto, usa `data.nome`, `data.preco` e estoque presente no payload do evento.
- `api/bling.ts?resource=sync-prices-vps` sincroniza dados ja salvos no Supabase para a VPS, em lotes de 50 produtos. Ela nao consulta o Bling em tempo real.

Se nome, preco ou estoque mudou no Bling mas nao apareceu na loja:

1. Consultar `webhook-logs` e procurar `event: "product.updated"` do SKU ou `bling_id`.
2. Confirmar se o payload tem o campo esperado (`data.nome`, `data.preco` ou estoque).
3. Consultar a VPS com `status=all` e `search` para evitar cache:

```text
https://api.xiaomipetrolina.com.br/products?search=SKU&status=all&limit=10&compact=true&_t=diag
```

4. Se o payload tem o campo, mas a VPS nao mudou, verificar logs da Vercel para `product -> SKU=... price_retail=... stock_quantity=... VPS=...`.
5. Se o webhook nao chegou, conferir a configuracao de Webhooks no Bling.

## Observacoes

- A rota `/products` da VPS retorna `Cache-Control: no-store` quando usa `search` ou `status=all`; esse e o caminho recomendado para diagnostico.
- O catalogo publico pode ter cache curto quando a chamada nao usa busca/admin, mas isso nao explica divergencia se a consulta direta acima ainda retorna o preco antigo.
- Produtos sem `bling_id` nao recebem atualizacao confiavel por webhook.
