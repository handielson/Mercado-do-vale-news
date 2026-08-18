import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function loadFormatter(file) {
  const source = readFileSync(file, 'utf8');
  const match = source.match(/function formatAutomationPaymentMethods\(value\) \{[\s\S]*?\n\}/);
  assert.ok(match, `${file} must define formatAutomationPaymentMethods`);

  const context = {
    parseAutomationJson(value, fallback) {
      if (typeof value !== 'string') return value;
      try { return JSON.parse(value); } catch { return fallback; }
    },
    formatAutomationMoney(value) {
      return (Number(value || 0) / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });
    },
  };
  vm.runInNewContext(`${match[0]}; this.formatter = formatAutomationPaymentMethods;`, context);
  return context.formatter;
}

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const format = loadFormatter(file);

  assert.equal(
    format([{ method: 'credit', amount: 99426, total_with_fee: 111788, installments: 12 }]),
    'Credito - R$\u00a01.117,88 (12x de R$\u00a093,16)',
    `${file} must show the installment count and rounded installment value`,
  );
  assert.equal(
    format([{ method: 'pix', amount: 1490, total_with_fee: 1490 }]),
    'Pix - R$\u00a014,90',
    `${file} must keep non-credit payments unchanged`,
  );
  assert.equal(
    format(JSON.stringify([{ method: 'credit', amount: 10000, total_with_fee: 10000, installments: 1 }])),
    'Credito - R$\u00a0100,00',
    `${file} must omit redundant single-installment details`,
  );
}

console.log('WhatsApp sale payment installment formatting checks passed');
