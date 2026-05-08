import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const serverFiles = ['vps_server.js', 'vps_server.cjs'];
const docPath = path.join(root, 'Bot_Whatsapp.md');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const fileName of serverFiles) {
  const source = fs.readFileSync(path.join(root, fileName), 'utf8');

  [
    'async function getAutoresponderCompanyId',
    'function buildAutoresponderCustomerPayload',
    'async function createOrUpdateAutoresponderCustomer',
    '/rest/v1/companies?select=id',
    '/rest/v1/customers',
    "intent: 'purchase_customer_upserted'",
    'customer_record',
    "status: 'customer_record_ready'",
  ].forEach((needle) => {
    assert(source.includes(needle), `${fileName} must include ${needle}`);
  });

  assert(
    source.indexOf("purchaseFlow.status === 'customer_registration_ready'") <
      source.indexOf('createOrUpdateAutoresponderCustomer(') &&
      source.indexOf('createOrUpdateAutoresponderCustomer(') <
      source.indexOf("intent: 'purchase_customer_upserted'"),
    `${fileName} must create/update the customer before handing the order to the attendant`
  );
}

const doc = fs.readFileSync(docPath, 'utf8');
assert(
  doc.includes('- [x] Se cliente ja existir, confirmar dados cadastrados antes de atualizar'),
  'Bot_Whatsapp.md must mark existing customer confirmation before update done'
);
assert(
  doc.includes('- [x] Criar/atualizar cliente no sistema a partir das respostas do WhatsApp quando possivel'),
  'Bot_Whatsapp.md must mark customer create/update done'
);
assert(
  doc.includes('- [x] Cliente novo informa dados e cadastro e criado/atualizado antes do pedido'),
  'Bot_Whatsapp.md must mark new customer registration test done'
);
assert(
  doc.includes('tmp-tests/autoresponder-customer-upsert-static.test.mjs'),
  'Bot_Whatsapp.md must mention customer upsert test'
);

console.log('autoresponder customer upsert static checks passed');
