# Evolution Bot Typing Presence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show WhatsApp “digitando” through Evolution API before automatic bot replies are sent.

**Architecture:** Keep the behavior inside the automatic Evolution autoresponder reply path. Add one helper that sends typing presence and waits briefly, then call it from `sendAutoresponderEvolutionReplies()` before text delivery; leave manual attendant messages untouched.

**Tech Stack:** Node.js Fastify VPS server, Evolution API HTTP endpoints, static Node.js regression test.

---

## File Structure

- Modify `vps_server.cjs`: add the typing delay helper, add the Evolution typing presence helper, and call it only in `sendAutoresponderEvolutionReplies()`.
- Modify `vps_server.js`: mirror the same VPS server change because this repository keeps both deployment server files in sync.
- Create `tmp-tests/autoresponder-evolution-typing-presence-static.test.mjs`: static regression test for the automatic flow and manual-message exclusion.

### Task 1: Add regression test for automatic typing presence

**Files:**
- Create: `tmp-tests/autoresponder-evolution-typing-presence-static.test.mjs`
- Read: `vps_server.cjs`

- [ ] **Step 1: Write the failing test**

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('vps_server.cjs', 'utf8');

assert.match(
  source,
  /async function sleepAutoresponderEvolutionTypingPresence\(/,
  'server must define a helper that waits while Evolution shows typing presence'
);

assert.match(
  source,
  /async function sendAutoresponderEvolutionTypingPresence\(/,
  'server must define a helper that sends Evolution typing presence'
);

assert.match(
  source,
  /\/chat\/sendPresence\/\$\{EVOLUTION_INSTANCE_NAME\}/,
  'typing presence must use the Evolution sendPresence endpoint'
);

const repliesFunctionMatch = source.match(
  /async function sendAutoresponderEvolutionReplies\(sender, replies\) \{[\s\S]*?\n\}/
);
assert.ok(repliesFunctionMatch, 'sendAutoresponderEvolutionReplies must exist');
const repliesFunction = repliesFunctionMatch[0];

const typingIndex = repliesFunction.indexOf('await sendAutoresponderEvolutionTypingPresence(sender, text)');
const sendIndex = repliesFunction.indexOf('await sendAutoresponderEvolutionTextMessage(sender, text)');
assert.ok(typingIndex >= 0, 'automatic Evolution replies must request typing presence');
assert.ok(sendIndex >= 0, 'automatic Evolution replies must still send text messages');
assert.ok(typingIndex < sendIndex, 'typing presence must happen before the text message is sent');

const manualRouteMatch = source.match(
  /fastify\.post\('\/autoresponder\/conversations\/:sender\/manual-message'[\s\S]*?fastify\.post\('\/autoresponder\/conversations\/:sender\/tags'/
);
assert.ok(manualRouteMatch, 'manual message route must be found');
assert.ok(
  !manualRouteMatch[0].includes('sendAutoresponderEvolutionTypingPresence'),
  'manual attendant messages must not simulate bot typing presence'
);

console.log('autoresponder Evolution typing presence static checks passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tmp-tests/autoresponder-evolution-typing-presence-static.test.mjs`

Expected: `AssertionError` saying the typing helper is missing.

### Task 2: Implement automatic typing presence

**Files:**
- Modify: `vps_server.cjs`
- Modify: `vps_server.js`

- [ ] **Step 1: Add helpers near `sendAutoresponderEvolutionTextMessage()`**

```js
function getAutoresponderEvolutionTypingDelayMs(text) {
  const length = String(text || '').trim().length;
  if (!length) return 0;
  return Math.max(900, Math.min(3500, 500 + length * 18));
}

async function sleepAutoresponderEvolutionTypingPresence(ms) {
  const delay = Number(ms || 0);
  if (!Number.isFinite(delay) || delay <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, delay));
}

async function sendAutoresponderEvolutionTypingPresence(sender, text) {
  const number = normalizeAutoresponderSender(sender);
  if (!number) return;
  const delayMs = getAutoresponderEvolutionTypingDelayMs(text);
  if (!delayMs) return;
  try {
    await callEvolutionApiDetailed(`/chat/sendPresence/${EVOLUTION_INSTANCE_NAME}`, 'POST', {
      number,
      presence: 'composing',
      delay: delayMs,
    });
    await sleepAutoresponderEvolutionTypingPresence(delayMs);
  } catch (err) {
    console.warn('[autoresponder-evolution] typing presence skipped:', err?.message || err);
  }
}
```

- [ ] **Step 2: Call the helper before automatic text sending**

Change `sendAutoresponderEvolutionReplies()` to:

```js
async function sendAutoresponderEvolutionReplies(sender, replies) {
  const replyItems = Array.isArray(replies) ? replies : [];
  const results = [];
  for (const replyItem of replyItems) {
    const text = String(replyItem?.message || replyItem || '').trim();
    if (!text) continue;
    await sendAutoresponderEvolutionTypingPresence(sender, text);
    results.push(await sendAutoresponderEvolutionTextMessage(sender, text));
  }
  return results;
}
```

### Task 3: Verify and commit

**Files:**
- Test: `tmp-tests/autoresponder-evolution-typing-presence-static.test.mjs`
- Test: `tmp-tests/whatsapp-connection-center-static.test.mjs`

- [ ] **Step 1: Run focused test**

Run: `node tmp-tests/autoresponder-evolution-typing-presence-static.test.mjs`

Expected: `autoresponder Evolution typing presence static checks passed`

- [ ] **Step 2: Run existing WhatsApp static regression**

Run: `node tmp-tests/whatsapp-connection-center-static.test.mjs`

Expected: `whatsapp connection center static checks passed`

- [ ] **Step 3: Inspect git diff**

Run: `git diff -- vps_server.cjs vps_server.js tmp-tests/autoresponder-evolution-typing-presence-static.test.mjs docs/superpowers/plans/2026-06-19-evolution-bot-typing-presence.md`

Expected: only typing presence implementation, the new test, and this plan.

- [ ] **Step 4: Commit**

```bash
git add -- vps_server.cjs vps_server.js tmp-tests/autoresponder-evolution-typing-presence-static.test.mjs docs/superpowers/plans/2026-06-19-evolution-bot-typing-presence.md
git commit -m "feat: show typing presence for bot replies" -m "Co-Authored-By: GPT-5 Codex <noreply@openai.com>"
```
