# Shopee Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Shopee templates so products can receive safe titles, descriptions, categories, attributes, price/stock defaults, and dangerous-term alerts before being published.

**Architecture:** Add a small template domain with types, a pure resolver module, a Supabase-backed service with local fallback, a templates management page, and integration into the existing `ShopeeSyncModal`. Keep the existing Shopee upload/publish logic intact and only hydrate the modal state before publishing.

**Tech Stack:** React, TypeScript, Supabase, Vite, existing Shopee API proxy, existing static Node regression tests.

---

## File Structure

- Create `types/shopee-template.ts`: typed template, matching rule, dangerous term, apply result, and template input contracts.
- Create `services/shopeeTemplateEngine.ts`: pure helpers for variable interpolation, template scoring, title safety checks, and applying template defaults.
- Create `services/shopeeTemplateService.ts`: persistence layer for templates and dangerous terms, with Supabase first and localStorage fallback if the table is not present yet.
- Create `pages/admin/settings/ShopeeTemplatesPage.tsx`: CRUD page under Shopee settings.
- Create `supabase/add_shopee_templates.sql`: table definitions and RLS-safe indexes.
- Modify `routes/index.tsx`: lazy-load and route `/admin/settings/shopee/templates`.
- Modify `pages/admin/settings/ShopeePage.tsx`: add Templates tab/link and integrate templates into `ShopeeSyncModal`.
- Modify `Shopee.md`: keep the planned feature section as the source of product decisions.
- Test `tmp-tests/shopee-template-engine.test.mjs`: pure behavior test for variable rendering, rule scoring, dangerous terms, and safe-title suggestion.
- Test `tmp-tests/shopee-templates-page-static.test.mjs`: static route/page/service coverage.
- Test `tmp-tests/shopee-sync-modal-template-static.test.mjs`: static modal integration coverage.

## Task 1: Template Types And Engine

**Files:**
- Create: `types/shopee-template.ts`
- Create: `services/shopeeTemplateEngine.ts`
- Test: `tmp-tests/shopee-template-engine.test.mjs`

- [ ] **Step 1: Write the failing engine test**

Create `tmp-tests/shopee-template-engine.test.mjs` that imports the built helper through `tsx` or performs static checks before implementation. It must cover:

```js
assert.equal(
  renderShopeeTemplateText('Capa compativel com {modelo} Cor:{cor}', sampleProduct),
  'Capa compativel com iPhone 13 Cor:Vermelho'
);

assert.equal(
  analyzeShopeeTitleSafety('Capa para iPhone', dangerousRules).suggestedTitle,
  'Capa compativel com iPhone'
);

assert.equal(
  resolveBestShopeeTemplate(sampleProduct, templates)?.id,
  'phone_case'
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd tsx tmp-tests\shopee-template-engine.test.mjs`

Expected: FAIL because `services/shopeeTemplateEngine.ts` does not exist.

- [ ] **Step 3: Add types**

Create `types/shopee-template.ts` with:

```ts
export type ShopeeTemplatePriceMode = 'product' | 'fixed' | 'percent';
export type ShopeeTemplateStockMode = 'product' | 'fixed';
export type ShopeeTemplateDimensionMode = 'product' | 'fixed';
export type ShopeeTemplateGtinMode = 'product' | 'no_gtin' | 'blank';
export type ShopeeDangerLevel = 'warning' | 'block';

export interface ShopeeTemplateRule {
  categoryId?: string;
  nameIncludes?: string[];
  skuIncludes?: string[];
  brandIncludes?: string[];
  modelIncludes?: string[];
}

export interface ShopeeDangerousTermRule {
  id: string;
  term: string;
  replacement?: string;
  level: ShopeeDangerLevel;
  note?: string;
  active: boolean;
}

export interface ShopeeTemplate {
  id: string;
  name: string;
  active: boolean;
  priority: number;
  rules: ShopeeTemplateRule;
  titleTemplate: string;
  descriptionTemplate: string;
  shopeeCategoryId?: number | null;
  shopeeCategoryName?: string | null;
  attributeDefaults: Record<string, string | string[]>;
  priceMode: ShopeeTemplatePriceMode;
  fixedPrice?: number | null;
  pricePercent?: number | null;
  stockMode: ShopeeTemplateStockMode;
  fixedStock?: number | null;
  dimensionMode: ShopeeTemplateDimensionMode;
  weightKg?: number | null;
  packageLength?: number | null;
  packageWidth?: number | null;
  packageHeight?: number | null;
  gtinMode: ShopeeTemplateGtinMode;
  dangerousTerms: ShopeeDangerousTermRule[];
  createdAt?: string;
  updatedAt?: string;
}
```

- [ ] **Step 4: Implement engine helpers**

Create `services/shopeeTemplateEngine.ts` with exported functions:

```ts
export function renderShopeeTemplateText(template: string, product: Record<string, any>): string;
export function analyzeShopeeTitleSafety(title: string, rules: ShopeeDangerousTermRule[]): ShopeeTitleSafetyResult;
export function resolveBestShopeeTemplate(product: Record<string, any>, templates: ShopeeTemplate[]): ShopeeTemplate | null;
export function applyShopeeTemplateToProduct(product: Record<string, any>, template: ShopeeTemplate): ShopeeTemplateApplyResult;
```

The initial matching rule should score category, name, SKU, brand, model, then sort by `priority` and score.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx.cmd tsx tmp-tests\shopee-template-engine.test.mjs`

Expected: PASS.

## Task 2: Persistence And Database

**Files:**
- Create: `services/shopeeTemplateService.ts`
- Create: `supabase/add_shopee_templates.sql`
- Test: `tmp-tests/shopee-template-service-static.test.mjs`

- [ ] **Step 1: Write static failing test**

Assert that the service uses table `shopee_templates`, exposes `list/create/update/remove`, and has fallback keys `shopee_templates_cache_v1`.

- [ ] **Step 2: Add SQL**

Create `supabase/add_shopee_templates.sql` with `create table if not exists public.shopee_templates`, JSONB columns for `rules`, `attribute_defaults`, `dangerous_terms`, and indexes on `company_id`, `active`, `priority`.

- [ ] **Step 3: Add service**

Implement `shopeeTemplateService`:

```ts
export const shopeeTemplateService = {
  list,
  create,
  update,
  remove,
  seedDefaultsIfEmpty,
};
```

The default seed should include `Capa de celular` with title `Capa compativel com {modelo} Cor:{cor}` and dangerous rules for `para iPhone`, `original`, and `oficial`.

- [ ] **Step 4: Run static test**

Run: `node tmp-tests\shopee-template-service-static.test.mjs`

Expected: PASS.

## Task 3: Templates Page

**Files:**
- Create: `pages/admin/settings/ShopeeTemplatesPage.tsx`
- Modify: `routes/index.tsx`
- Test: `tmp-tests/shopee-templates-page-static.test.mjs`

- [ ] **Step 1: Write static failing test**

Assert route `/admin/settings/shopee/templates`, page import, labels `Templates da Shopee`, `Novo template`, `Titulo sugerido`, `Termos perigosos`.

- [ ] **Step 2: Implement page**

Create a two-column operational UI:

- left: searchable template list with active/inactive badge and `Novo template`;
- right: editor sections for matching rules, suggested title, description, Shopee category, attributes JSON, price/stock/dimensions/GTIN, dangerous terms;
- bottom: preview with sample product selector/input.

- [ ] **Step 3: Add route**

Add lazy import and protected route:

```tsx
const ShopeeTemplatesPage = lazy(() => import('../pages/admin/settings/ShopeeTemplatesPage'));
```

Route:

```tsx
{
  path: "/admin/settings/shopee/templates",
  element: (
    <ProtectedRoute requireAdmin={true}>
      <AdminLayout><ShopeeTemplatesPage /></AdminLayout>
    </ProtectedRoute>
  )
}
```

- [ ] **Step 4: Run static test**

Run: `node tmp-tests\shopee-templates-page-static.test.mjs`

Expected: PASS.

## Task 4: Shopee Modal Integration

**Files:**
- Modify: `pages/admin/settings/ShopeePage.tsx`
- Test: `tmp-tests/shopee-sync-modal-template-static.test.mjs`

- [ ] **Step 1: Write static failing test**

Assert `ShopeeSyncModal` imports `shopeeTemplateService`, `resolveBestShopeeTemplate`, `applyShopeeTemplateToProduct`, and `analyzeShopeeTitleSafety`.

- [ ] **Step 2: Load templates on modal open**

Inside `ShopeeSyncModal`, add state for templates, selected template id, suggested template id, title safety result, and dirty guards.

- [ ] **Step 3: Apply selected template**

When a template is selected:

- set `itemName` from rendered safe title unless title was manually edited;
- set description unless manually edited;
- set category if template category is configured;
- set attribute defaults after category attributes load;
- set price/stock/dimensions/GTIN according to template modes.

- [ ] **Step 4: Add UI**

Add a compact template panel above the existing step body:

- select template;
- badge for automatic suggestion;
- `Aplicar template`;
- title warning/blocking alerts;
- `Aplicar titulo sugerido`.

- [ ] **Step 5: Block unsafe publish**

In `handleSync`, if title safety has active `block` matches, show toast and do not publish.

- [ ] **Step 6: Run static test**

Run: `node tmp-tests\shopee-sync-modal-template-static.test.mjs`

Expected: PASS.

## Task 5: Verification And Release

**Files:**
- Modify only files touched by previous tasks.

- [ ] **Step 1: Run focused tests**

Run:

```powershell
node tmp-tests\shopee-template-service-static.test.mjs
node tmp-tests\shopee-templates-page-static.test.mjs
node tmp-tests\shopee-sync-modal-template-static.test.mjs
npx.cmd tsx tmp-tests\shopee-template-engine.test.mjs
node pages\admin\settings\shopeeFieldTemplates.test.mjs
node pages\admin\settings\shopeeSyncDefaults.test.mjs
```

- [ ] **Step 2: Run build**

Run: `npm.cmd run build`

Expected: Vite build passes.

- [ ] **Step 3: Commit and push**

Stage only Shopee template files and docs. Do not stage unrelated `vps_server.cjs` or loose workspace files.

Commit message:

```bash
git commit -m "feat(shopee): add product export templates"
```

- [ ] **Step 4: Confirm deploy**

Run: `npx.cmd vercel ls mercado-do-vale-news`

Expected: newest production deploy reaches `Ready`.
