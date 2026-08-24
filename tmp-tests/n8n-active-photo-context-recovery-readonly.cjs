const assert = require('node:assert/strict');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');
const { patchPostList, PHOTO_CONTEXT_RECOVERY_MARKER } = require('./n8n-fix-model-color-photo-fallback.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const NODE_NAME = 'Vendas - Verificar Pos Lista';
const IMAGE_URL = 'https://api.xiaomipetrolina.com.br/images/model-color/model/color/photo.jpg';

const quote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

function run(connection, command) {
  return new Promise((resolve, reject) => connection.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `remote command failed: ${code}`)));
  }));
}

async function main() {
  const connection = new Client();
  await new Promise((resolve, reject) => connection.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  try {
    const database = (await run(connection, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    assert.ok(database, 'n8n database container must exist');
    const sql = `COPY (
      SELECT encode(convert_to(node->'parameters'->>'jsCode', 'UTF8'), 'hex')
      FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node
      WHERE id = ${quote(WORKFLOW_ID)} AND node->>'name' = ${quote(NODE_NAME)}
    ) TO STDOUT;`;
    const codeHex = (await run(connection, `docker exec ${quote(database)} psql -U postgres -d n8n -X -q -t -A -c ${quote(sql)}`)).trim();
    const patchedCode = patchPostList(Buffer.from(codeHex, 'hex').toString('utf8'));
    assert.match(patchedCode, new RegExp(PHOTO_CONTEXT_RECOVERY_MARKER));

    const execute = async (json, mockHttpRequest) => new Function(
      '$json', '$input', '$getWorkflowStaticData', '$', '$env', 'helpers',
      patchedCode,
    )(
      json,
      {},
      () => ({}),
      () => ({ first: () => ({ json: {} }), all: () => [] }),
      {},
      { httpRequest: mockHttpRequest },
    );

    const queryCalls = [];
    const product = {
      id: 'product-1', name: 'Wp58 Pró', sku: 'W58P24816512L',
      slug: 'wp58-pro-24gb-8-16-512gb-laranja-w58p24816512l',
      specs: { color: 'Laranja', keywords: ['wp58 pro'] },
      images: [], resolved_images: [IMAGE_URL], model_color_images: [IMAGE_URL],
    };
    const byQuery = await execute({
      remoteJid: 'fixture@s.whatsapp.net', conversation: 'tem foto e video dele?',
      salesSearchQuery: 'wp58 pro laranja', salesFlowColor: 'laranja',
      salesFlowAction: 'pergunta_sobre_item', salesFlowItemNumber: 36,
    }, async (options) => { queryCalls.push(options); return [product]; });
    assert.equal(queryCalls.length, 1);
    assert.match(queryCalls[0].url, /search=wp58%20pro$/);
    assert.equal(byQuery[0].json.salesPostListStep, 'photo_recovered_without_list');
    assert.equal(byQuery[0].json.messages[0].type, 'image');

    const skuCalls = [];
    const byFollowupNumber = await execute({
      remoteJid: 'fixture@s.whatsapp.net', conversation: '36',
      salesFlowAction: 'pedir_foto', salesFlowItemNumber: 36,
      recentMessages: [
        { direction: 'outbound', text: 'https://mercadodovale.com.br/produto/wp58-pro-24gb-8-16-512gb-laranja-w58p24816512l' },
        { direction: 'outbound', text: 'Consigo mandar. Me confirma o numero do item.' },
      ],
    }, async (options) => { skuCalls.push(options); return [product]; });
    assert.match(skuCalls[0].url, /sku=W58P24816512L$/);
    assert.equal(byFollowupNumber[0].json.messages[0].mediaUrl, IMAGE_URL);
  } finally {
    connection.end();
  }
}

main()
  .then(() => console.log('active n8n missing-list photo recovery simulation OK'))
  .catch((error) => { console.error(error.stack || error.message); process.exit(1); });
