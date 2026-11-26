'use strict';

// card-machine-wording-v1: pedido do dono (26/11) — no cartão o certo não é "presencial", e sim "na maquininha",
// e não aceitamos cartão virtual. Troca os 3 textos do nó "Pagamento - Politica" que o cliente vê.
const MARK = 'card-machine-wording-v1';
const NODE = 'Pagamento - Politica';
const CHANGED = [NODE];
const MACHINE = 'O pagamento no cartão é feito na maquininha (não aceitamos cartão virtual).';
const REPLACEMENTS = [
  ['O pagamento no cartão é presencial.', MACHINE, 2],
  ['Para cartão de crédito, o pagamento é feito presencialmente, no ato da entrega ou retirada. 💳',
    'No cartão de crédito, o pagamento é feito na maquininha, no ato da entrega ou retirada. Não aceitamos cartão virtual. 💳', 1],
];

function patchPagamento(code) {
  if (code.includes(MARK)) return code;
  let next = code;
  for (const [from, to, expected] of REPLACEMENTS) {
    const count = next.split(from).length - 1;
    if (count !== expected) throw new Error(`${MARK}: "${from.slice(0, 40)}…" encontrado ${count}x (esperado ${expected})`);
    next = next.split(from).join(to);
  }
  if (/presencial/i.test(next.replace(/presencialFees|channel/g, ''))) throw new Error(`${MARK}: ainda há "presencial" em texto do nó`);
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

module.exports = { MARK, NODE, CHANGED, ADDED: [], MACHINE, patchPagamento, patchWorkflow, assertExpectedGraph };
