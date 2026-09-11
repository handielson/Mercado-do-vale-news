const assert = require('node:assert/strict');
const vm = require('node:vm');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const SMARTPHONES_CATEGORY_ID = '8b7c4852-c195-4527-8fd7-c3cc2debda42';
const MARKER = 'sales-model-template-facts-source-v2';
const APPLY = process.argv.includes('--apply');
const shQuote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

function run(connection, command) {
  return new Promise((resolve, reject) => connection.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0
      ? resolve(stdout)
      : reject(new Error(stderr || stdout || `remote command failed: ${code}`)));
  }));
}

function psql(connection, container, sql) {
  return new Promise((resolve, reject) => {
    connection.exec(`docker exec -i ${shQuote(container)} psql -U postgres -d n8n -X -q -t -A -v ON_ERROR_STOP=1`, (error, stream) => {
      if (error) return reject(error);
      let stdout = '';
      let stderr = '';
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.on('close', (code) => code === 0
        ? resolve(stdout)
        : reject(new Error(stderr || stdout || `psql failed: ${code}`)));
      stream.end(sql);
    });
  });
}

async function waitService(connection, service, expected, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const replicas = (await run(connection, `docker service ls --filter name=${shQuote(service)} --format '{{.Replicas}}' | head -n 1`)).trim();
    if (replicas === `${expected}/${expected}`) return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service} did not reach ${expected}/${expected}`);
}

function findNode(nodes, name) {
  const node = nodes.find((item) => item.name === name);
  assert.ok(node, `Node not found: ${name}`);
  return node;
}

function patchProductLookup(node) {
  const parameters = node.parameters?.queryParameters?.parameters;
  assert.ok(Array.isArray(parameters), 'Product lookup query parameters are missing');
  const existing = parameters.find((parameter) => parameter.name === 'include_model_specs');
  if (existing) {
    existing.value = 'true';
    return;
  }
  parameters.push({ name: 'include_model_specs', value: 'true' });
}

function patchProductContext(node) {
  let code = String(node.parameters?.jsCode || '');
  if (code.includes(MARKER)) return;
  const oldSource = "    const specsV1 = product?.specs && typeof product.specs === 'object' && !Array.isArray(product.specs) ? product.specs : {};";
  const newSource = `    // ${MARKER}
    // Fatos comuns do aparelho pertencem ao modelo. A ficha da variacao fica
    // restrita a preco, estoque, memoria, cor e outros dados da unidade comercial.
    const modelSpecsV2 = product?.model_template_values && typeof product.model_template_values === 'object' && !Array.isArray(product.model_template_values)
      ? product.model_template_values : {};
    const variationSpecsV2 = product?.specs && typeof product.specs === 'object' && !Array.isArray(product.specs)
      ? product.specs : {};
    const specsV1 = Object.keys(modelSpecsV2).length > 0 ? modelSpecsV2 : variationSpecsV2;`;
  assert.ok(code.includes(oldSource), 'Product facts source anchor not found');
  code = code.replace(oldSource, newSource);
  new Function('$json', '$input', '$getWorkflowStaticData', '$', code);
  node.parameters.jsCode = code;
}

function patchSalesAgent(node) {
  const options = node.parameters.options || (node.parameters.options = {});
  const prompt = String(options.systemMessage || '');
  if (prompt.includes(`${MARKER}:agent`)) return;
  options.systemMessage = `${prompt}\n- As Caracteristicas confirmadas comuns ao aparelho vêm do cadastro do modelo, que prevalece sobre fichas antigas de variacoes. Nunca apresente capacidades diferentes para variacoes de RAM ou armazenamento ligadas ao mesmo modelo. // ${MARKER}:agent`;
}

function patchWorkflow(workflow) {
  patchProductLookup(findNode(workflow.nodes, 'Vendas - Buscar Produtos'));
  patchProductContext(findNode(workflow.nodes, 'Vendas - Contexto Produtos'));
  patchSalesAgent(findNode(workflow.nodes, 'Especialista - Vendas'));
  return workflow;
}

async function validate(workflow) {
  const lookup = findNode(workflow.nodes, 'Vendas - Buscar Produtos');
  const modelFlag = lookup.parameters.queryParameters.parameters.find((parameter) => parameter.name === 'include_model_specs');
  assert.equal(modelFlag?.value, 'true');

  const contextCode = findNode(workflow.nodes, 'Vendas - Contexto Produtos').parameters.jsCode;
  const modelFacts = {
    battery_mah: 6000,
    cam_principal_mpx: "50MP (OIS, f/1.5, 1/1.95'')",
    tipo_de_display: 'AMOLED',
    carregamento: '90W HyperCharge',
    celular_fps_display: '120',
  };
  const baseProduct = {
    model_id: 'model-poco-x7-pro',
    category_id: SMARTPHONES_CATEGORY_ID,
    brand: 'Poco',
    name: 'Poco X7 Pro 5G',
    status: 'active',
    stock_quantity: 1,
    price_retail: 250000,
    slug: 'poco-x7-pro',
    model_template_values: modelFacts,
  };
  const products = [
    {
      ...baseProduct,
      id: 'variation-8-256',
      sku: 'X7P8256',
      specs: { ram: '8GB', storage: '256GB', battery_mah: 5000, carregamento: '67W', cam_principal_mpx: '64MP' },
    },
    {
      ...baseProduct,
      id: 'variation-12-256',
      sku: 'X7P12256',
      specs: { ram: '12GB', storage: '256GB', battery_mah: 6000, carregamento: '90W', cam_principal_mpx: '50MP' },
    },
  ];
  const source = {
    remoteJid: '559999999999@s.whatsapp.net',
    Instancia: 'botmercadodovale',
    conversation: 'quero um celular com bateria boa',
    productSearchTerm: '',
    productCategoryId: SMARTPHONES_CATEGORY_ID,
    productCategoryName: 'Smartphones',
    specificDeviceModelRequest: false,
    requestedDeviceModelQuery: '',
    salesRequestKind: 'busca',
    salesSearchQuery: '',
    salesFilters: {},
  };
  const selectors = {
    'Vendas - Preparar Busca': { first: () => ({ json: source }) },
    'Vendas - Buscar Produtos': { all: () => products.map((json) => ({ json })) },
    'switc Mensagens': { first: () => ({ json: source }) },
  };
  const result = vm.runInNewContext(`(function(){${contextCode}})()`, {
    $input: { all: () => [] },
    $getWorkflowStaticData: () => ({}),
    $: (name) => selectors[name] || { first: () => ({ json: {} }), all: () => [] },
    Date,
    Intl,
  })[0].json;
  const facts = result.productsInStock.map((product) => product.verifiedSalesFacts);
  assert.ok(facts.length >= 2, 'Expected both X7 Pro memory variations');
  assert.ok(facts.every((item) => item.batteryMah === 6000));
  assert.ok(facts.every((item) => item.mainCameraMp === 50));
  assert.ok(facts.every((item) => item.charging === '90W HyperCharge'));
  assert.doesNotMatch(result.productsContext, /Bateria: 5000mAh|Camera principal: 64MP|Carregamento: 67W/);
  assert.match(result.productsContext, /Bateria: 6000mAh/);
  assert.ok(findNode(workflow.nodes, 'Especialista - Vendas').parameters.options.systemMessage.includes(`${MARKER}:agent`));
  return {
    modelSourcePreferred: true,
    variationConflictSuppressed: true,
    expectedBatteryMah: 6000,
    expectedCharging: '90W HyperCharge',
    expectedMainCameraMp: 50,
  };
}

async function verifyApiReady() {
  const url = `https://api.xiaomipetrolina.com.br/products?category=${SMARTPHONES_CATEGORY_ID}&status=active&compact=true&limit=20&include_model_specs=true`;
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  assert.equal(response.ok, true, `Products API readiness failed: ${response.status}`);
  const products = await response.json();
  assert.ok(products.some((product) => product.model_id && product.model_template_values && Object.keys(product.model_template_values).length > 0), 'Products API is not exposing model_template_values yet');
}

async function main() {
  const connection = new Client();
  await new Promise((resolve, reject) => connection.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let servicesStopped = false;
  try {
    const dbContainer = (await run(connection, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    assert.ok(dbContainer, 'n8n Postgres container not found');
    const readSql = `COPY (
      SELECT encode(convert_to(json_build_object(
        'nodes', nodes::jsonb,
        'connections', connections::jsonb,
        'activeVersionId', "activeVersionId",
        'versionId', "versionId",
        'active', active
      )::text, 'UTF8'), 'hex')
      FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}
    ) TO STDOUT;`;
    const hex = (await psql(connection, dbContainer, readSql)).trim();
    const workflow = JSON.parse(Buffer.from(hex, 'hex').toString('utf8'));
    assert.equal(workflow.active, true);
    assert.equal(workflow.versionId, workflow.activeVersionId);
    const alreadyActive = JSON.stringify(workflow.nodes).includes(MARKER);
    patchWorkflow(workflow);
    const validation = await validate(workflow);
    if (!APPLY) {
      console.log(JSON.stringify({ apply: false, workflowId: WORKFLOW_ID, marker: MARKER, alreadyActive, validation }, null, 2));
      return;
    }

    await verifyApiReady();
    const activeSql = `COPY (SELECT count(*) FROM execution_entity WHERE "workflowId"=${shQuote(WORKFLOW_ID)} AND status IN ('new','running')) TO STDOUT;`;
    assert.equal(Number((await psql(connection, dbContainer, activeSql)).trim()), 0, 'workflow has active executions');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `/root/n8n-backups/${WORKFLOW_ID}-before-${MARKER}-${timestamp}.json`;
    await run(connection, 'mkdir -p /root/n8n-backups');
    const backupSql = `COPY (
      SELECT json_build_object('workflow', row_to_json(workflow), 'activeHistory', row_to_json(history))::text
      FROM workflow_entity workflow
      LEFT JOIN workflow_history history ON history."workflowId"=workflow.id AND history."versionId"=workflow."activeVersionId"
      WHERE workflow.id=${shQuote(WORKFLOW_ID)}
    ) TO STDOUT;`;
    const backup = await psql(connection, dbContainer, backupSql);
    await new Promise((resolve, reject) => connection.sftp((error, sftp) => {
      if (error) return reject(error);
      sftp.writeFile(backupPath, Buffer.from(backup, 'utf8'), (writeError) => {
        sftp.end();
        writeError ? reject(writeError) : resolve();
      });
    }));

    await run(connection, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitService(connection, 'n8n_n8n-runner', 0);
    await run(connection, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitService(connection, 'n8n_n8n', 0);
    servicesStopped = true;
    assert.equal(Number((await psql(connection, dbContainer, activeSql)).trim()), 0);

    const nodesPath = `/tmp/${WORKFLOW_ID}-${MARKER}-${timestamp}-nodes.json`;
    await new Promise((resolve, reject) => connection.sftp((error, sftp) => {
      if (error) return reject(error);
      sftp.writeFile(nodesPath, Buffer.from(JSON.stringify(workflow.nodes), 'utf8'), (writeError) => {
        sftp.end();
        writeError ? reject(writeError) : resolve();
      });
    }));
    await run(connection, `docker cp ${shQuote(nodesPath)} ${shQuote(dbContainer)}:${shQuote(nodesPath)}`);
    try {
      await psql(connection, dbContainer, `BEGIN;
        UPDATE workflow_entity SET nodes=pg_read_file('${nodesPath}')::json, "versionId"="activeVersionId", "updatedAt"=NOW() WHERE id=${shQuote(WORKFLOW_ID)};
        UPDATE workflow_history SET nodes=pg_read_file('${nodesPath}')::json, "updatedAt"=NOW() WHERE "workflowId"=${shQuote(WORKFLOW_ID)} AND "versionId"=${shQuote(workflow.activeVersionId)};
        COMMIT;`);
    } finally {
      await run(connection, `rm -f ${shQuote(nodesPath)}`).catch(() => {});
      await run(connection, `docker exec ${shQuote(dbContainer)} rm -f ${shQuote(nodesPath)}`).catch(() => {});
    }

    await run(connection, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(connection, 'n8n_n8n', 1);
    await run(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(connection, 'n8n_n8n-runner', 1);
    servicesStopped = false;

    const verifySql = `COPY (
      SELECT json_build_object(
        'active', workflow.active,
        'versionAligned', workflow."versionId"=workflow."activeVersionId",
        'entityHistoryEqual', workflow.nodes::jsonb=history.nodes::jsonb,
        'marker', workflow.nodes::text LIKE '%${MARKER}%',
        'apiFlag', workflow.nodes::text LIKE '%include_model_specs%'
      )::text
      FROM workflow_entity workflow
      JOIN workflow_history history ON history."workflowId"=workflow.id AND history."versionId"=workflow."activeVersionId"
      WHERE workflow.id=${shQuote(WORKFLOW_ID)}
    ) TO STDOUT;`;
    const verification = JSON.parse((await psql(connection, dbContainer, verifySql)).trim());
    assert.deepEqual(verification, { active: true, versionAligned: true, entityHistoryEqual: true, marker: true, apiFlag: true });
    console.log(JSON.stringify({ apply: true, workflowId: WORKFLOW_ID, marker: MARKER, backupPath, validation, verification }, null, 2));
  } finally {
    if (servicesStopped) {
      await run(connection, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await waitService(connection, 'n8n_n8n', 1).catch(() => {});
      await run(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
      await waitService(connection, 'n8n_n8n-runner', 1).catch(() => {});
    }
    connection.end();
  }
}

module.exports = { MARKER, patchProductLookup, patchProductContext, patchSalesAgent, patchWorkflow, validate };
if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
