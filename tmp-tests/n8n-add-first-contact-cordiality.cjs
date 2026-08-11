const path = require('node:path');
const { Client } = require('ssh2');
for (const root of [path.join(__dirname, '..'), path.join(__dirname, '..', '..', '..', 'mercado-do-vale')]) {
  require('dotenv').config({ path: path.join(root, '.env.vps.local'), quiet: true });
  require('dotenv').config({ path: path.join(root, '.env.local'), quiet: true });
}
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');
const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const MARKER = 'first-contact-cordiality-v227';
const APPLY = process.argv.includes('--apply');
function quote(value) { return `'${String(value).replace(/'/g, `'\\''`)}'`; }
function run(conn, command) { return new Promise((resolve, reject) => conn.exec(command, (error, stream) => { if (error) return reject(error); let out=''; let err=''; stream.on('data',(c)=>out+=c); stream.stderr.on('data',(c)=>err+=c); stream.on('close',(code)=>code===0?resolve(out):reject(new Error(err||out||String(code)))); })); }
function put(conn, remotePath, value) { return new Promise((resolve, reject) => conn.sftp((error, sftp) => { if (error) return reject(error); sftp.writeFile(remotePath, Buffer.from(value, 'utf8'), (writeError) => { sftp.end(); writeError ? reject(writeError) : resolve(); }); })); }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitService(conn, name, desired) { for (let i=0;i<72;i+=1) { const value=(await run(conn, `docker service ls --filter name=${quote(name)} --format '{{.Replicas}}' | head -n 1`)).trim(); if(value===`${desired}/${desired}`) return; await sleep(2500); } throw new Error(`timeout ${name}`); }
function byName(nodes, name) { const node=nodes.find((item)=>item.name===name); if(!node) throw new Error(`${name} not found`); return node; }

function patchWorkflow(nodes) {
  const parse = byName(nodes, 'Parse Classificacao');
  let parseCode = String(parse.parameters?.jsCode || '');
  if (!parseCode.includes(MARKER)) {
    const field = 'saudacaoDetectada: parsed.saudacao_detectada === true || currentStartsWithGreetingV160 || inheritedRapidGreetingV160,';
    if (!parseCode.includes(field)) throw new Error('greeting field not found');
    const firstGreeting = `// ${MARKER}\nconst firstConversationGreetingV227 = latestOutboundAtV160 === 0\n  || (Date.now() - latestOutboundAtV160) >= 6 * 60 * 60 * 1000;\n`;
    const returnAnchor = 'return [{\n  json: {';
    if (!parseCode.includes(returnAnchor)) throw new Error('parse return anchor not found');
    parseCode = parseCode.replace(returnAnchor, `${firstGreeting}${returnAnchor}`);
    parseCode = parseCode.replace(field, 'saudacaoDetectada: parsed.saudacao_detectada === true || currentStartsWithGreetingV160 || inheritedRapidGreetingV160 || firstConversationGreetingV227,');
  }
  new Function(parseCode);
  parse.parameters.jsCode = parseCode;

  const product = byName(nodes, 'Vendas - Contexto Produtos');
  let productCode = String(product.parameters?.jsCode || '');
  if (!productCode.includes(MARKER)) {
    const productsLine = 'const products = mergeQuoteProducts(rawProducts);';
    if (!productCode.includes(productsLine)) throw new Error('merged products line not found');
    const brandGrouping = `// ${MARKER}\nconst quoteBrandGroupV227 = (product) => {\n  const text = normalize([product?.name, product?.brand].filter(Boolean).join(' '));\n  if (/\\bpoco\\b/.test(text)) return { label: 'POCO', rank: 2 };\n  if (/\\b(?:redmi|xiaomi)\\b/.test(text)) return { label: 'Xiaomi / Redmi', rank: 1 };\n  if (/\\b(?:iphone|apple)\\b/.test(text)) return { label: 'Apple / iPhone', rank: 3 };\n  if (/\\b(?:samsung|galaxy)\\b/.test(text)) return { label: 'Samsung', rank: 4 };\n  if (/\\b(?:motorola|moto)\\b/.test(text)) return { label: 'Motorola', rank: 5 };\n  if (/\\brealme\\b/.test(text)) return { label: 'Realme', rank: 6 };\n  if (/\\binfinix\\b/.test(text)) return { label: 'Infinix', rank: 7 };\n  const label = String(product?.brand || 'Outras marcas').trim() || 'Outras marcas';\n  return { label, rank: 50 };\n};\nconst products = mergeQuoteProducts(rawProducts).sort((a, b) => {\n  if (!prefersSmartphones) return 0;\n  const ga = quoteBrandGroupV227(a);\n  const gb = quoteBrandGroupV227(b);\n  return ga.rank - gb.rank || ga.label.localeCompare(gb.label, 'pt-BR') || toNumber(a.priceCents) - toNumber(b.priceCents);\n});`;
    productCode = productCode.replace(productsLine, brandGrouping);
    const loopAnchor = /chunk\.forEach\(\(product, index\) => \{/;
    const groupedLoop = `chunk.forEach((product, index) => {\n      const currentBrandV227 = quoteBrandGroupV227(product);\n      const previousBrandV227 = index > 0 ? quoteBrandGroupV227(chunk[index - 1]) : null;\n      if (prefersSmartphones && (!previousBrandV227 || previousBrandV227.label !== currentBrandV227.label)) {\n        chunkLines.push('🏷️ *' + currentBrandV227.label + '*');\n      }`;
    if (!loopAnchor.test(productCode)) throw new Error('quote loop anchor not found');
    productCode = productCode.replace(loopAnchor, groupedLoop);
    const output = "output: [String(base.metaSmartphoneCatalogIntro || '').trim(), greetingLine, smartwatchAvailabilityIntroV162, unavailableDeviceIntroMessage, ...finalQuoteMessages].filter(Boolean).join('[[MSG]]'),";
    if (!productCode.includes(output)) throw new Error('product output not found');
    const intro = `// ${MARKER}\nconst cordialCatalogIntroV227 = greetingLine\n  ? 'Vou atualizar as opções disponíveis para você e já envio a lista. Só um momento! 📱✨'\n  : String(base.metaSmartphoneCatalogIntro || '').trim();\n`;
    const returnAnchor = '\nreturn [{\n  json: {';
    if (!productCode.includes(returnAnchor)) throw new Error('product return anchor not found');
    productCode = productCode.replace(returnAnchor, `\n${intro}${returnAnchor}`);
    productCode = productCode.replace(output, "output: [greetingLine, cordialCatalogIntroV227, smartwatchAvailabilityIntroV162, unavailableDeviceIntroMessage, ...finalQuoteMessages].filter(Boolean).join('[[MSG]]'),");
  }
  new Function(productCode);
  product.parameters.jsCode = productCode;

  const policy = `\n\nCORDIALIDADE NA PRIMEIRA RESPOSTA (${MARKER}):\n- Na primeira resposta de uma conversa, cumprimente mesmo que o cliente nao tenha enviado saudacao.\n- Comece exatamente com [[SAUDACAO]]; use o primeiro nome apenas quando o sistema fornecer um nome confiavel.\n- Escreva com suas proprias palavras, de forma gentil e natural; nao copie um texto-modelo.\n- Se for preparar uma lista, avise brevemente que vai atualizar as opcoes e enviar em seguida.\n- Prefira duas mensagens curtas, separadas por [[MSG]], com quebras de linha quando ajudarem. Evite paragrafos longos e excesso de emojis.`;
  for (const name of ['Agente Geral - Atendimento', 'Especialista - Vendas']) {
    const node = byName(nodes, name);
    const system = String(node.parameters?.options?.systemMessage || '');
    node.parameters.options = { ...(node.parameters.options || {}), systemMessage: system.includes(MARKER) ? system : system + policy };
  }
  return nodes;
}

function summarize(nodes) {
  const all = JSON.stringify(nodes);
  return { marker: all.includes(MARKER), firstConversation: all.includes('firstConversationGreetingV227'), sixHourWindow: all.includes('6 * 60 * 60 * 1000'), namedGreeting: all.includes("firstName ? ', ' + firstName"), shortMessages: all.includes('Prefira duas mensagens curtas'), aiOwnWords: all.includes('Escreva com suas proprias palavras'), catalogIntro: all.includes('cordialCatalogIntroV227'), brandGrouping: all.includes('quoteBrandGroupV227'), brandHeadings: all.includes("chunkLines.push('🏷️ *'") };
}

(async()=>{
  const conn=new Client(); await new Promise((resolve,reject)=>conn.on('ready',resolve).on('error',reject).connect(getVpsSshConfig())); let stopped=false;
  try {
    const db=(await run(conn,"docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    const raw=await run(conn,`docker exec ${quote(db)} psql -U postgres -d n8n -X -q -t -A -c ${quote(`COPY (SELECT encode(convert_to(json_build_object('nodes',nodes::jsonb,'connections',connections::jsonb,'activeVersionId',\"activeVersionId\")::text,'UTF8'),'hex') FROM workflow_entity WHERE id='${WORKFLOW_ID}') TO STDOUT;`)}`);
    const workflow=JSON.parse(Buffer.from(raw.trim(),'hex').toString('utf8'));
    if (process.argv.includes('--dump-product')) {
      console.log(String(byName(workflow.nodes, 'Vendas - Contexto Produtos').parameters?.jsCode || ''));
      return;
    }
    patchWorkflow(workflow.nodes); const summary=summarize(workflow.nodes);
    if(!APPLY) { console.log(JSON.stringify({apply:false,...summary},null,2)); return; }
    await put(conn,'/tmp/mdv-n8n-nodes-v227.json',JSON.stringify(workflow.nodes));
    await run(conn,`docker cp /tmp/mdv-n8n-nodes-v227.json ${quote(db)}:/tmp/mdv-n8n-nodes-v227.json`);
    await run(conn,'docker service scale n8n_n8n-runner=0 >/dev/null'); await waitService(conn,'n8n_n8n-runner',0);
    await run(conn,'docker service scale n8n_n8n=0 >/dev/null'); await waitService(conn,'n8n_n8n',0); stopped=true;
    const sql=`BEGIN; UPDATE workflow_entity SET nodes=pg_read_file('/tmp/mdv-n8n-nodes-v227.json')::json, \"updatedAt\"=CURRENT_TIMESTAMP WHERE id='${WORKFLOW_ID}'; UPDATE workflow_history SET nodes=pg_read_file('/tmp/mdv-n8n-nodes-v227.json')::json WHERE \"workflowId\"='${WORKFLOW_ID}' AND \"versionId\"='${workflow.activeVersionId}'; COMMIT;`;
    await run(conn,`docker exec ${quote(db)} psql -U postgres -d n8n -X -v ON_ERROR_STOP=1 -c ${quote(sql)}`);
    await run(conn,'docker service scale n8n_n8n=1 >/dev/null'); await waitService(conn,'n8n_n8n',1);
    await run(conn,'docker service scale n8n_n8n-runner=1 >/dev/null'); await waitService(conn,'n8n_n8n-runner',1); stopped=false;
    console.log(JSON.stringify({apply:true,...summary},null,2));
  } finally { if(stopped){ await run(conn,'docker service scale n8n_n8n=1 >/dev/null').catch(()=>{}); await waitService(conn,'n8n_n8n',1).catch(()=>{}); await run(conn,'docker service scale n8n_n8n-runner=1 >/dev/null').catch(()=>{}); } await run(conn,'rm -f /tmp/mdv-n8n-nodes-v227.json').catch(()=>{}); conn.end(); }
})().catch((error)=>{console.error(error.stack||error.message);process.exit(1)});

module.exports = { patchWorkflow, summarize };
