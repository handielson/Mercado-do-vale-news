'use strict';

// card-machine-list-v1: pedido do dono (26/11) — textos de cartão em lista com emojis (não em redação) e
// "não aceitamos cartão virtual nem pagamento por link". Troca os 3 textos de cartão do "Pagamento - Politica"
// (os mesmos do card-machine-wording-v1). "||" vira quebra de linha na mesma mensagem.
const MARK = 'card-machine-list-v1';
const NODE = 'Pagamento - Politica';
const CHANGED = [NODE];
const NO_VIRTUAL = '🚫 Não aceitamos cartão virtual nem pagamento por link';
const TEXTS = {
  juros: '💳 *Cartão de crédito*||✅ Em até 12x na maquininha||💰 À vista (Pix ou dinheiro) tem desconto; no cartão vale o valor sem desconto||' + NO_VIRTUAL,
  parcelamento: '💳 *Cartão de crédito*||✅ Em até 12x na maquininha||📋 As parcelas seguem a tabela da maquininha; te passo tudo certinho antes de finalizar||' + NO_VIRTUAL,
  link: '💳 *Cartão de crédito*||✅ Pagamento na maquininha, na entrega ou na retirada||' + NO_VIRTUAL,
};
const REPLACEMENTS = [
  ['No cartão o valor é sem desconto. 💳||O preço à vista (Pix ou dinheiro) já vem com desconto e, no cartão de crédito, vale o valor sem o desconto, em até 12x. O pagamento no cartão é feito na maquininha (não aceitamos cartão virtual).', TEXTS.juros],
  ['No cartão de crédito, dividimos em até 12x. 💳||As parcelas seguem a tabela da maquininha e eu te passo tudo certinho antes de finalizar. O pagamento no cartão é feito na maquininha (não aceitamos cartão virtual).', TEXTS.parcelamento],
  ['No cartão de crédito, o pagamento é feito na maquininha, no ato da entrega ou retirada. Não aceitamos cartão virtual. 💳', TEXTS.link],
];

function patchPagamento(code) {
  if (code.includes(MARK)) return code;
  if (!code.includes('card-machine-wording-v1')) throw new Error(`${MARK}: precisa do card-machine-wording-v1`);
  let next = code;
  for (const [from, to] of REPLACEMENTS) {
    const count = next.split(from).length - 1;
    if (count !== 1) throw new Error(`${MARK}: "${from.slice(0, 40)}…" encontrado ${count}x`);
    next = next.split(from).join(to);
  }
  return `// ${MARK}\n` + next;
}

function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  for (const node of next.nodes) if (node.name === NODE) node.parameters.jsCode = patchPagamento(node.parameters.jsCode);
  return next;
}

function assertExpectedGraph(before, after) {
  if (JSON.stringify(before.connections) !== JSON.stringify(after.connections)) throw new Error(`${MARK}: ligações mudaram`);
  if (before.nodes.length !== after.nodes.length) throw new Error(`${MARK}: quantidade de nós mudou`);
}

module.exports = { MARK, NODE, CHANGED, ADDED: [], TEXTS, NO_VIRTUAL, patchPagamento, patchWorkflow, assertExpectedGraph };
