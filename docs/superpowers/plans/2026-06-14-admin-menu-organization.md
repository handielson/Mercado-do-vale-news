# Admin Menu Organization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the admin sidebar into clearer day-to-day operational groups and remove the development-only `Teste de Abas` link from the visible menu.

**Architecture:** Keep the current `AdminLayout.tsx` menu array pattern. Only reorder and regroup existing menu items; do not remove routes or shared services.

**Tech Stack:** React, TypeScript, Vite, static Node regression tests.

---

### Task 1: Sidebar Menu Regression Test

**Files:**
- Create: `tmp-tests/admin-menu-organization-static.test.mjs`
- Modify: `layouts/AdminLayout.tsx`

- [ ] **Step 1: Write the failing test**

Create a static test that checks the sidebar group names, key item placement, and absence of `/test-tabs` from `AdminLayout.tsx`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tmp-tests\admin-menu-organization-static.test.mjs`
Expected: FAIL while old groups such as `Operacional` and the `Teste de Abas` item still exist.

- [ ] **Step 3: Implement the menu organization**

Edit `layouts/AdminLayout.tsx` so `menuGroups` uses:
`Atendimento`, `Produtos & Estoque`, `Financeiro`, `Loja Online & Marketing`, `Catalogo Tecnico`, `Integracoes`, `Empresa & Sistema`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tmp-tests\admin-menu-organization-static.test.mjs`
Expected: PASS.

### Task 2: Release Verification

**Files:**
- Modify: `public/VERSION.json`
- Modify: `VERSAO_ATUAL.md`
- Create: `docs/versoes/2026-06-14-v1.1.7-organize-admin-menu.md`

- [ ] **Step 1: Update version docs**

Set version to `v1.1.7-organize-admin-menu` and describe the sidebar grouping change.

- [ ] **Step 2: Run verification**

Run:
```powershell
node tmp-tests\admin-menu-organization-static.test.mjs
npm.cmd run build
```

- [ ] **Step 3: Publish**

Run:
```powershell
$env:VPS_SITE_RELEASE_NAME='20260614-193000-v117-organize-admin-menu'; npm.cmd run deploy:vps-site
curl.exe -s https://www.mercadodovale.com.br/VERSION.json
```
