const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const MDV_API_URL = 'https://api.xiaomipetrolina.com.br';

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function dollar(value, tag) {
  if (String(value).includes(`$${tag}$`)) throw new Error(`Dollar quote tag collision: ${tag}`);
  return `$${tag}$${value}$${tag}$`;
}

function runRemote(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(stderr || stdout || `Remote command failed: ${code}`));
      });
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
    });
  });
}

async function psql(conn, dbContainer, sql) {
  return runRemote(conn, `docker exec -i ${shQuote(dbContainer)} psql -U postgres -d n8n -X -q -t -A <<'SQL'\n${sql}\nSQL`);
}

async function psqlFile(conn, dbContainer, sql) {
  return new Promise((resolve, reject) => {
    conn.exec(`docker exec -i ${shQuote(dbContainer)} psql -U postgres -d n8n -X -q -t -A`, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(stderr || stdout || `Remote psql failed: ${code}`));
      });
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.end(sql);
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitServiceReplicas(conn, serviceName, expectedReplicas, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  const expected = `${expectedReplicas}/${expectedReplicas}`;
  let last = '';
  while (Date.now() < deadline) {
    last = (await runRemote(
      conn,
      `docker service ls --filter name=${shQuote(serviceName)} --format '{{.Replicas}}' | head -n 1`
    )).trim();
    if (last === expected) return last;
    await sleep(3000);
  }
  throw new Error(`Service ${serviceName} did not reach ${expected}; last replicas: ${last || 'unknown'}`);
}

async function readJson(conn, dbContainer, sql) {
  const out = await psql(conn, dbContainer, `COPY (${sql}) TO STDOUT;`);
  return JSON.parse(out.trim());
}

const clientControlCode = `const source = $json;
const remoteJid = String(source.remoteJid || '');
const baseOutput = {
  ...source,
  n8nBotBlocked: false,
  n8nBotResetApplied: false,
  n8nBotControl: null,
  memorySessionKey: remoteJid,
};

if (!remoteJid) {
  return [{ json: baseOutput }];
}

return [{ json: baseOutput }];`;

const applyClientControlCode = `const source = $('Controle Bot - Verificar Cliente').first().json || {};
const payload = $json || {};
const remoteJid = String(source.remoteJid || '');
const staticData = $getWorkflowStaticData('global');
const baseOutput = {
  ...source,
  n8nBotBlocked: false,
  n8nBotResetApplied: false,
  n8nBotControl: null,
  memorySessionKey: remoteJid,
};

if (!payload || !payload.control) {
  return [{ json: baseOutput }];
}

const control = payload.control || {};
const output = {
  ...baseOutput,
  n8nBotBlocked: Boolean(control.blocked),
  n8nBotControl: control,
  memorySessionKey: payload.memorySessionKey || remoteJid,
};

if (payload.resetPending) {
  staticData.salesPostList = staticData.salesPostList || {};
  delete staticData.salesPostList[remoteJid];
  output.n8nBotResetApplied = true;
}

return [{ json: output }];`;

const adminCommandCode = `const source = $('Controle Bot - Verificar Cliente').first().json || {};
const payload = $json || {};
const remoteJid = String(source.remoteJid || '');
const text = String(source.conversation || source.text || '').trim().toLowerCase().replace(/\\s+/g, ' ');
const adminRows = Array.isArray(payload.adminNumbers) ? payload.adminNumbers : [];
const globalControl = payload.control || {};
const isAdmin = adminRows.some((row) => String(row.remote_jid || '') === remoteJid && Number(row.active ?? 1) === 1);
const match = text.match(/^(pausar|continuar|status)(?:\\s+(.+))?$/);
const normalizeTarget = (value) => {
  const digits = String(value || '').replace(/\\D/g, '');
  if (!digits) return { phone: '', remoteJid: '' };
  const phone = digits.startsWith('55') ? digits : ((digits.length === 10 || digits.length === 11) ? '55' + digits : digits);
  return { phone, remoteJid: phone + '@s.whatsapp.net' };
};
const target = match && match[2] ? normalizeTarget(match[2]) : { phone: '', remoteJid: '' };

return [{
  json: {
    ...source,
    n8nBotGlobalPaused: Boolean(globalControl.paused),
    n8nBotGlobalControl: globalControl,
    n8nBotIsAdmin: isAdmin,
    n8nBotAdminCommand: Boolean(isAdmin && match && (!match[2] || target.remoteJid)),
    adminCommandAction: match ? match[1] : '',
    adminCommandPhone: target.phone,
    adminCommandRemoteJid: target.remoteJid,
  },
}];`;

const adminReplyCode = `const source = $('Controle Bot - Comando Admin').first().json || {};
const result = $json || {};
return [{
  json: {
    ...source,
    adminCommandReply: result.reply || 'Comando recebido.',
  },
}];`;

const restoreClientControlCode = `return [{ json: $('Controle Bot - Aplicar Controle').first().json }];`;

const restoreOutboundCode = `return $('Dividir mensagens').all();`;

function patchSplitMessagesNode(node) {
  if (!node?.parameters?.jsCode) return;
  let code = String(node.parameters.jsCode);
  code = code.replace(
    `fileName: message.fileName || 'produto.jpg',
        messageIndex: index + 1,`,
    `fileName: message.fileName || 'produto.jpg',
        delayMs: Number(message.delayMs || 0),
        messageIndex: index + 1,`
  );
  code = code.replace(
    `fileName: '',
    messageIndex: index + 1,`,
    `fileName: '',
    delayMs: 0,
    messageIndex: index + 1,`
  );
  node.parameters.jsCode = code;
}

function patchSendDelayNode(node) {
  if (!node?.parameters?.bodyParameters?.parameters) return;
  const delayParam = node.parameters.bodyParameters.parameters.find((param) => param.name === 'delay');
  if (!delayParam) return;
  const fallback = node.name === 'Enviar WhatsApp - Imagem'
    ? "Math.min(6500, 1200 + (($json.messageIndex || 1) - 1) * 1800)"
    : "Math.min(6500, 1200 + (($json.messageIndex || 1) - 1) * 1800 + Math.min(1800, String($json.message || '').length * 18))";
  delayParam.value = `={{Number($json.delayMs || 0) > 0 ? Number($json.delayMs || 0) : ${fallback}}}`;
}

const salesAIContextCode = `const source = $json;
const staticData = $getWorkflowStaticData('global');
staticData.salesPostList = staticData.salesPostList || {};

const remoteJid = String(source.remoteJid || '');
const state = remoteJid ? staticData.salesPostList[remoteJid] : null;
const now = Date.now();

if (state && Number(state.expiresAt || 0) <= now) {
  delete staticData.salesPostList[remoteJid];
}

const activeState = remoteJid ? staticData.salesPostList[remoteJid] : null;
const summarizeOption = (option) => ({
  numero: Number(option?.number || 0),
  nome: option?.name || '',
  memoria: option?.memory || '',
  cores: Array.from(new Set((option?.colors || []).map((item) => item?.color).filter(Boolean))),
});

return [{
  json: {
    ...source,
    salesConversationState: activeState ? {
      ativo: true,
      etapa: activeState.step || '',
      itemSelecionado: activeState.selectedOptionNumber || null,
      corSelecionada: activeState.selectedColor || '',
      pedidoEmMontagem: activeState.orderDraft || null,
      opcoes: Array.isArray(activeState.options) ? activeState.options.map(summarizeOption) : [],
    } : { ativo: false },
  },
}];`;

const classifierSystemMessage = `Voce e o Agente Inicial e Roteador da Mercado do Vale.

Sua funcao e entender a mensagem inteira do cliente, considerando o estado atual do atendimento, e devolver somente JSON valido. Nao responda o cliente.

Voce nao e um bot de frases prontas. Interprete linguagem natural, girias, mensagens misturadas e mudancas de assunto.

Intencoes principais possiveis:
- saudacao
- vendas_produtos
- cadastro_contato
- pos_venda
- pedido_humano
- fallback

Regras de prioridade:
- Leia a mensagem inteira antes de decidir. Nunca trate um numero isolado dentro de uma frase como quantidade sem entender a intencao.
- Se houver saudacao junto com pergunta/pedido de produto, a intencao principal deve ser vendas_produtos e saudacao_detectada deve ser true.
- Se houver saudacao junto com pedido de humano, a intencao principal deve ser pedido_humano e saudacao_detectada deve ser true.
- Use saudacao somente quando a mensagem for apenas cumprimento, sem pedido claro.
- Perguntas sobre preco, produto, estoque, modelo, cor, memoria, acessorios, disponibilidade, foto, imagem, catalogo ou opcoes: vendas_produtos.
- Garantia, defeito, troca, assistencia ou problema com compra: pos_venda.
- Pedido para falar com atendente, vendedor ou humano: pedido_humano.
- Se nao entender: fallback.

Quando houver Estado de venda ativo, tambem classifique fluxo_venda. A IA deve decidir a acao do fluxo, nao os nos por palavras fixas.

Acoes de fluxo_venda:
- escolher_item: cliente escolheu item da lista por numero ou nome.
- pedir_foto: cliente pediu foto/imagem de item, produto, cor ou do item ja selecionado.
- escolher_cor: cliente escolheu cor.
- informar_quantidade: cliente informou quantidade desejada.
- escolha_entrega_retirada: cliente respondeu entrega ou retirada.
- nova_busca: cliente mudou de assunto e pediu outro produto/categoria/lista.
- pergunta_sobre_item: cliente perguntou algo sobre item selecionado sem escolher quantidade/cor/foto.
- indefinido: nao ficou claro.

Regras do fluxo de venda:
- Se a etapa atual for aguardando quantidade e a mensagem for "tem foto do 22", "foto do 22", "manda imagem do item 22" ou similar, a acao e pedir_foto e item_numero=22. Nao e quantidade.
- Se a etapa atual for aguardando quantidade e a mensagem for somente "22", ou "quero 22", ou "22 unidades", a acao e informar_quantidade e quantidade=22.
- Se a mensagem mistura pergunta e numero, priorize a pergunta. Ex: "tem foto do 22?" => pedir_foto.
- Se o cliente pedir "quais celulares", "smartphones", "aparelhos" ou "modelos" mesmo havendo estado ativo, use nova_busca para mostrar uma nova lista.
- Se o cliente escolhe numero e cor na mesma mensagem, preencha item_numero e cor.

Para vendas_produtos fora do pos-lista:
- Se o cliente pede celulares/smartphones/aparelhos de forma geral, use venda.tipo="categoria", venda.categoria="smartphones", venda.categoria_id="8b7c4852-c195-4527-8fd7-c3cc2debda42", venda.busca="".
- Se o cliente menciona modelo/marca/produto especifico, use venda.tipo="busca", venda.busca com o termo limpo. Ex: "tem poco x8 pro?" => "poco x8 pro".
- Se for acessorio, use venda.tipo="busca" e mantenha o termo do acessorio. Ex: "capa para redmi 15".

Retorne somente neste formato:
{
  "intencao": "vendas_produtos",
  "mensagem": "mensagem original",
  "confianca": 0.95,
  "saudacao_detectada": true,
  "venda": {
    "tipo": "categoria",
    "busca": "",
    "categoria": "smartphones",
    "categoria_id": "8b7c4852-c195-4527-8fd7-c3cc2debda42"
  },
  "fluxo_venda": {
    "acao": "pedir_foto",
    "item_numero": 22,
    "cor": "",
    "quantidade": null,
    "termo_nova_busca": ""
  }
}`;

const classifierTextExpression = `={{($json.clienteNome ? 'Nome do cliente salvo: ' + $json.clienteNome + '.\\n' : '') + 'Mensagem do cliente: ' + $json.conversation + '\\n\\nEstado de venda atual em JSON:\\n' + JSON.stringify($json.salesConversationState || { ativo: false })}}`;

function makeIfNode() {
  return {
    id: 'n8n-admin-control-blocked-if-001',
    name: 'Controle Bot - Bloqueado?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [528, 80],
    parameters: {
      conditions: {
        options: {
          caseSensitive: true,
          leftValue: '',
          typeValidation: 'strict',
          version: 2,
        },
        conditions: [
          {
            id: 'n8n-admin-control-blocked-condition',
            leftValue: '={{$json.n8nBotBlocked}}',
            rightValue: true,
            operator: {
              type: 'boolean',
              operation: 'true',
              singleValue: true,
            },
          },
        ],
        combinator: 'and',
      },
      options: {},
    },
  };
}

function makeBooleanIfNode({ id, name, position, leftValue }) {
  return {
    id,
    name,
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position,
    parameters: {
      conditions: {
        options: {
          caseSensitive: true,
          leftValue: '',
          typeValidation: 'strict',
          version: 2,
        },
        conditions: [
          {
            id: `${id}-condition`,
            leftValue,
            rightValue: true,
            operator: {
              type: 'boolean',
              operation: 'true',
              singleValue: true,
            },
          },
        ],
        combinator: 'and',
      },
      options: {},
    },
  };
}

function upsertNode(nodes, node) {
  const index = nodes.findIndex((item) => item.name === node.name);
  if (index >= 0) nodes[index] = { ...nodes[index], ...node };
  else nodes.push(node);
}

function patchMemoryNode(node) {
  if (!node?.parameters) node.parameters = {};
  node.parameters.sessionIdType = 'customKey';
  node.parameters.sessionKey = "={{ $('Controle Bot - Verificar Cliente').first().json.memorySessionKey || $('switc Mensagens').first().json.remoteJid }}";
}

function patchTransientHttpNode(node) {
  node.onError = 'continueRegularOutput';
  node.continueOnFail = true;
  node.retryOnFail = true;
  node.maxTries = 3;
  node.waitBetweenTries = 2000;
}

function patchClassifierAgent(node) {
  if (!node?.parameters) node.parameters = {};
  node.parameters.text = classifierTextExpression;
  node.parameters.promptType = 'define';
  node.parameters.options = {
    ...(node.parameters.options || {}),
    systemMessage: classifierSystemMessage,
  };
}

function patchParseClassification(node) {
  if (!node?.parameters) node.parameters = {};
  node.parameters.jsCode = `const source = $('Vendas - Preparar Contexto IA').first().json;
const raw = $json.output || $json.text || $json.response || '';

let parsed;
try {
  parsed = typeof raw === 'string' ? JSON.parse(raw.replace(/^\\\`\\\`\\\`json\\s*/i, '').replace(/^\\\`\\\`\\\`\\s*/i, '').replace(/\\\`\\\`\\\`$/i, '').trim()) : raw;
} catch (error) {
  parsed = {
    intencao: 'fallback',
    mensagem: source.conversation,
    confianca: 0,
    saudacao_detectada: false,
    venda: {},
    fluxo_venda: {},
  };
}

const allowed = new Set(['saudacao', 'vendas_produtos', 'cadastro_contato', 'pos_venda', 'pedido_humano', 'fallback']);
const intencao = allowed.has(String(parsed.intencao || '').trim()) ? String(parsed.intencao).trim() : 'fallback';
const venda = parsed && typeof parsed.venda === 'object' && !Array.isArray(parsed.venda) ? parsed.venda : {};
const fluxoVenda = parsed && typeof parsed.fluxo_venda === 'object' && !Array.isArray(parsed.fluxo_venda) ? parsed.fluxo_venda : {};

return [{
  json: {
    ...source,
    intencao,
    classificacaoMensagem: parsed.mensagem || source.conversation,
    classificacaoConfianca: Number(parsed.confianca || 0),
    saudacaoDetectada: parsed.saudacao_detectada === true,
    salesRequestKind: String(venda.tipo || '').trim(),
    salesSearchQuery: String(venda.busca || '').trim(),
    salesCategoryName: String(venda.categoria || '').trim(),
    salesCategoryId: String(venda.categoria_id || '').trim(),
    salesFlowAction: String(fluxoVenda.acao || '').trim(),
    salesFlowItemNumber: Number(fluxoVenda.item_numero || 0),
    salesFlowColor: String(fluxoVenda.cor || '').trim(),
    salesFlowQuantity: Number(fluxoVenda.quantidade || 0),
    salesFlowNewSearchTerm: String(fluxoVenda.termo_nova_busca || '').trim(),
  },
}];`;
}

function patchPostListPhotoFallback(node) {
  const code = String(node?.parameters?.jsCode || '');
  let nextCode = code;
  const oldBlock = `if (!activeState || !Array.isArray(activeState.options) || activeState.options.length === 0) {
  return buildContinueItem();
}`;
  const newBlock = `if (!activeState || !Array.isArray(activeState.options) || activeState.options.length === 0) {
  if (wantsPhoto || wantsPhotoFromAI) {
    return [{
      json: {
        ...source,
        salesPostListHandled: true,
        output: 'Consigo te mandar a foto sim 😊 Me confirma o numero do item ou o modelo que voce quer ver?',
      },
    }];
  }
  return buildContinueItem();
}`;
  if (nextCode.includes(oldBlock) && !nextCode.includes('Me confirma o numero do item ou o modelo')) {
    nextCode = nextCode.replace(oldBlock, newBlock);
  }
  nextCode = nextCode.replace('if (wantsPhoto) {\n    return [{\n      json: {\n        ...source,\n        salesPostListHandled: true,\n        output: \'Consigo te mandar a foto sim 😊 Me confirma o numero do item ou o modelo que voce quer ver?\',', 'if (wantsPhoto || wantsPhotoFromAI) {\n    return [{\n      json: {\n        ...source,\n        salesPostListHandled: true,\n        output: \'Consigo te mandar a foto sim 😊 Me confirma o numero do item ou o modelo que voce quer ver?\',');

  const oldIntentBlock = `const wantsPhoto = /\\b(foto|fotos|imagem|imagens|manda foto|ver foto|mostrar foto)\\b/.test(normalized);
const numberMatch = normalized.match(/\\b(?:opcao|opcao numero|numero|n|produto)?\\s*(\\d{1,3})\\b/);
const hasOrderDraft = Boolean(activeState?.orderDraft?.productId);
const isQuantityStep = hasOrderDraft && ['awaiting_quantity', 'awaiting_photo_confirmation'].includes(String(activeState?.step || ''));
const requestedQuantity = isQuantityStep && numberMatch ? Number(numberMatch[1]) : 0;
const selectedNumber = requestedQuantity ? Number(activeState?.selectedOptionNumber || 0) : (numberMatch ? Number(numberMatch[1]) : Number(activeState?.selectedOptionNumber || 0));`;
  const newIntentBlock = `const wantsPhoto = /\\b(foto|fotos|imagem|imagens|manda foto|ver foto|mostrar foto)\\b/.test(normalized);
const numberMatch = normalized.match(/\\b(?:opcao|opcao numero|numero|n|produto|item|do|da)?\\s*(\\d{1,3})\\b/);
const hasOrderDraft = Boolean(activeState?.orderDraft?.productId);
const isQuantityStep = hasOrderDraft && ['awaiting_quantity', 'awaiting_photo_confirmation'].includes(String(activeState?.step || ''));
const aiAction = String(source.salesFlowAction || '').trim();
const aiSelectedNumber = Number(source.salesFlowItemNumber || 0);
const aiQuantity = Number(source.salesFlowQuantity || 0);
const aiColor = String(source.salesFlowColor || '').trim();
if (aiAction === 'nova_busca') {
  return buildContinueItem();
}
const quantityIntent = /^\\d{1,3}$/.test(normalized)
  || /^\\s*(quero|queria|vou querer|pode separar|separa|separe)\\s+\\d{1,3}\\b/.test(normalized)
  || /\\b\\d{1,3}\\s*(unidade|unidades|peca|pecas|und|unds|un|x)\\b/.test(normalized);
const requestedQuantity = isQuantityStep && aiAction === 'informar_quantidade' && aiQuantity > 0
  ? aiQuantity
  : (isQuantityStep && !wantsPhoto && quantityIntent && numberMatch ? Number(numberMatch[1]) : 0);
const selectedNumber = requestedQuantity
  ? Number(activeState?.selectedOptionNumber || 0)
  : (aiSelectedNumber || (numberMatch ? Number(numberMatch[1]) : Number(activeState?.selectedOptionNumber || 0)));
const wantsPhotoFromAI = aiAction === 'pedir_foto';`;
  if (nextCode.includes(oldIntentBlock)) {
    nextCode = nextCode.replace(oldIntentBlock, newIntentBlock);
  }
  const currentIntentBlock = `const wantsPhoto = /\\b(foto|fotos|imagem|imagens|manda foto|ver foto|mostrar foto)\\b/.test(normalized);
const numberMatch = normalized.match(/\\b(?:opcao|opcao numero|numero|n|produto|item|do|da)?\\s*(\\d{1,3})\\b/);
const hasOrderDraft = Boolean(activeState?.orderDraft?.productId);
const isQuantityStep = hasOrderDraft && ['awaiting_quantity', 'awaiting_photo_confirmation'].includes(String(activeState?.step || ''));
const quantityIntent = /^\\d{1,3}$/.test(normalized)
  || /^\\s*(quero|queria|vou querer|pode separar|separa|separe)\\s+\\d{1,3}\\b/.test(normalized)
  || /\\b\\d{1,3}\\s*(unidade|unidades|peca|pecas|und|unds|un|x)\\b/.test(normalized);
const requestedQuantity = isQuantityStep && !wantsPhoto && quantityIntent && numberMatch ? Number(numberMatch[1]) : 0;
const selectedNumber = requestedQuantity ? Number(activeState?.selectedOptionNumber || 0) : (numberMatch ? Number(numberMatch[1]) : Number(activeState?.selectedOptionNumber || 0));`;
  if (nextCode.includes(currentIntentBlock)) {
    nextCode = nextCode.replace(currentIntentBlock, newIntentBlock);
  }

  const joinPtBlock = `const joinPt = (values) => {
  const list = values.filter(Boolean);
  if (list.length <= 1) return list.join('');
  if (list.length === 2) return list.join(' e ');
  return list.slice(0, -1).join(', ') + ' e ' + list[list.length - 1];
};`;
  const greetingHelpersBlock = `${joinPtBlock}

const periodGreeting = () => {
  if (source.saudacaoDetectada !== true) return '';
  if (normalized.includes('bom dia')) return 'Bom dia! 😊';
  if (normalized.includes('boa tarde')) return 'Boa tarde! 😊';
  if (normalized.includes('boa noite')) return 'Boa noite! 😊';
  const hour = Number(new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }));
  if (hour >= 5 && hour < 12) return 'Bom dia! 😊';
  if (hour >= 12 && hour < 18) return 'Boa tarde! 😊';
  return 'Boa noite! 😊';
};

const withGreeting = (message) => [periodGreeting(), message].filter(Boolean).join('|||');`;
  if (nextCode.includes(joinPtBlock) && !nextCode.includes('const periodGreeting =')) {
    nextCode = nextCode.replace(joinPtBlock, greetingHelpersBlock);
  }

  const findMentionedColorBlock = `const findMentionedColor = (availableColors) => {
  const normalizedColors = availableColors.map((color) => ({
    raw: color,
    key: normalize(colorAliases.get(normalize(color)) || color),
  }));
  const words = normalized.split(' ').filter(Boolean);
  for (const word of words) {
    const alias = colorAliases.get(word) || word;
    const found = normalizedColors.find((color) => color.key === normalize(alias));
    if (found) return found.raw;
  }
  for (const color of normalizedColors) {
    if (normalized.includes(color.key)) return color.raw;
  }
  return '';
};`;
  const findMentionedColorWithDedupeBlock = `${findMentionedColorBlock}

const uniqueColorItems = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = normalize(item?.color);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};`;
  if (nextCode.includes(findMentionedColorBlock) && !nextCode.includes('const uniqueColorItems =')) {
    nextCode = nextCode.replace(findMentionedColorBlock, findMentionedColorWithDedupeBlock);
  }

  const oldColorsBlock = `const option = activeState.options.find((item) => Number(item.number) === selectedNumber);
const allColors = option?.colors?.map((item) => item.color).filter(Boolean) || [];
const mentionedColor = findMentionedColor(option ? allColors : activeState.options.flatMap((item) => item.colors || []).map((item) => item.color).filter(Boolean));`;
  const newColorsBlock = `const option = activeState.options.find((item) => Number(item.number) === selectedNumber);
const optionColorItems = uniqueColorItems(option?.colors || []);
const allColors = optionColorItems.map((item) => item.color).filter(Boolean);
const mentionedColor = aiColor || findMentionedColor(option ? allColors : uniqueColorItems(activeState.options.flatMap((item) => item.colors || [])).map((item) => item.color).filter(Boolean));`;
  if (nextCode.includes(oldColorsBlock)) {
    nextCode = nextCode.replace(oldColorsBlock, newColorsBlock);
  }
  nextCode = nextCode.replace(
    `const mentionedColor = findMentionedColor(option ? allColors : uniqueColorItems(activeState.options.flatMap((item) => item.colors || [])).map((item) => item.color).filter(Boolean));`,
    `const mentionedColor = aiColor || findMentionedColor(option ? allColors : uniqueColorItems(activeState.options.flatMap((item) => item.colors || [])).map((item) => item.color).filter(Boolean));`
  );

  const oldSelectedVariantBlock = `const selectedVariant = mentionedColor
  ? option.colors.find((item) => normalize(item.color) === normalize(mentionedColor))
  : null;`;
  const newSelectedVariantBlock = `const selectedVariant = mentionedColor
  ? optionColorItems.find((item) => normalize(item.color) === normalize(mentionedColor))
  : null;`;
  if (nextCode.includes(oldSelectedVariantBlock)) {
    nextCode = nextCode.replace(oldSelectedVariantBlock, newSelectedVariantBlock);
  }

  const oldVariantBlock = `const variant = selectedVariant || (option.colors.length === 1 ? option.colors[0] : null);`;
  const newVariantBlock = `const variant = selectedVariant || (optionColorItems.length === 1 ? optionColorItems[0] : null);`;
  if (nextCode.includes(oldVariantBlock)) {
    nextCode = nextCode.replace(oldVariantBlock, newVariantBlock);
  }
  nextCode = nextCode.replace(
    `if (!selectedNumber && !wantsPhoto && !mentionedColor) {`,
    `if (!selectedNumber && !wantsPhoto && !wantsPhotoFromAI && !mentionedColor) {`
  );
  nextCode = nextCode.replace(
    `if (wantsPhoto) {\n  return [{`,
    `if (wantsPhoto || wantsPhotoFromAI) {\n  return [{`
  );
  nextCode = nextCode
    .replace(
      `output: 'Consigo te mandar a foto sim 😊 Me confirma o numero do item ou o modelo que voce quer ver?',`,
      `output: withGreeting('Consigo te mandar a foto sim 😊 Me confirma o numero do item ou o modelo que voce quer ver?'),`
    )
    .replace(
      `output: 'Certo 😊 Separei ' + requestedQuantity + ' ' + unidade + '. Voce prefere retirada na loja ou entrega?',`,
      `output: withGreeting('Certo 😊 Separei ' + requestedQuantity + ' ' + unidade + '. Voce prefere retirada na loja ou entrega?'),`
    )
    .replace(
      `output: 'Nao encontrei esse numero na lista. Pode escolher uma opcao de 1 a ' + activeState.options.length + '? 😊',`,
      `output: withGreeting('Nao encontrei esse numero na lista. Pode escolher uma opcao de 1 a ' + activeState.options.length + '? 😊'),`
    )
    .replace(
      `output: 'Perfeito 😊 Temos ' + colorsText + '. Qual cor voce prefere?',`,
      `output: withGreeting('Perfeito 😊 Temos ' + colorsText + '. Qual cor voce prefere?'),`
    )
    .replace(
      `output: 'Perfeito 😊 Separei o ' + option.name + (option.memory ? ' ' + option.memory : '') + ' na cor ' + titleCase(variant.color) + '. Quantas unidades voce deseja?',`,
      `output: withGreeting('Perfeito 😊 Separei o ' + option.name + (option.memory ? ' ' + option.memory : '') + ' na cor ' + titleCase(variant.color) + '. Quantas unidades voce deseja?'),`
    );
  nextCode = nextCode.replace(
    `const buildPhotoMessages = (item) => {
  const images = Array.isArray(item.images) ? item.images.filter((url) => String(url).includes('api.xiaomipetrolina.com.br/images/')).slice(0, 3) : [];
  if (images.length === 0) {
    return [
      { type: 'text', text: 'Ainda nao tenho foto cadastrada dessa cor. Voce pode ver pelo link: ' + (option.url || 'produto sem link cadastrado') },
    ];
  }
  const captionBase = [option.name, option.memory, titleCase(item.color)].filter(Boolean).join(' - ');
  return [
    { type: 'text', text: titleCase(item.color) },
    ...images.map((mediaUrl, index) => ({
      type: 'image',
      mediaUrl,
      caption: index === 0 ? captionBase : '',
      mimetype: 'image/jpeg',
      fileName: 'produto-' + normalize(item.color).replace(/\\s+/g, '-') + '-' + (index + 1) + '.jpg',
    })),
    { type: 'text', text: 'Gostou desse modelo? Posso separar ele para voce? 😊' },
  ];
};`,
    `const buildPhotoMessages = (item) => {
  const images = Array.isArray(item.images) ? item.images.filter((url) => String(url).includes('api.xiaomipetrolina.com.br/images/')).slice(0, 3) : [];
  const linkText = option.url ? 'No link tem mais fotos, video e as caracteristicas dele: ' + option.url : '';
  if (images.length === 0) {
    return [
      { type: 'text', text: withGreeting('Ainda nao tenho foto cadastrada dessa cor. ' + (linkText || 'Esse produto esta sem link cadastrado no momento.')) },
    ];
  }
  const captionBase = [option.name, option.memory, titleCase(item.color)].filter(Boolean).join(' - ');
  return [
    ...[periodGreeting()].filter(Boolean).map((text) => ({ type: 'text', text })),
    { type: 'text', text: titleCase(item.color) },
    ...images.map((mediaUrl, index) => ({
      type: 'image',
      mediaUrl,
      caption: index === 0 ? captionBase : '',
      mimetype: 'image/jpeg',
      fileName: 'produto-' + normalize(item.color).replace(/\\s+/g, '-') + '-' + (index + 1) + '.jpg',
    })),
    ...[linkText].filter(Boolean).map((text) => ({ type: 'text', text })),
    { type: 'text', text: 'Gostou desse modelo? Posso separar ele para voce? 😊' },
  ];
};`
  );
  nextCode = nextCode.replace(
    `    { type: 'text', text: titleCase(item.color) },
`,
    ''
  );
  nextCode = nextCode.replace(
    `const buildPhotoMessages = (item) => {
  const images = Array.isArray(item.images) ? item.images.filter((url) => String(url).includes('api.xiaomipetrolina.com.br/images/')).slice(0, 3) : [];
  const linkText = option.url ? 'No link tem mais fotos, video e as caracteristicas dele: ' + option.url : '';
  if (images.length === 0) {
    return [
      { type: 'text', text: withGreeting('Ainda nao tenho foto cadastrada dessa cor. ' + (linkText || 'Esse produto esta sem link cadastrado no momento.')) },
    ];
  }
  const captionBase = [option.name, option.memory, titleCase(item.color)].filter(Boolean).join(' - ');
  return [
    ...[periodGreeting()].filter(Boolean).map((text) => ({ type: 'text', text })),
    ...images.map((mediaUrl, index) => ({
      type: 'image',
      mediaUrl,
      caption: index === 0 ? captionBase : '',
      mimetype: 'image/jpeg',
      fileName: 'produto-' + normalize(item.color).replace(/\\s+/g, '-') + '-' + (index + 1) + '.jpg',
    })),
    ...[linkText].filter(Boolean).map((text) => ({ type: 'text', text })),
    { type: 'text', text: 'Gostou desse modelo? Posso separar ele para voce? 😊' },
  ];
};`,
    `const buildPhotoMessages = (item) => {
  const images = Array.isArray(item.images) ? item.images.filter((url) => String(url).includes('api.xiaomipetrolina.com.br/images/')).slice(0, 3) : [];
  const linkText = option.url ? 'No link tem mais fotos, video e as caracteristicas dele: ' + option.url : '';
  if (images.length === 0) {
    return [
      { type: 'text', text: withGreeting('Ainda nao tenho foto cadastrada dessa cor. ' + (linkText || 'Esse produto esta sem link cadastrado no momento.')) },
    ];
  }
  const captionBase = [option.name, option.memory, titleCase(item.color)].filter(Boolean).join(' - ');
  return [
    ...[periodGreeting()].filter(Boolean).map((text) => ({ type: 'text', text })),
    ...images.map((mediaUrl, index) => ({
      type: 'image',
      mediaUrl,
      caption: index === 0 ? captionBase : '',
      mimetype: 'image/jpeg',
      fileName: 'produto-' + normalize(item.color).replace(/\\s+/g, '-') + '-' + (index + 1) + '.jpg',
    })),
    ...[linkText].filter(Boolean).map((text) => ({ type: 'text', text })),
    { type: 'text', text: 'Gostou desse modelo? Posso separar ele para voce? 😊' },
  ];
};

const buildAllPhotoMessages = (items) => {
  const variants = uniqueColorItems(items || []);
  const linkText = option.url ? 'No link tem mais fotos, video e as caracteristicas dele: ' + option.url : '';
  const messages = [];
  const greeting = periodGreeting();
  if (greeting) messages.push({ type: 'text', text: greeting, delayMs: 800 });

  for (const item of variants) {
    const images = Array.isArray(item.images) ? item.images.filter((url) => String(url).includes('api.xiaomipetrolina.com.br/images/')).slice(0, 1) : [];
    const captionBase = [option.name, option.memory, titleCase(item.color)].filter(Boolean).join(' - ');
    for (const mediaUrl of images) {
      messages.push({
        type: 'image',
        mediaUrl,
        caption: captionBase,
        mimetype: 'image/jpeg',
        fileName: 'produto-' + normalize(item.color).replace(/\\s+/g, '-') + '-1.jpg',
        delayMs: 1200 + messages.length * 4500,
      });
    }
  }

  const sentImages = messages.some((message) => message.type === 'image');
  if (!sentImages) {
    messages.push({ type: 'text', text: linkText || 'Ainda nao tenho foto cadastrada dessas cores.', delayMs: 1200 });
  } else if (linkText) {
    messages.push({ type: 'text', text: linkText, delayMs: 1200 + messages.length * 4500 });
  }
  messages.push({ type: 'text', text: 'Gostou de alguma dessas cores? Posso separar para voce? 😊', delayMs: 1200 + messages.length * 4500 });
  return messages;
};`
  );
  nextCode = nextCode.replace(
    `if (!variant) {
  return askColor();
}`,
    `if (!variant && (wantsPhoto || wantsPhotoFromAI)) {
  activeState.step = 'awaiting_quantity';
  activeState.selectedOptionNumber = option.number;
  activeState.updatedAt = new Date(now).toISOString();
  return [{
    json: {
      ...source,
      salesPostListHandled: true,
      salesPostListStep: activeState.step,
      messages: buildAllPhotoMessages(optionColorItems),
    },
  }];
}

if (!variant) {
  return askColor();
}`
  );

  if (nextCode !== code) {
    node.parameters.jsCode = nextCode;
  }
}

function makeHttpNode({ id, name, position, method = 'GET', url, bodyParameters = [] }) {
  const node = {
    id,
    name,
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position,
    onError: 'continueRegularOutput',
    continueOnFail: true,
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 1500,
    parameters: {
      method,
      url,
      options: {},
      sendHeaders: true,
      headerParameters: {
        parameters: [{ name: 'x-sync-key', value: '={{$env.SYNC_SECRET}}' }],
      },
    },
  };
  if (method !== 'GET') {
    node.parameters.sendBody = true;
    node.parameters.bodyParameters = { parameters: bodyParameters };
  }
  return node;
}

function makeAdminWhatsAppReplyNode() {
  return {
    id: 'n8n-admin-command-whatsapp-reply-001',
    name: 'Controle Bot - Responder Admin',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [1392, -272],
    parameters: {
      method: 'POST',
      url: "={{$env.EVOLUTION_SERVER_URL + '/message/sendText/botmercadodovale'}}",
      options: {},
      sendHeaders: true,
      headerParameters: {
        parameters: [{ name: 'apikey', value: '={{$env.EVOLUTION_API_KEY}}' }],
      },
      sendBody: true,
      bodyParameters: {
        parameters: [
          { name: 'number', value: "={{$json.remoteJid.replace('@s.whatsapp.net', '')}}" },
          { name: 'text', value: '={{$json.adminCommandReply}}' },
        ],
      },
    },
  };
}

function makeResetPendingIfNode() {
  return {
    id: 'n8n-admin-control-reset-if-001',
    name: 'Controle Bot - Reset pendente?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [816, 80],
    parameters: {
      conditions: {
        options: {
          caseSensitive: true,
          leftValue: '',
          typeValidation: 'strict',
          version: 2,
        },
        conditions: [
          {
            id: 'n8n-admin-control-reset-condition',
            leftValue: '={{$json.n8nBotResetApplied}}',
            rightValue: true,
            operator: {
              type: 'boolean',
              operation: 'true',
              singleValue: true,
            },
          },
        ],
        combinator: 'and',
      },
      options: {},
    },
  };
}

function patchGraph(nodes, connections) {
  upsertNode(nodes, {
    id: 'n8n-admin-client-control-001',
    name: 'Controle Bot - Verificar Cliente',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [384, 80],
    parameters: { jsCode: clientControlCode },
  });

  upsertNode(nodes, makeHttpNode({
    id: 'n8n-admin-client-inbound-log-001',
    name: 'Controle Bot - Registrar Entrada',
    position: [528, -112],
    method: 'POST',
    url: `${MDV_API_URL}/n8n-bot/messages/log`,
    bodyParameters: [
      { name: 'remoteJid', value: "={{ $('Controle Bot - Verificar Cliente').first().json.remoteJid }}" },
      { name: 'direction', value: 'inbound' },
      { name: 'message', value: "={{ $('Controle Bot - Verificar Cliente').first().json.conversation || $('Controle Bot - Verificar Cliente').first().json.text || $('Controle Bot - Verificar Cliente').first().json.message || '' }}" },
      { name: 'messageType', value: "={{ $('Controle Bot - Verificar Cliente').first().json.messageType || 'text' }}" },
      { name: 'sourceNode', value: 'Controle Bot - Registrar Entrada' },
      { name: 'waMessageId', value: "={{ $('Controle Bot - Verificar Cliente').first().json.messageId || $('Controle Bot - Verificar Cliente').first().json.id || $('Controle Bot - Verificar Cliente').first().json.key?.id || '' }}" },
    ],
  }));

  upsertNode(nodes, makeHttpNode({
    id: 'n8n-admin-global-fetch-001',
    name: 'Controle Bot - Buscar Admin Global',
    position: [672, -272],
    method: 'GET',
    url: `${MDV_API_URL}/n8n-bot/global-control`,
  }));

  upsertNode(nodes, {
    id: 'n8n-admin-command-parse-001',
    name: 'Controle Bot - Comando Admin',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [816, -272],
    parameters: { jsCode: adminCommandCode },
  });

  upsertNode(nodes, makeBooleanIfNode({
    id: 'n8n-admin-command-if-001',
    name: 'Controle Bot - E comando admin?',
    position: [960, -272],
    leftValue: '={{$json.n8nBotAdminCommand}}',
  }));

  upsertNode(nodes, makeHttpNode({
    id: 'n8n-admin-command-execute-001',
    name: 'Controle Bot - Executar Comando Admin',
    position: [1104, -384],
    method: 'POST',
    url: `${MDV_API_URL}/n8n-bot/admin-command`,
    bodyParameters: [
      { name: 'remoteJid', value: "={{ $('Controle Bot - Comando Admin').first().json.remoteJid }}" },
      { name: 'message', value: "={{ $('Controle Bot - Comando Admin').first().json.conversation || '' }}" },
    ],
  }));

  upsertNode(nodes, {
    id: 'n8n-admin-command-reply-code-001',
    name: 'Controle Bot - Preparar Resposta Admin',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1248, -384],
    parameters: { jsCode: adminReplyCode },
  });

  upsertNode(nodes, makeAdminWhatsAppReplyNode());

  upsertNode(nodes, makeBooleanIfNode({
    id: 'n8n-admin-global-paused-if-001',
    name: 'Controle Bot - Pausa global?',
    position: [1104, -112],
    leftValue: '={{$json.n8nBotGlobalPaused}}',
  }));

  upsertNode(nodes, makeHttpNode({
    id: 'n8n-admin-client-control-fetch-001',
    name: 'Controle Bot - Buscar Controle',
    position: [672, -112],
    method: 'GET',
    url: `={{'${MDV_API_URL}/n8n-bot/client-control?remoteJid=' + encodeURIComponent($('Controle Bot - Verificar Cliente').first().json.remoteJid)}}`,
  }));

  upsertNode(nodes, {
    id: 'n8n-admin-client-control-apply-001',
    name: 'Controle Bot - Aplicar Controle',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [816, -112],
    parameters: { jsCode: applyClientControlCode },
  });

  upsertNode(nodes, makeResetPendingIfNode());

  upsertNode(nodes, makeHttpNode({
    id: 'n8n-admin-client-control-reset-consume-001',
    name: 'Controle Bot - Consumir Reset',
    position: [960, -208],
    method: 'POST',
    url: `${MDV_API_URL}/n8n-bot/client-control/consume-reset`,
    bodyParameters: [
      { name: 'remoteJid', value: "={{ $('Controle Bot - Aplicar Controle').first().json.remoteJid }}" },
    ],
  }));

  upsertNode(nodes, {
    id: 'n8n-admin-client-control-restore-001',
    name: 'Controle Bot - Restaurar Controle',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1104, -208],
    parameters: { jsCode: restoreClientControlCode },
  });

  upsertNode(nodes, makeIfNode());

  upsertNode(nodes, makeHttpNode({
    id: 'n8n-admin-client-outbound-log-001',
    name: 'Controle Bot - Registrar Saida',
    position: [1472, 80],
    method: 'POST',
    url: `${MDV_API_URL}/n8n-bot/messages/log`,
    bodyParameters: [
      { name: 'remoteJid', value: "={{$json.remoteJid || $('Controle Bot - Verificar Cliente').first().json.remoteJid}}" },
      { name: 'direction', value: 'outbound' },
      { name: 'message', value: '={{$json.message || $json.caption || $json.text || $json.output || ""}}' },
      { name: 'messageType', value: '={{$json.messageType || "text"}}' },
      { name: 'sourceNode', value: 'Controle Bot - Registrar Saida' },
      { name: 'payload', value: '={{JSON.stringify({ messageIndex: $json.messageIndex || null, totalMessages: $json.totalMessages || null, mediaUrl: $json.mediaUrl || "" })}}' },
    ],
  }));

  upsertNode(nodes, {
    id: 'n8n-admin-client-outbound-restore-001',
    name: 'Controle Bot - Restaurar Saida',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1600, 80],
    parameters: { jsCode: restoreOutboundCode },
  });

  upsertNode(nodes, {
    id: 'sales-ai-context-001',
    name: 'Vendas - Preparar Contexto IA',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1760, 448],
    parameters: { jsCode: salesAIContextCode },
  });

  for (const node of nodes) {
    if (node.name === 'Memoria de contexto postggress' || node.name === 'Memoria Vendas') {
      patchMemoryNode(node);
    }
    if (node.name === 'Vendas - Buscar Taxas' || node.name === 'Vendas - Buscar Produtos') {
      patchTransientHttpNode(node);
    }
    if (node.name === 'Vendas - Verificar Pos Lista') {
      patchPostListPhotoFallback(node);
    }
    if (node.name === 'Agente Inicial - Classificador') {
      patchClassifierAgent(node);
    }
    if (node.name === 'Parse Classificacao') {
      patchParseClassification(node);
    }
    if (node.name === 'Dividir mensagens') {
      patchSplitMessagesNode(node);
    }
    if (node.name === 'Enviar WhatsApp' || node.name === 'Enviar WhatsApp - Imagem') {
      patchSendDelayNode(node);
    }
  }

  connections['switc Mensagens'] = {
    main: [[{ node: 'Controle Bot - Verificar Cliente', type: 'main', index: 0 }]],
  };
  connections['Controle Bot - Verificar Cliente'] = {
    main: [[{ node: 'Controle Bot - Registrar Entrada', type: 'main', index: 0 }]],
  };
  connections['Controle Bot - Registrar Entrada'] = {
    main: [[{ node: 'Controle Bot - Buscar Admin Global', type: 'main', index: 0 }]],
  };
  connections['Controle Bot - Buscar Admin Global'] = {
    main: [[{ node: 'Controle Bot - Comando Admin', type: 'main', index: 0 }]],
  };
  connections['Controle Bot - Comando Admin'] = {
    main: [[{ node: 'Controle Bot - E comando admin?', type: 'main', index: 0 }]],
  };
  connections['Controle Bot - E comando admin?'] = {
    main: [
      [{ node: 'Controle Bot - Executar Comando Admin', type: 'main', index: 0 }],
      [{ node: 'Controle Bot - Pausa global?', type: 'main', index: 0 }],
    ],
  };
  connections['Controle Bot - Executar Comando Admin'] = {
    main: [[{ node: 'Controle Bot - Preparar Resposta Admin', type: 'main', index: 0 }]],
  };
  connections['Controle Bot - Preparar Resposta Admin'] = {
    main: [[{ node: 'Controle Bot - Responder Admin', type: 'main', index: 0 }]],
  };
  connections['Controle Bot - Responder Admin'] = {
    main: [[]],
  };
  connections['Controle Bot - Pausa global?'] = {
    main: [
      [],
      [{ node: 'Controle Bot - Buscar Controle', type: 'main', index: 0 }],
    ],
  };
  connections['Controle Bot - Buscar Controle'] = {
    main: [[{ node: 'Controle Bot - Aplicar Controle', type: 'main', index: 0 }]],
  };
  connections['Controle Bot - Aplicar Controle'] = {
    main: [[{ node: 'Controle Bot - Reset pendente?', type: 'main', index: 0 }]],
  };
  connections['Controle Bot - Reset pendente?'] = {
    main: [
      [{ node: 'Controle Bot - Consumir Reset', type: 'main', index: 0 }],
      [{ node: 'Controle Bot - Bloqueado?', type: 'main', index: 0 }],
    ],
  };
  connections['Controle Bot - Consumir Reset'] = {
    main: [[{ node: 'Controle Bot - Restaurar Controle', type: 'main', index: 0 }]],
  };
  connections['Controle Bot - Restaurar Controle'] = {
    main: [[{ node: 'Controle Bot - Bloqueado?', type: 'main', index: 0 }]],
  };
  connections['Controle Bot - Bloqueado?'] = {
    main: [
      [],
      [{ node: 'Handoff - Verificar pausa', type: 'main', index: 0 }],
    ],
  };

  if (connections['Contato encontrado?']?.main) {
    connections['Contato encontrado?'] = {
      main: [
        [{ node: 'Vendas - Preparar Contexto IA', type: 'main', index: 0 }],
        [{ node: 'Mensagem parece nome?', type: 'main', index: 0 }],
      ],
    };
  }
  connections['Vendas - Preparar Contexto IA'] = {
    main: [[{ node: 'Agente Inicial - Classificador', type: 'main', index: 0 }]],
  };
  connections['Agente Inicial - Classificador'] = {
    main: [[{ node: 'Parse Classificacao', type: 'main', index: 0 }]],
  };
  connections['Parse Classificacao'] = {
    main: [[{ node: 'Vendas - Verificar Pos Lista', type: 'main', index: 0 }]],
  };
  connections['Vendas - Pos Lista resolvido?'] = {
    main: [
      [{ node: 'Dividir mensagens', type: 'main', index: 0 }],
      [{ node: 'Switch Especialistas', type: 'main', index: 0 }],
    ],
  };

  if (connections['Dividir mensagens']?.main?.[0]) {
    const hasImageRouter = nodes.some((node) => node.name === 'Enviar WhatsApp - Tipo imagem?');
    const sendAfterLogger = hasImageRouter ? 'Enviar WhatsApp - Tipo imagem?' : 'Enviar WhatsApp';
    connections['Dividir mensagens'] = {
      main: [[{ node: 'Controle Bot - Registrar Saida', type: 'main', index: 0 }]],
    };
    connections['Controle Bot - Registrar Saida'] = {
      main: [[{ node: 'Controle Bot - Restaurar Saida', type: 'main', index: 0 }]],
    };
    connections['Controle Bot - Restaurar Saida'] = {
      main: [[{ node: sendAfterLogger, type: 'main', index: 0 }]],
    };
    if (hasImageRouter) {
      connections['Enviar WhatsApp - Tipo imagem?'] = {
        main: [
          [{ node: 'Enviar WhatsApp - Imagem', type: 'main', index: 0 }],
          [{ node: 'Enviar WhatsApp', type: 'main', index: 0 }],
        ],
      };
    }
  }
}

async function ensureN8nSyncSecretEnv(conn) {
  const command = `
set -eu
secret="$(grep -E '^SYNC_SECRET=' /var/www/mdv-api/.env | tail -n 1 | cut -d= -f2-)"
if [ -z "$secret" ]; then
  echo "SYNC_SECRET missing in /var/www/mdv-api/.env" >&2
  exit 1
fi
for service in n8n_n8n n8n_n8n-runner; do
  docker service update --env-rm SYNC_SECRET "$service" >/dev/null 2>&1 || true
  docker service update --env-add "SYNC_SECRET=$secret" "$service" >/dev/null
done
`;
  await runRemote(conn, command);
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig());
  });

  try {
    const dbContainer = (await runRemote(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    if (!dbContainer) throw new Error('n8n Postgres container not found');

    await ensureN8nSyncSecretEnv(conn);
    await waitServiceReplicas(conn, 'n8n_n8n', 1);
    await waitServiceReplicas(conn, 'n8n_n8n-runner', 1);

    await runRemote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n-runner', 0);
    await runRemote(conn, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n', 0);

    const entity = await readJson(conn, dbContainer, `
      SELECT json_build_object(
        'nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'),
        'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'),
        'activeVersionId', "activeVersionId"
      )::text
      FROM workflow_entity
      WHERE id = ${shQuote(WORKFLOW_ID)}
    `);

    const nodes = JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8'));
    const connections = JSON.parse(Buffer.from(entity.connectionsHex, 'hex').toString('utf8'));
    patchGraph(nodes, connections);

    const updateSql = `
\\set ON_ERROR_STOP on

UPDATE workflow_entity
SET nodes = ${dollar(JSON.stringify(nodes), 'nodesjson')}::json,
    connections = ${dollar(JSON.stringify(connections), 'connjson')}::json,
    "updatedAt" = NOW()
WHERE id = ${shQuote(WORKFLOW_ID)};

UPDATE workflow_history
SET nodes = ${dollar(JSON.stringify(nodes), 'histnodesjson')}::json,
    connections = ${dollar(JSON.stringify(connections), 'histconnjson')}::json,
    "updatedAt" = NOW()
WHERE "workflowId" = ${shQuote(WORKFLOW_ID)}
  AND "versionId" = ${shQuote(entity.activeVersionId)};

COPY (
  SELECT json_build_object(
    'switchTarget', connections::jsonb #> '{"switc Mensagens",main,0,0,node}',
    'controlBlockedTarget', connections::jsonb #> '{"Controle Bot - Bloqueado?",main,0}',
    'controlContinueTarget', connections::jsonb #> '{"Controle Bot - Bloqueado?",main,1,0,node}',
    'outboundLoggerTarget', connections::jsonb #> '{"Dividir mensagens",main,0,0,node}',
    'outboundAfterLoggerTarget', connections::jsonb #> '{"Controle Bot - Registrar Saida",main,0,0,node}',
    'imageTrueTarget', connections::jsonb #> '{"Enviar WhatsApp - Tipo imagem?",main,0,0,node}',
    'imageFalseTarget', connections::jsonb #> '{"Enviar WhatsApp - Tipo imagem?",main,1,0,node}',
    'transientHttpNodes', (
      SELECT json_agg(json_build_object(
        'name', node->>'name',
        'onError', node->>'onError',
        'retryOnFail', node->>'retryOnFail',
        'maxTries', node->>'maxTries'
      ))
      FROM jsonb_array_elements(nodes::jsonb) AS node
      WHERE node->>'name' IN ('Vendas - Buscar Taxas', 'Vendas - Buscar Produtos')
    ),
    'memoryNodes', (
      SELECT json_agg(node->>'name')
      FROM jsonb_array_elements(nodes::jsonb) AS node
      WHERE node->'parameters'->>'sessionKey' LIKE '%memorySessionKey%'
    )
  )::text
  FROM workflow_entity
  WHERE id = ${shQuote(WORKFLOW_ID)}
) TO STDOUT;
`;
    const result = await psqlFile(conn, dbContainer, updateSql);

    await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n', 1);
    await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n-runner', 1);

    console.log(result.trim().split(/\r?\n/).filter(Boolean).pop());
  } catch (error) {
    try {
      await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null');
      await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    } catch (_) {}
    throw error;
  } finally {
    conn.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
