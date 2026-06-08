# WhatsApp Attendance Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the essential attendance operations into `/admin/settings/whatsapp` while keeping the legacy AutoResponder page available.

**Architecture:** Add a focused `WhatsAppConversationsPanel` component that uses the existing `autoResponderService` conversation endpoints. The WhatsApp center renders connection, attendance, and migration status; the legacy `/admin/atendimento-automatico` route remains untouched.

**Tech Stack:** React/Vite/TypeScript admin UI, existing `autoResponderService`, existing VPS conversation endpoints, static Node regression tests.

---

## File Structure

- Modify `tmp-tests/whatsapp-connection-center-static.test.mjs`: extend the center contract to include the attendance panel.
- Create `components/whatsapp/WhatsAppConversationsPanel.tsx`: lists conversations, filters active/paused, and runs pause/resume/reset actions.
- Modify `components/whatsapp/WhatsAppMigrationChecklist.tsx`: mark `Atendimento` as `testing`.
- Modify `pages/admin/settings/WhatsAppPage.tsx`: render the attendance panel below connection.

---

## Tasks

### Task 1: Static Contract

- [ ] Add assertions for `WhatsAppConversationsPanel`, conversation service methods, and attendance copy.
- [ ] Run `node tmp-tests\whatsapp-connection-center-static.test.mjs` and confirm it fails for the missing component.

### Task 2: Attendance Component

- [ ] Create `components/whatsapp/WhatsAppConversationsPanel.tsx`.
- [ ] Use `autoResponderService.listConversations`, `pauseConversation`, `resumeConversation`, and `resetConversationCounters`.
- [ ] Include active/paused filters, refresh action, empty state, and per-conversation pause/resume/reset buttons.
- [ ] Run the static test and confirm it still fails until page integration.

### Task 3: Page Integration

- [ ] Render `WhatsAppConversationsPanel` from `pages/admin/settings/WhatsAppPage.tsx`.
- [ ] Mark `Atendimento` as `testing` in the migration checklist.
- [ ] Run the WhatsApp center static test and legacy AutoResponder regressions.

### Task 4: Verify And Publish

- [ ] Run `npm.cmd run build`.
- [ ] Deploy with `node scripts\deploy-vps-site.cjs`.
- [ ] Verify API health and production `/admin/settings/whatsapp`.
- [ ] Commit and push to `main`.

---

## Self-Review

- Spec coverage: This plan covers the approved option 2 only: essential attendance, not complete tag/blocklist migration.
- Placeholder scan: No deferred implementation placeholders.
- Type consistency: Uses existing `AutoResponderConversation` and existing `autoResponderService` methods.
