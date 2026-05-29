import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pageSource = fs.readFileSync(path.join(root, 'pages/admin/AutoResponderPage.tsx'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

[
  'CEP da entrega',
  'Cliente informa CEP',
  '56.304-000, 56304000',
  'Bot confirma endereco',
  'Cliente confirma ou troca CEP',
  'sim, nao, outro CEP',
  'Numero e complemento',
  '123, 123 apto 202, s/n',
  'Endereco completo',
  'Rua Marechal Deodoro, 123',
].forEach((needle) => {
  assert(pageSource.includes(needle), `AutoResponderPage must show delivery flow step: ${needle}`);
});

const deliveryIndex = pageSource.indexOf("id: 'delivery'");
const cepInputIndex = pageSource.indexOf("id: 'delivery-cep-input'");
const cepConfirmIndex = pageSource.indexOf("id: 'delivery-cep-confirm'");
const numberIndex = pageSource.indexOf("id: 'delivery-number'");
const savedIndex = pageSource.indexOf("id: 'delivery-address-saved'");

assert(
  deliveryIndex >= 0 &&
    deliveryIndex < cepInputIndex &&
    cepInputIndex < cepConfirmIndex &&
    cepConfirmIndex < numberIndex &&
    numberIndex < savedIndex,
  'AutoResponderPage must show the delivery continuation in order'
);

console.log('autoresponder delivery flow visibility static checks passed');
