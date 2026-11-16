'use strict';
// interrupted-replay-v1: mensagem cortada pelo restart do deploy volta ao webhook; o que já foi respondido não repete.
const test = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');
const { remoteProgram, callRemote, RUNNER } = require('../scripts/deploy-n8n-meta-attendance.cjs');

// Mesmo formato (flatted) que o n8n grava em execution_data.
function flat(root) {
  const out = [];
  const enc = (value) => {
    if (typeof value === 'string') { out.push(value); return String(out.length - 1); }
    if (value && typeof value === 'object') {
      const index = out.push(null) - 1;
      out[index] = Array.isArray(value) ? value.map(enc) : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, enc(v)]));
      return String(index);
    }
    return value;
  };
  enc(root);
  return JSON.stringify(out);
}
const body = (extra = {}) => ({ event: 'messages.upsert', instance: 'botmercadodovale', data: { key: { remoteJid: '5587999990000@s.whatsapp.net', fromMe: false, id: '3A0000000000TESTE01' }, message: { conversation: 'Vocês trabalham com boleto?' }, messageTimestamp: 1 }, ...extra });
const execution = ({ error = 'Task request timed out', runData = {}, hook = body() } = {}) => flat({ resultData: { error: error ? { message: error } : undefined, runData: { Webhook: [{ data: { main: [[{ json: { body: hook } }]] } }], ...runData } } });
const extract = (data, status = 'error') => remoteProgram({ mode: 'extract_replay', data, status });

test('mensagem cortada pelo restart é reenviada; resposta já enviada, envio próprio e erro comum não', async () => {
  assert.deepEqual(await extract(execution()), { messageId: '3A0000000000TESTE01', remoteJid: '5587999990000@s.whatsapp.net' });
  assert.equal((await extract(execution({ error: '' }), 'crashed')).messageId, '3A0000000000TESTE01', 'crashed no restart');
  assert.equal((await extract(execution({ error: 'Cannot read properties of undefined' }))).skip, 'not_interrupted');
  assert.equal((await extract(execution({ runData: { 'Enviar WhatsApp': [{}] } }))).skip, 'already_sent');
  const own = body(); own.data.key.fromMe = true;
  assert.equal((await extract(execution({ hook: own }))).skip, 'not_inbound');
  const group = body(); group.data.key.remoteJid = '120363000000000000@g.us';
  assert.equal((await extract(execution({ hook: group }))).skip, 'not_private_chat');
  assert.equal((await extract(execution({ hook: { event: 'messages.update', data: { key: {} } } }))).skip, 'not_inbound');
});

test('reenvio roda uma vez, logo depois que o runner volta', async () => {
  const sent = [];
  const connection = { exec: (_cmd, callback) => {
    const stream = new PassThrough(); stream.stderr = new PassThrough();
    stream.end = (program) => { sent.push(JSON.parse(program.match(/\)\((\{.*\})\)\.then/)[1]).mode); queueMicrotask(() => { stream.write('{}'); stream.emit('close', 0); }); };
    callback(null, stream);
  } };
  const errors = []; const original = console.error; console.error = (line) => errors.push(line);
  try {
    await callRemote(connection, { mode: 'scale', service: 'n8n_n8n', replicas: 1 });
    await callRemote(connection, { mode: 'scale', service: RUNNER, replicas: 0 });
    await callRemote(connection, { mode: 'scale', service: RUNNER, replicas: 1 });
    await callRemote(connection, { mode: 'scale', service: RUNNER, replicas: 1 });
  } finally { console.error = original; }
  assert.deepEqual(sent, ['scale', 'scale', 'scale', 'replay_interrupted', 'scale']);
  assert.match(errors.join('\n'), /interruptedReplay/);
});
