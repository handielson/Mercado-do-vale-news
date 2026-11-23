// payjoy-print-after-offer-v1: print depois da oferta do link é lido (caso 558781215720).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const m = require('../scripts/n8n-payjoy-print-after-offer.cjs');
const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;
const skip = !snapshot && 'sem snapshot do n8n';
const jid = '558781215720@s.whatsapp.net';
const ago = (min) => Date.now() - min * 60000;
function run(state, recent = [], caption = '') {
  const w = m.patchWorkflow(JSON.parse(fs.readFileSync(snapshot, 'utf8')));
  const code = w.nodes.find((n) => n.name === m.NODE).parameters.jsCode;
  const json = { remoteJid: jid, whatsappImageReceived: true, whatsappOriginalCaption: caption, payjoyImageBase64: 'QUJD', payjoyImageMimeType: 'image/jpeg', recentMessages: recent };
  const data = { payjoyByJid: state ? { [jid]: state } : {} };
  return new Function('$json', '$getWorkflowStaticData', code)(json, () => data)[0].json;
}
const askPrint = [{ direction: 'outbound', text: 'O cadastro é feito diretamente com a PayJoy. Pode me enviar um print legível', created_at: new Date(ago(4)).toISOString() }];

test('caso real: oferta do link + print pedido → imagem é lida como print', { skip }, () => {
  const r = run({ status: 'awaiting_link_confirmation', updatedAt: ago(6), expiresAt: ago(-60 * 24 * 30) }, askPrint);
  assert.equal(r.payjoyPrint, true); assert.equal(r.whatsappImageNeedsContext, false); assert.equal(r.payjoyImageBase64, 'QUJD');
});
test('oferta do link há mais de 24 h e sem histórico → pergunta o que é a imagem', { skip }, () => {
  const r = run({ status: 'awaiting_link_confirmation', updatedAt: ago(60 * 30) }, []);
  assert.equal(r.payjoyPrint, false); assert.equal(r.whatsappImageNeedsContext, true);
});
test('sem estado e sem PayJoy no histórico → pergunta (igual antes)', { skip }, () => {
  assert.equal(run(null, [{ direction: 'outbound', text: 'Temos o Redmi 15', created_at: new Date(ago(2)).toISOString() }]).payjoyPrint, false);
});
test('awaiting_result continua lendo', { skip }, () => {
  assert.equal(run({ status: 'awaiting_result', updatedAt: ago(10) }).payjoyPrint, true);
});
test('cliente pede atendente na legenda → não lê', { skip }, () => {
  assert.equal(run({ status: 'awaiting_link_confirmation', updatedAt: ago(6) }, askPrint, 'quero falar com atendente').payjoyPrint, false);
});
