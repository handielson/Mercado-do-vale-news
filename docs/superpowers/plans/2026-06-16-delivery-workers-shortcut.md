# Delivery Workers Shortcut Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dashboard shortcut that opens the customer list filtered to registered delivery workers.

**Architecture:** Reuse the existing customer list and its `is_delivery_worker` service filter. Add a query-driven initial state and a small filter UI extension instead of adding a new page.

**Tech Stack:** React, React Router, TypeScript, Vite, Node static tests.

---

### Task 1: Static Regression Test

**Files:**
- Create: `tmp-tests/delivery-workers-shortcut-static.test.mjs`
- Read: `components/admin/dashboard/AdminQuickAccessGrid.tsx`
- Read: `pages/customers/CustomerListPage.tsx`

- [ ] **Step 1: Write the failing test**

```js
import fs from 'node:fs';
import assert from 'node:assert/strict';

const dashboard = fs.readFileSync('components/admin/dashboard/AdminQuickAccessGrid.tsx', 'utf8');
const customerList = fs.readFileSync('pages/customers/CustomerListPage.tsx', 'utf8');

assert.match(dashboard, /label:\s*'Entregadores'/);
assert.match(dashboard, /path:\s*'\/admin\/customers\?delivery=1'/);

assert.match(customerList, /useLocation/);
assert.match(customerList, /new URLSearchParams\(location\.search\)/);
assert.match(customerList, /deliveryFromQuery === '1'/);
assert.match(customerList, /is_delivery_worker:\s*true/);
assert.match(customerList, /Mostrando apenas entregadores/);
assert.match(customerList, /<option value="delivery">Entregadores<\/option>/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tmp-tests/delivery-workers-shortcut-static.test.mjs`

Expected: FAIL because the dashboard card and query-driven filter do not exist yet.

### Task 2: Dashboard Shortcut

**Files:**
- Modify: `components/admin/dashboard/AdminQuickAccessGrid.tsx`

- [ ] **Step 1: Add the quick access item**

Add this item to `dailyItems`:

```ts
{
  label: 'Entregadores',
  description: 'Clientes de entrega',
  path: '/admin/customers?delivery=1',
  icon: '🚚',
  cardClassName: 'bg-white border-slate-200 hover:border-cyan-400',
  iconClassName: 'bg-cyan-100 group-hover:bg-cyan-200',
}
```

### Task 3: Customer List Filter

**Files:**
- Modify: `pages/customers/CustomerListPage.tsx`

- [ ] **Step 1: Read query parameters**

Change the React Router import to include `useLocation`, call it in the component, and initialize `filters` from `delivery=1`.

- [ ] **Step 2: Add the "Tipo" filter**

Add a select with values `all`, `customer`, and `delivery`. It should update `is_delivery_worker` to `undefined`, `false`, or `true`.

- [ ] **Step 3: Add the active indicator**

When `filters.is_delivery_worker === true`, show "Mostrando apenas entregadores" below the search controls.

### Task 4: Verify

**Files:**
- Test: `tmp-tests/delivery-workers-shortcut-static.test.mjs`

- [ ] **Step 1: Run focused test**

Run: `node tmp-tests/delivery-workers-shortcut-static.test.mjs`

Expected: PASS.

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: successful Vite production build.
