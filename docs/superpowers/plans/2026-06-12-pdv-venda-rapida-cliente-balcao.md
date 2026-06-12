# PDV Venda Rapida Cliente Balcao Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a PDV quick-sale flow using one technical customer named `Cliente Balcao` so sales without customer registration still have history for returns/refunds.

**Architecture:** Add a small service helper that finds or creates the walk-in customer, expose a `Venda rapida` action in the PDV customer selector, and guard sale finalization so this technical customer does not earn coins or benefits. Keep delivery as store pickup.

**Tech Stack:** React, TypeScript, existing VPS table-data customer APIs, static Node tests.

---

### Task 1: Customer Service Helper

**Files:**
- Modify: `services/customers.ts`
- Modify: `types/customer.ts`
- Test: `tmp-tests/pdv-walk-in-customer-static.test.mjs`

- [x] Add optional `is_walk_in_customer?: boolean` to `Customer`.
- [x] Normalize `is_walk_in_customer` in customer service responses.
- [x] Add `getOrCreateWalkInCustomer()` that searches customers for `is_walk_in_customer === true` or normalized name `cliente balcao`, then creates one if missing.
- [x] Static test confirms type, normalization, and helper exist.

### Task 2: PDV Quick Sale Selection

**Files:**
- Modify: `components/pdv/CustomerSection.tsx`
- Modify: `pages/pdv/PDVPage.tsx`
- Test: `tmp-tests/pdv-walk-in-customer-static.test.mjs`

- [x] Add `onSelectWalkInCustomer` prop to `CustomerSection`.
- [x] Add a `Venda rapida` button near customer selection.
- [x] In `PDVPage`, implement handler using `customerService.getOrCreateWalkInCustomer()`.
- [x] Handler selects `Cliente Balcao`, sets delivery to `store_pickup`, clears delivery person and delivery costs.
- [x] Static test confirms the handler and button exist.

### Task 3: No Benefits Or Coins

**Files:**
- Modify: `pages/pdv/PDVPage.tsx`
- Modify: `services/saleService.ts`
- Test: `tmp-tests/pdv-walk-in-customer-static.test.mjs`

- [x] Add helper `isWalkInCustomer(customer)` in PDV scope.
- [x] Skip `earnCoinsForPurchase` when selected customer is walk-in.
- [x] Skip screen protector benefit grant path in `saleService` when selected customer is walk-in.
- [x] Static test confirms guards exist.

### Task 4: VPS Schema

**Files:**
- Modify: `vps_server.js`
- Modify: `vps_server.cjs`
- Test: `tmp-tests/pdv-walk-in-customer-static.test.mjs`

- [x] Add migration for `customers.is_walk_in_customer`.
- [x] Static test confirms VPS migration exists.

### Task 5: Verify And Publish

- [x] Run `node tmp-tests/pdv-walk-in-customer-static.test.mjs`.
- [x] Run `npm.cmd run build`.
- [x] Publish backend with `deploy-vps-server-only.cjs`.
- [x] Publish frontend with `scripts/deploy-vps-site.cjs`.
- [x] Confirm production bundle contains `Venda rápida` and `Cliente Balcão`.
- [x] Confirm MySQL column `customers.is_walk_in_customer` exists on VPS.

### Production Diary

- 2026-06-12 10:33 BRT: static test passed locally.
- 2026-06-12 10:33 BRT: production build passed locally.
- 2026-06-12 10:43 BRT: backend uploaded to `/var/www/mdv-api`, PM2 `mdv-api` restarted online.
- 2026-06-12 10:45 BRT: frontend release active at `/var/www/mdv-site/releases/20260612-134538`.
- 2026-06-12 10:46 BRT: VPS MySQL confirmed `customers.is_walk_in_customer tinyint(1)`.
