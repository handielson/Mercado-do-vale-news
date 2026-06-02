# Bulk Product Import Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first safe core for Excel product bulk import: category-aware templates, row normalization, validation, duplicate detection, and upsert planning that preserves images.

**Architecture:** Phase 1 adds a pure JavaScript core under `services/` so behavior can be tested without React, browser APIs, Supabase, or live VPS calls. The existing `services/bulk-products.ts` will delegate normalization/validation to this core while the UI remains compatible.

**Tech Stack:** Vite/React, browser Excel helpers already in `utils/excel.ts`, Node `.mjs` static/unit tests.

---

## Files

- Create: `services/bulkProductImportCore.js`
- Create: `tmp-tests/bulk-product-import-core.test.mjs`
- Modify: `services/bulk-products.ts`
- Modify: `types/bulk-product.ts`
- Reference: `importacao.md`

## Task 1: Core Template and Normalization

- [x] Write failing tests in `tmp-tests/bulk-product-import-core.test.mjs` for:
  - receptor template includes `specs.serial`;
  - receptor template does not include `specs.iks` or `specs.sks`;
  - smartphone template includes `specs.imei1`, `specs.imei2`, `specs.serial`, `specs.color`, `specs.ram`, `specs.storage`, `specs.version`;
  - row normalization maps Portuguese headers like `preco_varejo` and `garantia_tipo` to canonical fields.
- [x] Run `node tmp-tests\bulk-product-import-core.test.mjs` and confirm it fails because `services/bulkProductImportCore.js` does not exist.
- [x] Create `services/bulkProductImportCore.js` with:
  - `BULK_IMPORT_BASE_HEADERS`;
  - `buildBulkProductTemplateHeaders({ categoryConfig })`;
  - `normalizeBulkImportRow(row)`;
  - `normalizeBulkImportRows(rows)`.
- [x] Run the test and confirm it passes.

## Task 2: Validation and Conflict Planning

- [x] Extend the same test file for:
  - missing SKU is an error;
  - missing required prices are errors for new rows;
  - invalid IMEI length is an error;
  - duplicated SKU in the uploaded batch is an error;
  - duplicated serial/IMEI in the uploaded batch is an error;
  - existing SKU produces action `update` when `updateExisting` is true;
  - existing SKU produces action `skip` when `updateExisting` is false;
  - generated update payload preserves existing `images`.
- [x] Run `node tmp-tests\bulk-product-import-core.test.mjs` and confirm these tests fail.
- [x] Implement:
  - `validateBulkImportRows(rows, context)`;
  - `buildBulkImportPlan(rows, context, options)`;
  - `buildBulkImportPayload(row, existingProduct, options)`.
- [x] Run the test and confirm it passes.

## Task 3: Service Integration

- [x] Update `types/bulk-product.ts` with action/status/debug fields needed by the new plan while preserving existing exported names.
- [x] Update `services/bulk-products.ts` so `parseExcelFile()` uses `normalizeBulkImportRows()`.
- [x] Add exports from `bulkProductService` for:
  - `buildTemplateHeaders`;
  - `validateImportRows`;
  - `buildImportPlan`.
- [x] Keep existing `generatePreview()` and `createBulkProducts()` behavior operational for current UI.
- [x] Add a static no-Supabase assertion to the core test.
- [x] Add category-aware template download with an editable example row to the current Excel upload UI.
- [x] Run `node tmp-tests\bulk-product-import-core.test.mjs`.

## Task 4: Verification

- [x] Run `node tmp-tests\bulk-product-import-core.test.mjs`.
- [x] Run `node tmp-tests\category-spec-fields.test.mjs`.
- [x] Run `npm.cmd run build`.
- [x] Check `git status --short` and verify only planned files changed, plus pre-existing untracked report files.

## Phase 1 Non-Goals

- No new VPS endpoint yet.
- No persistent import jobs yet.
- No UI redesign yet.
- No Bling reconciliation execution yet.
- No Supabase usage.
