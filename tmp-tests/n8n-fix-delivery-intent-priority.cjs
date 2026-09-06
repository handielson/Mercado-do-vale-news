const { Client } = require('ssh2');
const fs = require('node:fs');
const path = require('node:path');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const MARKER = 'delivery-intent-priority-v337';

function shQuote(value) { return `'${String(value).replace(/'/g, `'\\''`)}'`; }
function dollar(value, tag) { return `$${tag}$${String(value).replace(new RegExp(`\\$${tag}\\$`, 'g'), '')}$${tag}$`; }
function runRemote(conn, command) { return new Promise((resolve, reject) => conn.exec(command, (error, stream) => { if (error) return reject(error); let out = ''; let err = ''; stream.on('data', (d) => { out += d; }); stream.stderr.on('data', (d) => { err += d; }); stream.on('close', (code) => code === 0 ? resolve(out) : reject(new Error(err || out || `Remote command failed: ${code}`))); })); }
function psql(conn, db, sql) { return new Promise((resolve, reject) => conn.exec(`docker exec -i ${shQuote(db)} psql -U postgres -d n8n -X -q -t -A`, (error, stream) => { if (error) return reject(error); let out = ''; let err = ''; stream.on('data', (d) => { out += d; }); stream.stderr.on('data', (d) => { err += d; }); stream.on('close', (code) => code === 0 ? resolve(out) : reject(new Error(err || out || `psql failed: ${code}`))); stream.end(sql); })); }
async function waitReplicas(conn, service, expected, timeoutMs = 120000) { const started = Date.now(); while (Date.now() - started < timeoutMs) { const value = (await runRemote(conn, `docker service ls --filter name=${shQuote(service)} --format '{{.Replicas}}' | head -n 1`)).trim(); if (value === `${expected}/${expected}`) return; await new Promise((resolve) => setTimeout(resolve, 2500)); } throw new Error(`Timed out waiting for ${service}`); }

function patchClassifierMessage(message) {
  let next = String(message || '');
  if (!next.includes('- entrega_frete\n')) next = next.replace('- formas_pagamento\n', '- formas_pagamento\n- entrega_frete\n');
  if (!next.includes('Perguntas sobre entrega, frete')) next = next.replace('- Perguntas sobre Pix, cartao, cartao de credito, cartao de debito, debito, credito, boleto, parcelamento, dinheiro, transferencia, link de pagamento ou usado como entrada: formas_pagamento.\n', '- Perguntas sobre Pix, cartao, cartao de credito, cartao de debito, debito, credito, boleto, parcelamento, dinheiro, transferencia, link de pagamento ou usado como entrada: formas_pagamento.\n- Perguntas sobre entrega, frete, envio, motoboy, retirada, prazo ou opcoes de entrega: entrega_frete.\n');
  return next;
}

function patchParseCode(code) {
  let next = String(code || '');
  next = next.replace(/const allowed = new Set\(\[([^\]]*)\]\);/, (match, values) => values.includes('entrega_frete') ? match : match.replace("'formas_pagamento'", "'formas_pagamento', 'entrega_frete'"));
  if (!next.includes(MARKER)) {
    const anchor = 'const intencao = usedPhonePolicyIntentV161';
    const addition = `// ${MARKER}\nconst deliveryIntentNormalizedV337 = usedPolicyNormalizedV161;\nconst deliveryTermsV337 = /\\b(?:entreg(?:a|as|ar|am|amos|ando|ue|ues)|frete|fretes|envi(?:o|os|ar|am|amos|ando)|motoboy|motoboys|retir(?:ada|adas|ar|am|amos|ando)|delivery)\\b/.test(deliveryIntentNormalizedV337);\nconst explicitPaymentTermsV337 = /\\b(?:pix|cartao|credito|debito|boleto|parcelamento|dinheiro|transferencia|pagamento|pagar)\\b/.test(deliveryIntentNormalizedV337);\nconst deliveryFreightIntentV337 = deliveryTermsV337 && !explicitPaymentTermsV337;\n`;
    if (!next.includes(anchor)) throw new Error('Parse classifier anchor not found');
    next = next.replace(anchor, addition + anchor);
    next = next.replace("const intencao = usedPhonePolicyIntentV161\n  ? 'formas_pagamento'", "const intencao = deliveryFreightIntentV337\n  ? 'entrega_frete'\n  : (usedPhonePolicyIntentV161\n  ? 'formas_pagamento'");
    next = next.replace(": (allowed.has(String(parsed.intencao || '').trim()) ? String(parsed.intencao).trim() : 'fallback'));\nconst venda =", ": (allowed.has(String(parsed.intencao || '').trim()) ? String(parsed.intencao).trim() : 'fallback')));\nconst venda =");
  }
  new Function('$json', '$', next);
  return next;
}

function patchResolverCode(code) {
  let next = String(code || '');
  if (!next.includes(MARKER)) {
    const anchor = 'const allowedActions = new Set(';
    const addition = `// ${MARKER}\nconst deliveryIntentTextV337 = normalize(text);\nconst deliveryTermsV337 = /\\b(?:entreg(?:a|as|ar|am|amos|ando|ue|ues)|frete|fretes|envi(?:o|os|ar|am|amos|ando)|motoboy|motoboys|retir(?:ada|adas|ar|am|amos|ando)|delivery)\\b/.test(deliveryIntentTextV337);\nconst explicitPaymentTermsV337 = /\\b(?:pix|cartao|credito|debito|boleto|parcelamento|dinheiro|transferencia|pagamento|pagar)\\b/.test(deliveryIntentTextV337);\nconst deterministicDeliveryIntentV337 = deliveryTermsV337 && !explicitPaymentTermsV337\n  ? { acao: 'consultar_entrega', intencao: 'entrega', confianca: 1, motivo: 'Pergunta deterministica sobre opcoes de entrega ou frete.' }\n  : null;\n`;
    if (!next.includes(anchor)) throw new Error('Resolver anchor not found');
    next = next.replace(anchor, addition + anchor);
    const oldDecision = 'deterministicStoreLocationV129 || deterministicServiceDecisionV135 || (parsed';
    if (!next.includes(oldDecision)) throw new Error('Resolver decision anchor not found');
    next = next.replace(oldDecision, 'deterministicStoreLocationV129 || deterministicServiceDecisionV135 || deterministicDeliveryIntentV337 || (parsed');
  }
  new Function('$json', '$getWorkflowStaticData', next);
  return next;
}

function patchWorkflow(nodes) {
  const classifier = nodes.find((node) => node.name === 'Agente Inicial - Classificador');
  const parse = nodes.find((node) => node.name === 'Parse Classificacao');
  const resolver = nodes.find((node) => node.name === 'Resolver Acao de Conversacao');
  if (!classifier || !parse || !resolver) throw new Error('Required routing nodes not found');
  classifier.parameters.options.systemMessage = patchClassifierMessage(classifier.parameters.options.systemMessage);
  parse.parameters.jsCode = patchParseCode(parse.parameters.jsCode);
  resolver.parameters.jsCode = patchResolverCode(resolver.parameters.jsCode);
  return { classifier, parse, resolver };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let stopped = false;
  try {
    const db = (await runRemote(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    const raw = await psql(conn, db, `COPY (SELECT encode(convert_to(json_build_object('nodes',nodes,'connections',connections,'activeVersionId',\"activeVersionId\")::text,'UTF8'),'hex') FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`);
    const workflow = JSON.parse(Buffer.from(raw.trim(), 'hex').toString('utf8'));
    const before = JSON.stringify(workflow.nodes);
    const patched = patchWorkflow(workflow.nodes);
    const result = { mode: apply ? 'apply' : 'dry-run', changed: before !== JSON.stringify(workflow.nodes), activeVersionId: workflow.activeVersionId, marker: [patched.parse, patched.resolver].every((node) => node.parameters.jsCode.includes(MARKER)), deliveryNode: workflow.nodes.some((node) => node.name === 'Entrega - Politica') };
    if (!apply) { console.log(JSON.stringify(result, null, 2)); return; }
    fs.writeFileSync(path.join('C:/tmp', `n8n-${WORKFLOW_ID}-before-${Date.now()}.json`), JSON.stringify(workflow, null, 2));
    await runRemote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null'); await waitReplicas(conn, 'n8n_n8n-runner', 0);
    await runRemote(conn, 'docker service scale n8n_n8n=0 >/dev/null'); await waitReplicas(conn, 'n8n_n8n', 0); stopped = true;
    const nodesJson = JSON.stringify(workflow.nodes);
    const update = `\\set ON_ERROR_STOP on\nBEGIN;\nUPDATE workflow_entity SET nodes=${dollar(nodesJson, 'nodes337')}::json, \"versionId\"=\"activeVersionId\", \"updatedAt\"=NOW() WHERE id=${shQuote(WORKFLOW_ID)};\nUPDATE workflow_history SET nodes=${dollar(nodesJson, 'hist337')}::json, \"updatedAt\"=NOW() WHERE \"workflowId\"=${shQuote(WORKFLOW_ID)} AND \"versionId\"=${shQuote(workflow.activeVersionId)};\nCOMMIT;\nCOPY (SELECT json_build_object('aligned',we.nodes::jsonb=wh.nodes::jsonb,'marker',we.nodes::text LIKE '%${MARKER}%')::text FROM workflow_entity we JOIN workflow_history wh ON wh.\"workflowId\"=we.id AND wh.\"versionId\"=we.\"activeVersionId\" WHERE we.id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`;
    result.verification = JSON.parse((await psql(conn, db, update)).trim());
    await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null'); await waitReplicas(conn, 'n8n_n8n', 1);
    await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null'); await waitReplicas(conn, 'n8n_n8n-runner', 1); stopped = false;
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (stopped) { await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {}); await waitReplicas(conn, 'n8n_n8n', 1).catch(() => {}); await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {}); await waitReplicas(conn, 'n8n_n8n-runner', 1).catch(() => {}); }
    conn.end();
  }
}

module.exports = { patchClassifierMessage, patchParseCode, patchResolverCode, patchWorkflow, MARKER };
if (require.main === module) main().catch((error) => { console.error(error.stack || error); process.exit(1); });
