# PDV Serialized Inventory Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild only the serialized-item flow in the PDV so products with the same SKU stay grouped in one product card when searching by name/SKU, exact IMEI/serial scans add the matching unit directly to the cart, and finalization writes off only the chosen physical unit.

**Architecture:** Keep the existing PDV structure for customers, payments, delivery, cart, receipt, discounts, and finalization. Replace only the name/SKU product-search serialization logic with a small domain service that returns product cards containing either normal stock data or a list of available serialized units. The `Nome / SKU` UI renders one card per product and delegates the exact unit choice to a selector/list inside the card; the `IMEI / Serial` UI bypasses cards and adds the exact resolved unit directly.

**Tech Stack:** React + TypeScript, Vite, existing VPS MySQL API (`vps_server.js`), `unitService`, `vpsApiService`, static regression tests under `tmp-tests`, production deploy via `publish-vps`.

---

## Domain Summary

Serialized products work like this:

- Multiple physical items may share the same product/SKU.
- Each physical item is represented by one `units` row.
- Unique identifiers live on the unit:
  - smartphones: `imei_1`, optional `imei_2`, optional `serial`;
  - receivers: usually only `serial`;
  - other devices: any available combination of `imei_1`, `imei_2`, `serial`.
- A sale must write off exactly the selected unit row, not the product/SKU as a generic quantity.
- `products.stock_quantity` is still useful as a total, but not enough to sell a serialized item.
- Legacy identifiers in `product.specs` must not decide what appears in PDV search.

## Current Problem

The PDV currently mixes three sources:

- `products.stock_quantity`;
- `units`;
- legacy `product.specs.imei1`, `product.specs.imei2`, `product.specs.serial`.

That causes inconsistent cards:

- one product card shows several serials in one text line;
- another shows SKU only;
- another shows one serial;
- the admin cannot clearly select the exact equipment being sold;
- finalization depends on whether the add action received `unitData`.

## Target Behavior

1. Products remain grouped in one card per product/SKU.
2. Normal non-serialized products keep the current PDV behavior:
   - show SKU;
   - show quantity input;
   - add product quantity to cart;
   - use existing payment/finalization/cart logic.
3. Serialized products show one grouped product card with an internal unit selector/list only in `Nome / SKU` search:
   - card title remains product name/specs as today;
   - card shows `N unidades disponiveis`;
   - inside the card, each available unit is listed with its identifiers;
   - admin selects one unit before adding;
   - quantity is locked to 1 for serialized unit sale;
   - add to cart passes `unitData` for the selected unit.
4. `IMEI / Serial` tab remains scanner-friendly and direct-to-cart:
   - scanning `imei_1` for smartphones finds the exact unit;
   - scanning serial for receivers finds the exact unit;
   - found available unit is added to cart immediately with `unitData`;
   - this mode must not show the product card selector, because the scanner/typed identifier already selected the equipment.
5. Finalization must write off only the selected unit:
   - selected `unitId` is stored on sale item as `serialized_unit.unitId`;
   - receipt/termo/print use that exact IMEI/serial;
   - stock sync marks only that unit sold/reserved according to the existing finalization flow.
6. No search result text should ever concatenate several serials into a single line.
7. The same selected `unitId` cannot be added twice to the cart before finalization.
8. If a selected serialized unit is no longer available during finalization, the sale flow must surface a finalization issue for that unit and must not decrement generic product stock for the serialized item.

---

## File Structure

**Create**

- `services/pdvSerializedInventory.ts`
  - Converts raw products + available units into PDV-ready product cards.
  - Defines card shape and unit option shape.
  - Owns unit identifier labels.

- `tmp-tests/pdv-serialized-inventory-core.test.mjs`
  - Behavior test for grouped product cards with internal unit options.

- `tmp-tests/pdv-serialized-inventory-ui-static.test.mjs`
  - Guard that keeps unit decision logic out of `ProductSearchSection.tsx`.

- `tmp-tests/pdv-vps-search-units-static.test.mjs`
  - Mandatory guard for one VPS hydrated search endpoint.

- `tmp-tests/pdv-serialized-finalization-static.test.mjs`
  - Guard that cart/finalization keep one exact selected unit and do not decrement generic stock for serialized items.

**Modify**

- `components/pdv/ProductSearchSection.tsx`
  - In `Nome / SKU`, render `PdvSearchCard[]`, not raw `Product[]`.
  - In `Nome / SKU`, render serialized units as a selector/list inside one product card.
  - In `IMEI / Serial`, resolve the exact unit and call `onAddToCart(product, 1, unitData)` directly.
  - Remove ad-hoc joined serial strings.

- `pages/pdv/PDVPage.tsx`
  - Keep existing `handleAddToCart(product, quantity, unitData)` contract.
  - Reject the same serialized `unitId` if it is already in the cart.
  - Do not rebuild payment/finalization sections.

- `services/saleService.ts`
  - Preserve selected `serialized_unit_id`.
  - Mark only the selected unit as sold.
  - Keep serialized items out of generic stock decrement.

- `utils/pdvProductDisplay.ts`
  - Keep cart/receipt product naming compatible with selected unit data.

- `services/units.ts`
  - Keep as transport wrapper.

- `services/vpsApiService.ts`, `vps_server.js`, `vps_server.cjs`
  - Required final search path: one hydrated PDV search endpoint that returns products with available units.

---

## Domain Contract

Create `services/pdvSerializedInventory.ts` with these types:

```ts
import type { Product } from '../types/product';
import type { Unit } from '../types/unit';

export type PdvSerializedUnitOption = {
    id: string;
    unit: Unit;
    label: string;
    detail: string;
    unitData: {
        unitId: string;
        imei1?: string;
        imei2?: string;
        serial?: string;
    };
};

export type PdvSearchCard =
    | {
        kind: 'serialized-product';
        id: string;
        product: Product;
        title: string;
        subtitle: string;
        stockLabel: string;
        quantityLocked: true;
        unitOptions: PdvSerializedUnitOption[];
      }
    | {
        kind: 'stock-product';
        id: string;
        product: Product;
        title: string;
        subtitle: string;
        stockLabel: string;
        quantityLocked: false;
        maxQuantity?: number;
        unitOptions: [];
      };
```

Rules:

- `serialized-product.id` must be `product:${product.id}:serialized`.
- `stock-product.id` must be `product:${product.id}:stock`.
- A product with available unit rows becomes exactly one `serialized-product` card.
- That card contains one `unitOptions[]` entry per available unit.
- Each `unitOptions[]` entry shows one physical unit, not a product.
- `unitOptions[].label` should prefer:
  - `IMEI 1: ${imei_1}` when present;
  - else `Serial: ${serial_number}` when present;
  - else `IMEI 2: ${imei_2}` when present;
  - else `Unidade: ${unit.id.slice(0, 8)}`.
- `unitOptions[].detail` may include secondary identifiers:
  - if label uses IMEI 1 and unit has IMEI 2 value `860000000000002`, include `IMEI 2: 860000000000002`;
  - if label uses IMEI 1 and unit has serial value `AT2209901885`, include `Serial: AT2209901885`;
  - for serial-only receiver, detail can be empty or location/status metadata later.
- Sold/reserved/RMA units are never present in `unitOptions`.
- Legacy `product.specs` identifiers are ignored in the search card builder.

---

### Task 1: Add Core Failing Test For Grouped Serialized Cards

**Files:**
- Create: `tmp-tests/pdv-serialized-inventory-core.test.mjs`
- Create later: `services/pdvSerializedInventory.ts`

- [ ] **Step 1: Write the failing test**

Create `tmp-tests/pdv-serialized-inventory-core.test.mjs`:

```js
import assert from 'node:assert/strict';

const mod = await import('../services/pdvSerializedInventory.ts');

const products = [
  {
    id: 'prod-athomics',
    name: 'Athomics Inspire Lite',
    sku: 'rail',
    track_inventory: true,
    stock_quantity: 3,
    price_retail: 45000,
    specs: { serial: 'LEGACY-SHOULD-NOT-RENDER' },
  },
  {
    id: 'prod-cable',
    name: 'Cabo USB-C',
    sku: 'CABO-USB',
    track_inventory: true,
    stock_quantity: 3,
    price_retail: 2500,
    specs: {},
  },
];

const unitsByProduct = new Map([
  ['prod-athomics', [
    { id: 'unit-1', product_id: 'prod-athomics', status: 'available', imei_1: '', imei_2: '', serial_number: 'AT2209901430', condition: 'new', created: '', updated: '' },
    { id: 'unit-2', product_id: 'prod-athomics', status: 'available', imei_1: '', imei_2: '', serial_number: 'AT2209901450', condition: 'new', created: '', updated: '' },
    { id: 'unit-sold', product_id: 'prod-athomics', status: 'sold', imei_1: '', imei_2: '', serial_number: 'SOLD-SHOULD-NOT-SHOW', condition: 'new', created: '', updated: '' },
  ]],
  ['prod-cable', []],
]);

const cards = await mod.buildPdvSearchCards(products, {
  listUnitsByProduct: async (productId) => unitsByProduct.get(productId) || [],
});

assert.equal(cards.length, 2, 'one serialized product card plus one normal stock product card');

const serialized = cards.find((card) => card.id === 'product:prod-athomics:serialized');
assert.equal(serialized.kind, 'serialized-product');
assert.equal(serialized.stockLabel, '2 unidades disponiveis');
assert.equal(serialized.quantityLocked, true);
assert.equal(serialized.unitOptions.length, 2);
assert.deepEqual(
  serialized.unitOptions.map((option) => option.label),
  ['Serial: AT2209901430', 'Serial: AT2209901450'],
);
assert.deepEqual(
  serialized.unitOptions.map((option) => option.unitData.unitId),
  ['unit-1', 'unit-2'],
);
assert.ok(
  serialized.unitOptions.every((option) => !option.label.includes('SOLD-SHOULD-NOT-SHOW')),
  'sold units must not be selectable',
);
assert.ok(
  JSON.stringify(serialized).includes('LEGACY-SHOULD-NOT-RENDER') === false,
  'legacy specs identifiers must not render in PDV search cards',
);

const cable = cards.find((card) => card.id === 'product:prod-cable:stock');
assert.equal(cable.kind, 'stock-product');
assert.equal(cable.subtitle, 'SKU: CABO-USB');
assert.equal(cable.quantityLocked, false);
assert.equal(cable.maxQuantity, 3);
assert.equal(cable.stockLabel, '3 disponiveis');

console.log('pdv serialized inventory core checks passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node tmp-tests\pdv-serialized-inventory-core.test.mjs
```

Expected:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '../services/pdvSerializedInventory.ts'
```

---

### Task 2: Implement `pdvSerializedInventory`

**Files:**
- Create: `services/pdvSerializedInventory.ts`
- Test: `tmp-tests/pdv-serialized-inventory-core.test.mjs`

- [ ] **Step 1: Implement the service**

Create `services/pdvSerializedInventory.ts`:

```ts
import type { Product } from '../types/product';
import type { Unit } from '../types/unit';
import { UnitStatus } from '../utils/field-standards';

export type PdvSerializedUnitOption = {
    id: string;
    unit: Unit;
    label: string;
    detail: string;
    unitData: {
        unitId: string;
        imei1?: string;
        imei2?: string;
        serial?: string;
    };
};

export type PdvSearchCard =
    | {
        kind: 'serialized-product';
        id: string;
        product: Product;
        title: string;
        subtitle: string;
        stockLabel: string;
        quantityLocked: true;
        unitOptions: PdvSerializedUnitOption[];
      }
    | {
        kind: 'stock-product';
        id: string;
        product: Product;
        title: string;
        subtitle: string;
        stockLabel: string;
        quantityLocked: false;
        maxQuantity?: number;
        unitOptions: [];
      };

export type PdvSearchCardDeps = {
    listUnitsByProduct(productId: string): Promise<Unit[]>;
};

function cleanText(value: unknown): string {
    return String(value || '').trim();
}

function isAvailableUnit(unit: Unit): boolean {
    return unit.status === UnitStatus.AVAILABLE || String(unit.status) === 'available';
}

function formatStockLabel(quantity: number | undefined): string {
    const qty = Math.max(0, Math.trunc(Number(quantity || 0)));
    return qty === 1 ? '1 disponivel' : `${qty} disponiveis`;
}

function formatUnitCountLabel(quantity: number): string {
    return quantity === 1 ? '1 unidade disponivel' : `${quantity} unidades disponiveis`;
}

export function buildPdvUnitOption(unit: Unit): PdvSerializedUnitOption {
    const imei1 = cleanText(unit.imei_1);
    const imei2 = cleanText(unit.imei_2);
    const serial = cleanText(unit.serial_number);

    const label = imei1
        ? `IMEI 1: ${imei1}`
        : serial
            ? `Serial: ${serial}`
            : imei2
                ? `IMEI 2: ${imei2}`
                : `Unidade: ${String(unit.id || '').slice(0, 8)}`;

    const detail = [
        imei1 && imei2 ? `IMEI 2: ${imei2}` : '',
        imei1 && serial ? `Serial: ${serial}` : '',
    ].filter(Boolean).join(' | ');

    return {
        id: `unit:${unit.id}`,
        unit,
        label,
        detail,
        unitData: {
            unitId: unit.id,
            imei1: imei1 || undefined,
            imei2: imei2 || undefined,
            serial: serial || undefined,
        },
    };
}

export function buildStockProductCard(product: Product): Extract<PdvSearchCard, { kind: 'stock-product' }> {
    return {
        kind: 'stock-product',
        id: `product:${product.id}:stock`,
        product,
        title: product.name,
        subtitle: `SKU: ${product.sku || '-'}`,
        stockLabel: product.track_inventory ? formatStockLabel(product.stock_quantity) : 'Disponivel',
        quantityLocked: false,
        maxQuantity: product.track_inventory ? Math.max(0, Math.trunc(Number(product.stock_quantity || 0))) : undefined,
        unitOptions: [],
    };
}

export function buildSerializedProductCard(
    product: Product,
    availableUnits: Unit[],
): Extract<PdvSearchCard, { kind: 'serialized-product' }> {
    const unitOptions = availableUnits.filter(isAvailableUnit).map(buildPdvUnitOption);
    return {
        kind: 'serialized-product',
        id: `product:${product.id}:serialized`,
        product,
        title: product.name,
        subtitle: product.sku ? `SKU: ${product.sku}` : 'Produto serializado',
        stockLabel: formatUnitCountLabel(unitOptions.length),
        quantityLocked: true,
        unitOptions,
    };
}

export async function buildPdvSearchCards(
    products: Product[],
    deps: PdvSearchCardDeps,
): Promise<PdvSearchCard[]> {
    const cards: PdvSearchCard[] = [];

    for (const product of products) {
        const units = product.track_inventory
            ? await deps.listUnitsByProduct(product.id).catch(() => [])
            : [];
        const availableUnits = units.filter(isAvailableUnit);

        if (availableUnits.length > 0) {
            cards.push(buildSerializedProductCard(product, availableUnits));
            continue;
        }

        cards.push(buildStockProductCard(product));
    }

    return cards;
}
```

- [ ] **Step 2: Run test**

Run:

```powershell
node tmp-tests\pdv-serialized-inventory-core.test.mjs
```

Expected:

```text
pdv serialized inventory core checks passed
```

- [ ] **Step 3: Commit**

```powershell
git add -- services/pdvSerializedInventory.ts tmp-tests/pdv-serialized-inventory-core.test.mjs
git commit -m "feat(pdv): model serialized product cards"
```

---

### Task 3: Add UI Guard For Grouped Serialized Cards

**Files:**
- Create: `tmp-tests/pdv-serialized-inventory-ui-static.test.mjs`
- Modify later: `components/pdv/ProductSearchSection.tsx`

- [ ] **Step 1: Write failing static guard**

Create `tmp-tests/pdv-serialized-inventory-ui-static.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/pdv/ProductSearchSection.tsx', 'utf8');

assert.match(
  source,
  /buildPdvSearchCards/,
  'ProductSearchSection must render grouped PDV cards from pdvSerializedInventory',
);

assert.match(
  source,
  /selectedUnitByCardId/,
  'Serialized product cards must store the selected unit option per product card',
);

assert.match(
  source,
  /card\.unitOptions/,
  'Serialized product cards must render/select available unit options inside the product card',
);

assert.match(
  source,
  /selectedUnit\.unitData/,
  'Adding a serialized product must pass the selected unitData to the cart',
);

assert.doesNotMatch(
  source,
  /availableSerializedLines/,
  'ProductSearchSection must not keep ad-hoc serialized line maps',
);

assert.doesNotMatch(
  source,
  /join\(' \| '\)/,
  'ProductSearchSection must not join multiple serials into one product text line',
);

assert.doesNotMatch(
  source,
  /specs\.(imei|imei1|imei2|serial|serial_number)/,
  'ProductSearchSection must not render or decide serialized state from legacy specs identifiers',
);

console.log('pdv serialized inventory UI static checks passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node tmp-tests\pdv-serialized-inventory-ui-static.test.mjs
```

Expected:

```text
ProductSearchSection must render grouped PDV cards from pdvSerializedInventory
```

---

### Task 4: Refactor `ProductSearchSection` To Render `PdvSearchCard[]`

**Files:**
- Modify: `components/pdv/ProductSearchSection.tsx`
- Test: `tmp-tests/pdv-serialized-inventory-ui-static.test.mjs`
- Test: `tmp-tests/pdv-product-search-autocomplete-static.test.mjs`

- [ ] **Step 1: Replace raw product result state**

In `components/pdv/ProductSearchSection.tsx`, import:

```ts
import { buildPdvSearchCards, type PdvSearchCard, type PdvSerializedUnitOption } from '../../services/pdvSerializedInventory';
```

Replace raw result and serialized-line state with:

```ts
const [searchCards, setSearchCards] = useState<PdvSearchCard[]>([]);
const [quantities, setQuantities] = useState<Record<string, number>>({});
const [selectedUnitByCardId, setSelectedUnitByCardId] = useState<Record<string, string>>({});
```

Delete these local helper functions from `ProductSearchSection.tsx` entirely:

- `hasSerializedIdentity`
- `getSerializedSpecs`
- `getSerializedLookupValues`
- `formatUnitIdentifierLine`
- `isKnownSerializedProduct`
- `getResultIdentifierLine`

After this deletion, `ProductSearchSection.tsx` must not inspect `product.specs.imei1`, `product.specs.imei2`, `product.specs.serial`, or any similar legacy serialized field.

- [ ] **Step 2: Build cards in product search**

Inside `handleSearch`, keep `searchProducts(term)` and `availableProducts`, then use:

```ts
const cards = await buildPdvSearchCards(availableProducts, {
    listUnitsByProduct: unitService.listByProduct,
});

setSearchCards(cards);

const firstSelections: Record<string, string> = {};
for (const card of cards) {
    if (card.kind === 'serialized-product' && card.unitOptions[0]) {
        firstSelections[card.id] = card.unitOptions[0].id;
    }
}
setSelectedUnitByCardId(firstSelections);

if (cards.length === 1 && options.autoAddSingle === true) {
    await addCardToCart(cards[0], term);
}
```

- [ ] **Step 3: Add card-based add handler**

Add:

```ts
const getSelectedUnit = (card: PdvSearchCard): PdvSerializedUnitOption | undefined => {
    if (card.kind !== 'serialized-product') return undefined;
    const selectedId = selectedUnitByCardId[card.id] || card.unitOptions[0]?.id;
    return card.unitOptions.find(option => option.id === selectedId) || card.unitOptions[0];
};

const addCardToCart = async (card: PdvSearchCard, preferredIdentifier?: string) => {
    if (card.kind === 'serialized-product') {
        const selectedUnit = getSelectedUnit(card);
        if (!selectedUnit) {
            toast.error('Selecione uma unidade disponivel');
            return;
        }

        onAddToCart(card.product, 1, selectedUnit.unitData);
        toast.success(`${card.product.name} adicionado ao carrinho`);
        setImeiQuery('');
        setSearchCards([]);
        setSearchTerm('');
        return;
    }

    const quantity = quantities[card.id] || 1;
    if (card.product.track_inventory && card.maxQuantity !== undefined && quantity > card.maxQuantity) {
        toast.error(`Estoque insuficiente. Disponivel: ${card.maxQuantity}`);
        return;
    }

    onAddToCart(card.product, quantity);
    toast.success(`${card.product.name} adicionado ao carrinho`);
    setQuantities(prev => ({ ...prev, [card.id]: 1 }));
};

const handleAddToCart = async (card: PdvSearchCard) => {
    await addCardToCart(card);
};
```

- [ ] **Step 4: Render one card per product**

Render `searchCards.map((card) => <div key={card.id}>{card.title}</div>)` as the outer product-card loop, then place the concrete stock and serialized branches below inside that card body.

For normal stock cards:

```tsx
<p className="text-sm text-slate-500">{card.subtitle}</p>
<input
    type="number"
    min="1"
    max={card.maxQuantity}
    value={quantity}
    onChange={(e) => updateQuantity(card.id, Math.min(parseInt(e.target.value) || 1, card.maxQuantity ?? Infinity))}
/>
```

For serialized cards, render a selector/list inside the same product card:

```tsx
{card.kind === 'serialized-product' && (
    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-2">
        <div className="mb-2 text-xs font-semibold text-blue-800">
            Escolha a unidade que sera vendida
        </div>
        <div className="space-y-1">
            {card.unitOptions.map((option) => (
                <label
                    key={option.id}
                    className="flex cursor-pointer items-start gap-2 rounded-md bg-white px-2 py-2 text-xs text-slate-700 hover:bg-blue-50"
                >
                    <input
                        type="radio"
                        name={`unit-${card.id}`}
                        checked={(selectedUnitByCardId[card.id] || card.unitOptions[0]?.id) === option.id}
                        onChange={() => setSelectedUnitByCardId(prev => ({ ...prev, [card.id]: option.id }))}
                        className="mt-0.5"
                    />
                    <span>
                        <span className="block font-mono font-semibold">{option.label}</span>
                        {option.detail && <span className="block font-mono text-slate-500">{option.detail}</span>}
                    </span>
                </label>
            ))}
        </div>
    </div>
)}
```

For serialized cards, quantity input should be disabled and fixed:

```tsx
<input
    type="number"
    min="1"
    max="1"
    value={1}
    disabled
    className="w-16 px-2 py-1 border border-slate-300 rounded text-center bg-slate-50"
/>
```

- [ ] **Step 5: Preserve Enter behavior for `Nome / SKU` only**

Keep:

```ts
type ProductSearchOptions = { autoAddSingle?: boolean };
setTimeout(() => handleSearch({ autoAddSingle: false }), 500);
if (cards.length === 1 && options.autoAddSingle === true) {
    await addCardToCart(cards[0], term);
}
if (e.key === 'Enter') handleSearch({ autoAddSingle: true });
```

Important:

- This step applies only to the `Nome / SKU` tab.
- If one product card has several unit options and Enter is pressed in `Nome / SKU`, the first available unit may be selected by default to preserve the current shortcut behavior.
- This does not apply to the `IMEI / Serial` tab.
- In `IMEI / Serial`, the typed/bipped identifier already selects the equipment, so the flow must add the exact unit directly to the cart.

- [ ] **Step 6: Run tests**

```powershell
node tmp-tests\pdv-serialized-inventory-core.test.mjs
node tmp-tests\pdv-serialized-inventory-ui-static.test.mjs
node tmp-tests\pdv-product-search-autocomplete-static.test.mjs
```

Expected:

```text
pdv serialized inventory core checks passed
pdv serialized inventory UI static checks passed
pdv product search autocomplete static checks passed
```

---

### Task 5: Rebuild Exact IMEI/Serial Search On Same Unit Contract

**Files:**
- Modify: `components/pdv/ProductSearchSection.tsx`
- Modify: `services/pdvSerializedInventory.ts`
- Test: `tmp-tests/pdv-serialized-inventory-core.test.mjs`

**Behavior:** This task is for the `IMEI / Serial` tab only. It must not render the grouped product card or unit selector. The scanned/typed identifier is the selection, so a valid available unit is added directly to the cart.

- [ ] **Step 1: Extend core test for exact scanned unit option**

Append to `tmp-tests/pdv-serialized-inventory-core.test.mjs`:

```js
const exactOption = mod.buildPdvUnitOption({
  id: 'unit-exact',
  product_id: 'prod-athomics',
  status: 'available',
  imei_1: '860000000000001',
  imei_2: '860000000000002',
  serial_number: 'AT2209901885',
  condition: 'new',
  created: '',
  updated: '',
});

assert.equal(exactOption.id, 'unit:unit-exact');
assert.equal(exactOption.label, 'IMEI 1: 860000000000001');
assert.equal(exactOption.detail, 'IMEI 2: 860000000000002 | Serial: AT2209901885');
assert.equal(exactOption.unitData.unitId, 'unit-exact');
assert.equal(exactOption.unitData.imei1, '860000000000001');
assert.equal(exactOption.unitData.imei2, '860000000000002');
assert.equal(exactOption.unitData.serial, 'AT2209901885');
```

- [ ] **Step 2: Refactor `handleImeiSearch`**

When `unitService.searchByIdentifier(query)` returns a unit:

```ts
const unit = units[0];

if (unit.status !== UnitStatus.AVAILABLE) {
    toast.error('Esta unidade nao esta disponivel para venda');
    return;
}

const { getProductById } = await import('../../services/productService');
const product = await getProductById(unit.product_id);

if (!product) {
    toast.error('Produto vinculado a este IMEI/serial nao encontrado');
    return;
}

const selectedUnit = buildPdvUnitOption(unit);
onAddToCart(product, 1, selectedUnit.unitData);
toast.success(`${product.name} adicionado ao carrinho`);
setImeiQuery('');
setTimeout(() => imeiInputRef.current?.focus(), 100);
```

Delete fallback to `getProductByImei(query)` from the PDV IMEI/Serial flow. Legacy specs should not silently sell a unit.

Do not call `setSearchCards(...)` from `handleImeiSearch`. The scanner flow should not show product choices after an exact identifier match.

- [ ] **Step 3: Run tests**

```powershell
node tmp-tests\pdv-serialized-inventory-core.test.mjs
node tmp-tests\pdv-serialized-inventory-ui-static.test.mjs
```

Expected both pass.

---

### Task 6: Guard Cart And Finalization For Exact Serialized Unit

**Files:**
- Create: `tmp-tests/pdv-serialized-finalization-static.test.mjs`
- Modify: `pages/pdv/PDVPage.tsx`
- Verify: `services/saleService.ts`

**Behavior:** This task protects the sale after the unit is selected. The same physical unit cannot be added twice to the cart, finalization must store the selected `unitId`, and serialized items must not decrement generic product stock.

- [ ] **Step 1: Write failing static guard**

Create `tmp-tests/pdv-serialized-finalization-static.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pdvPage = readFileSync('pages/pdv/PDVPage.tsx', 'utf8');
const saleService = readFileSync('services/saleService.ts', 'utf8');

assert.match(
  pdvPage,
  /unitData\?\.unitId[\s\S]{0,500}cartItems\.some\([\s\S]{0,500}serialized_unit\?\.unitId[\s\S]{0,300}unitData\.unitId/,
  'PDVPage.handleAddToCart must reject a serialized unit already present in the cart',
);

assert.match(
  pdvPage,
  /toast\.error\(['"`]Esta unidade ja esta no carrinho['"`]\)/,
  'Duplicate selected unit must show a clear cart error',
);

assert.match(
  saleService,
  /serialized_unit_id:\s*item\.serialized_unit\?\.unitId\s*\|\|\s*null/,
  'saleService must persist selected serialized_unit_id on sale items',
);

assert.match(
  saleService,
  /unitService\.markAsSold\(unitId,\s*undefined,\s*sale\.id\)/,
  'saleService must mark the selected serialized unit as sold with the sale id',
);

assert.match(
  saleService,
  /!\(item as any\)\.serialized_unit\?\.unitId/,
  'serialized items must be excluded from generic product stock decrement',
);

assert.match(
  saleService,
  /recordFinalizationIssue\('serialized_units'/,
  'serialized unit write-off failures must be recorded as finalization issues',
);

console.log('pdv serialized finalization static checks passed');
```

- [ ] **Step 2: Run guard to verify it fails if duplicate protection is absent**

Run:

```powershell
node tmp-tests\pdv-serialized-finalization-static.test.mjs
```

Expected before implementation:

```text
PDVPage.handleAddToCart must reject a serialized unit already present in the cart
```

- [ ] **Step 3: Add duplicate unit protection in `handleAddToCart`**

In `pages/pdv/PDVPage.tsx`, inside `handleAddToCart(product, quantity, unitData)`, add this check before creating the cart item:

```ts
if (unitData?.unitId) {
    const alreadyInCart = cartItems.some((item) => item.serialized_unit?.unitId === unitData.unitId);
    if (alreadyInCart) {
        toast.error('Esta unidade ja esta no carrinho');
        return;
    }
}
```

Keep the existing behavior that prevents grouped quantity merge for serialized items.

- [ ] **Step 4: Verify `saleService.ts` already follows the selected-unit contract**

In `services/saleService.ts`, verify these exact behaviors remain present:

```ts
serialized_unit_id: item.serialized_unit?.unitId || null,
```

```ts
await unitService.markAsSold(unitId, undefined, sale.id);
```

```ts
const inventoryItems = saleInput.items.filter(item =>
    item.track_inventory &&
    item.product_id &&
    !(item as any).serialized_unit?.unitId
);
```

If any of these are missing, add them exactly with the same intent:

- persist `serialized_unit_id` from cart item;
- mark only the selected `unitId` as sold;
- exclude serialized items from generic product stock decrement.

- [ ] **Step 5: Run checks**

```powershell
node tmp-tests\pdv-serialized-finalization-static.test.mjs
node tmp-tests\pdv-serialized-inventory-core.test.mjs
node tmp-tests\pdv-serialized-inventory-ui-static.test.mjs
```

Expected:

```text
pdv serialized finalization static checks passed
pdv serialized inventory core checks passed
pdv serialized inventory UI static checks passed
```

- [ ] **Step 6: Commit**

```powershell
git add -- pages/pdv/PDVPage.tsx services/saleService.ts tmp-tests/pdv-serialized-finalization-static.test.mjs
git commit -m "fix(pdv): guard selected serialized unit finalization"
```

---

### Task 7: Add Mandatory VPS Hydrated Search Endpoint

**Files:**
- Modify: `vps_server.js`
- Modify: `vps_server.cjs`
- Modify: `services/vpsApiService.ts`
- Modify: `services/pdvSerializedInventory.ts`
- Modify: `components/pdv/ProductSearchSection.tsx`
- Test: `tmp-tests/pdv-vps-search-units-static.test.mjs`

**Why:** The final architecture must ask the VPS for products already hydrated with available units. This avoids one request per product and prevents the UI from rebuilding serialized state from mixed sources.

- [ ] **Step 1: Add static guard**

Create `tmp-tests/pdv-vps-search-units-static.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const vps = readFileSync('vps_server.js', 'utf8');
const api = readFileSync('services/vpsApiService.ts', 'utf8');
const pdv = readFileSync('services/pdvSerializedInventory.ts', 'utf8');

assert.match(vps, /fastify\.get\('\/pdv\/product-search'/, 'VPS must expose a PDV-specific product search endpoint');
assert.match(vps, /SELECT u\.\*[\s\S]*FROM units u[\s\S]*u\.status = 'available'[\s\S]*u\.product_id IN/, 'PDV search endpoint must hydrate only available serialized units');
assert.match(api, /async searchPdvProducts/, 'vpsApiService must expose searchPdvProducts');
assert.match(pdv, /fromHydratedPdvSearchPayload/, 'pdvSerializedInventory must normalize hydrated VPS payloads into product cards');

console.log('pdv VPS search units static checks passed');
```

- [ ] **Step 2: Add `/pdv/product-search` to `vps_server.js` and `vps_server.cjs`**

The endpoint should:

- search active products by name/SKU/EAN/model/slug;
- fetch available units for all returned product IDs in one query;
- return:

```js
[
  {
    product,
    available_units: unitsByProduct.get(product.id) || []
  }
]
```

Use this implementation shape for unit hydration:

```js
const productIds = products.map((product) => product.id).filter(Boolean);
const unitsByProduct = new Map();

if (productIds.length > 0) {
  const placeholders = productIds.map(() => '?').join(', ');
  const [units] = await pool.query(
    `SELECT u.*
       FROM units u
      WHERE u.status = 'available'
        AND u.product_id IN (${placeholders})
      ORDER BY u.created_at ASC`,
    productIds,
  );

  for (const unit of units) {
    const list = unitsByProduct.get(unit.product_id) || [];
    list.push(unit);
    unitsByProduct.set(unit.product_id, list);
  }
}

return products.map((product) => ({
  product,
  available_units: unitsByProduct.get(product.id) || [],
}));
```

- [ ] **Step 3: Add client and normalizer**

In `services/vpsApiService.ts` add:

```ts
async searchPdvProducts(search: string, limit: number = 50): Promise<Array<{ product: any; available_units: any[] }> | null> {
  const qs = new URLSearchParams();
  qs.set('search', search);
  qs.set('limit', String(limit));
  return this.fetchSafe<Array<{ product: any; available_units: any[] }>>(`/pdv/product-search?${qs.toString()}`, true);
}
```

In `services/pdvSerializedInventory.ts` add:

```ts
type HydratedPdvProduct = {
    product: Product;
    available_units?: Unit[];
};

export function fromHydratedPdvSearchPayload(payload: HydratedPdvProduct[]): PdvSearchCard[] {
    return payload.map((entry) => {
        const availableUnits = (entry.available_units || []).filter(unit => String(unit.status) === 'available');
        return availableUnits.length > 0
            ? buildSerializedProductCard(entry.product, availableUnits)
            : buildStockProductCard(entry.product);
    });
}
```

- [ ] **Step 4: Switch UI to hydrated endpoint**

In `ProductSearchSection.tsx`, use:

```ts
const data = await vpsApiService.searchPdvProducts(term, 50);
const cards = fromHydratedPdvSearchPayload(data || []);
setSearchCards(cards);
```

- [ ] **Step 5: Run checks**

```powershell
node tmp-tests\pdv-vps-search-units-static.test.mjs
node tmp-tests\pdv-serialized-inventory-core.test.mjs
node tmp-tests\pdv-serialized-inventory-ui-static.test.mjs
node --check vps_server.js
node --check vps_server.cjs
```

Expected all pass.

---

### Task 8: Add Read-Only Data Audit

**Files:**
- Create: `scripts/audit-pdv-serialized-inventory.cjs`

**Purpose:** Code fixes the PDV flow, but existing data may still need cleanup.

- [ ] **Step 1: Create audit script**

The script must report:

- products with legacy identifiers in `specs`;
- available units with no `imei_1`, no `imei_2`, and no `serial`;
- products where `products.stock_quantity` does not match available unit count when units exist.

The script must be read-only and print JSON.

- [ ] **Step 2: Run audit**

```powershell
node scripts\audit-pdv-serialized-inventory.cjs
```

Only after reviewing the output, decide whether to create/fix units or clear legacy specs.

---

### Task 9: Build, Publish, And Validate

**Files:**
- Modify:
  - `public/VERSION.json`
  - `VERSAO_ATUAL.md`
  - `docs/versoes/YYYY-MM-DD-vX.Y.Z-pdv-serialized-inventory-rebuild.md`

- [ ] **Step 1: Run focused checks**

```powershell
node tmp-tests\pdv-serialized-inventory-core.test.mjs
node tmp-tests\pdv-serialized-inventory-ui-static.test.mjs
node tmp-tests\pdv-serialized-finalization-static.test.mjs
node tmp-tests\pdv-vps-search-units-static.test.mjs
node tmp-tests\pdv-product-search-autocomplete-static.test.mjs
node tmp-tests\pdv-sales-repair-plan-static.test.mjs
node --check vps_server.js
node --check vps_server.cjs
npm.cmd run build
```

- [ ] **Step 2: Version release**

Use next version after current production, for example:

```text
v1.1.47-pdv-serialized-inventory-rebuild
```

- [ ] **Step 3: Publish with `publish-vps`**

Because this plan changes frontend and API:

```powershell
git push origin HEAD:main
git tag v1.1.47-pdv-serialized-inventory-rebuild
git push origin v1.1.47-pdv-serialized-inventory-rebuild
$env:VPS_SITE_RELEASE_NAME='YYYYMMDD-HHMMSS-v1147-pdv-serialized-inventory-rebuild'
npm.cmd run deploy:vps-site
node deploy-vps-server-only.cjs
```

- [ ] **Step 4: Validate production**

```powershell
curl.exe -L -s -o NUL -w "%{http_code} %{url_effective}\n" https://www.mercadodovale.com.br/
curl.exe -s https://www.mercadodovale.com.br/VERSION.json
curl.exe -s -i https://api.xiaomipetrolina.com.br/status
```

Expected:

```text
homepage HTTP 200
VERSION.json has the new version
API HTTP 200 with mysql.ok=true
```

---

## Manual Acceptance Checklist

- [ ] Search `athom` in `Nome / SKU`.
- [ ] Athomics appears as one product card, not several duplicate product cards.
- [ ] The card shows all available serials inside the unit selector/list.
- [ ] Selecting `AT2209901430` and clicking `Adicionar` adds that exact unit to cart.
- [ ] Cart item has quantity 1 and carries selected `unitId`.
- [ ] Trying to add `AT2209901430` again shows `Esta unidade ja esta no carrinho`.
- [ ] Finalizing sale writes off only that selected unit.
- [ ] Finalization stores `serialized_unit_id` on the sale item.
- [ ] Finalization does not decrement generic `products.stock_quantity` for serialized items.
- [ ] If the selected unit becomes unavailable before finalization, the sale records a `serialized_units` finalization issue instead of silently selling another unit.
- [ ] Searching/scanning smartphone `imei_1` in `IMEI / Serial` adds the exact smartphone unit.
- [ ] Searching/scanning receiver serial in `IMEI / Serial` adds the exact receiver unit.
- [ ] `IMEI / Serial` does not open a product card or selector after finding an available unit.
- [ ] Sold/reserved units do not appear as selectable.
- [ ] Non-serialized products still behave as before.
- [ ] Customer, payment, delivery, discounts, receipt, and sale finalization continue unchanged outside serialized unit selection.

---

## Self-Review

**Spec coverage:** This plan matches the clarified requirement: same SKU/product remains grouped, unique IMEI/serial fields stay on units, the admin chooses the exact available unit inside the product card, IMEI/serial scans add the exact unit directly, duplicate unit selection is blocked in the cart, and finalization writes off only that unit without generic serialized stock decrement.

**Placeholder scan:** No implementation task uses an unresolved placeholder. Data repair remains intentionally gated by a read-only audit.

**Type consistency:** `PdvSearchCard`, `PdvSerializedUnitOption`, `unitOptions`, `selectedUnitByCardId`, `selectedUnit.unitData`, `serialized_unit.unitId`, and `serialized_unit_id` are defined before use and reused consistently through the UI, cart, finalization, and scan flow.
