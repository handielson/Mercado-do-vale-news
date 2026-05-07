import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const docPath = path.join(root, 'Bot_Whatsapp.md');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const fileName of ['vps_server.cjs', 'vps_server.js']) {
  const source = fs.readFileSync(path.join(root, fileName), 'utf8');

  [
    'function isAutoresponderPurchaseFinalizeRequest',
    'function calculateAutoresponderCartTotals',
    'function formatAutoresponderCartSummaryReply',
    "status: 'summary_ready'",
    "intent: 'purchase_summary'",
    'Resumo do pedido',
    'Subtotal:',
    'Total:',
    '- [x] Carrinho com 1 item gera resumo correto',
    '- [x] Carrinho com varios itens soma total corretamente',
  ].forEach((token) => {
    if (token.startsWith('- [x]')) return;
    assert(source.includes(token), `${fileName} must include ${token}`);
  });

  assert(
    source.includes('items.reduce((total, item) => total + Number(item?.subtotal_cents || 0), 0)'),
    `${fileName} must sum cart item subtotals`
  );
  assert(
    source.indexOf('isAutoresponderPurchaseFinalizeRequest(message)') < source.indexOf('const numberedChoice = detectedIntent.numberedChoice'),
    `${fileName} must handle cart finalization before numbered selection`
  );
}

const doc = fs.readFileSync(docPath, 'utf8');
assert(doc.includes('- [x] Calcular subtotal, total e resumo do pedido'), 'Bot_Whatsapp.md must mark cart summary checklist item');
assert(doc.includes('- [x] Carrinho com 1 item gera resumo correto'), 'Bot_Whatsapp.md must mark one-item cart test');
assert(doc.includes('- [x] Carrinho com varios itens soma total corretamente'), 'Bot_Whatsapp.md must mark multi-item cart test');
assert(doc.includes('tmp-tests/autoresponder-purchase-summary-static.test.mjs'), 'Bot_Whatsapp.md must mention cart summary test');

console.log('autoresponder purchase summary static checks passed');
