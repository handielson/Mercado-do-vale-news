'use strict';

const assert = require('node:assert/strict');

const MARK = 'installment-table-clean-v1';
const NODES = ['Vendas - Resolver Parcelamento', 'Vendas - Verificar Pos Lista'];

function replaceOnce(code, anchor, value) {
  assert.equal(code.split(anchor).length - 1, 1, 'Âncora alterada: ' + anchor.split('\n')[0]);
  return code.replace(anchor, () => value);
}

function patchResolver(code) {
  assert.ok(code.includes('sales-price-revalidate-v1'), 'Recotação do parcelamento ausente');

  const quote = 'if (source.paymentQuoteOnly === true) {';
  code = replaceOnce(code, quote, [
    '// ' + MARK,
    'const productLabel = [draft.name, draft.memory, draft.color].filter(Boolean).join(" - ");',
    'const formatInstallment = (option) => {',
    '  const value = option.installments + "x de " + centsToBRL(option.installmentCents);',
    '  return option.installments === 1 && option.totalCents === option.installmentCents',
    '    ? value : value + " (" + centsToBRL(option.totalCents) + ")";',
    '};',
    'const formatTable = (downPaymentMethod) => {',
    '  const downPaymentLine = downPaymentCents > 0',
    '    ? "Entrada " + (downPaymentMethod || "informada") + ": " + centsToBRL(downPaymentCents) + lineBreak',
    '      + "Saldo para o cartao: " + centsToBRL(cardBaseCents) + lineBreak',
    '    : "";',
    '  return downPaymentLine + productLabel + ":" + lineBreak + options.map(formatInstallment).join(lineBreak);',
    '};',
    quote,
  ].join('\n'));
  code = replaceOnce(code, '  const requested = options.find((option) => option.installments === requestedInstallments);\n', '');
  code = replaceOnce(code, [
    "  const productLabel = [draft.name, draft.memory, draft.color].filter(Boolean).join(' - ');",
    "  const requestedLine = requested ? 'Em ' + requested.label + '.' + lineBreak + lineBreak : '';",
    "  const list = 'Tabela da maquininha para ' + productLabel + ':' + lineBreak",
    "    + options.map((option) => option.installments + 'x de ' + centsToBRL(option.installmentCents)",
    "      + ' (total ' + centsToBRL(option.totalCents) + ')').join(lineBreak);",
  ].join('\n'), '  const list = formatTable(source.downPaymentMethod || draft.downPaymentMethod);');
  code = replaceOnce(code, 'output: updatedNotice + requestedLine + list', 'output: updatedNotice + list');
  code = replaceOnce(code, [
    'const downPaymentLine = downPaymentCents > 0',
    "  ? 'Entrada ' + (activeState.orderDraft.downPaymentMethod || 'informada') + ': ' + centsToBRL(downPaymentCents) + lineBreak + 'Saldo para o cartao: ' + centsToBRL(cardBaseCents) + lineBreak",
    "  : '';",
    "const list = downPaymentLine + 'Opcoes no cartao:' + lineBreak",
    "  + options.map((option, index) => (index + 1) + '. ' + option.label).join(lineBreak)",
  ].join('\n'), 'const list = formatTable(activeState.orderDraft.downPaymentMethod)');
  return code;
}

function patchQuoteRequest(code) {
  assert.ok(code.includes('installment-quote-guard-v1:quote-request'), 'Regra de cotação ausente');
  const original = 'const installmentQuoteRequestV1 = (Boolean(installmentQuoteMatchV1)';
  return replaceOnce(code, original, [
    '// ' + MARK,
    'const installmentQuoteRequestV1 = /\\bparcelam?\\s+em\\s+quantas\\s+vezes\\b/.test(normalized)',
    '  || (Boolean(installmentQuoteMatchV1)',
  ].join('\n'));
}

function patchWorkflow(workflow) {
  const result = structuredClone(workflow);
  for (const [index, transform] of [patchResolver, patchQuoteRequest].entries()) {
    const matches = result.nodes.filter(node => node.name === NODES[index]);
    assert.equal(matches.length, 1, 'Nó ausente ou duplicado: ' + NODES[index]);
    const params = matches[0].parameters;
    if (params.jsCode.includes(MARK)) continue;
    params.jsCode = transform(params.jsCode);
    new Function(params.jsCode);
  }
  return result;
}

module.exports = { MARK, NODES, patchWorkflow };
