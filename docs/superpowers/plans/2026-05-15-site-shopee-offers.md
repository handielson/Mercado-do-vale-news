# Site Shopee Offers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing Kits & Combos area into an offer center where kits and combos are created for the site first, then published/synced to Shopee.

**Architecture:** Offers are represented as real product rows so the catalog, product page, cart, and existing combo stock SQL can keep working. A quantity kit is stored as a generated combo product with one child product and quantity N; a product combo remains a combo product with multiple children. New offer metadata on product rows links offers to a base product, controls site visibility, and stores Shopee strategy/link status.

**Tech Stack:** React/Vite, TypeScript, Supabase, VPS MySQL/Fastify server, Shopee Open Platform proxy routes, Node/tsx static tests.

---

## File Structure

- `types/product-offer.ts`: shared offer contracts for UI, services, and tests.
- `services/productOfferEngine.ts`: pure helpers for stock calculation, SKU generation, offer payload shaping, and Shopee strategy choice.
- `tmp-tests/product-offer-engine.test.mjs`: behavior tests for pure offer helpers.
- `supabase/add_product_offer_fields.sql`: Supabase-side idempotent product metadata migration.
- `migrations/vps-add-product-offer-fields.sql`: VPS MySQL idempotent product metadata migration.
- `tmp-tests/product-offer-schema-static.test.mjs`: static guard for both migrations.
- `vps_server.js` and `vps_server.cjs`: product select/insert/update serialization, offer endpoints, and Bling stock webhook hooks.
- `services/vpsApiService.ts`: client methods for listing, creating, updating, and syncing offers.
- `pages/admin/products/ProductCombosPage.tsx`: evolve into the offer center while keeping the current route.
- `pages/store/PublicProductPage.tsx`: show related offers inside the base product page.
- `components/catalog/ProductCard.tsx` and `components/catalog/ModernProductCard.tsx`: label offer products in catalog cards.
- `pages/admin/settings/ShopeePage.tsx`: publish saved offers to Shopee as variation when possible or separate item when required.
- `services/shopeeOfferSync.ts`: pure helpers that convert saved offers into Shopee variation/model inputs.
- `tmp-tests/shopee-offer-sync.test.mjs`: behavior tests for Shopee offer mapping.
- `docs/operacional/ofertas-kits-site-shopee.md`: operator guide for creating and publishing offers.

---

### Task 1: Pure Offer Engine

**Files:**
- Create: `types/product-offer.ts`
- Create: `services/productOfferEngine.ts`
- Test: `tmp-tests/product-offer-engine.test.mjs`

- [ ] **Step 1: Write the failing behavior test**

Create `tmp-tests/product-offer-engine.test.mjs`:

```js
import assert from 'node:assert/strict';
import {
  buildDefaultOfferSku,
  calculateOfferStock,
  chooseShopeeOfferStrategy,
  normalizeOfferComponents,
} from '../services/productOfferEngine.ts';

const baseProduct = {
  id: 'prod-red',
  sku: 'CAPA-RN8-VERM',
  name: 'Capa Redmi Note 8 Vermelha',
  stock_quantity: 10,
  price_retail: 1490,
  price_reseller: 1296,
  price_wholesale: 1043,
  bling_id: 111,
};

const filmProduct = {
  id: 'film-rn8',
  sku: 'PEL-RN8',
  name: 'Pelicula Redmi Note 8',
  stock_quantity: 4,
  price_retail: 1000,
  price_reseller: 800,
  price_wholesale: 700,
  bling_id: 222,
};

assert.equal(buildDefaultOfferSku(baseProduct.sku, 'quantity_kit', 3), 'CAPA-RN8-VERM-KIT3');
assert.equal(buildDefaultOfferSku(baseProduct.sku, 'product_combo', 1, 'capa-pelicula'), 'CAPA-RN8-VERM-COMBO-CAPA-PELICULA');

assert.deepEqual(
  normalizeOfferComponents([{ product: baseProduct, quantity: 3 }]),
  [{ product_id: 'prod-red', quantity: 3, sku: 'CAPA-RN8-VERM', name: 'Capa Redmi Note 8 Vermelha', bling_id: 111 }],
);

assert.equal(
  calculateOfferStock([{ product: baseProduct, quantity: 3 }]),
  3,
);

assert.equal(
  calculateOfferStock([
    { product: baseProduct, quantity: 1 },
    { product: filmProduct, quantity: 1 },
  ]),
  4,
);

assert.equal(
  chooseShopeeOfferStrategy({ existingDimensionCount: 1, requestedOfferDimensionCount: 1 }),
  'variation',
);
assert.equal(
  chooseShopeeOfferStrategy({ existingDimensionCount: 2, requestedOfferDimensionCount: 1 }),
  'separate_item',
);

console.log('product offer engine tests passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd tsx tmp-tests\product-offer-engine.test.mjs`

Expected: FAIL because `services/productOfferEngine.ts` does not exist.

- [ ] **Step 3: Add offer types**

Create `types/product-offer.ts`:

```ts
export type ProductOfferType = 'quantity_kit' | 'product_combo';

export type ProductOfferShopeeStrategy = 'variation' | 'separate_item';

export type ProductOfferVisibility = 'visible' | 'hidden';

export interface ProductOfferComponent {
  product_id: string;
  quantity: number;
  sku?: string | null;
  name?: string | null;
  bling_id?: number | null;
}

export interface ProductOfferProductLike {
  id: string;
  sku?: string | null;
  name?: string | null;
  stock_quantity?: number | null;
  price_retail?: number | null;
  price_reseller?: number | null;
  price_wholesale?: number | null;
  bling_id?: number | null;
}

export interface ProductOfferDraft {
  offer_type: ProductOfferType;
  base_product_id?: string | null;
  name: string;
  sku: string;
  price_retail: number;
  price_reseller: number;
  price_wholesale: number;
  status: 'active' | 'inactive';
  offer_visibility: ProductOfferVisibility;
  shopee_strategy: ProductOfferShopeeStrategy;
  components: ProductOfferComponent[];
}
```

- [ ] **Step 4: Implement the pure engine**

Create `services/productOfferEngine.ts`:

```ts
import type {
  ProductOfferComponent,
  ProductOfferProductLike,
  ProductOfferShopeeStrategy,
  ProductOfferType,
} from '../types/product-offer';

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function slugPart(value: unknown): string {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();
}

function positiveInt(value: unknown, fallback = 0): number {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function buildDefaultOfferSku(
  baseSku: string | null | undefined,
  offerType: ProductOfferType,
  quantity = 1,
  suffix = '',
): string {
  const cleanBase = slugPart(baseSku || 'OFERTA');
  if (offerType === 'quantity_kit') return `${cleanBase}-KIT${positiveInt(quantity, 1)}`;
  const cleanSuffix = slugPart(suffix || 'COMBO');
  return `${cleanBase}-COMBO-${cleanSuffix}`;
}

export function normalizeOfferComponents(
  items: Array<{ product: ProductOfferProductLike; quantity: number }>,
): ProductOfferComponent[] {
  return items.map(({ product, quantity }) => ({
    product_id: product.id,
    quantity: positiveInt(quantity, 1),
    sku: product.sku || null,
    name: product.name || null,
    bling_id: product.bling_id ?? null,
  }));
}

export function calculateOfferStock(
  items: Array<{ product: ProductOfferProductLike; quantity: number }>,
): number {
  if (!items.length) return 0;
  const possible = items.map(({ product, quantity }) => {
    const stock = Math.max(0, Math.trunc(Number(product.stock_quantity ?? 0) || 0));
    return Math.floor(stock / positiveInt(quantity, 1));
  });
  return Math.max(0, Math.min(...possible));
}

export function hasMissingBlingLink(items: Array<{ product: ProductOfferProductLike; quantity: number }>): boolean {
  return items.some(({ product }) => !positiveInt(product.bling_id, 0));
}

export function chooseShopeeOfferStrategy(input: {
  existingDimensionCount: number;
  requestedOfferDimensionCount: number;
}): ProductOfferShopeeStrategy {
  const total = positiveInt(input.existingDimensionCount, 0) + positiveInt(input.requestedOfferDimensionCount, 0);
  return total <= 2 ? 'variation' : 'separate_item';
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx.cmd tsx tmp-tests\product-offer-engine.test.mjs`

Expected: PASS with `product offer engine tests passed`.

- [ ] **Step 6: Commit**

```bash
git add types/product-offer.ts services/productOfferEngine.ts tmp-tests/product-offer-engine.test.mjs
git commit -m "feat(offers): add offer calculation engine"
```

---

### Task 2: Product Offer Metadata Schema

**Files:**
- Create: `supabase/add_product_offer_fields.sql`
- Create: `migrations/vps-add-product-offer-fields.sql`
- Test: `tmp-tests/product-offer-schema-static.test.mjs`

- [ ] **Step 1: Write the failing static schema test**

Create `tmp-tests/product-offer-schema-static.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const supabaseSql = readFileSync('supabase/add_product_offer_fields.sql', 'utf8');
const vpsSql = readFileSync('migrations/vps-add-product-offer-fields.sql', 'utf8');

for (const sql of [supabaseSql, vpsSql]) {
  assert.match(sql, /offer_type/i);
  assert.match(sql, /offer_parent_product_id/i);
  assert.match(sql, /offer_visibility/i);
  assert.match(sql, /shopee_strategy/i);
  assert.match(sql, /shopee_offer_status/i);
  assert.match(sql, /shopee_offer_error/i);
}

assert.match(vpsSql, /ALTER TABLE products ADD COLUMN offer_type/i);
assert.match(supabaseSql, /ALTER TABLE public\.products/i);

console.log('product offer schema static checks passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tmp-tests\product-offer-schema-static.test.mjs`

Expected: FAIL because the SQL files do not exist.

- [ ] **Step 3: Add Supabase migration**

Create `supabase/add_product_offer_fields.sql`:

```sql
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS offer_type text,
ADD COLUMN IF NOT EXISTS offer_parent_product_id uuid,
ADD COLUMN IF NOT EXISTS offer_visibility text DEFAULT 'visible',
ADD COLUMN IF NOT EXISTS shopee_strategy text DEFAULT 'variation',
ADD COLUMN IF NOT EXISTS shopee_offer_status text,
ADD COLUMN IF NOT EXISTS shopee_offer_error text;

CREATE INDEX IF NOT EXISTS idx_products_offer_parent
ON public.products (offer_parent_product_id)
WHERE offer_parent_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_offer_type
ON public.products (offer_type)
WHERE offer_type IS NOT NULL;
```

- [ ] **Step 4: Add VPS MySQL migration**

Create `migrations/vps-add-product-offer-fields.sql`:

```sql
ALTER TABLE products ADD COLUMN offer_type VARCHAR(32) NULL;
ALTER TABLE products ADD COLUMN offer_parent_product_id CHAR(36) NULL;
ALTER TABLE products ADD COLUMN offer_visibility VARCHAR(16) NULL DEFAULT 'visible';
ALTER TABLE products ADD COLUMN shopee_strategy VARCHAR(32) NULL DEFAULT 'variation';
ALTER TABLE products ADD COLUMN shopee_offer_status VARCHAR(32) NULL;
ALTER TABLE products ADD COLUMN shopee_offer_error TEXT NULL;

CREATE INDEX idx_products_offer_parent ON products (offer_parent_product_id);
CREATE INDEX idx_products_offer_type ON products (offer_type);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node tmp-tests\product-offer-schema-static.test.mjs`

Expected: PASS with `product offer schema static checks passed`.

- [ ] **Step 6: Commit**

```bash
git add supabase/add_product_offer_fields.sql migrations/vps-add-product-offer-fields.sql tmp-tests/product-offer-schema-static.test.mjs
git commit -m "feat(offers): add offer metadata migrations"
```

---

### Task 3: VPS Offer Serialization and Endpoints

**Files:**
- Modify: `vps_server.js`
- Modify: `vps_server.cjs`
- Modify: `services/vpsApiService.ts`
- Test: `tmp-tests/product-offer-vps-static.test.mjs`

- [ ] **Step 1: Write the failing static VPS test**

Create `tmp-tests/product-offer-vps-static.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync('vps_server.js', 'utf8');
const service = readFileSync('services/vpsApiService.ts', 'utf8');

assert.match(server, /offer_type/);
assert.match(server, /offer_parent_product_id/);
assert.match(server, /fastify\.get\('\/offers'/);
assert.match(server, /fastify\.post\('\/offers'/);
assert.match(server, /fastify\.put\('\/offers\/:id'/);
assert.match(service, /async getOffers/);
assert.match(service, /async createOffer/);
assert.match(service, /async updateOffer/);

console.log('product offer VPS static checks passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tmp-tests\product-offer-vps-static.test.mjs`

Expected: FAIL because the offer endpoints and methods are not present.

- [ ] **Step 3: Extend product select fields in both VPS server files**

In `vps_server.js` and `vps_server.cjs`, add these fields anywhere the product SELECT lists include product metadata such as `kits`, `is_combo`, and `combo_discount_value`:

```sql
offer_type, offer_parent_product_id, offer_visibility,
shopee_strategy, shopee_offer_status, shopee_offer_error
```

In the row mapping blocks that parse `kits`, keep values as plain strings:

```js
offer_type: r.offer_type || null,
offer_parent_product_id: r.offer_parent_product_id || null,
offer_visibility: r.offer_visibility || 'visible',
shopee_strategy: r.shopee_strategy || 'variation',
shopee_offer_status: r.shopee_offer_status || null,
shopee_offer_error: r.shopee_offer_error || null,
```

- [ ] **Step 4: Extend product batch upsert and update columns**

In both VPS server files, add the new product columns to insert/update handling near the existing `kits` field:

```js
p.offer_type || null,
p.offer_parent_product_id || null,
p.offer_visibility || 'visible',
p.shopee_strategy || 'variation',
p.shopee_offer_status || null,
p.shopee_offer_error || null,
```

For duplicate update expressions, add:

```sql
offer_type=VALUES(offer_type),
offer_parent_product_id=VALUES(offer_parent_product_id),
offer_visibility=VALUES(offer_visibility),
shopee_strategy=VALUES(shopee_strategy),
shopee_offer_status=VALUES(shopee_offer_status),
shopee_offer_error=VALUES(shopee_offer_error)
```

- [ ] **Step 5: Add offer endpoints beside existing combo endpoints**

In both VPS server files, add endpoints after the `/combos/:id` endpoint:

```js
fastify.get('/offers', async (req, reply) => {
  const [rows] = await pool.query(
    `SELECT *
     FROM products
     WHERE offer_type IS NOT NULL
     ORDER BY updated_at DESC`
  );
  reply.send(rows.map((r) => ({
    ...r,
    images: typeof r.images === 'string' ? JSON.parse(r.images || '[]') : r.images,
    specs: typeof r.specs === 'string' ? JSON.parse(r.specs || '{}') : r.specs,
    kits: typeof r.kits === 'string' ? JSON.parse(r.kits || '[]') : r.kits,
  })));
});

fastify.post('/offers', { preHandler: requireSyncKey }, async (req, reply) => {
  req.body = { ...(req.body || {}), is_combo: true };
  return fastify.inject({
    method: 'POST',
    url: '/combos',
    headers: { 'x-vps-sync-key': req.headers['x-vps-sync-key'] },
    payload: req.body,
  }).then((res) => reply.code(res.statusCode).send(JSON.parse(res.body || '{}')));
});

fastify.put('/offers/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  return fastify.inject({
    method: 'PUT',
    url: `/combos/${req.params.id}`,
    headers: { 'x-vps-sync-key': req.headers['x-vps-sync-key'] },
    payload: req.body || {},
  }).then((res) => reply.code(res.statusCode).send(JSON.parse(res.body || '{}')));
});
```

- [ ] **Step 6: Add client methods**

In `services/vpsApiService.ts`, add methods near the combo methods:

```ts
async getOffers(): Promise<any[]> {
  return this.fetchSafe<any[]>('/offers', true) || [];
}

async createOffer(payload: unknown): Promise<{ ok: boolean; id?: string }> {
  this.invalidateProductCache();
  try {
    const res = await fetch(proxyUrl('/offers', 'POST'), {
      method: 'POST',
      headers: await this.authHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false };
    return await res.json();
  } catch {
    return { ok: false };
  }
}

async updateOffer(id: string, payload: unknown): Promise<{ ok: boolean }> {
  this.invalidateProductCache();
  try {
    const res = await fetch(proxyUrl(`/offers/${id}`, 'PUT'), {
      method: 'PUT',
      headers: await this.authHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false };
    return await res.json();
  } catch {
    return { ok: false };
  }
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `node tmp-tests\product-offer-vps-static.test.mjs`

Expected: PASS with `product offer VPS static checks passed`.

- [ ] **Step 8: Commit**

```bash
git add vps_server.js vps_server.cjs services/vpsApiService.ts tmp-tests/product-offer-vps-static.test.mjs
git commit -m "feat(offers): expose offer endpoints"
```

---

### Task 4: Offer Center UI

**Files:**
- Modify: `pages/admin/products/ProductCombosPage.tsx`
- Test: `tmp-tests/product-offer-ui-static.test.mjs`

- [ ] **Step 1: Write the failing static UI test**

Create `tmp-tests/product-offer-ui-static.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/products/ProductCombosPage.tsx', 'utf8');

assert.match(page, /Ofertas\/Kits/);
assert.match(page, /Kit por quantidade/);
assert.match(page, /Combo de produtos/);
assert.match(page, /offer_type/);
assert.match(page, /offer_parent_product_id/);
assert.match(page, /createOffer/);
assert.match(page, /updateOffer/);
assert.match(page, /buildDefaultOfferSku/);
assert.match(page, /calculateOfferStock/);

console.log('product offer UI static checks passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tmp-tests\product-offer-ui-static.test.mjs`

Expected: FAIL because the page still uses only combo wording and combo methods.

- [ ] **Step 3: Add imports and type fields**

In `pages/admin/products/ProductCombosPage.tsx`, add:

```ts
import {
  buildDefaultOfferSku,
  calculateOfferStock,
  hasMissingBlingLink,
  normalizeOfferComponents,
} from '../../../services/productOfferEngine';
import type { ProductOfferType, ProductOfferShopeeStrategy } from '../../../types/product-offer';
```

Extend `ProductComboFormData`:

```ts
offer_type?: ProductOfferType;
offer_parent_product_id?: string | null;
offer_visibility?: 'visible' | 'hidden';
shopee_strategy?: ProductOfferShopeeStrategy;
shopee_offer_status?: string | null;
shopee_offer_error?: string | null;
```

- [ ] **Step 4: Rename page copy and initial data**

Change the page title to `Ofertas/Kits` and subtitle to `Crie kits e combos para o site e sincronize com a Shopee`.

Change `openNewComboModal` so the initial object includes:

```ts
offer_type: 'product_combo',
offer_parent_product_id: null,
offer_visibility: 'visible',
shopee_strategy: 'variation',
```

- [ ] **Step 5: Add offer type controls in the modal**

Inside the modal body before product search, add two buttons:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
  {[
    ['quantity_kit', 'Kit por quantidade', 'Mesmo produto em pacote com desconto'],
    ['product_combo', 'Combo de produtos', 'Produtos diferentes vendidos juntos'],
  ].map(([value, label, description]) => (
    <button
      key={value}
      type="button"
      onClick={() => setEditingCombo({ ...editingCombo, offer_type: value as ProductOfferType, combo_children: [] })}
      className={`rounded-lg border p-3 text-left transition-colors ${
        editingCombo.offer_type === value ? 'border-teal-500 bg-teal-50' : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <p className="text-sm font-bold text-slate-800">{label}</p>
      <p className="text-xs text-slate-500">{description}</p>
    </button>
  ))}
</div>
```

- [ ] **Step 6: Shape quantity kit children**

When `offer_type === 'quantity_kit'`, allow selecting one base product and a quantity. Store it as:

```ts
combo_children: [
  {
    id: baseProduct.id,
    name: baseProduct.name,
    sku: baseProduct.sku,
    quantity: selectedQuantity,
    price_retail: baseProduct.price_retail,
    stock_quantity: baseProduct.stock_quantity,
  },
],
offer_parent_product_id: baseProduct.id,
sku: buildDefaultOfferSku(baseProduct.sku, 'quantity_kit', selectedQuantity),
name: `${baseProduct.name} - Kit ${selectedQuantity}`,
```

- [ ] **Step 7: Calculate offer stock and Bling warning**

Before saving, build:

```ts
const componentProducts = editingCombo.combo_children.map((child) => ({
  product: allProducts.find((p) => p.id === child.id) || child,
  quantity: child.quantity,
}));
const offerStock = calculateOfferStock(componentProducts);
const missingBling = hasMissingBlingLink(componentProducts);
```

Show a warning if `missingBling` is true:

```tsx
{missingBling && (
  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-700">
    Um ou mais componentes nao tem Bling ID. O estoque da oferta pode ficar incompleto.
  </div>
)}
```

- [ ] **Step 8: Save via offer methods**

In `handleSaveCombo`, include the metadata:

```ts
offer_type: editingCombo.offer_type || 'product_combo',
offer_parent_product_id: editingCombo.offer_parent_product_id || editingCombo.combo_children[0]?.id || null,
offer_visibility: editingCombo.offer_visibility || 'visible',
shopee_strategy: editingCombo.shopee_strategy || 'variation',
stock_quantity: offerStock,
combo_children: normalizeOfferComponents(componentProducts).map((component) => ({
  id: component.product_id,
  quantity: component.quantity,
})),
```

Call `vpsApiService.createOffer(payload)` for new records and `vpsApiService.updateOffer(editingCombo.id, payload)` for existing records.

- [ ] **Step 9: Run test to verify it passes**

Run: `node tmp-tests\product-offer-ui-static.test.mjs`

Expected: PASS with `product offer UI static checks passed`.

- [ ] **Step 10: Commit**

```bash
git add pages/admin/products/ProductCombosPage.tsx tmp-tests/product-offer-ui-static.test.mjs
git commit -m "feat(offers): evolve combos page into offer center"
```

---

### Task 5: Site Catalog and Product Page Display

**Files:**
- Modify: `pages/store/PublicProductPage.tsx`
- Modify: `components/catalog/ProductCard.tsx`
- Modify: `components/catalog/ModernProductCard.tsx`
- Test: `tmp-tests/product-offer-site-static.test.mjs`

- [ ] **Step 1: Write the failing static site test**

Create `tmp-tests/product-offer-site-static.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const publicPage = readFileSync('pages/store/PublicProductPage.tsx', 'utf8');
const card = readFileSync('components/catalog/ProductCard.tsx', 'utf8');
const modernCard = readFileSync('components/catalog/ModernProductCard.tsx', 'utf8');

assert.match(publicPage, /offer_parent_product_id/);
assert.match(publicPage, /Ofertas relacionadas/);
assert.match(publicPage, /selectedOfferId/);
assert.match(card, /offer_type/);
assert.match(card, /Kit|Combo/);
assert.match(modernCard, /offer_type/);
assert.match(modernCard, /Kit|Combo/);

console.log('product offer site static checks passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tmp-tests\product-offer-site-static.test.mjs`

Expected: FAIL because product page does not load related offers by parent product.

- [ ] **Step 3: Load related offers in product page**

In `pages/store/PublicProductPage.tsx`, add state:

```ts
const [relatedOffers, setRelatedOffers] = useState<any[]>([]);
const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
```

After the main product loads, fetch offers:

```ts
const allProducts = await vpsApiService.getProducts({ noCache: true, limit: 9999 });
const offers = (allProducts || []).filter((candidate: any) =>
  candidate.offer_parent_product_id === data.id &&
  candidate.offer_visibility !== 'hidden' &&
  candidate.status === 'active'
);
setRelatedOffers(offers);
```

- [ ] **Step 4: Render related offers near existing kit/price options**

In the buy box area, add:

```tsx
{relatedOffers.length > 0 && (
  <div className="mt-5 space-y-3">
    <p className="text-sm font-bold text-slate-800">Ofertas relacionadas</p>
    <div className="grid gap-2">
      {relatedOffers.map((offer) => (
        <button
          key={offer.id}
          type="button"
          onClick={() => setSelectedOfferId(offer.id)}
          className={`rounded-lg border p-3 text-left transition-colors ${
            selectedOfferId === offer.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-900">{offer.name}</p>
              <p className="text-xs text-slate-500">{offer.offer_type === 'quantity_kit' ? 'Kit' : 'Combo'}</p>
            </div>
            <p className="text-sm font-bold text-slate-900">
              R$ {(Number(offer.price_retail || 0) / 100).toFixed(2).replace('.', ',')}
            </p>
          </div>
        </button>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 5: Use selected offer for add-to-cart**

Before adding to cart, resolve:

```ts
const selectedOffer = relatedOffers.find((offer) => offer.id === selectedOfferId) || null;
const productForCart = selectedOffer || product;
```

Use `productForCart.id`, `productForCart.name`, `productForCart.price_retail`, and `productForCart.stock_quantity` in the cart item payload.

- [ ] **Step 6: Label offer catalog cards**

In both catalog card files, add:

```tsx
{product.offer_type && (
  <span className="inline-flex items-center rounded bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-700">
    {product.offer_type === 'quantity_kit' ? 'Kit' : 'Combo'}
  </span>
)}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `node tmp-tests\product-offer-site-static.test.mjs`

Expected: PASS with `product offer site static checks passed`.

- [ ] **Step 8: Commit**

```bash
git add pages/store/PublicProductPage.tsx components/catalog/ProductCard.tsx components/catalog/ModernProductCard.tsx tmp-tests/product-offer-site-static.test.mjs
git commit -m "feat(offers): show offers on storefront"
```

---

### Task 6: Shopee Offer Mapping

**Files:**
- Create: `services/shopeeOfferSync.ts`
- Modify: `pages/admin/settings/ShopeePage.tsx`
- Test: `tmp-tests/shopee-offer-sync.test.mjs`

- [ ] **Step 1: Write the failing Shopee mapping test**

Create `tmp-tests/shopee-offer-sync.test.mjs`:

```js
import assert from 'node:assert/strict';
import {
  buildShopeeOfferModelName,
  buildShopeeOfferModelSku,
  mapOfferToShopeeModelInput,
} from '../services/shopeeOfferSync.ts';

const offer = {
  id: 'offer-kit2',
  offer_type: 'quantity_kit',
  sku: 'CAPA-RN8-VERM-KIT2',
  name: 'Capa Redmi Note 8 Vermelha - Kit 2',
  price_retail: 2790,
  stock_quantity: 5,
};

assert.equal(buildShopeeOfferModelName(offer), 'Kit 2');
assert.equal(buildShopeeOfferModelSku(offer), 'CAPA-RN8-VERM-KIT2');

assert.deepEqual(mapOfferToShopeeModelInput(offer), {
  model_sku: 'CAPA-RN8-VERM-KIT2',
  normal_stock: 5,
  original_price: 27.9,
  seller_stock: [{ stock: 5 }],
  tier_index: [0],
});

console.log('shopee offer sync tests passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd tsx tmp-tests\shopee-offer-sync.test.mjs`

Expected: FAIL because `services/shopeeOfferSync.ts` does not exist.

- [ ] **Step 3: Add pure Shopee offer mapper**

Create `services/shopeeOfferSync.ts`:

```ts
export type ShopeeOfferLike = {
  id: string;
  offer_type?: string | null;
  name?: string | null;
  sku?: string | null;
  price_retail?: number | null;
  stock_quantity?: number | null;
};

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function stock(value: unknown): number {
  return Math.max(0, Math.trunc(Number(value) || 0));
}

export function buildShopeeOfferModelName(offer: ShopeeOfferLike): string {
  const name = text(offer.name);
  const kitMatch = name.match(/\bKit\s+\d+/i);
  if (kitMatch) return kitMatch[0].replace(/\s+/, ' ');
  return offer.offer_type === 'product_combo' ? 'Combo' : 'Oferta';
}

export function buildShopeeOfferModelSku(offer: ShopeeOfferLike): string {
  return text(offer.sku || offer.id).slice(0, 100);
}

export function mapOfferToShopeeModelInput(offer: ShopeeOfferLike, tierIndex = 0) {
  const qty = stock(offer.stock_quantity);
  return {
    model_sku: buildShopeeOfferModelSku(offer),
    normal_stock: qty,
    original_price: Number(((Number(offer.price_retail || 0) / 100)).toFixed(2)),
    seller_stock: [{ stock: qty }],
    tier_index: [tierIndex],
  };
}
```

- [ ] **Step 4: Integrate Shopee page entry point**

In `pages/admin/settings/ShopeePage.tsx`, import:

```ts
import { mapOfferToShopeeModelInput } from '../../../services/shopeeOfferSync';
```

Where `publishWithVariations` builds `variationPayloadParts`, add a branch for saved offers passed into the modal:

```ts
const offerModelList = Array.isArray((product as any).related_offers)
  ? (product as any).related_offers.map((offer: any, index: number) => mapOfferToShopeeModelInput(offer, index))
  : [];
```

When `offerModelList.length > 0` and `product.shopee_strategy === 'variation'`, merge `offerModelList` into the outgoing `model_list`.

When `product.shopee_strategy === 'separate_item'`, keep the existing non-variation `add_item`/`update_item` flow using the offer product as `product`.

- [ ] **Step 5: Save offer link status after publication**

After a successful Shopee publish, update the product/offer row with:

```ts
await vpsApiService.updateOffer(product.id, {
  ...(product as any),
  shopee_item_id: shopeeItemId,
  shopee_offer_status: 'synced',
  shopee_offer_error: null,
});
```

On failure, update:

```ts
await vpsApiService.updateOffer(product.id, {
  ...(product as any),
  shopee_offer_status: 'error',
  shopee_offer_error: errorMessage,
});
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx.cmd tsx tmp-tests\shopee-offer-sync.test.mjs`

Expected: PASS with `shopee offer sync tests passed`.

- [ ] **Step 7: Commit**

```bash
git add services/shopeeOfferSync.ts pages/admin/settings/ShopeePage.tsx tmp-tests/shopee-offer-sync.test.mjs
git commit -m "feat(shopee): map offers to Shopee models"
```

---

### Task 7: Automatic Stock Sync Hook

**Files:**
- Modify: `vps_server.js`
- Modify: `vps_server.cjs`
- Test: `tmp-tests/product-offer-stock-sync-static.test.mjs`

- [ ] **Step 1: Write the failing static stock sync test**

Create `tmp-tests/product-offer-stock-sync-static.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync('vps_server.js', 'utf8');

assert.match(server, /recalculateOfferStockForProduct/);
assert.match(server, /\/products\/stock/);
assert.match(server, /offer_parent_product_id/);
assert.match(server, /product_combos pc/);

console.log('product offer stock sync static checks passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tmp-tests\product-offer-stock-sync-static.test.mjs`

Expected: FAIL because `recalculateOfferStockForProduct` does not exist.

- [ ] **Step 3: Add stock recalculation helper to both VPS server files**

Add near existing stock helpers:

```js
async function recalculateOfferStockForProduct(productId) {
  await pool.query(
    `UPDATE products offer
     SET offer.stock_quantity = COALESCE((
       SELECT MIN(FLOOR(child.stock_quantity / pc.quantity))
       FROM product_combos pc
       JOIN products child ON child.id = pc.child_product_id
       WHERE pc.combo_product_id = offer.id
     ), 0),
     offer.updated_at = CURRENT_TIMESTAMP
     WHERE offer.id IN (
       SELECT DISTINCT pc.combo_product_id
       FROM product_combos pc
       WHERE pc.child_product_id = ?
     )`,
    [productId]
  );
}
```

- [ ] **Step 4: Call helper after Bling stock updates**

In the `/products/stock` route after updating by `sku` or `bling_id`, fetch the affected product id:

```js
const [affectedRows] = await pool.query(
  'SELECT id FROM products WHERE sku = ? OR bling_id = ? LIMIT 1',
  [sku || '', bling_id || 0]
);
const affectedProductId = affectedRows?.[0]?.id;
if (affectedProductId) await recalculateOfferStockForProduct(affectedProductId);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node tmp-tests\product-offer-stock-sync-static.test.mjs`

Expected: PASS with `product offer stock sync static checks passed`.

- [ ] **Step 6: Commit**

```bash
git add vps_server.js vps_server.cjs tmp-tests/product-offer-stock-sync-static.test.mjs
git commit -m "feat(offers): recalculate offer stock from Bling updates"
```

---

### Task 8: Operator Documentation and Verification

**Files:**
- Create: `docs/operacional/ofertas-kits-site-shopee.md`

- [ ] **Step 1: Add operator guide**

Create `docs/operacional/ofertas-kits-site-shopee.md`:

```md
# Ofertas/Kits no Site e Shopee

## Fluxo de criacao

1. Acesse `Produtos > Ofertas/Kits`.
2. Clique em `Nova Oferta`.
3. Escolha `Kit por quantidade` ou `Combo de produtos`.
4. Selecione os produtos componentes.
5. Confira nome, SKU, preco, imagens e descricao.
6. Salve a oferta.

## Site

Ofertas ativas e visiveis aparecem como produto proprio no catalogo e como opcao relacionada na pagina do produto principal.

## Estoque

O estoque vem do Bling:

- Kit por quantidade: estoque do produto dividido pela quantidade do kit.
- Combo: menor estoque disponivel entre os componentes.

## Shopee

Depois de salvar a oferta, use `Publicar/Sincronizar Shopee`.

O sistema publica como variacao quando a Shopee permitir. Quando o anuncio ja tiver dimensoes demais, publique a oferta como anuncio separado.

## Erros comuns

- Sem Bling ID: vincule os produtos componentes ao Bling antes de confiar no estoque automatico.
- Sem imagem: adicione imagem na oferta antes de publicar na Shopee.
- Categoria/atributo Shopee pendente: complete o modal da Shopee e tente de novo.
```

- [ ] **Step 2: Run focused tests**

Run:

```bash
node tmp-tests\product-offer-schema-static.test.mjs
node tmp-tests\product-offer-vps-static.test.mjs
node tmp-tests\product-offer-ui-static.test.mjs
node tmp-tests\product-offer-site-static.test.mjs
node tmp-tests\product-offer-stock-sync-static.test.mjs
npx.cmd tsx tmp-tests\product-offer-engine.test.mjs
npx.cmd tsx tmp-tests\shopee-offer-sync.test.mjs
```

Expected: every command exits 0.

- [ ] **Step 3: Run production build**

Run: `npm.cmd run build`

Expected: Vite build exits 0.

- [ ] **Step 4: Commit docs and any final polish**

```bash
git add docs/operacional/ofertas-kits-site-shopee.md
git commit -m "docs(offers): document site and Shopee offer flow"
```

---

## Self-Review

- Spec coverage: the plan covers offer creation, site display as product and related option, Bling-based stock, Shopee variation/separate item strategy, saved Shopee status, and automatic stock recalculation.
- Placeholder scan: no plan step uses TBD or deferred requirements.
- Type consistency: offer fields use `offer_type`, `offer_parent_product_id`, `offer_visibility`, `shopee_strategy`, `shopee_offer_status`, and `shopee_offer_error` consistently across schema, VPS, UI, site, and Shopee tasks.
