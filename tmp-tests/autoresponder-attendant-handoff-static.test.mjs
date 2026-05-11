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
    'function formatAutoresponderAttendantOrderSummary',
    'function buildAutoresponderCustomerOrderHandoffReply',
    'async function pauseAutoresponderConversationForPurchase',
    'Seu pedido foi separado para um atendente finalizar',
    "status: 'pedido_em_andamento'",
    "pause_reason = 'pedido_em_andamento'",
    "intent: 'purchase_request'",
    'attendant_summary:',
  ].forEach((token) => {
    assert(source.includes(token), `${fileName} must include ${token}`);
  });

  assert(
    /const handoffPurchaseFlow = \{[\s\S]*?attendant_summary:[\s\S]*?status: 'pedido_em_andamento'[\s\S]*?await saveAutoresponderPurchaseFlow\(senderKey, handoffPurchaseFlow\)/m.test(source),
    `${fileName} must save handoff status and attendant summary in purchase_flow`
  );

  assert(
    /await pauseAutoresponderConversationForPurchase\(senderKey,[\s\S]*?pauseMinutes[\s\S]*?\)/m.test(source),
    `${fileName} must pause the bot after generating the purchase request`
  );
}

const doc = fs.readFileSync(docPath, 'utf8');
[
  '- [x] Gerar mensagem-resumo para atendente com cliente, telefone, itens, total, entrega/retirada e observacoes',
  '- [x] Pausar o bot automaticamente apos gerar resumo de pedido',
  '- [x] Criar tag/conversa com status `pedido_em_andamento`',
  '- [x] Salvar evento em `autoresponder_logs` com intent `purchase_request`',
  '- [x] Criar mensagem para o cliente: "Seu pedido foi separado para um atendente finalizar"',
  'tmp-tests/autoresponder-attendant-handoff-static.test.mjs',
].forEach((token) => {
  assert(doc.includes(token), `Bot_Whatsapp.md must include ${token}`);
});

console.log('autoresponder attendant handoff static checks passed');
