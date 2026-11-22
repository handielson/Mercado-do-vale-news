'use strict';

// model-waiting-stock-v1 (prompt do "Especialista - Vendas"): quando o modelo pedido não está na lista que o cliente
// já recebeu (status requested_model_not_confirmed_after_catalog), o dono pediu a frase:
// "Esse modelo acabou e estamos esperando chegar, <nome>. Se quiser, me diga o que é mais importante para você —
//  como preço, câmera ou armazenamento — e te indico uma opção entre os modelos da lista."
// (antes: "Não encontrei iPhone confirmado na lista que você recebeu…"). Só muda essa linha do prompt.
const MARK = 'model-waiting-stock-v1';
const NODE = 'Especialista - Vendas';
const NODES = [NODE];
const OLD = '- requested_model_not_confirmed_after_catalog: o modelo exato nao foi confirmado e a cliente ja recebeu a lista atual nesta conversa. Explique isso com naturalidade, sem reenviar a lista, sem dizer que ela aparecera em seguida e sem prometer estoque. Convide a cliente a dizer uma preferencia para eu indicar uma opcao da lista que ela ja recebeu.';
const NEW = `- requested_model_not_confirmed_after_catalog (${MARK}): o modelo pedido nao esta na lista atual e a cliente ja recebeu essa lista nesta conversa. Responda numa mensagem so, sem reenviar a lista e sem dizer que ela aparecera em seguida, seguindo este modelo (troque o nome pelo primeiro nome da cliente; sem nome, comece direto): "Esse modelo acabou e estamos esperando chegar, Nome. Se quiser, me diga o que é mais importante para você — como preço, câmera ou armazenamento — e te indico uma opção entre os modelos da lista." Nao invente data de chegada nem prometa reserva.`;

function patchPrompt(text) {
  if (text.includes(MARK)) return text;
  if (text.split(OLD).length !== 2) throw new Error(`${MARK}: linha do prompt não encontrada`);
  return text.replace(OLD, () => NEW);
}
function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  const node = next.nodes.find((n) => n.name === NODE);
  node.parameters.options.systemMessage = patchPrompt(node.parameters.options.systemMessage);
  return next;
}
module.exports = { MARK, NODE, NODES, OLD, patchWorkflow, patchPrompt };
