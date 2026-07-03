const assert = require('node:assert/strict');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const NODE_NAME = 'Vendas - Verificar Pos Lista';

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function runRemote(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => (
        code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Remote command failed: ${code}`))
      ));
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
    });
  });
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig());
  });

  try {
    const dbContainer = (await runRemote(
      conn,
      "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1",
    )).trim();
    assert.ok(dbContainer, 'n8n database container must be running');

    const sql = `
COPY (
  SELECT encode(convert_to((node->'parameters'->>'jsCode'), 'UTF8'), 'hex')
  FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node
  WHERE id = ${shQuote(WORKFLOW_ID)}
    AND node->>'name' = ${shQuote(NODE_NAME)}
) TO STDOUT;
`;
    const hex = (await runRemote(
      conn,
      `docker exec -i ${shQuote(dbContainer)} psql -U postgres -d n8n -X -q -t -A <<'SQL'\n${sql}\nSQL`,
    )).trim();

    assert.ok(hex, `${NODE_NAME} must exist in active workflow`);
    const code = Buffer.from(hex, 'hex').toString('utf8');
    const definitions = code.match(/const\s+buildAllPhotoMessages\s*=/g) || [];
    assert.equal(definitions.length, 1, `${NODE_NAME} must declare buildAllPhotoMessages exactly once`);
    assert.doesNotThrow(
      () => new Function('$json', '$getWorkflowStaticData', code),
      `${NODE_NAME} code must compile before a customer message can receive a reply`,
    );
  } finally {
    conn.end();
  }
}

main()
  .then(() => console.log('active n8n sales post-list node compiles'))
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
