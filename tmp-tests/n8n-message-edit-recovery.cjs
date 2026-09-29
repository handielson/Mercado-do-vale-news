const assert = require('node:assert/strict');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');
const { readWorkflow } = require('./n8n-warranty-policy.cjs');

const MARKER = 'message-edit-recovery-v1';

function nodeByName(nodes, name) {
  const node = nodes.find((item) => item?.name === name);
  assert.ok(node, `${name} not found`);
  return node;
}

function patchDados(node) {
  let code = String(node.parameters?.jsCode || '');
  if (code.includes(MARKER)) return;
  const anchor = `const body = $json.body || {};
const data = body.data || {};
const key = data.key || {};
const message = data.message || {};
const rawMessageType = String(data.messageType || data.message_type || '');

const getText = () => String(
  message.conversation
  || message.extendedTextMessage?.text
  || data.text
  || data.messageText
  || ''
).trim();`;
  assert.ok(code.includes(anchor), 'Dados edit-message anchor not found');
  const replacement = `const body = $json.body || {};
const data = body.data || {};
const key = data.key || data.update?.key || {};
const eventNameV402 = String(body.event || '').trim().toLowerCase();
const isMessageEditV402 = /^(?:messages[._](?:update|edited))$/.test(eventNameV402);

// ${MARKER}: Evolution emits MESSAGES_UPDATE after a customer edits a message.
// Delivery/read updates and encrypted payloads have no replacement text and must not reach the agent.
const textFromMessageV402 = (candidate) => String(
  candidate?.conversation
  || candidate?.extendedTextMessage?.text
  || candidate?.imageMessage?.caption
  || candidate?.videoMessage?.caption
  || candidate?.documentMessage?.caption
  || ''
).trim();
const editedCandidatesV402 = [
  data.editedMessage,
  data.edited_message,
  data.update?.editedMessage,
  data.update?.edited_message,
  data.update?.message,
  data.messageUpdate?.editedMessage,
  data.messageUpdate?.edited_message,
  data.messageUpdate?.message,
  data.message?.editedMessage,
  data.message?.edited_message,
  data.message?.protocolMessage?.editedMessage,
];
const editedMessageV402 = isMessageEditV402
  ? editedCandidatesV402.find((candidate) => textFromMessageV402(candidate)) || null
  : null;
const editedTextV402 = textFromMessageV402(editedMessageV402);
if (isMessageEditV402 && !editedTextV402) return [];

const message = editedMessageV402 || data.message || {};
const rawMessageType = String(data.messageType || data.message_type || (isMessageEditV402 ? 'conversation' : ''));

const getText = () => isMessageEditV402
  ? editedTextV402
  : String(
    message.conversation
    || message.extendedTextMessage?.text
    || data.text
    || data.messageText
    || ''
  ).trim();`;
  code = code.replace(anchor, replacement);
  const staleAnchor = "const eventNameV226 = String(body.event || '').trim().toLowerCase();";
  assert.ok(code.includes(staleAnchor), 'Dados stale guard anchor not found');
  code = code.replace(staleAnchor, 'const eventNameV226 = eventNameV402;');
  const baseAnchor = "  messageId: String(key.id || data.messageId || data.id || ''),\n};";
  assert.ok(code.includes(baseAnchor), 'Dados base anchor not found');
  code = code.replace(baseAnchor, `  messageId: String(key.id || data.messageId || data.id || ''),
  messageEdited: isMessageEditV402,
  editedMessageId: String(
    data.message?.protocolMessage?.key?.id
    || data.update?.key?.id
    || data.messageUpdate?.key?.id
    || ''
  ),
};`);
  new Function('$json', '$execution', code);
  node.parameters.jsCode = code;
}

function patchWorkflow(workflow) {
  const patched = structuredClone(workflow);
  patchDados(nodeByName(patched.nodes, 'Dados'));
  return patched;
}

function runFixtures(workflow) {
  const code = nodeByName(workflow.nodes, 'Dados').parameters.jsCode;
  const execute = new Function('$json', '$execution', code);
  const normal = execute({ body: {
    event: 'MESSAGES_UPSERT',
    data: { key: { remoteJid: '5587000000000@s.whatsapp.net', id: 'normal-1', fromMe: false }, message: { conversation: 'Poco X8 Pro 12GB' }, messageTimestamp: Math.floor(Date.now() / 1000) },
  } }, { id: 1 });
  assert.equal(normal[0].json.conversation, 'Poco X8 Pro 12GB');
  assert.equal(normal[0].json.messageEdited, false);

  const edited = execute({ body: {
    event: 'MESSAGES_UPDATE',
    data: {
      key: { remoteJid: '5587000000000@s.whatsapp.net', id: 'edit-event-1', fromMe: false },
      message: { protocolMessage: { key: { id: 'original-312gb' }, editedMessage: { conversation: '512gb' } } },
      messageTimestamp: Math.floor(Date.now() / 1000),
    },
  } }, { id: 2 });
  assert.equal(edited[0].json.conversation, '512gb');
  assert.equal(edited[0].json.messageEdited, true);
  assert.equal(edited[0].json.editedMessageId, 'original-312gb');

  const nestedEdit = execute({ body: {
    event: 'messages.edited',
    data: {
      key: { remoteJid: '5587000000000@s.whatsapp.net', id: 'edit-event-2', fromMe: false },
      update: { editedMessage: { extendedTextMessage: { text: 'Poco X8 Pro 12GB/512GB' } } },
      messageTimestamp: Math.floor(Date.now() / 1000),
    },
  } }, { id: 3 });
  assert.equal(nestedEdit[0].json.conversation, 'Poco X8 Pro 12GB/512GB');
  assert.equal(nestedEdit[0].json.messageEdited, true);

  const statusOnly = execute({ body: {
    event: 'MESSAGES_UPDATE',
    data: { key: { remoteJid: '5587000000000@s.whatsapp.net', id: 'status-1', fromMe: false }, update: { status: 3 } },
  } }, { id: 4 });
  assert.deepEqual(statusOnly, []);
  return { normal: true, editedText: true, nestedEditedText: true, ignoredStatusOnly: true };
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.once('ready', resolve).once('error', reject).connect(getVpsSshConfig()));
  try {
    const workflow = await readWorkflow(conn);
    assert.equal(workflow.active, true, 'production workflow is not active');
    assert.equal(workflow.versionId, workflow.activeVersionId, 'workflow active version is not aligned');
    const patched = patchWorkflow(workflow);
    const dados = nodeByName(patched.nodes, 'Dados');
    console.log(JSON.stringify({
      marker: MARKER,
      changed: !nodeByName(workflow.nodes, 'Dados').parameters.jsCode.includes(MARKER),
      fixtures: runFixtures(patched),
      webhookEventRequired: 'MESSAGES_UPDATE',
      dadosCompiles: Boolean(dados.parameters.jsCode.includes(MARKER)),
    }, null, 2));
  } finally {
    conn.end();
  }
}

module.exports = { MARKER, patchDados, patchWorkflow, runFixtures };
if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
