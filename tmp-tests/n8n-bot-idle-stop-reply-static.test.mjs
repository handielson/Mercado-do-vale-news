import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const normalizeSource = source.match(/function normalizeN8nBotIdleReplyText\(value\) \{[\s\S]*?\n\}/)?.[0];
  const actionSource = source.match(/function getN8nBotIdleReplyAction\(text, previousSourceNode = ''\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(normalizeSource && actionSource, `${file}: idle reply classifier functions must exist`);

  const classify = vm.runInNewContext(
    `${normalizeSource}\n${actionSource}\ngetN8nBotIdleReplyAction`,
  );
  assert.equal(classify('Naooooo', 'idle-followup'), 'suppress', `${file}: long no must stop follow-ups`);
  assert.equal(classify('Nãoooo', 'idle-followup'), 'suppress', `${file}: accented long no must stop follow-ups`);
  assert.equal(classify('Por enquanto não mais obg', 'Controle Bot - Registrar Saida'), 'suppress', `${file}: explicit conversation ending must stop follow-ups before the first reminder`);
  assert.equal(classify('Não tem Redmi 15?', 'idle-followup'), 'reopen', `${file}: a product question must reopen instead of opting out`);
  assert.equal(classify('Quero um Samsung', 'idle-followup'), 'reopen', `${file}: a new sales request must reopen the idle flow`);

  assert.match(source, /idle_suppressed_at = CURRENT_TIMESTAMP/, `${file}: suppression must be persisted`);
  assert.match(source, /idle_suppressed_at = NULL/, `${file}: a real new inbound message must clear suppression`);
  assert.match(source, /idle_suppressed_reason = 'customer-ended-conversation'/, `${file}: suppression reason must be auditable`);
  assert.match(source, /addColumnIfMissing\('n8n_bot_client_controls', 'idle_suppressed_at'/, `${file}: suppression timestamp migration must exist`);
  assert.match(source, /addColumnIfMissing\('n8n_bot_client_controls', 'idle_suppressed_reason'/, `${file}: suppression reason migration must exist`);

  const scheduler = source.slice(source.indexOf('async function runN8nBotIdleFollowups'));
  const suppressionGuards = scheduler.match(/idle_suppressed_at IS NULL/g) || [];
  assert.ok(suppressionGuards.length >= 4, `${file}: follow-up and close select/claim queries must all reject suppressed conversations`);
}

console.log('n8n bot idle stop reply guards: ok');
