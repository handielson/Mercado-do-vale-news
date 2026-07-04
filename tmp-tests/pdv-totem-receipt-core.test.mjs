import assert from 'node:assert/strict';

function pickPdvPixReceiptAuthorizationCode(payment) {
  const candidates = [
    payment?.raw_response?.transaction_details?.authorization_code,
    payment?.raw_response?.authorization_code,
    payment?.raw_response?.id,
    payment?.mercado_pago_payment_id,
    payment?.id,
  ];

  for (const candidate of candidates) {
    const value = candidate == null ? '' : String(candidate).trim();

    if (value) {
      return value;
    }
  }

  return '';
}

function maskPdvReceiptPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  const national = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
  const areaCode = national.slice(0, 2);
  const lastFour = national.slice(-4);

  if (areaCode.length !== 2 || lastFour.length !== 4) {
    return '';
  }

  return `(${areaCode}) *****-${lastFour}`;
}

function formatPdvPixReceiptWhatsAppMessage(receipt) {
  const lines = [];
  const customerName = String(receipt?.customer_name || '').trim();
  const firstName = customerName.split(/\s+/)[0];

  if (firstName) {
    lines.push(`Ola, ${firstName}!`);
    lines.push('');
  }

  lines.push('Segue o comprovante da sua compra:');
  lines.push(`Pedido: ${receipt.order_number}`);
  lines.push(`Valor: ${receipt.amount_label}`);
  lines.push('Pagamento: Pix');
  lines.push(`Autenticacao: ${receipt.authentication_code}`);
  lines.push(`Data/hora: ${receipt.approved_at_label}`);
  lines.push('Obrigado pela preferencia!');
  lines.push('Mercado do Vale');

  return lines.join('\n');
}

assert.equal(
  pickPdvPixReceiptAuthorizationCode({
    raw_response: {
      transaction_details: { authorization_code: ' AUTH-123 ' },
      authorization_code: 'RAW-AUTH-456',
      id: 'RAW-789',
    },
    mercado_pago_payment_id: 'MP-789',
    id: 'PAY-000',
  }),
  'AUTH-123',
  'transaction_details authorization_code must have priority and be trimmed',
);

assert.equal(
  pickPdvPixReceiptAuthorizationCode({
    raw_response: {
      authorization_code: ' RAW-AUTH-456 ',
      id: 'RAW-789',
    },
    mercado_pago_payment_id: 'MP-789',
    id: 'PAY-000',
  }),
  'RAW-AUTH-456',
  'raw_response authorization_code must be used before raw_response id',
);

assert.equal(
  pickPdvPixReceiptAuthorizationCode({
    raw_response: { id: 12345 },
    mercado_pago_payment_id: 'MP-789',
    id: 'PAY-000',
  }),
  '12345',
  'numeric raw_response id must be coerced to string',
);

assert.equal(
  pickPdvPixReceiptAuthorizationCode({
    mercado_pago_payment_id: 'MP-789',
    id: 'PAY-000',
  }),
  'MP-789',
  'Mercado Pago payment id must be used before local id',
);

assert.equal(
  pickPdvPixReceiptAuthorizationCode({
    id: 'PAY-000',
  }),
  'PAY-000',
  'local payment id must be the final fallback',
);

assert.equal(maskPdvReceiptPhone('+5587988032612'), '(87) *****-2612');
assert.equal(maskPdvReceiptPhone('+558788032612'), '(87) *****-2612');

assert.ok(
  formatPdvPixReceiptWhatsAppMessage({
    customer_name: 'Maria Silva',
    order_number: '123',
    amount_label: 'R$ 99,90',
    authentication_code: 'AUTH-123',
    approved_at_label: '04/07/2026 10:30',
  }).startsWith('Ola, Maria!'),
  'WhatsApp message with customer must start with the first-name greeting',
);

const whatsappMessage = formatPdvPixReceiptWhatsAppMessage({
  customer_name: 'Maria Silva',
  order_number: '123',
  amount_label: 'R$ 99,90',
  authentication_code: 'AUTH-123',
  approved_at_label: '04/07/2026 10:30',
});

for (const expectedLine of [
  'Pedido: 123',
  'Valor: R$ 99,90',
  'Pagamento: Pix',
  'Autenticacao: AUTH-123',
  'Data/hora: 04/07/2026 10:30',
  'Obrigado pela preferencia!',
  'Mercado do Vale',
]) {
  assert.ok(whatsappMessage.includes(expectedLine), `WhatsApp message must include ${expectedLine}`);
}

assert.ok(
  !formatPdvPixReceiptWhatsAppMessage({
    customer_name: '',
    order_number: '123',
    amount_label: 'R$ 99,90',
    authentication_code: 'AUTH-123',
    approved_at_label: '04/07/2026 10:30',
  }).startsWith('Ola,'),
  'WhatsApp message without customer_name must not start with a personalized greeting',
);

assert.ok(
  !formatPdvPixReceiptWhatsAppMessage({
    order_number: '123',
    amount_label: 'R$ 99,90',
    authentication_code: 'AUTH-123',
    approved_at_label: '04/07/2026 10:30',
  }).startsWith('Ola,'),
  'WhatsApp message without customer_name field must not start with a personalized greeting',
);

console.log('pdv totem receipt core checks passed');
