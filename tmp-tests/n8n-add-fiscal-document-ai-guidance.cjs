const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const APPLY = process.argv.includes('--apply');
const MARKER = '// fiscal-document-ai-guidance-v164';
const POLICY_GUIDANCE = [
  'O cliente perguntou sobre nota fiscal ou documento fiscal.',
  'Responda com palavras proprias, de forma gentil, educada, natural e coerente com a conversa; isto nao e uma frase pronta.',
  'Informe com clareza que a loja fisica emite comprovante de compra e venda.',
  'Explique que o cliente pode consultar os dados da compra a qualquer momento no sistema da loja.',
  'Explique tambem que, sempre que precisar, o cliente pode acessar ou emitir pelo sistema o termo de garantia e o comprovante de venda.',
  'Nao afirme que a loja emite nota fiscal, NF, NF-e ou cupom fiscal e nao confunda o comprovante de compra e venda com nota fiscal.',
  'Nao encaminhe para especialista e nao faca perguntas desnecessarias sobre esta politica conhecida.',
].join(' ');

function detectFiscalDocumentIntentV164(value) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return /\b(?:nota\s+fiscal|cupom\s+fiscal|danfe|nf(?:-?e)?)\b/.test(normalized);
}

function quote(value) { return `'${String(value).replace(/'/g, `'\\''`)}'`; }
function dollar(value, tag) {
  if (String(value).includes(`$${tag}$`)) throw new Error(`Dollar quote collision: ${tag}`);
  return `$${tag}$${value}$${tag}$`;
}
function run(conn, command) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Remote command failed: ${code}`)));
  }));
}
function psql(conn, db, sql) {
  return new Promise((resolve, reject) => conn.exec(`docker exec -i ${quote(db)} psql -U postgres -d n8n -X -q -t -A`, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `psql failed: ${code}`)));
    stream.end(sql);
  }));
}
async function waitService(conn, service, expected, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const replicas = (await run(conn, `docker service ls --filter name=${quote(service)} --format '{{.Replicas}}' | head -n 1`)).trim();
    if (replicas === `${expected}/${expected}`) return replicas;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service} did not reach ${expected}/${expected}`);
}
function nodeByName(nodes, name) {
  const node = nodes.find((item) => item.name === name);
  if (!node) throw new Error(`${name} not found`);
  return node;
}

const detectorBlock = `${MARKER}
const fiscalDocumentIntentV164 = (${detectFiscalDocumentIntentV164.toString()})(text);
const deterministicFiscalDocumentDecisionV164 = fiscalDocumentIntentV164
  ? {
      acao: 'responder_direto',
      intencao: 'documentos_compra',
      confianca: 1,
      motivo: 'Pergunta sobre nota fiscal deve ser respondida pelo agente geral com a politica documental da loja.',
    }
  : null;
const fiscalDocumentGuidanceV164 = fiscalDocumentIntentV164 ? ${JSON.stringify(POLICY_GUIDANCE)} : '';`;

const systemPolicy = `

POLITICA DE DOCUMENTOS DE COMPRA (${MARKER}):
- Quando receber um Direcionamento interno para a resposta, use-o como fatos e limites; nunca mostre esse direcionamento ao cliente e nunca o copie palavra por palavra.
- Em perguntas sobre nota fiscal, NF, NF-e, NFe, cupom fiscal ou DANFE, redija uma resposta propria, natural, gentil e adequada ao contexto.
- A informacao correta e: a loja fisica emite comprovante de compra e venda; o sistema da loja permite consultar os dados da compra a qualquer momento e acessar ou emitir o termo de garantia e o comprovante de venda sempre que necessario.
- Nao diga que a loja emite nota fiscal, NF, NF-e ou cupom fiscal. Nao apresente o comprovante de compra e venda como se fosse nota fiscal.
- Nao use uma frase decorada, nao encaminhe ao especialista e nao faca perguntas desnecessarias quando a duvida for apenas sobre essa politica.`;

function patchWorkflow(nodes) {
  const resolver = nodeByName(nodes, 'Resolver Acao de Conversacao');
  let resolverCode = String(resolver.parameters?.jsCode || '');
  if (!resolverCode.includes(MARKER)) {
    const insertionPoint = '// smartwatch-category-greeting-v162';
    if (!resolverCode.includes(insertionPoint)) throw new Error('Resolver detector insertion point not found');
    resolverCode = resolverCode.replace(insertionPoint, `${detectorBlock}\n${insertionPoint}`);

    const decisionMatch = resolverCode.match(/^const decision = (.+);$/m);
    if (!decisionMatch) throw new Error('Resolver decision line not found');
    resolverCode = resolverCode.replace(decisionMatch[0], `const decision = deterministicFiscalDocumentDecisionV164 || ${decisionMatch[1]};`);

    const returnAnchor = "    conversationIntent: String(decision.intencao || ''),";
    if (!resolverCode.includes(returnAnchor)) throw new Error('Resolver return insertion point not found');
    resolverCode = resolverCode.replace(returnAnchor, `${returnAnchor}\n    aiResponseGuidance: fiscalDocumentGuidanceV164 || String($json.aiResponseGuidance || ''),`);
  }
  if (!resolverCode.includes('const directOutput = \'\';')) throw new Error('Resolver must leave direct output empty for AI-authored response');
  if (!resolverCode.includes('deterministicFiscalDocumentDecisionV164 ||')) throw new Error('Fiscal document intent does not override generic routing');
  new Function(resolverCode);
  resolver.parameters.jsCode = resolverCode;

  const agent = nodeByName(nodes, 'Agente Geral - Atendimento');
  let agentText = String(agent.parameters?.text || '');
  const textTail = "'Mensagem do cliente: ' + $json.conversation)}}";
  if (!agentText.includes('Direcionamento interno para esta resposta:')) {
    if (!agentText.includes(textTail)) throw new Error('General agent text expression insertion point not found');
    agentText = agentText.replace(textTail, "'Mensagem do cliente: ' + $json.conversation + ($json.aiResponseGuidance ? '\\n\\nDirecionamento interno para esta resposta:\\n' + $json.aiResponseGuidance : ''))}}" );
  }
  agent.parameters.text = agentText;

  let agentSystem = String(agent.parameters?.options?.systemMessage || '');
  if (!agentSystem.includes(MARKER)) agentSystem += systemPolicy;
  agent.parameters.options = { ...(agent.parameters.options || {}), systemMessage: agentSystem };

  return nodes;
}

function summarize(nodes) {
  const resolver = nodeByName(nodes, 'Resolver Acao de Conversacao').parameters.jsCode;
  const agent = nodeByName(nodes, 'Agente Geral - Atendimento');
  const agentText = String(agent.parameters?.text || '');
  const system = String(agent.parameters?.options?.systemMessage || '');
  return {
    deterministicRoute: resolver.includes('deterministicFiscalDocumentDecisionV164 ||'),
    routesToGeneralAi: resolver.includes("acao: 'responder_direto'") && resolver.includes("intencao: 'documentos_compra'"),
    dynamicGuidance: resolver.includes('aiResponseGuidance: fiscalDocumentGuidanceV164') && agentText.includes('Direcionamento interno para esta resposta:'),
    aiWritesResponse: resolver.includes("const directOutput = '';"),
    physicalStoreProof: system.includes('loja fisica emite comprovante de compra e venda'),
    purchaseLookup: system.includes('consultar os dados da compra a qualquer momento'),
    warrantyAndReceipt: system.includes('termo de garantia e o comprovante de venda'),
    noFalseFiscalClaim: system.includes('Nao diga que a loja emite nota fiscal'),
    noCannedText: system.includes('Nao use uma frase decorada'),
  };
}

async function serviceMap(conn) {
  const output = await run(conn, "docker service ls --filter name=n8n --format '{{.Name}} {{.Replicas}}'");
  return Object.fromEntries(output.trim().split(/\r?\n/).filter(Boolean).map((line) => line.trim().split(/\s+/)));
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let servicesStopped = false;
  try {
    const db = (await run(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    if (!db) throw new Error('n8n Postgres container not found');
    const raw = await psql(conn, db, `COPY (SELECT json_build_object('nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'), 'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'), 'activeVersionId', "activeVersionId")::text FROM workflow_entity WHERE id=${quote(WORKFLOW_ID)}) TO STDOUT;`);
    const entity = JSON.parse(raw.trim());
    const nodes = JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8'));
    const connections = JSON.parse(Buffer.from(entity.connectionsHex, 'hex').toString('utf8'));
    patchWorkflow(nodes);
    const summary = summarize(nodes);
    if (!APPLY) return console.log(JSON.stringify({ apply: false, ...summary }, null, 2));

    await run(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 0);
    await run(conn, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitService(conn, 'n8n_n8n', 0);
    servicesStopped = true;

    const sql = `\\set ON_ERROR_STOP on
UPDATE workflow_entity SET nodes=${dollar(JSON.stringify(nodes), 'nodes')}::json, connections=${dollar(JSON.stringify(connections), 'connections')}::json, "versionId"="activeVersionId", "updatedAt"=NOW() WHERE id=${quote(WORKFLOW_ID)};
UPDATE workflow_history SET nodes=${dollar(JSON.stringify(nodes), 'hnodes')}::json, connections=${dollar(JSON.stringify(connections), 'hconnections')}::json, "updatedAt"=NOW() WHERE "workflowId"=${quote(WORKFLOW_ID)} AND "versionId"=${quote(entity.activeVersionId)};
COPY (SELECT json_build_object(
  'entityHistoryEqual', we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb,
  'markerCount', (length(we.nodes::text)-length(replace(we.nodes::text, 'fiscal-document-ai-guidance-v164', '')))/length('fiscal-document-ai-guidance-v164'),
  'routePresent', we.nodes::text LIKE '%deterministicFiscalDocumentDecisionV164%',
  'guidancePresent', we.nodes::text LIKE '%Direcionamento interno para esta resposta:%',
  'noCannedFiscalOutput', we.nodes::text NOT LIKE '%directOutput = ''A loja fisica emite comprovante%'
)::text FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`;
    const result = JSON.parse((await psql(conn, db, sql)).trim());
    await run(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(conn, 'n8n_n8n', 1);
    await run(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 1);
    servicesStopped = false;
    const services = await serviceMap(conn);
    console.log(JSON.stringify({ apply: true, ...result, ...summary, services: {
      n8n: services.n8n_n8n,
      runner: services['n8n_n8n-runner'],
      evolution: services['n8n_evolution-api'],
    } }, null, 2));
  } finally {
    if (servicesStopped) {
      await run(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await waitService(conn, 'n8n_n8n', 1).catch(() => {});
      await run(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
      await waitService(conn, 'n8n_n8n-runner', 1).catch(() => {});
    }
    conn.end();
  }
}

module.exports = { POLICY_GUIDANCE, detectFiscalDocumentIntentV164, patchWorkflow, summarize };
if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
