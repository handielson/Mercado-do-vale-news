# Synology Status in VPS Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Synology NAS operations panel inside the existing `Status VPS` page, showing live RAM/swap/uptime plus safe actions to refresh, restart the tunnel, and reboot the NAS.

**Architecture:** Keep DSM untouched. The NAS will report a lightweight status heartbeat to the VPS through the existing poller channel, the VPS will store the latest snapshot in memory and expose it to the admin UI, and the React page will render both VPS and NAS cards from those endpoints. Command actions will continue to use the existing queue pattern, expanded to support a full NAS reboot.

**Tech Stack:** Vite + React + TypeScript TSX on the admin UI, Fastify on `vps_server.js`, shell scripting on Synology DSM Task Scheduler, Node ESM service helpers with `node:assert/strict` tests.

---

## File Structure

### New files

- Create: `services/synologyNasStatusService.js`
  - Normalize raw NAS heartbeat payloads.
  - Compute freshness (`online`, `stale`, `offline`) and health (`ok`, `warning`, `critical`).
  - Build the response shape returned by `/synology/status`.
- Create: `services/synologyNasStatusService.test.mjs`
  - Covers normalization, freshness, and health rules.
- Create: `services/synologyCommandQueueService.js`
  - Encapsulates in-memory command queue state and TTL handling for Synology actions.
- Create: `services/synologyCommandQueueService.test.mjs`
  - Covers enqueue, pending lock, expiry, and ack transitions.
- Create: `services/synologyStatusViewModel.js`
  - Converts backend NAS status data into UI-friendly labels and button states for `VpsStatusPage.tsx`.
- Create: `services/synologyStatusViewModel.test.mjs`
  - Covers stale/offline copy, button disabling, and reboot schedule label formatting.

### Existing files to modify

- Modify: `vps_server.js`
  - Import both new backend services.
  - Replace ad-hoc Synology queue state with service-backed queue state.
  - Add `POST /synology/report-status`.
  - Add `GET /synology/status`.
  - Add `POST /synology/enqueue-reboot`.
- Modify: `synology-command-poller.sh`
  - Continue polling commands.
  - Collect RAM/swap/uptime/model data every run.
  - POST the heartbeat to the VPS.
  - Support `reboot-nas`.
- Modify: `pages/admin/settings/VpsStatusPage.tsx`
  - Fetch NAS status and command status alongside VPS status.
  - Render NAS cards, usage bars, health badges, and action buttons.
  - Reuse `vpsClient` for privileged actions.

### Existing files intentionally left unchanged

- `pages/admin/settings/SynologyConfigPage.tsx`
  - Documentation page only. No behavior change required for phase 1.
- `routes/index.tsx`
  - Existing route already points to `VpsStatusPage`.
- DSM UI / native Synology pages
  - Out of scope by design.

---

### Task 1: Build the NAS Snapshot Service

**Files:**
- Create: `services/synologyNasStatusService.js`
- Test: `services/synologyNasStatusService.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import assert from 'node:assert/strict';
import {
  normalizeSynologyStatusPayload,
  buildSynologyStatusResponse,
} from './synologyNasStatusService.js';

const normalized = normalizeSynologyStatusPayload({
  hostname: 'Hand_Server',
  model: 'DS723+',
  timestamp: '2026-04-20T16:40:00.000Z',
  uptime_seconds: 3600,
  memory: { total_mb: 1942, used_mb: 765, available_mb: 876 },
  swap: { total_mb: 3213, used_mb: 28, free_mb: 3185 },
  cache: { cached_mb: 762, buffers_mb: 18, slab_mb: 126 },
  scheduled_reboot: { enabled: true, label: 'Domingo 04:00' },
}, new Date('2026-04-20T16:41:00.000Z'));

assert.equal(normalized.memory.used_percent, 39);
assert.equal(normalized.swap.used_percent, 1);
assert.equal(normalized.freshness.state, 'online');
assert.equal(normalized.health.level, 'ok');

const offlineResponse = buildSynologyStatusResponse({
  snapshot: {
    ...normalized,
    timestamp: '2026-04-20T16:30:00.000Z',
  },
  command: null,
  now: new Date('2026-04-20T16:40:30.000Z'),
});

assert.equal(offlineResponse.ok, false);
assert.equal(offlineResponse.state, 'offline');
assert.equal(offlineResponse.snapshot.health.level, 'critical');

const missingResponse = buildSynologyStatusResponse({
  snapshot: null,
  command: null,
  now: new Date('2026-04-20T16:40:30.000Z'),
});

assert.equal(missingResponse.state, 'missing');
assert.equal(missingResponse.snapshot, null);

console.log('synologyNasStatusService.test.mjs: ok');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node services/synologyNasStatusService.test.mjs`  
Expected: FAIL with `Cannot find module` or missing export error for `synologyNasStatusService.js`.

- [ ] **Step 3: Write minimal implementation**

```js
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toPercent(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function resolveSynologyFreshness(timestamp, now = new Date()) {
  const ts = new Date(timestamp);
  if (Number.isNaN(ts.getTime())) {
    return { state: 'offline', age_ms: null };
  }

  const ageMs = Math.max(0, now.getTime() - ts.getTime());
  if (ageMs >= OFFLINE_THRESHOLD_MS) {
    return { state: 'offline', age_ms: ageMs };
  }
  if (ageMs >= ONLINE_THRESHOLD_MS) {
    return { state: 'stale', age_ms: ageMs };
  }
  return { state: 'online', age_ms: ageMs };
}

export function resolveSynologyHealth({ memoryAvailablePercent, swapUsedPercent, freshnessState }) {
  if (freshnessState === 'offline') {
    return { level: 'critical', message: 'NAS sem heartbeat recente' };
  }
  if (memoryAvailablePercent < 15 || swapUsedPercent >= 40) {
    return { level: 'critical', message: 'Memoria critica no NAS' };
  }
  if (memoryAvailablePercent < 25 || swapUsedPercent >= 20 || freshnessState === 'stale') {
    return { level: 'warning', message: 'NAS requer atencao' };
  }
  return { level: 'ok', message: 'Memoria estavel' };
}

export function normalizeSynologyStatusPayload(payload, now = new Date()) {
  const memoryTotalMb = toNumber(payload?.memory?.total_mb);
  const memoryUsedMb = toNumber(payload?.memory?.used_mb);
  const memoryAvailableMb = toNumber(payload?.memory?.available_mb);
  const swapTotalMb = toNumber(payload?.swap?.total_mb);
  const swapUsedMb = toNumber(payload?.swap?.used_mb);
  const swapFreeMb = toNumber(payload?.swap?.free_mb);
  const freshness = resolveSynologyFreshness(payload?.timestamp, now);
  const memoryAvailablePercent = toPercent(memoryAvailableMb, memoryTotalMb);
  const swapUsedPercent = toPercent(swapUsedMb, swapTotalMb);
  const health = resolveSynologyHealth({
    memoryAvailablePercent,
    swapUsedPercent,
    freshnessState: freshness.state,
  });

  return {
    hostname: payload?.hostname || 'Synology NAS',
    model: payload?.model || '',
    timestamp: payload?.timestamp || null,
    uptime_seconds: toNumber(payload?.uptime_seconds),
    memory: {
      total_mb: memoryTotalMb,
      used_mb: memoryUsedMb,
      available_mb: memoryAvailableMb,
      used_percent: toPercent(memoryUsedMb, memoryTotalMb),
      available_percent: memoryAvailablePercent,
    },
    swap: {
      total_mb: swapTotalMb,
      used_mb: swapUsedMb,
      free_mb: swapFreeMb,
      used_percent: swapUsedPercent,
    },
    cache: {
      cached_mb: toNumber(payload?.cache?.cached_mb),
      buffers_mb: toNumber(payload?.cache?.buffers_mb),
      slab_mb: toNumber(payload?.cache?.slab_mb),
    },
    scheduled_reboot: {
      enabled: Boolean(payload?.scheduled_reboot?.enabled),
      label: payload?.scheduled_reboot?.label || '',
    },
    freshness,
    health,
  };
}

export function buildSynologyStatusResponse({ snapshot, command = null, now = new Date() }) {
  if (!snapshot) {
    return {
      ok: false,
      state: 'missing',
      snapshot: null,
      command,
    };
  }

  const normalized = normalizeSynologyStatusPayload(snapshot, now);
  return {
    ok: normalized.freshness.state === 'online',
    state: normalized.freshness.state,
    snapshot: normalized,
    command,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node services/synologyNasStatusService.test.mjs`  
Expected: PASS with `synologyNasStatusService.test.mjs: ok`.

- [ ] **Step 5: Commit**

```bash
git add services/synologyNasStatusService.js services/synologyNasStatusService.test.mjs
git commit -m "feat: add synology status snapshot service"
```

---

### Task 2: Extract Synology Command Queue Logic and Wire VPS Endpoints

**Files:**
- Create: `services/synologyCommandQueueService.js`
- Test: `services/synologyCommandQueueService.test.mjs`
- Modify: `vps_server.js`

- [ ] **Step 1: Write the failing test**

```js
import assert from 'node:assert/strict';
import { createSynologyCommandQueue } from './synologyCommandQueueService.js';

const queue = createSynologyCommandQueue({ ttlMs: 1000 });
const first = queue.enqueue('restart-cloudflared', new Date('2026-04-20T10:00:00.000Z'));

assert.equal(first.ok, true);
assert.equal(first.command.status, 'pending');

const blocked = queue.enqueue('reboot-nas', new Date('2026-04-20T10:00:01.000Z'));
assert.equal(blocked.ok, false);
assert.equal(blocked.error, 'pending-command-exists');

const pending = queue.getStatus(new Date('2026-04-20T10:00:01.000Z'));
assert.equal(pending.status, 'pending');

queue.ack({
  id: first.command.id,
  status: 'success',
  result: 'cloudflared restarted',
}, new Date('2026-04-20T10:00:02.000Z'));

assert.equal(queue.getStatus().status, 'success');

const expiredQueue = createSynologyCommandQueue({ ttlMs: 1000 });
expiredQueue.enqueue('reboot-nas', new Date('2026-04-20T10:00:00.000Z'));

assert.equal(
  expiredQueue.getStatus(new Date('2026-04-20T10:00:03.000Z')).status,
  'expired',
);

console.log('synologyCommandQueueService.test.mjs: ok');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node services/synologyCommandQueueService.test.mjs`  
Expected: FAIL with `Cannot find module` or missing export error for `createSynologyCommandQueue`.

- [ ] **Step 3: Write minimal implementation**

Create `services/synologyCommandQueueService.js`:

```js
const DEFAULT_TTL_MS = 5 * 60 * 1000;

function createCommand(command, now = new Date()) {
  return {
    id: now.getTime().toString(36) + Math.random().toString(36).slice(2, 8),
    command,
    enqueuedAt: now.toISOString(),
    status: 'pending',
  };
}

export function createSynologyCommandQueue({ ttlMs = DEFAULT_TTL_MS } = {}) {
  let pending = null;

  function applyExpiry(now = new Date()) {
    if (!pending || pending.status !== 'pending') return;
    const age = now.getTime() - new Date(pending.enqueuedAt).getTime();
    if (age > ttlMs) {
      pending = { ...pending, status: 'expired' };
    }
  }

  return {
    enqueue(command, now = new Date()) {
      applyExpiry(now);
      if (pending && pending.status === 'pending') {
        return { ok: false, error: 'pending-command-exists', command: pending };
      }
      pending = createCommand(command, now);
      return { ok: true, command: pending };
    },
    getStatus(now = new Date()) {
      applyExpiry(now);
      return pending;
    },
    poll(now = new Date()) {
      applyExpiry(now);
      if (!pending || pending.status !== 'pending') {
        return { command: null };
      }
      return { id: pending.id, command: pending.command };
    },
    ack({ id, status, result }, now = new Date()) {
      if (!pending || pending.id !== id) return null;
      pending = {
        ...pending,
        status: status === 'success' ? 'success' : 'failed',
        completedAt: now.toISOString(),
        result: result ? String(result).slice(0, 500) : undefined,
      };
      return pending;
    },
  };
}
```

Modify `vps_server.js` to import and use both services:

```js
import {
  buildSynologyStatusResponse,
  normalizeSynologyStatusPayload,
} from './services/synologyNasStatusService.js';
import { createSynologyCommandQueue } from './services/synologyCommandQueueService.js';
```

Replace the ad-hoc module state:

```js
const synologyCommandQueue = createSynologyCommandQueue();
let synologyLastStatusSnapshot = null;
```

Add the new routes near the existing Synology queue block:

```js
fastify.get('/synology/status', { preHandler: requireSyncKey }, async () => {
  return buildSynologyStatusResponse({
    snapshot: synologyLastStatusSnapshot,
    command: synologyCommandQueue.getStatus(),
    now: new Date(),
  });
});

fastify.post('/synology/report-status', { preHandler: requireSynoPollKey }, async (req) => {
  synologyLastStatusSnapshot = normalizeSynologyStatusPayload(req.body || {}, new Date());
  return { ok: true, receivedAt: new Date().toISOString() };
});

fastify.post('/synology/enqueue-restart', { preHandler: requireSyncKey }, async (req, reply) => {
  if (!process.env.SYNOLOGY_POLL_KEY) {
    return reply.code(500).send({ error: 'SYNOLOGY_POLL_KEY not configured on VPS' });
  }
  const result = synologyCommandQueue.enqueue('restart-cloudflared', new Date());
  if (!result.ok) {
    return reply.code(409).send({ error: result.error, command: result.command });
  }
  return { ok: true, command: result.command };
});

fastify.post('/synology/enqueue-reboot', { preHandler: requireSyncKey }, async (req, reply) => {
  if (!process.env.SYNOLOGY_POLL_KEY) {
    return reply.code(500).send({ error: 'SYNOLOGY_POLL_KEY not configured on VPS' });
  }
  const result = synologyCommandQueue.enqueue('reboot-nas', new Date());
  if (!result.ok) {
    return reply.code(409).send({ error: result.error, command: result.command });
  }
  return { ok: true, command: result.command };
});

fastify.get('/synology/command-status', { preHandler: requireSyncKey }, async () => {
  return synologyCommandQueue.getStatus();
});

fastify.get('/synology/poll-command', { preHandler: requireSynoPollKey }, async () => {
  return synologyCommandQueue.poll(new Date());
});

fastify.post('/synology/ack-command', { preHandler: requireSynoPollKey }, async (req) => {
  const { id, status, result } = req.body || {};
  synologyCommandQueue.ack({ id, status, result }, new Date());
  return { ok: true };
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
node services/synologyCommandQueueService.test.mjs
node services/synologyNasStatusService.test.mjs
```

Expected:
- `synologyCommandQueueService.test.mjs: ok`
- `synologyNasStatusService.test.mjs: ok`

- [ ] **Step 5: Commit**

```bash
git add services/synologyCommandQueueService.js services/synologyCommandQueueService.test.mjs services/synologyNasStatusService.js services/synologyNasStatusService.test.mjs vps_server.js
git commit -m "feat: add synology status and reboot queue endpoints"
```

---

### Task 3: Extend the Synology Poller to Report RAM and Support Full Reboot

**Files:**
- Modify: `synology-command-poller.sh`

- [ ] **Step 1: Write the operational failing check**

Document the before-state so the implementer knows what should be missing:

```bash
# Before editing the script, this should fail because the endpoint does not exist yet
curl -s -H "x-poll-key: $POLL_KEY" "$VPS_URL/synology/status"

# Before editing the script, there is no reboot-nas branch
rg -n "reboot-nas|report-status|MemAvailable" synology-command-poller.sh
```

Expected:
- first command returns `Unauthorized`, `404`, or empty output depending on environment
- second command returns no matches

- [ ] **Step 2: Add status collection and reporting helpers**

Insert these helpers near the top of `synology-command-poller.sh` after `log()`:

```bash
collect_status_payload() {
    HOSTNAME_VALUE=$(hostname 2>/dev/null || echo "Synology NAS")
    MODEL_VALUE=$(cat /proc/sys/kernel/syno_hw_version 2>/dev/null || echo "")
    UPTIME_SECONDS=$(cut -d. -f1 /proc/uptime 2>/dev/null || echo "0")

    MEMTOTAL_KB=$(awk '/MemTotal:/ {print $2}' /proc/meminfo)
    MEMAVAILABLE_KB=$(awk '/MemAvailable:/ {print $2}' /proc/meminfo)
    SWAPTOTAL_KB=$(awk '/SwapTotal:/ {print $2}' /proc/meminfo)
    SWAPFREE_KB=$(awk '/SwapFree:/ {print $2}' /proc/meminfo)
    CACHED_KB=$(awk '/^Cached:/ {print $2}' /proc/meminfo)
    BUFFERS_KB=$(awk '/^Buffers:/ {print $2}' /proc/meminfo)
    SLAB_KB=$(awk '/^Slab:/ {print $2}' /proc/meminfo)

    MEMTOTAL_MB=$((MEMTOTAL_KB / 1024))
    MEMAVAILABLE_MB=$((MEMAVAILABLE_KB / 1024))
    MEMUSED_MB=$(((MEMTOTAL_KB - MEMAVAILABLE_KB) / 1024))
    SWAPTOTAL_MB=$((SWAPTOTAL_KB / 1024))
    SWAPFREE_MB=$((SWAPFREE_KB / 1024))
    SWAPUSED_MB=$(((SWAPTOTAL_KB - SWAPFREE_KB) / 1024))
    CACHED_MB=$((CACHED_KB / 1024))
    BUFFERS_MB=$((BUFFERS_KB / 1024))
    SLAB_MB=$((SLAB_KB / 1024))
    NOW_ISO=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    cat <<EOF
{"hostname":"$HOSTNAME_VALUE","model":"$MODEL_VALUE","timestamp":"$NOW_ISO","uptime_seconds":$UPTIME_SECONDS,"memory":{"total_mb":$MEMTOTAL_MB,"used_mb":$MEMUSED_MB,"available_mb":$MEMAVAILABLE_MB},"swap":{"total_mb":$SWAPTOTAL_MB,"used_mb":$SWAPUSED_MB,"free_mb":$SWAPFREE_MB},"cache":{"cached_mb":$CACHED_MB,"buffers_mb":$BUFFERS_MB,"slab_mb":$SLAB_MB},"scheduled_reboot":{"enabled":true,"label":"Domingo 04:00"}}
EOF
}

report_status() {
    STATUS_PAYLOAD=$(collect_status_payload)
    curl -s -m 5 -X POST \
        -H "x-poll-key: $POLL_KEY" \
        -H "Content-Type: application/json" \
        -d "$STATUS_PAYLOAD" \
        "$VPS_URL/synology/report-status" >> "$LOG_FILE" 2>&1
}
```

- [ ] **Step 3: Call `report_status` on every run and support `reboot-nas`**

Make two focused edits:

1. Report status before checking whether there is a pending command:

```bash
report_status

if [ -z "$RESP" ]; then
    exit 0
fi
```

2. Add a `reboot-nas` branch in the case statement:

```bash
    reboot-nas)
        log "Reboot completo do NAS solicitado..."
        STATUS="success"
        RESULT="nas reboot initiated"
        curl -s -m 5 -X POST \
            -H "x-poll-key: $POLL_KEY" \
            -H "Content-Type: application/json" \
            -d "{\"id\":\"$ID\",\"status\":\"$STATUS\",\"result\":\"$RESULT\"}" \
            "$VPS_URL/synology/ack-command" >> "$LOG_FILE" 2>&1
        sleep 2
        /sbin/reboot
        exit 0
        ;;
```

Keep the final ack block in place for all non-reboot commands.

- [ ] **Step 4: Verify the script syntax and deploy it to the real NAS**

Run locally in the repo:

```bash
bash -n synology-command-poller.sh
```

Expected: no output.

Then copy to the NAS and restore executable permissions:

```bash
scp synology-command-poller.sh Handielson@192.168.1.25:/volume1/scripts/synology-command-poller.sh
ssh Handielson@192.168.1.25 "sudo chmod +x /volume1/scripts/synology-command-poller.sh"
```

Expected:
- no syntax errors
- file replaced on the NAS
- executable bit restored

- [ ] **Step 5: Commit**

```bash
git add synology-command-poller.sh
git commit -m "feat: report synology memory heartbeat and reboot command"
```

---

### Task 4: Add a View Model for NAS Status Presentation

**Files:**
- Create: `services/synologyStatusViewModel.js`
- Test: `services/synologyStatusViewModel.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import assert from 'node:assert/strict';
import { buildSynologyPanelModel } from './synologyStatusViewModel.js';

const model = buildSynologyPanelModel({
  synologyStatus: {
    state: 'stale',
    snapshot: {
      hostname: 'Hand_Server',
      model: 'DS723+',
      timestamp: '2026-04-20T16:30:00.000Z',
      uptime_seconds: 7200,
      memory: { total_mb: 1942, used_mb: 1200, available_mb: 742, used_percent: 62, available_percent: 38 },
      swap: { total_mb: 3213, used_mb: 300, free_mb: 2913, used_percent: 9 },
      scheduled_reboot: { enabled: true, label: 'Domingo 04:00' },
      health: { level: 'warning', message: 'NAS requer atencao' },
      freshness: { state: 'stale', age_ms: 180000 },
    },
  },
  commandStatus: { status: 'pending', command: 'reboot-nas' },
  now: new Date('2026-04-20T16:33:00.000Z'),
});

assert.equal(model.title, 'Hand_Server');
assert.equal(model.statusLabel, 'Leitura desatualizada');
assert.equal(model.canRebootNow, false);
assert.equal(model.rebootScheduleLabel, 'Domingo 04:00');
assert.match(model.heartbeatLabel, /3m/);

console.log('synologyStatusViewModel.test.mjs: ok');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node services/synologyStatusViewModel.test.mjs`  
Expected: FAIL with `Cannot find module` or missing export error.

- [ ] **Step 3: Write minimal implementation**

```js
function formatDurationShort(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function buildSynologyPanelModel({ synologyStatus, commandStatus, now = new Date() }) {
  if (!synologyStatus?.snapshot) {
    return {
      title: 'Synology NAS',
      statusLabel: synologyStatus?.state === 'offline' ? 'NAS offline' : 'Sem leitura do NAS',
      heartbeatLabel: 'Sem heartbeat',
      canRebootNow: !(commandStatus?.status === 'pending'),
      rebootScheduleLabel: '',
      tone: 'slate',
    };
  }

  const snapshot = synologyStatus.snapshot;
  const heartbeatAgeMs = snapshot?.freshness?.age_ms ?? Math.max(0, now.getTime() - new Date(snapshot.timestamp).getTime());
  const statusLabel = synologyStatus.state === 'online'
    ? 'NAS online'
    : synologyStatus.state === 'stale'
      ? 'Leitura desatualizada'
      : 'NAS offline';

  return {
    title: snapshot.hostname || 'Synology NAS',
    subtitle: snapshot.model || '',
    statusLabel,
    heartbeatLabel: `Ultimo heartbeat ha ${formatDurationShort(heartbeatAgeMs)}`,
    canRebootNow: !(commandStatus?.status === 'pending'),
    rebootScheduleLabel: snapshot?.scheduled_reboot?.label || 'Nao configurado',
    tone: snapshot?.health?.level || 'slate',
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node services/synologyStatusViewModel.test.mjs`  
Expected: PASS with `synologyStatusViewModel.test.mjs: ok`.

- [ ] **Step 5: Commit**

```bash
git add services/synologyStatusViewModel.js services/synologyStatusViewModel.test.mjs
git commit -m "feat: add synology status view model helpers"
```

---

### Task 5: Render the NAS Panel and Actions on the Status Page

**Files:**
- Modify: `pages/admin/settings/VpsStatusPage.tsx`
- Test: `services/synologyStatusViewModel.test.mjs`

- [ ] **Step 1: Write the failing interaction check**

Use the already-written view model test as the RED proof for the UI state logic, then document the page gap:

```bash
node services/synologyStatusViewModel.test.mjs
rg -n "Synology|reboot-nas|command-status|/synology/status" pages/admin/settings/VpsStatusPage.tsx
```

Expected:
- first command is already green from Task 4
- second command shows there is still no Synology panel or action wiring in the page

- [ ] **Step 2: Add state and fetch wiring for NAS status**

At the top of `VpsStatusPage.tsx`, add the imports and local types:

```tsx
import { Power, RotateCcw, TriangleAlert } from 'lucide-react';
import { vpsClient } from '../../../services/vpsClient';
import { buildSynologyPanelModel } from '../../../services/synologyStatusViewModel';

interface SynologySnapshotResponse {
    ok: boolean;
    state: 'online' | 'stale' | 'offline' | 'missing';
    snapshot: null | {
        hostname: string;
        model: string;
        timestamp: string | null;
        uptime_seconds: number;
        memory: { total_mb: number; used_mb: number; available_mb: number; used_percent: number; available_percent: number };
        swap: { total_mb: number; used_mb: number; free_mb: number; used_percent: number };
        scheduled_reboot: { enabled: boolean; label: string };
        health: { level: 'ok' | 'warning' | 'critical'; message: string };
        freshness: { state: 'online' | 'stale' | 'offline'; age_ms: number | null };
    };
    command?: CommandStatus | null;
}

interface CommandStatus {
    command: string | null;
    id?: string;
    enqueuedAt?: string;
    status?: 'pending' | 'success' | 'failed' | 'expired';
    completedAt?: string;
    result?: string;
}
```

Add state inside the component:

```tsx
const [synologyStatus, setSynologyStatus] = useState<SynologySnapshotResponse | null>(null);
const [commandStatus, setCommandStatus] = useState<CommandStatus | null>(null);
const [actionBusy, setActionBusy] = useState<'restart' | 'reboot' | null>(null);
```

Replace the single fetch with a combined fetch:

```tsx
const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
        const [vps, synology, command] = await Promise.all([
            vpsClient.get<VpsStatus>('/status'),
            vpsClient.get<SynologySnapshotResponse>('/synology/status'),
            vpsClient.get<CommandStatus | null>('/synology/command-status'),
        ]);
        setStatus(vps);
        setSynologyStatus(synology);
        setCommandStatus(command);
        setLastCheck(new Date());
        setCountdown(AUTO_REFRESH_MS / 1000);
    } catch (e: any) {
        setError(e.message || 'Erro ao conectar a VPS');
        setStatus(null);
        setSynologyStatus(null);
        setCommandStatus(null);
    } finally {
        setLoading(false);
    }
}, []);
```

- [ ] **Step 3: Add the action handlers and render block**

Add the handlers:

```tsx
async function handleRestartTunnel() {
    setActionBusy('restart');
    try {
        const resp = await vpsClient.post<{ ok: boolean; command: CommandStatus }>('/synology/enqueue-restart', {});
        setCommandStatus(resp.command);
    } finally {
        setActionBusy(null);
    }
}

async function handleRebootNas() {
    const confirmed = window.confirm('Reiniciar o NAS agora? Isso derruba o acesso por alguns minutos.');
    if (!confirmed) return;
    setActionBusy('reboot');
    try {
        const resp = await vpsClient.post<{ ok: boolean; command: CommandStatus }>('/synology/enqueue-reboot', {});
        setCommandStatus(resp.command);
    } finally {
        setActionBusy(null);
    }
}
```

Build the panel model before `return`:

```tsx
const synologyPanel = buildSynologyPanelModel({
    synologyStatus,
    commandStatus,
    now: new Date(),
});
```

Render the NAS panel below the existing VPS status banner:

```tsx
{synologyPanel && (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-4">
            <div>
                <h2 className="text-xl font-bold text-slate-900">{synologyPanel.title}</h2>
                {synologyPanel.subtitle && <p className="text-sm text-slate-500 mt-1">{synologyPanel.subtitle}</p>}
            </div>
            <StatusBadge ok={synologyStatus?.state === 'online'} label={synologyPanel.statusLabel} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<Server size={20} />} label="RAM usada" value={`${synologyStatus?.snapshot?.memory.used_mb ?? 0} MB`} sub={`${synologyStatus?.snapshot?.memory.available_mb ?? 0} MB livres`} />
            <StatCard icon={<HardDrive size={20} />} label="Swap usado" value={`${synologyStatus?.snapshot?.swap.used_mb ?? 0} MB`} sub={`${synologyStatus?.snapshot?.swap.free_mb ?? 0} MB livres`} />
            <StatCard icon={<Clock size={20} />} label="Uptime NAS" value={formatUptime(synologyStatus?.snapshot?.uptime_seconds ?? 0)} sub={synologyPanel.heartbeatLabel} />
            <StatCard icon={<TriangleAlert size={20} />} label="Reboot semanal" value={synologyPanel.rebootScheduleLabel} sub={synologyStatus?.snapshot?.health.message || 'Sem dados'} />
        </div>

        {synologyStatus?.snapshot && (
            <>
                <UsageBar
                    used={synologyStatus.snapshot.memory.used_mb}
                    total={synologyStatus.snapshot.memory.total_mb}
                    label="Memoria RAM do NAS"
                    unit=" MB"
                />
                <UsageBar
                    used={synologyStatus.snapshot.swap.used_mb}
                    total={synologyStatus.snapshot.swap.total_mb}
                    label="Swap do NAS"
                    unit=" MB"
                />
            </>
        )}

        <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
            <button onClick={fetchStatus} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium">
                <RefreshCw size={15} />
                Atualizar agora
            </button>
            <button onClick={handleRestartTunnel} disabled={actionBusy !== null || commandStatus?.status === 'pending'} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-sm font-medium disabled:opacity-60">
                <RotateCcw size={15} />
                Reiniciar tunel
            </button>
            <button onClick={handleRebootNas} disabled={!synologyPanel.canRebootNow || actionBusy !== null} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-900 text-sm font-medium disabled:opacity-60">
                <Power size={15} />
                Reiniciar NAS agora
            </button>
        </div>
    </div>
)}
```

- [ ] **Step 4: Run verification**

Run:

```bash
node services/synologyStatusViewModel.test.mjs
node services/synologyCommandQueueService.test.mjs
node services/synologyNasStatusService.test.mjs
npm run build
```

Expected:
- all three `*.test.mjs` scripts print `: ok`
- `npm run build` completes successfully

- [ ] **Step 5: Commit**

```bash
git add pages/admin/settings/VpsStatusPage.tsx services/synologyStatusViewModel.js services/synologyStatusViewModel.test.mjs
git commit -m "feat: show synology memory and actions in status page"
```

---

### Task 6: End-to-End Validation on the Real NAS

**Files:**
- Modify: none
- Test: live NAS + live VPS + admin UI

- [ ] **Step 1: Trigger a live heartbeat and verify the VPS endpoint**

Run on the NAS:

```bash
sudo bash /volume1/scripts/synology-command-poller.sh
```

Run from the workstation:

```bash
curl -s -H "x-sync-key: $SYNC_SECRET" "https://api.xiaomipetrolina.com.br/synology/status"
```

Expected:
- the script runs without shell errors
- the endpoint returns a JSON object with `snapshot.memory`, `snapshot.swap`, and `snapshot.scheduled_reboot`

- [ ] **Step 2: Verify the UI render path**

Open:

```text
/admin/settings/vps-status
```

Expected:
- existing VPS cards still render
- a new Synology block appears
- RAM and swap bars show real values
- reboot schedule displays `Domingo 04:00`
- the page still auto-refreshes every 30 seconds

- [ ] **Step 3: Verify the tunnel restart action**

From the UI:
- click `Reiniciar tunel`

Expected:
- button goes pending
- `command-status` changes to `pending`
- within one poll cycle the status becomes `success` or a clear error

- [ ] **Step 4: Verify the NAS reboot action carefully**

From the UI:
- click `Reiniciar NAS agora`
- confirm the browser prompt

Expected:
- the command is enqueued once
- the page shows pending state
- the NAS disconnects briefly
- after boot, the poller resumes and the next heartbeat repopulates the panel

Only run this once the operator confirms there is no upload, sync burst, or maintenance in progress.

- [ ] **Step 5: Commit operational notes**

```bash
git add docs/superpowers/specs/2026-04-20-synology-status-vps-design.md docs/superpowers/plans/2026-04-20-synology-status-vps.md
git commit -m "docs: add synology status panel implementation plan"
```

---

## Self-Review

### Spec coverage

- NAS RAM/swap/uptime in `Status VPS`: covered by Tasks 1, 4, and 6.
- VPS intermediary architecture: covered by Tasks 1, 2, and 3.
- Actions `Atualizar`, `Reiniciar tunel`, `Reiniciar NAS agora`: covered by Tasks 2, 4, and 6.
- Safe handling of destructive reboot action: covered by Tasks 2, 3, 4, and 6.
- Keep DSM untouched: preserved by all tasks.

### Placeholder scan

- No `TODO`, `TBD`, or "implement later" language remains.
- Every code-changing step includes concrete code blocks.
- Every verification step includes exact commands and expected output.

### Type consistency

- Queue command names are fixed as `restart-cloudflared` and `reboot-nas` across backend, shell script, and UI.
- NAS status state values are fixed as `online`, `stale`, `offline`, `missing`.
- Health levels are fixed as `ok`, `warning`, `critical`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-20-synology-status-vps.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
