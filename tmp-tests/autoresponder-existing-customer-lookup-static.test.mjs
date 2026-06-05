import fs from 'node:fs';
import path from 'node:path';
import { readBotWhatsappDoc } from '../tools/autoresponder-bot-doc.cjs';

const root = process.cwd();
const serverFiles = ['vps_server.js', 'vps_server.cjs'];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const fileName of serverFiles) {
  const source = fs.readFileSync(path.join(root, fileName), 'utf8');

  [
    'async function findAutoresponderExistingCustomer',
    'buildAutoresponderCustomerLookupCandidates',
    "'select=id,name,cpf_cnpj,email,phone,address,is_active'",
    "vpsDbSelect('customers', query)",
    'existing_customer',
    "intent: 'purchase_existing_customer_found'",
    "intent: 'purchase_existing_customer_not_found'",
  ].forEach((needle) => {
    assert(source.includes(needle), `${fileName} must include ${needle}`);
  });

  const customerPendingIndex = source.indexOf("purchaseFlow.status === 'customer_data_pending'");
  const customerPendingLookupIndex = source.indexOf('findAutoresponderExistingCustomer(customerData)', customerPendingIndex);
  const customerPendingConfirmationIndex = source.indexOf("status: 'awaiting_customer_confirmation'", customerPendingLookupIndex);
  assert(
    customerPendingIndex >= 0 &&
      customerPendingIndex < customerPendingLookupIndex &&
      customerPendingLookupIndex < customerPendingConfirmationIndex,
    `${fileName} must look up existing customer before asking customer confirmation`
  );

  const fullNameFlowIndex = source.indexOf("purchaseFlow.status === 'awaiting_customer_full_name'");
  const fullNameLookupIndex = source.indexOf('findAutoresponderExistingCustomer(customerData)', fullNameFlowIndex);
  const fullNameConfirmationIndex = source.indexOf("status: 'awaiting_customer_confirmation'", fullNameLookupIndex);
  assert(
    fullNameFlowIndex >= 0 &&
      fullNameFlowIndex < fullNameLookupIndex &&
      fullNameLookupIndex < fullNameConfirmationIndex,
    `${fileName} must look up existing customer after collecting the full name`
  );

  const documentFlowIndex = source.indexOf("purchaseFlow.status === 'awaiting_customer_document'");
  const documentLookupIndex = source.indexOf('findAutoresponderExistingCustomer(documentCustomerData)', documentFlowIndex);
  const documentRegistrationIndex = source.indexOf("status: 'customer_registration_ready'", documentLookupIndex);
  assert(
    documentFlowIndex >= 0 &&
      documentFlowIndex < documentLookupIndex &&
      documentLookupIndex < documentRegistrationIndex,
    `${fileName} must look up existing customer after CPF/CNPJ is provided`
  );
}

const doc = readBotWhatsappDoc(root);
assert(
  doc.includes('- [x] Consultar cliente existente pelo telefone do WhatsApp, CPF/CNPJ ou e-mail antes de pedir dados novamente'),
  'Bot_Whatsapp.md must mark existing customer lookup done'
);
assert(
  doc.includes('- [x] Cliente existente e localizado pelo telefone e confirma dados antes do pedido'),
  'Bot_Whatsapp.md must mark existing customer test done'
);
assert(
  doc.includes('tmp-tests/autoresponder-existing-customer-lookup-static.test.mjs'),
  'Bot_Whatsapp.md must mention existing customer lookup test'
);

console.log('autoresponder existing customer lookup static checks passed');
