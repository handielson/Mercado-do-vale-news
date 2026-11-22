'use strict';

// delivery-today-v1 (nó "Entrega - Politica"), caso 558781026485 (domingo 22/11 13h35): "vc entrega hj" recebeu só
// "Qual é o bairro da entrega?", sem resposta sobre hoje, e ninguém da equipe foi avisado.
// Agora, quando o cliente pede entrega hoje/agora, o robô diz que vamos chamar um motoboy e que já já confirma,
// e continua pedindo o bairro/CEP. A frase "chamar um motoboy" faz a API avisar o admin no WhatsApp (delivery-alert-v1).
const MARK = 'delivery-today-v1';
const NODE = 'Entrega - Politica';
const NODES = [NODE];
const OLD = 'return [{ json: { ...source, output, deliveryDddAssumption: assumption } }];';
const NEW = `// ${MARK}: entrega hoje/agora → motoboy + confirmação da equipe (a API avisa o admin pela frase "chamar um motoboy").
const deliveryTextV1 = String(source.conversation || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
const deliveryTodayV1 = /\\b(?:hj|hoje|agora|ainda hoje|hoje ainda|ja ja|rapidinho|urgente|domingo)\\b/.test(deliveryTextV1);
const outputV1 = deliveryTodayV1
  ? ['Vamos chamar um motoboy para fazer a sua entrega e já já te confirmo, tá bom? 😊🛵',
    assumption.label ? 'Enquanto isso, me diga o bairro da entrega' + ' (pelo seu DDD ' + assumption.ddd + ', considerei ' + assumption.label + ').' : 'Enquanto isso, me envie os 8 números do CEP da entrega.'].join('[[BR]]')
  : output;
return [{ json: { ...source, output: outputV1, deliveryTodayV1, deliveryDddAssumption: assumption } }];`;

function patchEntrega(code) {
  if (code.includes(MARK)) return code;
  if (code.split(OLD).length !== 2) throw new Error(`${MARK}: retorno não encontrado`);
  return code.replace(OLD, () => NEW);
}
function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  const node = next.nodes.find((n) => n.name === NODE);
  node.parameters.jsCode = patchEntrega(node.parameters.jsCode);
  return next;
}
module.exports = { MARK, NODE, NODES, patchWorkflow, patchEntrega };
