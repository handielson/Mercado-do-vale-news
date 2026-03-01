# Pendências — Mercado do Vale

## 🐛 Bugs Conhecidos

### 1. Filtro de estoque ignora `track_inventory = false`
**Arquivo:** `services/productGrouping.ts` → função `filterAvailableProducts`

**Problema:** Produtos com `track_inventory = false` (estoque infinito) estão sendo incorretamente filtrados quando `stock_quantity <= 0`, porque o código não verifica se o rastreamento está ativo antes de aplicar o filtro.

**Exemplo real:** Suporte Carona Universal — Branco (`track_inventory = false`, `stock_quantity = 0`) sumiu do catálogo público mesmo estando ativo com estoque infinito.

**Correção necessária:**
```ts
// ❌ Código atual (errado)
if (!includeOutOfStock && product.track_inventory && (product.stock_quantity ?? 0) <= 0) {
    return false;
}

// ✅ Código correto
if (!includeOutOfStock && product.track_inventory === true && (product.stock_quantity ?? 0) <= 0) {
    return false;
}
```

> A diferença é usar `=== true` para garantir que só filtra quando explicitamente rastreando estoque. `track_inventory = false` = infinito → nunca filtrar.

---
