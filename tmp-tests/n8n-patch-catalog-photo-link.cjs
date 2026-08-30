const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const APPLY = process.argv.includes('--apply');
const MARKER = '// all-photos-catalog-link-v300';

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

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));

  try {
    const dbContainer = (await run(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    if (!dbContainer) throw new Error('Database container not found');

    const rawHex = await psql(conn, dbContainer, `
      SELECT encode(convert_to(nodes::text, 'UTF8'), 'hex')
      FROM workflow_entity
      WHERE id = ${quote(WORKFLOW_ID)};
    `);
    if (!rawHex.trim()) throw new Error('Workflow not found');

    const nodes = JSON.parse(Buffer.from(rawHex.trim(), 'hex').toString('utf8'));
    const posListNode = nodeByName(nodes, 'Vendas - Verificar Pos Lista');
    const classifierNode = nodeByName(nodes, 'Agente Inicial - Classificador');

    let posListCode = posListNode.parameters.jsCode;
    let classifierSysMessage = classifierNode.parameters.options.systemMessage;

    // 1. Patch Vendas - Verificar Pos Lista
    if (!posListCode.includes(MARKER)) {
      const targetSnippet = `if (!selectedNumber && !wantsPhoto && !wantsPhotoFromAI && !wantsProductLink && !mentionedColor) {
  return buildContinueItem();
}`;
      const replacementSnippet = `${MARKER}
const allPhotosRequestedV300 = (wantsPhoto || wantsPhotoFromAI) && !selectedNumber;
if (allPhotosRequestedV300) {
  return [{
    json: {
      ...source,
      salesPostListHandled: true,
      salesPostListStep: activeState.step,
      output: withGreeting('Temos fotos e detalhes de todos os modelos no nosso catálogo online! 😊' + lineBreak + lineBreak
        + 'Você pode ver a galeria completa de todos eles aqui:' + lineBreak
        + '🔗 https://www.mercadodovale.com.br/?categoria=Smartphones' + lineBreak + lineBreak
        + 'Ou se preferir ver por aqui mesmo, me diga o número do aparelho (de 1 a ' + activeState.options.length + ') que envio as fotos! 👍'),
    },
  }];
}

if (!selectedNumber && !wantsPhoto && !wantsPhotoFromAI && !wantsProductLink && !mentionedColor) {
  return buildContinueItem();
}`;
      if (!posListCode.includes(targetSnippet)) {
        throw new Error('Target snippet for posListCode not found');
      }
      posListCode = posListCode.replace(targetSnippet, replacementSnippet);
      posListNode.parameters.jsCode = posListCode;
      console.log('Patched Vendas - Verificar Pos Lista with all-photos link');
    }

    // 2. Patch Agente Inicial - Classificador System Message
    const classifierClarification = `- Se o cliente pedir "todos os celulares", "todos os modelos", "lista completa", "grade completa" ou "todos", use venda.tipo="categoria", venda.categoria="smartphones", venda.categoria_id="8b7c4852-c195-4527-8fd7-c3cc2debda42", venda.busca="".
- Se o cliente fizer apenas uma pergunta generica como "quais celulares tem?", "quais sao os precos dos celulares?", "tem celular?", "quais os modelos?" sem pedir todos explicitamente, pergunte qual marca/modelo ele busca ou envie o link da categoria https://www.mercadodovale.com.br/?categoria=Smartphones.
`;

    if (!classifierSysMessage.includes('https://www.mercadodovale.com.br/?categoria=Smartphones')) {
      const oldRule = `- Se o cliente pede celulares/smartphones/aparelhos de forma geral, use venda.tipo="categoria", venda.categoria="smartphones", venda.categoria_id="8b7c4852-c195-4527-8fd7-c3cc2debda42", venda.busca="".`;
      if (classifierSysMessage.includes(oldRule)) {
        classifierSysMessage = classifierSysMessage.replace(oldRule, classifierClarification.trim());
        classifierNode.parameters.options.systemMessage = classifierSysMessage;
        console.log('Patched Agente Inicial - Classificador systemMessage');
      }
    }

    if (!APPLY) {
      console.log('DRY RUN successful. Run with --apply to commit to n8n database and reload service.');
      return;
    }

    const updatedNodesJson = JSON.stringify(nodes);
    const updateSql = `
UPDATE workflow_entity
SET nodes = ${dollar(updatedNodesJson, 'NODES')}::json,
    "updatedAt" = NOW()
WHERE id = ${quote(WORKFLOW_ID)};
`;
    await psql(conn, dbContainer, updateSql);
    console.log('Updated workflow in n8n database');

    console.log('Restarting n8n service to apply changes...');
    await run(conn, 'docker service update --force n8n_n8n');
    await waitService(conn, 'n8n_n8n', 1);
    console.log('n8n service restarted and healthy (1/1 replicas)');
  } finally {
    conn.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
