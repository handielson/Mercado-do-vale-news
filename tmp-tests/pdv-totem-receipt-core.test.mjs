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
  const localReference = String(payment?.local_reference || '').trim();
  if (localReference) {
    if (localReference.toLowerCase().startsWith('standalone_pix:')) {
      const description = String(payment?.description || '').trim();
      if (description && description !== 'Pix avulso Mercado do Vale') return description;
      const standaloneId = localReference.slice(localReference.indexOf(':') + 1);
      const codeSource = String(standaloneId || payment?.id || payment?.mercado_pago_payment_id || '')
        .replace(/[^a-z0-9]/gi, '')
        .toUpperCase();
      return `PIX-${codeSource.slice(-6) || 'AVULSO'}`;
    }
    const saleMatch = localReference.match(/^sale:(.+)$/i);
    const pdvMatch = localReference.match(/^pdv:(.+)$/i);
    if (pdvMatch?.[1]) return pdvMatch[1];
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(localReference)) {
      return `PDV-${localReference.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    }
    return saleMatch?.[1] || localReference;
  }
  const saleDraftId = String(payment?.sale_draft_id || '').trim();
  if (saleDraftId) return saleDraftId;
  return String(payment?.id || '').trim();
}

function formatPdvReceiptAmount(cents) {
  return (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
assert.equal(
  getPdvPixReceiptOrderNumber({ local_reference: 'pdv:PDV-0706-1202-A1B2', id: 'fallback' }),
  'PDV-0706-1202-A1B2',
  'PDV Pix local reference must expose the customer-facing reference',
);
assert.equal(
  getPdvPixReceiptOrderNumber({ local_reference: 'f29e6068-0f74-48b4-982b-b1600ad2963c', id: 'fallback' }),
  'PDV-F29E6068',
  'legacy raw UUID local reference must be shortened before showing to the customer',
);
assert.equal(
  getPdvPixReceiptOrderNumber({
    local_reference: 'standalone_pix:550e8400-e29b-41d4-a716-446655440000',
    description: 'Cliente Joao - taxa',
    id: 'fallback',
  }),
  'Cliente Joao - taxa',
  'standalone Pix receipt must use the operator description when provided',
);
assert.equal(
  formatPdvReceiptAmount(100).replace(/\s/u, ' '),
  'R$ 1,00',
  'receipt amount must treat stored Pix amount as cents',
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
  let source = readFileSync(file, 'utf8');
  if (file === 'vps_server.js' || file === 'vps_server.cjs') {
    source = source
      .replace(/const legacyCompanyFooterText[\s\S]*?WHERE footer_text = \?`,\s*\[\s*legacyCompanyFooterText\s*\]\s*\);/, '')
      .replace(/await pool\.query\(\s*`UPDATE whatsapp_automation_logs[\s\S]*?WHERE rendered_text LIKE '%Obrigado pela preferencia%'`\s*\);/, '')
      .replace(/const legacyIdleDisplayMessageRegex[\s\S]*?for \(const displayRow of legacyIdleDisplayRows\) \{[\s\S]*?\n  \}/, '');
  }
  assert.doesNotMatch(
    source,
    /Obrigado pela prefer[êe]ncia|Obrigado pela preferencia/i,
    `${file} must not include the preference thank-you line in operational messages`,
  );
}

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');
  assert.match(source, /UPDATE company_settings[\s\S]*SET footer_text = 'Volte sempre!'/, `${file} must migrate legacy company footer text`);
  assert.match(source, /UPDATE whatsapp_automation_logs[\s\S]*Obrigado pela preferencia/, `${file} must clean legacy preference text from WhatsApp logs`);
  assert.match(source, /SELECT id, idle_content_json[\s\S]*FROM pdv_displays[\s\S]*legacyIdleDisplayMessageRegex/, `${file} must clean legacy preference text from saved display idle messages`);
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
