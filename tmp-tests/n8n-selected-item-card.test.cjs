// selected-item-card-v1: escolha da lista vira foto + ficha com emojis + chamada para venda; complemento ("De 512gb") reenvia o card.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow, MARK, NODE_POST, NODE_CONTEXT } = require('../scripts/n8n-selected-item-card.cjs');
const fixture = JSON.parse(fs.readFileSync('tmp-tests/fixtures/selected-item-card.json', 'utf8'));
const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;

function runner(code) {
  const state = {};
  const set = (jid) => { state.salesPostList = { [jid]: { ...JSON.parse(JSON.stringify(fixture.list)), expiresAt: Date.now() + 3600 * 1000 } }; };
  const helpers = { httpRequest: async () => JSON.parse(JSON.stringify(fixture.product)) };
  const run = async (jid, conversation, extra = {}) => {
    const source = { remoteJid: jid, conversation, intencao: 'vendas_produtos', saudacaoDetectada: false, salesRequestKind: 'busca', ...extra };
    const result = await new Function('$json', '$', '$getWorkflowStaticData', 'helpers', code)({}, () => ({ first: () => ({ json: source }) }), () => state, helpers);
    return result[0].json;
  };
  return { set, run, state };
}
const text = (json) => (json.messages || []).map((message) => message.caption || message.text || '').join('\n---\n') || String(json.output || '');

test('card de venda: foto + ficha, chamada 5 s depois, complemento e SIM', { skip: !snapshot && 'sem snapshot do n8n' }, async () => {
  const workflow = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  const live = workflow.nodes.find((node) => node.name === NODE_POST).parameters.jsCode;
  const patched = patchWorkflow(workflow);
  assert.deepEqual(patchWorkflow(patched), patched, 'idempotente');
  const code = patched.nodes.find((node) => node.name === NODE_POST).parameters.jsCode;
  const area = '5574999990000@s.whatsapp.net';

  const sim = runner(code); sim.set(area);
  const chosen = await sim.run(area, 'A opção 2', { salesFlowAction: 'escolher_item', salesFlowItemNumber: 2 });
  assert.equal(chosen.salesPostListStep, 'awaiting_purchase_confirmation');
  const [card, call] = chosen.messages;
  assert.equal(card.type, 'image');
  assert.match(card.mediaUrl, /^https:\/\/api\.xiaomipetrolina\.com\.br\/images\//);
  const clean = (value) => String(value).replace(/\u00a0/g, ' ').replace(/\ufe0f/g, '');
  assert.deepEqual(clean(card.caption).split('\n'), [
    '*Poco X8 Pro 5G* · 12GB/512GB', '💰 R$ 2.860,00 à vista no Pix', '💳 12x de R$ 266,70 (R$ 3.200,34)', '🎨 Cores: Amarelo', '',
    '📱 Tela: 6,59" AMOLED 120Hz', '⚙ Chip: Dimensity 8500-Ultra', '📸 Câmera: 50MP com OIS · Selfie 20MP', '🔋 Bateria: 6500mAh',
    '⚡ Carregamento: 100W HyperCharge', '📶 Rede: 5G · NFC: Sim', '💧 Resistência: IP68', '📦 Na caixa: carregador, cabo USB-C e capa', '',
    '🔗 mercadodovale.com.br/produto/poco-x8-pro',
  ]);
  assert.ok(card.caption.length <= 1000);
  assert.equal(call.type, 'text');
  assert.equal(call.delayMs, 5000, 'chamada ~5 s depois');
  assert.match(clean(call.text), /^🔥 Só rest(?:a 1 unidade|am [23] unidades) dele aqui na loja!\nGaranta o seu hoje: entrega grátis e imediata em Petrolina e Juazeiro 🛵💨\nPosso separar o seu\? É só responder \*SIM\* 👇$/);
  assert.doesNotMatch(text(chosen), /Voce quer comprar este modelo/);

  const complement = await sim.run(area, 'De 512gb', { salesFlowAction: 'escolher_item', salesFlowItemNumber: 2 });
  assert.equal(complement.salesPostListHandled, true, 'complemento não vira busca nova');
  assert.equal(complement.messages?.[0]?.caption, card.caption, 'reenvia o mesmo card');
  const yes = await sim.run(area, 'Sim', { salesFlowAction: 'confirmar' });
  assert.equal(yes.salesPostListStep, 'awaiting_fulfillment');
  assert.match(String(yes.output), /Perfeito, separei o seu Poco X8 Pro 5G 12GB\/512GB Amarelo! 🎉\[\[BR\]\]Vai querer receber em casa \(grátis\) ou prefere retirar na loja\?/);

  // Fora de Petrolina/Juazeiro: sem promessa de entrega grátis.
  const away = '5511999990000@s.whatsapp.net';
  const other = runner(code); other.set(away);
  const awayChosen = await other.run(away, 'A opção 2', { salesFlowAction: 'escolher_item', salesFlowItemNumber: 2 });
  assert.match(awayChosen.messages.at(-1).text, /retire na loja ou combine o envio com a gente 🏪/);
  assert.doesNotMatch(awayChosen.messages.at(-1).text, /grátis/);

  // Fluxo publicado sem a correção: o complemento virava busca nova (caso real 12/11).
  if (!live.includes(MARK)) {
    const before = runner(live); before.set(area);
    await before.run(area, 'A opção 2', { salesFlowAction: 'escolher_item', salesFlowItemNumber: 2 });
    assert.notEqual((await before.run(area, 'De 512gb', { salesFlowAction: 'escolher_item', salesFlowItemNumber: 2 })).salesPostListHandled, true, 'fixture reproduz o bug');
  }

  // Título: "5G" do nome do modelo não vira "Celulares com 5G".
  const context = patched.nodes.find((node) => node.name === NODE_CONTEXT).parameters.jsCode;
  assert.ok(context.includes("phone5gFilterRequestV338 && !/\\b5g\\b/i.test(String(base.requestedDeviceModelQuery || ''))"));
  assert.ok(code.includes(MARK) && context.includes(MARK));
});
