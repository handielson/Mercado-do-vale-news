# VPS Staging Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare the first safe migration block by deploying the built React/Vite frontend to the VPS as a staging/static site with rollback support.

**Architecture:** Keep the production domain on Vercel while creating a VPS-hosted static release flow. The script uploads `dist/` into a timestamped release directory, switches a `current` symlink, and keeps `previous` for rollback.

**Tech Stack:** Node.js, Vite, ssh2 SFTP, VPS filesystem releases, Nginx-ready static assets.

---

### Task 1: Static Frontend VPS Deploy Script

**Files:**
- Create: `scripts/deploy-vps-site.cjs`
- Test: `tmp-tests/vps-site-deploy-script-static.test.mjs`
- Modify: `package.json`
- Modify: `migração_VPS.md`

- [x] **Step 1: Write the failing static test**

Create `tmp-tests/vps-site-deploy-script-static.test.mjs` validating that the deploy script:

```js
import fs from 'node:fs';
import assert from 'node:assert/strict';

const scriptPath = 'scripts/deploy-vps-site.cjs';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

assert(fs.existsSync(scriptPath), 'scripts/deploy-vps-site.cjs should exist');

const script = fs.readFileSync(scriptPath, 'utf8');

assert(/VPS_SITE_HOST/.test(script), 'script should read VPS_SITE_HOST from env');
assert(/VPS_SITE_USER/.test(script), 'script should read VPS_SITE_USER from env');
assert(/VPS_SITE_PASSWORD/.test(script), 'script should read VPS_SITE_PASSWORD from env');
assert(/VPS_SITE_ROOT/.test(script), 'script should read VPS_SITE_ROOT from env');
assert(!/76\.13\.232\.162/.test(script), 'script must not hardcode VPS IP');
assert(!/@@@@/.test(script), 'script must not hardcode SSH password');
assert(/releases/.test(script), 'script should upload into a releases directory');
assert(/current/.test(script), 'script should maintain current symlink');
assert(/previous/.test(script), 'script should maintain previous symlink');
assert(/dist/.test(script), 'script should upload Vite dist output');
assert(/npm run build/.test(script), 'script should run npm run build before upload');
assert(/rollback/.test(script), 'script should document rollback command output');
assert(pkg.scripts['deploy:vps-site'] === 'node scripts/deploy-vps-site.cjs', 'package.json should expose deploy:vps-site');

console.log('vps site deploy script static checks ok');
```

- [x] **Step 2: Run the test to verify it fails**

Run:

```bash
node tmp-tests/vps-site-deploy-script-static.test.mjs
```

Expected: fail because the script does not exist yet.

- [x] **Step 3: Implement the deploy script**

Create `scripts/deploy-vps-site.cjs` with:

- env-only SSH config;
- `npm run build`;
- recursive upload of `dist/`;
- timestamped release path under `${VPS_SITE_ROOT}/releases/<timestamp>`;
- atomic-ish symlink switch: `previous -> old current`, `current -> new release`;
- clear rollback command printed at the end.

- [x] **Step 4: Add package script**

Add:

```json
"deploy:vps-site": "node scripts/deploy-vps-site.cjs"
```

- [x] **Step 5: Run test and build**

Run:

```bash
node tmp-tests/vps-site-deploy-script-static.test.mjs
npm run build
```

Expected: both pass.

- [x] **Step 6: Update migration documentation**

Update `migração_VPS.md`:

- mark this as first implementation step in the route map notes for `/`;
- add a change record following Rule 16;
- document that the script is staging/deploy preparation and does not switch DNS.

- [ ] **Step 7: Commit**

Stage only the files above and commit:

```bash
git add package.json scripts/deploy-vps-site.cjs tmp-tests/vps-site-deploy-script-static.test.mjs migração_VPS.md docs/superpowers/plans/2026-05-20-vps-staging-frontend.md
git commit -m "chore(vps): add static site deploy flow"
```
