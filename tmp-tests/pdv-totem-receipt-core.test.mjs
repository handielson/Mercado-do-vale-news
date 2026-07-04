import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

function getPdvPixReceiptOrderNumber(payment) {
  const saleDraftId = String(payment?.sale_draft_id || '').trim();
  if (saleDraftId) return saleDraftId;
  const localReference = String(payment?.local_reference || '').trim();
  if (localReference) {
    if (localReference.toLowerCase().startsWith('standalone_pix:')) {
      const standaloneId = localReference.slice(localReference.indexOf(':') + 1);
      const codeSource = String(standaloneId || payment?.id || payment?.mercado_pago_payment_id || '')
        .replace(/[^a-z0-9]/gi, '')
        .toUpperCase();
      return `PIX-${codeSource.slice(-6) || 'AVULSO'}`;
    }
    const saleMatch = localReference.match(/^sale:(.+)$/i);
    return saleMatch?.[1] || localReference;
  }
  return String(payment?.id || '').trim();
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
assert.equal(
  getPdvPixReceiptOrderNumber({ local_reference: 'standalone_pix:550e8400-e29b-41d4-a716-446655440000', id: 'fallback' }),
  'PIX-440000',
  'standalone Pix receipt must use a short traceable code',
);
assert.equal(
  getPdvPixReceiptOrderNumber({ local_reference: 'sale:12345', id: 'fallback' }),
  '12345',
  'sale local reference must keep exposing the sale order number',
);

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
  'Mercado do Vale',
]) {
  assert.ok(whatsappMessage.includes(expectedLine), `WhatsApp message must include ${expectedLine}`);
}

assert.ok(
  !whatsappMessage.includes('Obrigado pela preferencia!'),
  'WhatsApp message must not include the preference thank-you line',
);

for (const file of [
  'vps_server.js',
  'vps_server.cjs',
  'services/whatsappAutomationTemplateService.ts',
  'utils/printSaleReceipt.ts',
  'services/companySettingsService.ts',
  'pages/admin/settings/DocumentSettingsPage.tsx',
]) {
  const source = readFileSync(file, 'utf8');
  assert.doesNotMatch(
    source,
    /Obrigado pela prefer[êe]ncia|Obrigado pela preferencia/i,
    `${file} must not include the preference thank-you line in operational messages`,
  );
}

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');
  assert.match(source, /UPDATE company_settings[\s\S]*SET footer_text = 'Volte sempre!'/, `${file} must migrate legacy company footer text`);
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
