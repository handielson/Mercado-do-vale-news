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
    'function normalizeAutoresponderCustomerDocument',
    'function buildAutoresponderCustomerDocumentPrompt',
    'function buildAutoresponderCustomerDocumentSavedReply',
    "status: 'awaiting_customer_document'",
    "status: 'customer_registration_ready'",
    "status: 'customer_record_ready'",
    "intent: 'purchase_customer_document_prompt'",
    "intent: 'purchase_customer_upserted'",
    'cpf_cnpj: customerDocument',
    'customer_record',
    'CPF/CNPJ',
    'Dados minimos do cadastro anotados',
  ].forEach((token) => {
    assert(source.includes(token), `${fileName} must include ${token}`);
  });

  assert(
    source.indexOf("purchaseFlow.status === 'awaiting_customer_document'") < source.indexOf("purchaseFlow.status === 'awaiting_product_action'"),
    `${fileName} must capture customer document before product action flow`
  );
}

const doc = fs.readFileSync(docPath, 'utf8');
assert(doc.includes('- [x] Antes de finalizar venda, captar dados minimos para cadastro do cliente'), 'Bot_Whatsapp.md must mark minimum customer data checklist item');
assert(doc.includes('- [x] Definir campos obrigatorios do cadastro via WhatsApp: nome completo, telefone, CPF/CNPJ quando necessario, endereco quando houver entrega'), 'Bot_Whatsapp.md must mark required customer fields checklist item');
assert(doc.includes('tmp-tests/autoresponder-purchase-customer-document-static.test.mjs'), 'Bot_Whatsapp.md must mention customer document test');

console.log('autoresponder purchase customer document static checks passed');
