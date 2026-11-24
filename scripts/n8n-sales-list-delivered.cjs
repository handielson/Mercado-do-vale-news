'use strict';

// sales-list-delivered-v1 (nó "Vendas - Verificar Pos Lista"), caso 558781318075 (24/11 9h40):
// "Val estou precisando de um celular bom e barato" montou a lista completa e gravou o estado
// "lista enviada, esperando escolha" (salesPostList awaiting_product_choice), mas o envio foi descartado
// porque a cliente mandou "Qual a promoção de hoje" no meio. A execução seguinte herdou o estado, achou que a
// lista já tinha ido e respondeu só a política de promoção — a cliente ficou sem lista.
// Agora: lista criada há menos de 15 min sem nenhuma mensagem nossa com a lista depois dela = não entregue;
// o estado é descartado e o fluxo segue normal (monta e manda a lista de novo).
const MARK = 'sales-list-delivered-v1';
const NODE = 'Vendas - Verificar Pos Lista';
const NODES = [NODE];
const ANCHOR = 'let activeState = remoteJid ? staticData.salesPostList[remoteJid] : null;\n';

const GUARD = `// ${MARK}: estado de lista recém-criado sem a lista no histórico = envio descartado; não herda.
{
  const listStateV1 = remoteJid ? staticData.salesPostList[remoteJid] : null;
  const createdV1 = Date.parse(String(listStateV1?.createdAt || ''));
  const rowsV1 = Array.isArray(source.recentMessages) ? source.recentMessages : [];
  const atV1 = (row) => Date.parse(String(row?.created_at || row?.createdAt || ''));
  if (listStateV1?.flow === 'sales_post_list' && listStateV1?.step === 'awaiting_product_choice'
    && Number.isFinite(createdV1) && now - createdV1 >= 0 && now - createdV1 < 15 * 60 * 1000
    && rowsV1.some((row) => atV1(row) < createdV1 - 1000)) {
    const sentV1 = rowsV1.some((row) => String(row?.direction || '') === 'outbound' && atV1(row) >= createdV1 - 5000
      && /(?:a vista no pix|à vista no pix|qual modelo voce quer ver|qual modelo você quer ver|celulares disponiveis|celulares disponíveis)/i.test(String(row?.text ?? row?.message_text ?? '')));
    if (!sentV1) delete staticData.salesPostList[remoteJid];
  }
}
`;

function patchCode(code) {
  if (code.includes(MARK)) return code;
  const n = code.split(ANCHOR).length - 1;
  if (n !== 1) throw new Error(`${MARK}: âncora encontrada ${n}x`);
  if (!/\bconst now\b|\blet now\b/.test(code.slice(0, code.indexOf(ANCHOR)))) throw new Error(`${MARK}: now não definido antes da âncora`);
  return code.replace(ANCHOR, () => GUARD + ANCHOR);
}
function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  const node = next.nodes.find((n) => n.name === NODE);
  if (!node) throw new Error(`${MARK}: nó ${NODE} não existe`);
  node.parameters.jsCode = patchCode(node.parameters.jsCode);
  return next;
}
module.exports = { MARK, NODE, NODES, patchCode, patchWorkflow };
