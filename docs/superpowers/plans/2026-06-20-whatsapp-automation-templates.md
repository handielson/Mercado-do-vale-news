# WhatsApp Automation Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add editable WhatsApp automation templates with categories, defaults, and per-template enabled switches.

**Architecture:** A focused frontend service owns default template definitions and VPS persistence through table-data. A React panel in the WhatsApp center edits templates and exposes room for transactional, promotional, informational, and future categories. The VPS startup schema creates the backing table.

**Tech Stack:** React, TypeScript, Vite, lucide-react, Fastify VPS server, MySQL table-data API, static Node tests.

---

### Task 1: Static Contract Test

**Files:**
- Create: `tmp-tests/whatsapp-automation-templates-static.test.mjs`

- [ ] Write a static test that asserts the service, panel, defaults, page integration, and VPS schema strings exist.
- [ ] Run `node tmp-tests/whatsapp-automation-templates-static.test.mjs` and verify it fails because the feature files do not exist yet.

### Task 2: Template Service

**Files:**
- Create: `services/whatsappAutomationTemplateService.ts`

- [ ] Define template categories and default templates for registration, admin registration, purchase completed, birthday, delivery route, promotional, informational, post-sale, and warranty.
- [ ] Implement list, save, reset, and preview helpers using `/table-data/whatsapp_automation_templates`.
- [ ] Keep the service independent from Supabase.

### Task 3: Admin Panel

**Files:**
- Create: `components/whatsapp/WhatsAppAutomationTemplatesPanel.tsx`
- Modify: `pages/admin/settings/WhatsAppPage.tsx`

- [ ] Build a panel with category buttons, template selector, enabled toggle, textarea editor, variables list, preview, save, and reset.
- [ ] Add the panel to the WhatsApp center below the connection/settings tools.

### Task 4: VPS Schema

**Files:**
- Modify: `vps_server.cjs`
- Modify: `vps_server.js`

- [ ] Create `whatsapp_automation_templates` at startup with columns for key, category, title, description, content, enabled, variables JSON, and timestamps.
- [ ] Add compatibility columns with `addColumnIfMissing`.

### Task 5: Verification

**Files:**
- Test: `tmp-tests/whatsapp-automation-templates-static.test.mjs`

- [ ] Run the static test and verify it passes.
- [ ] Run `npm.cmd run build` from `mercado-do-vale` and verify the app compiles.
