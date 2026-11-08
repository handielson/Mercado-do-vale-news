// autoreply-guard-v1: o robô ignora respostas automáticas de outras empresas e não promete
// "Celulares com 64GB" quando a lista voltou ao estoque completo.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchWorkflow, patchDados, MARK, NODE_DADOS, NODE_CONTEXTO } = require('../scripts/n8n-autoreply-guard.cjs');
const snapshot = process.env.MDV_N8N_SALES_SNAPSHOT;
const load = () => JSON.parse(fs.readFileSync(snapshot, 'utf8'));
const jid = 'fixture@s.whatsapp.net';

const runDados = (code, text, { fromMe = false, event = 'messages.upsert' } = {}) => {
  const body = {
    event, instance: 'fixture', sender: '5500000000000@s.whatsapp.net',
    data: { key: { remoteJid: jid, fromMe, id: 'FIXTURE1' }, pushName: 'Cliente', messageType: 'conversation', message: { conversation: text }, messageTimestamp: Math.floor(Date.now() / 1000) },
  };
  return new Function('$json', '$execution', code)({ body }, { id: '1' });
};

test('Dados: respostas automáticas não viram fala do cliente', { skip: !snapshot && 'sem snapshot do n8n' }, () => {
  const original = load().nodes.find(n => n.name === NODE_DADOS).parameters.jsCode;
  const code = patchDados(original);
  const autoReplies = [
    'No momento não estou disponível, assim que possível respondo. Se for urgente fala no whatsapp do CREAS +55 74 0000-0000',
    'Olá! Esta é uma mensagem automática. Retornaremos em breve.',
    'Estamos fora do horário de atendimento. Nosso horário é de 8h às 18h.',
    'Agradecemos seu contato! Em breve retornaremos.',
    'Olá, no momento não podemos atender. Deixe sua mensagem.',
  ];
  for (const text of autoReplies) {
    assert.deepEqual(runDados(original, text).length > 0, true, 'original processava: ' + text);
    assert.deepEqual(runDados(code, text), [], 'ignorada: ' + text);
  }
  const customer = [
    'Quero receber a lista atualizada de celulares.',
    'Quais são as opções de parcelamento?',
    'Bom dia! Vcs tem o realme note 60x de 64 GB?',
    'Não estou conseguindo ver as fotos',
    'ok',
    'Obrigado, vou pensar e te falo',
    'Estou disponível amanhã de manhã para buscar',
  ];
  for (const text of customer) {
    const before = runDados(original, text);
    const after = runDados(code, text);
    assert.equal(after.length, before.length, 'cliente segue normal: ' + text);
    assert.equal(after[0]?.json?.conversation, before[0]?.json?.conversation);
  }
  // Mensagem da própria loja com o mesmo texto não é bloqueada (fluxo de mensagens da equipe).
  const store = 'No momento não estou disponível, assim que possível respondo.';
  assert.equal(runDados(code, store, { fromMe: true }).length, runDados(original, store, { fromMe: true }).length);
  assert.ok(code.includes(MARK));
});

test('Contexto: título com memória só quando a lista está filtrada', { skip: !snapshot && 'sem snapshot do n8n' }, () => {
  const workflow = load();
  const original = workflow.nodes.find(n => n.name === NODE_CONTEXTO).parameters.jsCode;
  const patched = patchWorkflow(workflow).nodes.find(n => n.name === NODE_CONTEXTO).parameters.jsCode;
  const product = (id, name, brand, ram, storage, color, price) => ({ id, model_id: id + '-m', model_name: name, name: name + ' ' + color, brand, status: 'active', stock_quantity: 1, price_retail: price, specs: { ram, storage, color }, slug: id, images: [] });
  const rows = [
    product('r15', 'Redmi 15', 'Xiaomi', '8GB', '256GB', 'Preto', 135000),
    product('a5', 'Redmi A5', 'Xiaomi', '4GB', '128GB', 'Azul', 116000),
    product('n70', 'Realme Note 70', 'Realme', '4GB', '128GB', 'Preto', 95000),
  ];
  const run = (code, base) => {
    const state = {};
    const sources = { 'Vendas - Preparar Busca': [base], 'Vendas - Buscar Produtos': rows, 'switc Mensagens': [base] };
    const lookup = name => ({ first: () => ({ json: sources[name][0] }), all: () => sources[name].map(json => ({ json })) });
    return new Function('$json', '$input', '$getWorkflowStaticData', '$', code)({}, { all: () => [{ json: { channel: 'presencial', installments: 12, applied_fee_pct: 11.9 } }] }, () => state, lookup)[0].json;
  };
  const common = { productCategoryId: 'smartphones', productSearchKind: 'busca', remoteJid: jid, phoneMemoryFilterRequest: true };
  // Caso Diana: modelo inexistente + 64GB → lista volta ao estoque completo.
  const diana = { ...common, conversation: 'Vcs tem o realme note 60x de 64 GB?', requestedDeviceBrand: 'realme', requestedDeviceBrandLabel: 'Realme', requestedDeviceModelQuery: 'realme note 60x 64 gb', requestedDeviceModelLabel: 'realme note 60x 64 gb', memoryFilterLabel: '64GB de armazenamento' };
  const before = run(original, diana).deterministicCatalogOutput;
  const after = run(patched, diana).deterministicCatalogOutput;
  assert.match(before, /Celulares com 64GB/, 'fixture reproduz o bug');
  assert.doesNotMatch(after, /64GB/, 'título não promete 64GB');
  assert.match(after, /Nao encontrei esse modelo/, 'intro preservada');
  assert.equal(after, before.split('📱 Celulares com 64GB de armazenamento').join('Celulares disponiveis agora'), 'só o título muda');
  // Filtro de memória que achou produtos: título igual ao atual.
  const ok128 = { ...common, conversation: 'Quais celulares de 128GB vocês têm?', memoryFilterLabel: '128GB de armazenamento' };
  assert.equal(run(patched, ok128).deterministicCatalogOutput, run(original, ok128).deterministicCatalogOutput, 'lista filtrada idêntica');
  assert.ok(patched.includes(MARK));
});
