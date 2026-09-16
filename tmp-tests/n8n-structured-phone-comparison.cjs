const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const APPLY = process.argv.includes('--apply');
const MARKER = '// structured-phone-comparison-v365';

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
  return new Promise((resolve, reject) => conn.exec(`docker exec -i ${quote(db)} psql -U postgres -d n8n -X -q -t -A -v ON_ERROR_STOP=1`, (error, stream) => {
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
function replaceRequired(code, search, replacement, label) {
  if (!code.includes(search)) throw new Error(`${label} anchor not found`);
  return code.replace(search, replacement);
}

const impliedRamParsers = `${MARKER}:implied-ram
  working = working.replace(/\\b(\\d{1,2})\\s*(?:de\\s*)?(?:ram|memoria\\s+ram)\\b/gi, (matched, ramValue) => {
    const ramGb = capacityToGb(ramValue, 'gb');
    if (ramGb && ramGb <= 24) ram.add(ramGb);
    return mask(matched);
  });
  working = working.replace(/\\b(?:ram|memoria\\s+ram)\\s*(?:de|com)?\\s*(\\d{1,2})\\b/gi, (matched, ramValue) => {
    const ramGb = capacityToGb(ramValue, 'gb');
    if (ramGb && ramGb <= 24) ram.add(ramGb);
    return mask(matched);
  });`;

const familyParser = `${MARKER}:family
const genericFilterTokensV365 = new Set(['qualquer', 'contanto', 'contando', 'portanto', 'portando', 'que', 'qui', 'seja', 'ram', 'memoria', 'gb', 'g']);
const modelTokens = tokens.filter((token) => !genericPhoneWords.has(token)
  && !brandAliasesForModel.includes(token)
  && !genericFilterTokensV365.has(token)
  && !/^\\d+$/.test(token));
const requestedDeviceFamilyV365 = (() => {
  const requestText = normalize([rawText, classifiedSearchQuery].filter(Boolean).join(' '));
  if (/\\bpoco\\b/.test(requestText)) return 'poco';
  if (/\\bredmi\\b/.test(requestText)) return 'redmi';
  if (/\\bgalaxy\\b/.test(requestText)) return 'galaxy';
  if (/\\bmoto\\b/.test(requestText)) return 'moto';
  return '';
})();`;

function patchPrepareSearch(nodes) {
  const node = nodeByName(nodes, 'Vendas - Preparar Busca');
  let code = String(node.parameters?.jsCode || '');
  if (code.includes(MARKER)) return;
  code = replaceRequired(
    code,
    `  let working = String(rawText || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();`,
    `  ${MARKER}:classifier-continuation\n  let working = [rawText, classifiedSearchQuery].filter(Boolean).join(' ').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();`,
    'memory source',
  );
  const ramAnchor = `  collect(/\\b(?:ram|memoria\\s+ram)\\s*(?:de|com)?\\s*(\\d{1,3})\\s*(gb|g)\\b/gi, ram);`;
  code = replaceRequired(code, ramAnchor, `${ramAnchor}\n${impliedRamParsers}`, 'RAM parser');
  code = replaceRequired(
    code,
    `const phoneMemoryFilterRequest = (explicitPhoneDeviceRequest || phoneNfcFilterRequestV228 || phone5gFilterRequestV338)`,
    `const phoneMemoryFilterRequest = (explicitPhoneDeviceRequest || requestedDeviceBrand || phoneNfcFilterRequestV228 || phone5gFilterRequestV338)`,
    'brand memory filter',
  );
  code = replaceRequired(
    code,
    `const modelTokens = tokens.filter((token) => !genericPhoneWords.has(token) && !brandAliasesForModel.includes(token));`,
    familyParser,
    'generic model tokens',
  );
  code = replaceRequired(code, `    requestedDeviceBrand,\n`, `    requestedDeviceBrand,\n    requestedDeviceFamily: requestedDeviceFamilyV365,\n`, 'family output');
  new Function(code);
  node.parameters.jsCode = code;
}

const featureSummaryRuntime = `${MARKER}:format
const structuredPhoneComparisonV365 = Boolean(prefersSmartphones && hasStructuredPreferenceV288 && products.length > 0 && !structuredFilterFallbackV1);
const formatDecimalPtBrV365 = (value) => Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const buildFeatureSummaryV365 = (product) => {
  if (!structuredPhoneComparisonV365 || !isQuoteDeviceProduct(product)) return '';
  const facts = product.verifiedSalesFacts || {};
  const displayType = String(facts.displayType || '').match(/AMOLED|OLED|IPS\\s*LCD|LCD/i)?.[0] || '';
  const screen = facts.screenInches
    ? 'tela' + (displayType ? ' ' + displayType.toUpperCase().replace(/IPS\\s*LCD/i, 'IPS LCD') : '') + ' de ' + formatDecimalPtBrV365(facts.screenInches) + '”'
    : (displayType ? 'tela ' + displayType.toUpperCase().replace(/IPS\\s*LCD/i, 'IPS LCD') : '');
  const battery = facts.batteryMah ? 'bateria de ' + Number(facts.batteryMah).toLocaleString('pt-BR') + ' mAh' : '';
  const camera = facts.mainCameraMp ? 'câmera de ' + Number(facts.mainCameraMp).toLocaleString('pt-BR') + ' MP' : '';
  const chargingWatts = String(facts.charging || '').match(/\\d+(?:[.,]\\d+)?\\s*W/i)?.[0]?.replace(/\\s+/g, ' ') || '';
  const charging = chargingWatts ? 'carregamento de ' + chargingWatts.replace(/\\s*w$/i, ' W') : '';
  const strongResistance = /\\bIP(?:6[789]|[789]\\d)\\b/i.test(String(facts.resistance || ''))
    ? 'resistência ' + String(facts.resistance).match(/\\bIP\\d{2}\\b/i)?.[0].toUpperCase()
    : '';
  const selected = [screen, battery, camera, charging].filter(Boolean).slice(0, 4);
  if (strongResistance) {
    if (selected.length >= 4) selected.splice(2, 1);
    selected.push(strongResistance);
  }
  if (!selected.length) return '';
  if (selected.length === 1) return '✨ ' + selected[0].charAt(0).toUpperCase() + selected[0].slice(1) + '.';
  return '✨ ' + selected.slice(0, -1).join(', ').replace(/^./, (letter) => letter.toUpperCase()) + ' e ' + selected.at(-1) + '.';
};`;

function patchProductContext(nodes) {
  const node = nodeByName(nodes, 'Vendas - Contexto Produtos');
  let code = String(node.parameters?.jsCode || '');
  if (code.includes(MARKER)) return;
  code = replaceRequired(
    code,
    `const requestedDeviceBrandLabel = String(base.requestedDeviceBrandLabel || requestedDeviceBrand || '').trim();`,
    `const requestedDeviceBrandLabel = String(base.requestedDeviceBrandLabel || requestedDeviceBrand || '').trim();\nconst requestedDeviceFamilyV365 = String(base.requestedDeviceFamily || '').trim();`,
    'context family',
  );
  code = replaceRequired(
    code,
    `const productMatchesRequestedBrand = (product) => {\n  if (!requestedDeviceBrand) return false;`,
    `const productMatchesRequestedBrand = (product) => {\n  if (!requestedDeviceBrand) return false;\n  if (requestedDeviceFamilyV365) {\n    const familyText = normalize([product.name, product.originalName].filter(Boolean).join(' '));\n    return new RegExp('\\\\b' + requestedDeviceFamilyV365 + '\\\\b').test(familyText);\n  }`,
    'family product filter',
  );
  code = replaceRequired(code, `const buildQuoteMessageForProducts = (chunk, offset, includeHeader, includeQuestion) => {`, `${featureSummaryRuntime}\nconst buildQuoteMessageForProducts = (chunk, offset, includeHeader, includeQuestion) => {`, 'quote formatter');
  code = replaceRequired(
    code,
    `    chunkLines.push((offset + index + 1) + '. ' + product.name);`,
    `    chunkLines.push((offset + index + 1) + '. ' + product.name);\n    const featureSummaryV365 = buildFeatureSummaryV365(product);\n    if (featureSummaryV365) chunkLines.push('   ' + featureSummaryV365);`,
    'feature line',
  );
  code = replaceRequired(code, `    productLookupCount: products.length,\n`, `    productLookupCount: products.length,\n    structuredPhoneComparison: structuredPhoneComparisonV365,\n`, 'comparison output');
  new Function(code);
  node.parameters.jsCode = code;
}

function patchComposer(nodes) {
  const node = nodeByName(nodes, 'Vendas - Compor Resposta IA');
  let code = String(node.parameters?.jsCode || '');
  if (code.includes(MARKER)) return;
  code = replaceRequired(
    code,
    `const catalogOutput = String(source.deterministicCatalogOutput || '').trim();`,
    `const catalogOutput = String(source.deterministicCatalogOutput || '').trim();\n${MARKER}:composer\nconst structuredCatalogOnlyV365 = source.structuredPhoneComparison === true && Boolean(catalogOutput);`,
    'composer flag',
  );
  code = replaceRequired(
    code,
    `    output: [aiOutput, catalogOutput].filter(Boolean).join('[[MSG]]'),`,
    `    output: structuredCatalogOnlyV365 ? catalogOutput : [aiOutput, catalogOutput].filter(Boolean).join('[[MSG]]'),`,
    'composer output',
  );
  new Function(code);
  node.parameters.jsCode = code;
}

function patchWorkflow(nodes) {
  patchPrepareSearch(nodes);
  patchProductContext(nodes);
  patchComposer(nodes);
  return nodes;
}

function summarize(nodes) {
  const prepare = nodeByName(nodes, 'Vendas - Preparar Busca').parameters.jsCode;
  const context = nodeByName(nodes, 'Vendas - Contexto Produtos').parameters.jsCode;
  const composer = nodeByName(nodes, 'Vendas - Compor Resposta IA').parameters.jsCode;
  return {
    markerPresent: [prepare, context, composer].every((code) => code.includes(MARKER)),
    impliedRamParsed: prepare.includes(':implied-ram') && prepare.includes("capacityToGb(ramValue, 'gb')"),
    classifierContinuationParsed: prepare.includes('[rawText, classifiedSearchQuery]'),
    familyFilterPresent: prepare.includes("return 'poco'") && context.includes('requestedDeviceFamilyV365'),
    genericPreferenceNotModel: prepare.includes('genericFilterTokensV365') && prepare.includes("!/^\\d+$/.test(token)"),
    structuredFeatureLinePresent: context.includes('buildFeatureSummaryV365') && context.includes('structuredPhoneComparisonV365'),
    officialPriceFieldsPreserved: context.includes("à vista no PIX") && context.includes("Cartão: 12x de ") && context.includes("🎨 Cores: "),
    aiEssaySuppressed: composer.includes('structuredCatalogOnlyV365 ? catalogOutput'),
  };
}

async function serviceMap(conn) {
  const output = await run(conn, "docker service ls --filter name=n8n --format '{{.Name}} {{.Replicas}}'");
  return Object.fromEntries(output.trim().split(/\r?\n/).filter(Boolean).map((line) => line.trim().split(/\s+/)));
}

async function main() {
  const { Client } = require('ssh2');
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
    if (!Object.values(summary).every(Boolean)) throw new Error(`Validation failed: ${JSON.stringify(summary)}`);
    if (!APPLY) return console.log(JSON.stringify({ apply: false, ...summary }, null, 2));

    await run(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 0);
    await run(conn, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitService(conn, 'n8n_n8n', 0);
    servicesStopped = true;

    const sql = `\\set ON_ERROR_STOP on
BEGIN;
UPDATE workflow_entity SET nodes=${dollar(JSON.stringify(nodes), 'nodes')}::json, connections=${dollar(JSON.stringify(connections), 'connections')}::json, "versionId"="activeVersionId", "updatedAt"=NOW() WHERE id=${quote(WORKFLOW_ID)};
UPDATE workflow_history SET nodes=${dollar(JSON.stringify(nodes), 'hnodes')}::json, connections=${dollar(JSON.stringify(connections), 'hconnections')}::json, "updatedAt"=NOW() WHERE "workflowId"=${quote(WORKFLOW_ID)} AND "versionId"=${quote(entity.activeVersionId)};
COPY (SELECT json_build_object(
  'entityHistoryEqual', we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb,
  'markerPresent', we.nodes::text LIKE '%structured-phone-comparison-v365%',
  'impliedRamParsed', we.nodes::text LIKE '%structured-phone-comparison-v365:implied-ram%',
  'familyFilterPresent', we.nodes::text LIKE '%requestedDeviceFamilyV365%',
  'featureSummaryPresent', we.nodes::text LIKE '%buildFeatureSummaryV365%',
  'aiEssaySuppressed', we.nodes::text LIKE '%structuredCatalogOnlyV365 ? catalogOutput%'
)::text FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;
COMMIT;`;
    const result = JSON.parse((await psql(conn, db, sql)).trim());
    await run(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(conn, 'n8n_n8n', 1);
    await run(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 1);
    servicesStopped = false;
    const services = await serviceMap(conn);
    console.log(JSON.stringify({ apply: true, ...result, ...summary, services: { n8n: services.n8n_n8n, runner: services['n8n_n8n-runner'], evolution: services['n8n_evolution-api'] } }, null, 2));
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

module.exports = { MARKER, patchPrepareSearch, patchProductContext, patchComposer, patchWorkflow, summarize, main };
if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
