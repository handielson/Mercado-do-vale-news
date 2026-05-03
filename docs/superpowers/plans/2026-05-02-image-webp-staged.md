# Image WebP Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce catalog image payloads by generating and serving smaller WebP derivatives for existing product and banner images while keeping originals intact.

**Architecture:** Start with a read-only audit, then add deterministic derivative naming, then generate WebP files beside originals, and only after that switch frontend card/banner URLs to optimized variants. The original URLs remain the source of truth and fallback path.

**Tech Stack:** Node.js scripts, `sharp` for server-side image conversion, existing Vite/React catalog components, existing VPS static `/images/...` storage.

---

### Task 1: Read-Only Image Inventory

**Files:**
- Create: `tools/audit-image-assets.mjs`
- Test: `tmp-tests/image-asset-audit.test.mjs`

- [ ] **Step 1: Write a failing test**

```js
import assert from 'node:assert/strict';
import { classifyImageAsset, buildDerivativePlan } from '../tools/audit-image-assets.mjs';

const product = classifyImageAsset('uploads/products/SKU/img-1.png', 817000);
assert.equal(product.kind, 'product');
assert.equal(product.shouldOptimize, true);

const plan = buildDerivativePlan(product);
assert.deepEqual(plan.map(item => item.width), [320, 480, 800]);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tmp-tests/image-asset-audit.test.mjs`

Expected: FAIL because `tools/audit-image-assets.mjs` does not exist yet.

- [ ] **Step 3: Implement read-only audit**

Create `tools/audit-image-assets.mjs` with exported helpers and a CLI that scans local `uploads/` when present. The CLI must not write files.

- [ ] **Step 4: Run test and dry-run**

Run: `node tmp-tests/image-asset-audit.test.mjs`

Expected: PASS.

Run: `node tools/audit-image-assets.mjs --root uploads`

Expected: JSON summary or a clear message when `uploads/` is absent locally.

### Task 2: WebP Derivative Generator

**Files:**
- Create: `tools/generate-image-derivatives.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add `sharp` only when ready to generate**

Run: `npm install sharp --save-dev`

- [ ] **Step 2: Generate derivatives without deleting originals**

Products:
- `name-320.webp`
- `name-480.webp`
- `name-800.webp`

Banners:
- `name-768.webp`
- `name-1280.webp`

- [ ] **Step 3: Verify sample output**

Run generator on a small fixture folder first, then inspect file sizes.

### Task 3: Frontend Derivative URL Selection

**Files:**
- Create: `utils/image-derivatives.ts`
- Modify: `components/catalog/ModernProductCard.tsx`
- Modify: `components/catalog/BannerCarousel.tsx`
- Test: `tmp-tests/image-derivatives.test.ts`

- [ ] **Step 1: Prefer WebP derivative for card images**

Use `-480.webp` for grid cards and `-320.webp` for list cards when URL matches `/images/products/`.

- [ ] **Step 2: Prefer WebP derivative for banners**

Use `-1280.webp` for desktop banners and keep original fallback.

### Task 4: VPS Rollout

**Files:**
- Modify: `server.js` or deployment scripts only if needed.

- [ ] **Step 1: Copy audit/generator to VPS**

Run audit in dry-run mode first.

- [ ] **Step 2: Generate derivatives in small batches**

Start with banners and 20 product images, then validate.

- [ ] **Step 3: Run Lighthouse**

Compare image payload and LCP/CLS before and after.

