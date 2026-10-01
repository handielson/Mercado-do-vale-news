const assert = require('node:assert/strict');
const { readWorkflow } = require('./n8n-warranty-policy.cjs');
const {
  patchWorkflow: patchInstallmentWorkflow,
  validate: validateInstallmentWorkflow,
} = require('./n8n-fix-installment-quote-guard.cjs');

const MARKER = 'sales-list-natural-intro-v1';
const HANDOFF_MARKER = 'manual-handoff-nonempty-message-v1';

function replaceOnce(text, search, replacement, label) {
  const matches = String(text).split(search).length - 1;
  assert.equal(matches, 1, `${label} anchor must occur exactly once`);
  return String(text).replace(search, replacement);
}

function patchComposer(code) {
  let next = String(code || '');
  if (next.includes(`${MARKER}:composer`)) return next;
  next = replaceOnce(
    next,
    "const catalogReadyV366 = Boolean(catalogOutput);",
    "const catalogReadyV366 = Boolean(catalogOutput);\n// sales-list-natural-intro-v1:composer\nconst prependNaturalIntroV1 = catalogReadyV366\n  && structuredCatalogOnlyV365 !== true\n  && Array.isArray(source.productsInStock)\n  && source.productsInStock.length > 1;",
    'catalog intro decision',
  );
  next = replaceOnce(
    next,
    "    output: catalogReadyV366 ? catalogOutput : aiOutput,",
    "    output: catalogReadyV366\n      ? (prependNaturalIntroV1 ? [aiOutput, catalogOutput].filter(Boolean).join('[[MSG]]') : catalogOutput)\n      : aiOutput,",
    'catalog intro composition',
  );
  new Function('$json', '$', next);
  return next;
}

function patchSalesPrompt(node) {
  assert.ok(node?.parameters?.options, 'sales agent options missing');
  const current = String(node.parameters.options.systemMessage || '');
  if (current.includes(`${MARKER}:agent`)) return;
  node.parameters.options.systemMessage = `${current}\n\nINTRODUCAO ANTES DE LISTAS (// ${MARKER}:agent):\n- Quando houver dois ou mais produtos confirmados, escreva exatamente uma mensagem curta para ser enviada antes da lista oficial.\n- Responda ao pedido atual e avise com naturalidade que vai apresentar ou atualizar as opcoes encontradas.\n- Seja sempre respeitosa, alegre e acolhedora, usando de 1 a 2 emojis adequados.\n- Escreva a frase do zero conforme a conversa. Nao copie exemplos, nao use resposta fixa e nao repita produtos, precos ou detalhes da lista.\n- Nessa introducao, nao use [[MSG]]: o sistema separara automaticamente a mensagem da lista oficial.`;
}

function patchManualHandoff(code) {
  let next = String(code || '');
  if (next.includes(HANDOFF_MARKER)) return next;
  const anchor = ").trim();\n\nreturn [{ json: {";
  next = replaceOnce(
    next,
    anchor,
    `).trim();\n\n// ${HANDOFF_MARKER}: status events and empty echoes must never pause the customer bot.\nif (!message) return [];\n\nreturn [{ json: {`,
    'manual handoff empty-message guard',
  );
  new Function('$json', '$', '$getWorkflowStaticData', next);
  return next;
}

function patchWorkflow(workflow) {
  const cloned = patchInstallmentWorkflow(workflow);
  const composer = cloned.nodes.find((node) => node.name === 'Vendas - Compor Resposta IA');
  const salesAgent = cloned.nodes.find((node) => node.name === 'Especialista - Vendas');
  const manualHandoff = cloned.nodes.find((node) => node.name === 'Handoff - Registrar manual');
  assert.ok(composer?.parameters?.jsCode && salesAgent && manualHandoff?.parameters?.jsCode, 'required sales intro nodes missing');
  composer.parameters.jsCode = patchComposer(composer.parameters.jsCode);
  patchSalesPrompt(salesAgent);
  manualHandoff.parameters.jsCode = patchManualHandoff(manualHandoff.parameters.jsCode);
  return cloned;
}

async function validate(workflow) {
  const installment = await validateInstallmentWorkflow(workflow);
  const composerCode = workflow.nodes.find((node) => node.name === 'Vendas - Compor Resposta IA').parameters.jsCode;
  const handoffCode = workflow.nodes.find((node) => node.name === 'Handoff - Registrar manual').parameters.jsCode;
  const prompt = workflow.nodes.find((node) => node.name === 'Especialista - Vendas').parameters.options.systemMessage;
  const catalogOutput = '📱 Orçamento[[BR]]1. Poco C71[[BR]]2. Poco C85';
  const intro = 'Ótimo! Vou atualizar as opções nessa faixa para você conferir. 😊📱';
  const source = {
    deterministicCatalogOutput: catalogOutput,
    productsInStock: [{ name: 'Poco C71' }, { name: 'Poco C85' }],
    structuredPhoneComparison: false,
  };
  const composed = new Function('$json', '$', composerCode)(
    { output: intro },
    (name) => ({ first: () => ({ json: name === 'Vendas - Contexto Produtos' ? source : {} }) }),
  );
  assert.equal(composed[0].json.output, `${intro}[[MSG]]${catalogOutput}`);
  assert.equal(composed[0].json.output.split('[[MSG]]')[0], intro);
  assert.match(prompt, new RegExp(`${MARKER}:agent`));
  assert.match(prompt, /respeitosa, alegre e acolhedora/);
  assert.match(prompt, /1 a 2 emojis/);
  assert.match(prompt, /Nao copie exemplos, nao use resposta fixa/);

  const runHandoff = (message) => new Function('$json', '$', '$getWorkflowStaticData', handoffCode)(
    { remoteJid: '558781180927@s.whatsapp.net', messageId: 'fixture-id', conversation: message, source: 'web' },
    () => ({ first: () => ({ json: { body: { data: {} } } }) }),
    () => ({ botSentMessageIds: {} }),
  );
  assert.deepEqual(runHandoff(''), []);
  const realManual = runHandoff('Vou te enviar as opções agora.');
  assert.equal(realManual.length, 1);
  assert.equal(realManual[0].json.handoffBy, 'whatsapp-web');

  return {
    installment,
    introSeparated: true,
    naturalAiWording: true,
    respectfulCheerfulEmojiRule: true,
    emptyOutboundCannotPauseBot: true,
    realManualMessageStillPausesBot: true,
  };
}

async function main() {
  const { Client } = require('ssh2');
  const { getVpsSshConfig } = require('./vps-ssh-config.cjs');
  const connection = new Client();
  await new Promise((resolve, reject) => connection.once('ready', resolve).once('error', reject).connect(getVpsSshConfig()));
  try {
    const current = await readWorkflow(connection);
    const patched = patchWorkflow(current);
    const result = await validate(patched);
    assert.deepEqual(patchWorkflow(patched).nodes, patched.nodes, 'combined patch must be idempotent');
    console.log(JSON.stringify({ mode: 'local dry run; production unchanged', workflow: current.name,
      markers: [MARKER, HANDOFF_MARKER, 'installment-quote-guard-v1'], result }, null, 2));
  } finally {
    connection.end();
  }
}

if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

module.exports = { patchComposer, patchSalesPrompt, patchManualHandoff, patchWorkflow, validate };
