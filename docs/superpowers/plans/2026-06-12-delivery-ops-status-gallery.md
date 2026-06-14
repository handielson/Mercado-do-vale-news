# Delivery Ops Status Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add delivery operation status visibility to sales and let operators manage delivery jobs, including administrative completion and multiple proof photos.

**Architecture:** The backend remains the source of truth in `customer_delivery_jobs` and `customer_delivery_proofs`. Frontend sales load delivery job snapshots and render a compact status column plus an operational panel inside the existing sale modal. The public delivery page keeps its current completion rule but displays all uploaded proofs instead of only the latest proof.

**Tech Stack:** Fastify VPS API (`vps_server.js`/`vps_server.cjs`), React/Vite TypeScript frontend, existing `vpsClient`, static Node regression tests in `tmp-tests`.

---

### Task 1: Backend Proof Gallery

**Files:**
- Modify: `vps_server.js`
- Modify: `vps_server.cjs`
- Test: `tmp-tests/delivery-ops-status-gallery-static.test.mjs`

- [ ] Add a failing static test asserting `/delivery/jobs/:token` returns `proofs` ordered by `created_at DESC`, not only `proof`.
- [ ] Update both server files to select all recent proofs with `LIMIT 20`.
- [ ] Return `{ job, proof: proofs?.[0] || null, proofs: proofs || [] }`.
- [ ] Verify with `node tmp-tests\delivery-ops-status-gallery-static.test.mjs` and `node --check vps_server.js` / `node --check vps_server.cjs`.

### Task 2: Sales Delivery Status

**Files:**
- Modify: `types/sale.ts`
- Modify: `services/saleService.ts`
- Modify: `pages/admin/sales/SalesPage.tsx`
- Test: `tmp-tests/delivery-ops-status-gallery-static.test.mjs`

- [ ] Add a failing static test asserting sales expose `delivery_job` and the sales table has an `Entrega` column.
- [ ] Add a `SaleDeliveryJobSummary` type and optional `delivery_job` to `SaleWithItems`.
- [ ] Load `customer_delivery_jobs` in `getSales` and attach the row matching `sale.id`.
- [ ] Render the status badge in the sales table and adjust `colSpan`.
- [ ] Verify with the static test and `npm.cmd run build`.

### Task 3: Operator Delivery Panel

**Files:**
- Modify: `components/admin/sales/SaleDetailsModal.tsx`
- Modify: `services/customerDeliveryService.ts`
- Test: `tmp-tests/delivery-ops-status-gallery-static.test.mjs`

- [ ] Add a failing static test asserting the modal renders delivery status, Pix status, proofs, logs, and admin completion.
- [ ] Extend `getDeliveryJob` return type to include `proofs`.
- [ ] In the sale modal, load delivery proofs and logs when a delivery job is available.
- [ ] Render an operational panel with public link, route link, status badges, proof thumbnails, logs, and administrative completion with required reason.
- [ ] Verify with static tests and `npm.cmd run build`.

### Task 4: Public Delivery Gallery

**Files:**
- Modify: `pages/delivery/DeliveryOperationPage.tsx`
- Test: `tmp-tests/delivery-ops-status-gallery-static.test.mjs`

- [ ] Add a failing static test asserting `proofs` state and gallery rendering exist.
- [ ] Replace single proof display with gallery rendering.
- [ ] After upload, append/refresh the gallery and keep completion enabled when at least one proof exists.
- [ ] Verify with static tests and `npm.cmd run build`.
