# Bling webhook - sincronizacao de precos

Documento operacional para diagnostico de alteracoes de valor vindas do Bling.

## Rotas envolvidas

- Webhook principal: `https://www.mercadodovale.com.br/api/bling-webhook`
- Webhook legado compativel: `https://www.mercadodovale.com.br/api/bling?resource=webhook`
- Logs recentes: `https://www.mercadodovale.com.br/api/bling?resource=webhook-logs`
- API VPS de produto: `https://api.xiaomipetrolina.com.br/products`

## Comportamento esperado

Quando o Bling envia `product.updated` com `data.preco`, o webhook converte o valor em reais para centavos e atualiza:

- `products.price_retail` no Supabase, filtrando pelo `bling_id`.
- `products.price_retail` na VPS, chamando `PATCH /products/prices-stock` com o contrato em lote `{ "products": [{ "sku": "...", "price_retail": 1499 }] }`.

Exemplo:

```json
{
  "event": "product.updated",
  "data": {
    "id": 16067598992,
    "codigo": "CA10PRE",
    "preco": 14.99
  }
}
```

Resultado esperado no sistema:

```json
{
  "sku": "CA10PRE",
  "price_retail": 1499
}
```

## Diferenca entre webhook e sincronizacao em lote

O webhook e a rotina `sync-prices-vps` nao fazem a mesma coisa:

- `api/bling-webhook.ts` recebe eventos em tempo real do Bling. Para preco, usa `data.preco` do payload do evento.
- `api/bling.ts?resource=sync-prices-vps` sincroniza dados ja salvos no Supabase para a VPS, em lotes de 50 produtos. Ela nao consulta o Bling em tempo real.

Se o preco mudou no Bling mas nao apareceu na loja:

1. Consultar `webhook-logs` e procurar `event: "product.updated"` do SKU ou `bling_id`.
2. Confirmar se o payload tem `data.preco`.
3. Consultar a VPS com `status=all` e `search` para evitar cache:

```text
https://api.xiaomipetrolina.com.br/products?search=SKU&status=all&limit=10&compact=true&_t=diag
```

4. Se o payload tem `preco`, mas a VPS nao mudou, verificar logs da Vercel para `product -> SKU=... price_retail=... VPS=...`.
5. Se o webhook nao chegou, conferir a configuracao de Webhooks no Bling.

## Observacoes

- A rota `/products` da VPS retorna `Cache-Control: no-store` quando usa `search` ou `status=all`; esse e o caminho recomendado para diagnostico.
- O catalogo publico pode ter cache curto quando a chamada nao usa busca/admin, mas isso nao explica divergencia se a consulta direta acima ainda retorna o preco antigo.
- Produtos sem `bling_id` nao recebem atualizacao confiavel por webhook.
