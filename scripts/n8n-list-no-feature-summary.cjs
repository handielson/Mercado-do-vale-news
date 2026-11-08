'use strict';

// list-no-feature-summary-v1 (08/11/2026, v1.2.820): a linha de resumo "✨ Tela ..., bateria ..., câmera ..."
// sai das listas de celulares para deixar a lista mais limpa (pedido do Handielson: opção "tirar de todas as listas").
//  - "Vendas - Contexto Produtos": lista/orçamento enviado ao cliente (todas as partes).
//  - "Vendas - Verificar Pos Lista": comparação curta de preços dos modelos já listados.
// O resumo continua calculado e guardado em options[].featureSummary (estado pós-lista), sem mudar o grafo.
// Também: a linha do cartão fica "💳 Cartão: 12x de R$ 111,81 (R$ 1.341,68)" (sem a palavra "total") nos dois nós.
// "Vendas - Resolver Parcelamento" (tabela de 1x a 12x) mantém "(total ...)" de propósito.

const MARK = 'list-no-feature-summary-v1';
const NODE_CONTEXTO = 'Vendas - Contexto Produtos';
const NODE_POS_LISTA = 'Vendas - Verificar Pos Lista';
const NODES = [NODE_CONTEXTO, NODE_POS_LISTA]; // ordem dos nós no workflow

function once(code, before, after, label) {
  const count = code.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: âncora encontrada ${count} vezes`);
  return code.replace(before, () => after);
}

function withoutCardTotalWord(code, expected, label) {
  const before = "' (total ' + ";
  const count = code.split(before).length - 1;
  if (count !== expected) throw new Error(`${label}: esperado ${expected} linhas de cartão, achou ${count}`);
  return code.split(before).join("' (' + ");
}

function patchContexto(code) {
  if (code.includes(MARK)) return code;
  code = withoutCardTotalWord(code, 3, 'cartão no orçamento');
  return once(code,
    "    if (featureSummaryV365) chunkLines.push('   ' + featureSummaryV365);\n",
    "    // " + MARK + ": resumo de características fora da lista (fica em options[].featureSummary).\n",
    'lista do orçamento');
}

function patchPosLista(code) {
  if (code.includes(MARK)) return code;
  code = withoutCardTotalWord(code, 4, 'cartão pós-lista');
  return once(code,
    "          option.featureSummary ? '   ' + option.featureSummary : '',\n",
    "          '', // " + MARK + "\n",
    'comparação pós-lista');
}

function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  const find = (name) => {
    const node = next.nodes.find((item) => item.name === name);
    if (!node?.parameters?.jsCode) throw new Error(`Code node ausente: ${name}`);
    return node;
  };
  const contexto = find(NODE_CONTEXTO);
  contexto.parameters.jsCode = patchContexto(contexto.parameters.jsCode);
  const posLista = find(NODE_POS_LISTA);
  posLista.parameters.jsCode = patchPosLista(posLista.parameters.jsCode);
  return next;
}

module.exports = { MARK, NODES, NODE_CONTEXTO, NODE_POS_LISTA, patchWorkflow, patchContexto, patchPosLista };

if (require.main === module) {
  const fs = require('node:fs');
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('Uso: node scripts/n8n-list-no-feature-summary.cjs antes.json candidato.json');
  fs.writeFileSync(output, JSON.stringify(patchWorkflow(JSON.parse(fs.readFileSync(input, 'utf8')))), { mode: 0o600 });
  console.log('candidato gravado em', output);
}
