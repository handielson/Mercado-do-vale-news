# Display Idle Site Instagram Wifi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the duplicated idle message screen with rotating site, Instagram, and optional Wi-Fi QR cards.

**Architecture:** The display page keeps Pix views unchanged and only replaces the idle fallback/card rotation. Public company settings provide logo and Instagram; per-display idle content stores optional Wi-Fi QR settings. The Android app exposes a best-effort SSID bridge for future APK builds, while the web UI remains usable with manual SSID/password entry.

**Tech Stack:** React, TypeScript, Fastify JSON storage, `react-qr-code`, Android Kotlin WebView bridge.

---

### Task 1: Regression Guard

**Files:**
- Create: `tmp-tests/pdv-display-idle-qr-cards-static.test.mjs`

- [ ] Add a static test that verifies `DisplayPage.tsx` imports public company settings, creates site/Instagram/Wi-Fi idle cards, renders the display name only in the bottom-left marker, and does not fall back to the duplicated `Mercado do Vale`/display-name message.
- [ ] Run `node tmp-tests\pdv-display-idle-qr-cards-static.test.mjs` and confirm it fails before implementation.

### Task 2: Display Idle Cards

**Files:**
- Modify: `types/pdvDisplay.ts`
- Modify: `pages/display/DisplayPage.tsx`

- [ ] Add `wifi` settings to `PdvDisplayIdleContent` with `enabled`, `ssid`, `password`, and `security`.
- [ ] Load `publicCompanySettingsService.get()` in `DisplayPage.tsx`.
- [ ] Build default idle cards for site, Instagram when configured, and Wi-Fi when configured.
- [ ] Render site/Instagram/Wi-Fi cards with centered logo, text, URL/handle, and QR.
- [ ] Keep display name as a small absolute label in the lower-left corner.

### Task 3: Admin Wi-Fi Fields

**Files:**
- Modify: `pages/admin/settings/DisplaysPage.tsx`

- [ ] Add a Wi-Fi section under idle content with enable toggle, SSID, password, show/hide password, and WPA/WPA2 default.
- [ ] Save Wi-Fi settings inside `idle_content`.
- [ ] Keep existing banners/products/categories/messages working.

### Task 4: Android SSID Bridge

**Files:**
- Modify: `android/totem-pix/app/src/main/AndroidManifest.xml`
- Modify: `android/totem-pix/app/src/main/java/br/com/mercadodovale/totempix/MainActivity.kt`

- [ ] Add Android permissions needed for best-effort SSID detection.
- [ ] Expose `window.MdvTotem.getWifiSsid()` through a JavaScript interface.
- [ ] Request location permission when needed and return an empty string when Android blocks SSID access.

### Task 5: Verification

**Files:**
- Test: `tmp-tests/pdv-display-idle-qr-cards-static.test.mjs`
- Existing tests: `tmp-tests/pdv-display-admin-static.test.mjs`, `tmp-tests/pdv-display-routes-static.test.mjs`

- [ ] Run `node tmp-tests\pdv-display-idle-qr-cards-static.test.mjs`.
- [ ] Run `node tmp-tests\pdv-display-admin-static.test.mjs`.
- [ ] Run `node tmp-tests\pdv-display-routes-static.test.mjs`.
- [ ] Run `npm.cmd run build`.
- [ ] Build APK with `gradle.bat assembleDebug` from `android/totem-pix` after Android edits.
