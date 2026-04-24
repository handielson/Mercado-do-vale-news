# Catalog Variation Label Casing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Padronizar a exibição dos nomes de variação no catálogo para `Title Case`, independentemente de como vierem do Bling.

**Architecture:** Reutilizar o formatter já existente de texto para criar um helper específico de labels de variação, preservando os valores crus usados nas comparações internas. Aplicar o helper apenas nos pontos de renderização do catálogo que mostram nomes de cor/variação.

**Tech Stack:** TypeScript, React, Node assert tests, Vite

---

### Task 1: Cobrir o formatter com TDD

**Files:**
- Modify: `components/catalog/modernProductCardState.test.mjs`
- Modify: `utils/stringFormatters.ts`

- [ ] **Step 1: Write the failing test**

```js
assert.equal(formatVariationLabel('PRETO'), 'Preto');
assert.equal(formatVariationLabel('AZUL MARINHO'), 'Azul Marinho');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node .\components\catalog\modernProductCardState.test.mjs`
Expected: FAIL because `formatVariationLabel` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export function formatVariationLabel(str?: string): string {
    return toTitleCase(str);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node .\components\catalog\modernProductCardState.test.mjs`
Expected: PASS

### Task 2: Aplicar formatter nos labels do catálogo

**Files:**
- Modify: `components/catalog/ModernProductCard.tsx`
- Modify: `components/catalog/VariantSelector.tsx`

- [ ] **Step 1: Replace rendered color labels**

```tsx
formatVariationLabel(color.name)
formatVariationLabel(variant.colors[currentColorIndex]?.name)
formatVariationLabel(product.specs?.color)
```

- [ ] **Step 2: Keep internal matching on raw values**

```tsx
const isSelected = selected.color === color.name;
onClick={() => handleColorSelect(color.name)}
```

- [ ] **Step 3: Run focused verification**

Run: `node .\components\catalog\modernProductCardState.test.mjs`
Expected: PASS

- [ ] **Step 4: Run build verification**

Run: `npm.cmd run build`
Expected: Build succeeds without new errors
