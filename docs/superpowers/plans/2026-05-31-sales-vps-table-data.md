# Sales VPS Table Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move PDV sale create/read/update/delete flows for `sales` and `sale_items` away from Supabase operational tables and into the VPS table-data layer.

**Architecture:** Use `vpsClient` helpers for `/table-data/sales` and `/table-data/sale_items` in `createSale`, `getSaleById`, `getSales`, `getSalesSummary`, `cancelSale`, `refundSale`, and `deleteSale`. Keep referral lookup/RPC and stock RPCs on the legacy path for later transactional slices.

**Tech Stack:** React/Vite TypeScript services, Fastify VPS `/table-data`, Node static regression tests.

---

### Task 1: Guard Sale Flows Through VPS

**Files:**
- Modify: `services/saleService.ts`
- Test: `tmp-tests/sale-service-vps-table-data-static.test.mjs`
- Document: `migracao_supabase.md`
- Document: `migração_VPS.md`

- [x] **Step 1: Write the failing test**

Add a static test that checks the create/read/update/delete functions use `vpsClient` table-data helpers for `sales`/`sale_items` and no longer contain direct `supabase.from('sales')` or `supabase.from('sale_items')` calls.

- [x] **Step 2: Run test to verify it fails**

Run: `node tmp-tests\sale-service-vps-table-data-static.test.mjs`

Expected: FAIL while the selected functions still contain Supabase sale table access or while `createSale` does not use the VPS insert/bulk insert path.

- [x] **Step 3: Write minimal implementation**

Add paged `loadTableRows`, normalizers for sale JSON fields, customer/seller hydration helpers, patch/delete wrappers, local ID generation, sale serialization, and VPS insert/bulk insert in `createSale`. Leave referral RPC cleanup and stock RPC cleanup for later slices.

- [x] **Step 4: Run focused tests**

Run:

```powershell
node tmp-tests\sale-service-vps-table-data-static.test.mjs
node tmp-tests\supabase-operational-dependency-guard-static.test.mjs
node tools\audit-supabase-operational-dependencies.mjs
```

Expected: all pass, with `.from(...)` total reduced or unchanged only if the guard baseline is intentionally updated after a real reduction.

- [x] **Step 5: Update migration docs**

Record affected admin/public scope, files, tests, audit totals, result, and rollback in `migracao_supabase.md` and `migração_VPS.md`.
