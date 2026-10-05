const assert = require('node:assert/strict');
const { registerManualCode } = require('./n8n-fix-persistent-handoff-context.cjs');

const run = ({ source = {}, webhookData = {}, staticData = { botSentMessageIds: {} } }) =>
  new Function('$json', '$', '$getWorkflowStaticData', registerManualCode)(
    source,
    () => ({ first: () => ({ json: { body: { data: webhookData } } }) }),
    () => staticData,
  );

const remoteJid = '558791113149@s.whatsapp.net';

const audio = run({
  source: { remoteJid, messageId: 'audio-1', messageType: 'audioMessage', source: 'web', conversation: '' },
  webhookData: { key: { remoteJid, id: 'audio-1' }, source: 'web', messageType: 'audioMessage', message: { audioMessage: { ptt: true } } },
});
assert.equal(audio.length, 1);
assert.equal(audio[0].json.message, '[Áudio enviado pelo atendente]');
assert.equal(audio[0].json.handoffBy, 'whatsapp-web');

const mediaCases = [
  ['imageMessage', 'imageMessage', '[Imagem enviada pelo atendente]'],
  ['videoMessage', 'videoMessage', '[Vídeo enviado pelo atendente]'],
  ['documentMessage', 'documentMessage', '[Documento enviado pelo atendente]'],
  ['stickerMessage', 'stickerMessage', '[Figurinha enviada pelo atendente]'],
  ['locationMessage', 'locationMessage', '[Localização enviada pelo atendente]'],
  ['contactMessage', 'contactMessage', '[Contato enviado pelo atendente]'],
];
for (const [messageType, key, expected] of mediaCases) {
  const result = run({
    source: { remoteJid, messageId: `fixture-${messageType}`, messageType, source: 'android' },
    webhookData: { key: { remoteJid, id: `fixture-${messageType}` }, source: 'android', messageType, message: { [key]: {} } },
  });
  assert.equal(result[0].json.message, expected, messageType);
  assert.equal(result[0].json.handoffBy, 'whatsapp-android', messageType);
}

const captionedImage = run({
  source: { remoteJid, messageId: 'image-caption', messageType: 'imageMessage', source: 'web' },
  webhookData: { key: { remoteJid, id: 'image-caption' }, source: 'web', messageType: 'imageMessage', message: { imageMessage: { caption: 'Veja esta opção' } } },
});
assert.equal(captionedImage[0].json.message, 'Veja esta opção');

assert.deepEqual(run({
  source: { remoteJid, messageId: 'empty-1', messageType: 'status', source: 'web' },
  webhookData: { key: { remoteJid, id: 'empty-1' }, source: 'web', messageType: 'status', message: {} },
}), []);

assert.deepEqual(run({
  source: { remoteJid, messageId: 'bot-1', messageType: 'audioMessage', source: 'web' },
  webhookData: { key: { remoteJid, id: 'bot-1' }, source: 'web', messageType: 'audioMessage', message: { audioMessage: {} } },
  staticData: { botSentMessageIds: { 'bot-1': Date.now() + 60000 } },
}), []);

assert.deepEqual(run({
  source: { remoteJid, messageId: 'api-1', messageType: 'audioMessage', source: 'api' },
  webhookData: { key: { remoteJid, id: 'api-1' }, source: 'api', messageType: 'audioMessage', message: { audioMessage: {} } },
}), []);

console.log(JSON.stringify({ passed: mediaCases.length + 5, marker: 'manual-media-handoff-v1' }, null, 2));
