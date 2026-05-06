const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const localEnvPath = path.join(root, '.env.local');
const localEnv = fs.existsSync(localEnvPath) ? fs.readFileSync(localEnvPath, 'utf8') : '';
const API = 'https://api.xiaomipetrolina.com.br';

function readLocalEnv(name) {
  const match = localEnv.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match ? match[1].trim().replace(/^"|"$/g, '') : '';
}

const syncKey = readLocalEnv('SYNC_SECRET') || readLocalEnv('VITE_VPS_SYNC_KEY');

if (!syncKey) {
  throw new Error('Missing SYNC_SECRET/VITE_VPS_SYNC_KEY in .env.local');
}

async function admin(pathname, method = 'GET', body) {
  const response = await fetch(`${API}${pathname}`, {
    method,
    headers: {
      Accept: 'application/json',
      'X-Sync-Key': syncKey,
      ...(body == null ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: response.status, body: parsed };
}

function assertStatus(label, result, expected = 200) {
  if (result.status !== expected) {
    throw new Error(`${label}: expected HTTP ${expected}, got ${result.status}: ${JSON.stringify(result.body)}`);
  }
}

function normalizeActive(value) {
  return value === true || value === 1 || value === '1';
}

async function main() {
  const stamp = Date.now();
  const question = `codex curadoria e2e ${stamp}`;
  const replyText = `Resposta de teste da curadoria ${stamp}`;
  let created = null;
  const report = {
    ok: false,
    endpoint: '/autoresponder/rules/from-question',
    question,
    cleanup: 'not_started',
  };

  try {
    const createResult = await admin('/autoresponder/rules/from-question', 'POST', {
      question,
      reply_text: replyText,
      active: false,
      priority: 0,
      tag_ids: [],
    });
    assertStatus('create curated rule', createResult);
    created = createResult.body;

    if (!created?.id) throw new Error(`create curated rule did not return id: ${JSON.stringify(created)}`);
    if (created.pattern !== question) throw new Error(`created rule pattern mismatch: ${JSON.stringify(created)}`);
    if (created.reply_text !== replyText) throw new Error(`created rule reply_text mismatch: ${JSON.stringify(created)}`);
    if (normalizeActive(created.active)) throw new Error(`created curated rule must be inactive by default: ${JSON.stringify(created)}`);

    const listResult = await admin('/autoresponder/rules');
    assertStatus('list rules', listResult);
    const rules = Array.isArray(listResult.body) ? listResult.body : [];
    const listed = rules.find((rule) => Number(rule.id) === Number(created.id));
    if (!listed) throw new Error(`created rule ${created.id} was not found in /autoresponder/rules`);

    report.created = {
      id: created.id,
      name: created.name,
      pattern: created.pattern,
      active: created.active,
      reply_text: created.reply_text,
    };
    report.confirmed_in_list = true;
    report.ok = true;
  } finally {
    if (created?.id) {
      const deleteResult = await admin(`/autoresponder/rules/${created.id}`, 'DELETE');
      assertStatus('delete curated test rule', deleteResult);
      report.deleted = true;
      report.cleanup = 'deleted_test_rule';
    } else {
      report.deleted = false;
      report.cleanup = 'nothing_to_delete';
    }
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
