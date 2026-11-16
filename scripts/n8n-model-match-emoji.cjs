'use strict';

// model-match-emoji-v1 (16/11/2026), caso real: "Vou tem o Redmi pad 2 256 tablet?" + "✨" 7 s depois.
//  1) Nome do modelo: palavras de categoria ("tablet", "celular", "smartphone", "aparelho") não entram na comparação.
//     Antes, "redmi pad 2 tablet" não batia com "Redmi Pad 2" e a lista (certa) abria com "Nao encontrei esse modelo".
//  2) Mensagem só de emoji logo depois de outra (até 60 s) não derruba a resposta que já está saindo
//     e não gera resposta própria (a IA geral respondia o "✨" com informação velha do histórico).

const MARK = 'model-match-emoji-v1';
const NODE_CONTEXT = 'Vendas - Contexto Produtos';
const NODE_APPLY = 'Controle Bot - Aplicar mensagem atual';
const NODES = [NODE_CONTEXT, NODE_APPLY];

function once(code, before, after, label) {
  const count = code.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: âncora encontrada ${count} vezes`);
  return code.replace(before, () => after);
}

const STOPWORDS_BEFORE = String.raw`|xiaomi|apple|samsung|motorola)\b/g,' ')`;
const STOPWORDS_AFTER = String.raw`|xiaomi|apple|samsung|motorola|tablet|tablets|celular|celulares|smartphone|smartphones|aparelho)\b/g,' ')/* ` + MARK + ' */';

function patchContext(code) {
  if (code.includes(MARK)) return code;
  return once(code, STOPWORDS_BEFORE, STOPWORDS_AFTER, 'palavras do modelo');
}

const APPLY_ANCHOR = "    const latestMessageIdV344 = String(latestInboundV344?.wa_message_id || '').trim();\n";
const APPLY_BLOCK = `    // ${MARK}: emoji solto logo depois de outra mensagem não derruba a resposta nem ganha resposta própria.
    const emojiOnlyV1 = (value) => { const textV1 = String(value || '').trim(); return Boolean(textV1) && !/[\\p{L}\\p{N}]/u.test(textV1); };
    const atV1 = (row) => Date.parse(row?.created_at || '') || 0;
    const ownIndexV1 = rowsV344.findIndex((row) => String(row?.direction || '') === 'inbound' && String(row?.wa_message_id || '').trim() === originalMessageIdV344);
    const ownRowV1 = ownIndexV1 >= 0 ? rowsV344[ownIndexV1] : null;
    if (ownRowV1 && emojiOnlyV1(ownRowV1.message_text)) {
      const previousInboundV1 = rowsV344.slice(0, ownIndexV1).reverse().find((row) => String(row?.direction || '') === 'inbound');
      if (previousInboundV1 && atV1(ownRowV1) - atV1(previousInboundV1) <= 60000) return false;
    }
    if (ownRowV1 && latestInboundV344 && latestMessageIdV344 && latestMessageIdV344 !== originalMessageIdV344
      && emojiOnlyV1(latestInboundV344.message_text) && atV1(latestInboundV344) - atV1(ownRowV1) <= 60000) return true;
`;

function patchApply(code) {
  if (code.includes(MARK)) return code;
  return once(code, APPLY_ANCHOR, APPLY_ANCHOR + APPLY_BLOCK, 'aplicar mensagem atual');
}

function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  const find = (name) => { const node = next.nodes.find((item) => item.name === name); if (!node?.parameters?.jsCode) throw new Error(`Nó ausente: ${name}`); return node; };
  const context = find(NODE_CONTEXT); context.parameters.jsCode = patchContext(context.parameters.jsCode);
  const apply = find(NODE_APPLY); apply.parameters.jsCode = patchApply(apply.parameters.jsCode);
  return next;
}

module.exports = { MARK, NODES, NODE_CONTEXT, NODE_APPLY, patchWorkflow, patchContext, patchApply };

if (require.main === module) {
  const fs = require('node:fs');
  const [input, output] = process.argv.slice(2);
  fs.writeFileSync(output, JSON.stringify(patchWorkflow(JSON.parse(fs.readFileSync(input, 'utf8')))), { mode: 0o600 });
  console.log('candidato gravado em', output);
}
