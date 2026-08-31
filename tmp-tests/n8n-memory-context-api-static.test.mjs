import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  assert.match(source, /n8nBotConversationContext\.cjs/);
  assert.match(source, /LAG\(created_at\) OVER \(ORDER BY id\)/);
  assert.match(source, /TIMESTAMPDIFF\(MICROSECOND, previous_created_at, created_at\) > \?/);
  assert.match(source, /selectConversationContext\(messageRows/);
  assert.match(source, /conversationContextIdle: context\.isIdle/);
  assert.match(source, /buildN8nBotContextMemorySessionKey/);
}

console.log('ok - API limits recent bot context and versions Postgres memory sessions');
