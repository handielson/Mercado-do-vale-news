'use strict';

const STOREFRONTS = Object.freeze(['mercado_do_vale', 'loja_3d']);
const STATUSES = Object.freeze(['new', 'contacted', 'negotiating', 'approved', 'declined', 'closed']);

function invalid(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function text(value, field, { min = 0, max, required = false } = {}) {
  const normalized = String(value || '').trim().replace(/\s+/g, ' ');
  if (required && normalized.length < min) throw invalid(`${field} é obrigatório.`);
  if (normalized.length > max) throw invalid(`${field} excede o limite permitido.`);
  return normalized || null;
}

function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (digits.length < 12 || digits.length > 13 || !digits.startsWith('55')) throw invalid('Informe um WhatsApp válido com DDD.');
  return digits;
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!email) return null;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw invalid('Informe um e-mail válido.');
  return email;
}

function normalizeDeadlineRequest(storefront, input) {
  if (!STOREFRONTS.includes(storefront)) throw invalid('Site desconhecido.');
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid('Solicitação inválida.');
  if (String(input.website || '').trim()) throw invalid('Solicitação inválida.');
  const quantity = Number(input.quantity);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000) throw invalid('A quantidade deve ficar entre 1 e 10000 unidades.');
  return {
    storefront,
    product_id: text(input.product_id, 'Produto', { min: 1, max: 100, required: true }),
    quantity,
    customer_name: text(input.customer_name, 'Nome', { min: 2, max: 160, required: true }),
    customer_phone: normalizePhone(input.customer_phone),
    customer_email: normalizeEmail(input.customer_email),
    customer_message: text(input.customer_message, 'Mensagem', { max: 1000 }),
  };
}

function deadlineLabel(days) {
  const value = Number(days);
  return Number.isSafeInteger(value) && value > 0
    ? `${value} ${value === 1 ? 'dia útil estimado' : 'dias úteis estimados'}`
    : 'Prazo sob consulta';
}

function normalizeAdminUpdate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid('Atualização inválida.');
  const status = String(input.status || '').trim();
  if (!STATUSES.includes(status)) throw invalid('Status inválido.');
  const days = input.negotiated_business_days === '' || input.negotiated_business_days == null
    ? null : Number(input.negotiated_business_days);
  if (days !== null && (!Number.isSafeInteger(days) || days < 1 || days > 3650)) throw invalid('O prazo negociado deve ficar entre 1 e 3650 dias úteis.');
  return { status, negotiated_business_days: days, admin_notes: text(input.admin_notes, 'Observação interna', { max: 2000 }) };
}

function buildAdminNotification(request) {
  const site = request.storefront === 'loja_3d' ? 'Loja 3D' : 'Mercado do Vale';
  return [
    `🔔 Nova solicitação de prazo · ${site}`,
    `Protocolo: ${request.public_code}`,
    `Produto: ${request.product_name} · SKU ${request.sku}`,
    `Quantidade desejada: ${request.quantity}`,
    `Prazo exibido: ${request.lead_time_label}`,
    `Cliente: ${request.customer_name}`,
    `WhatsApp: ${request.customer_phone}`,
    request.customer_email ? `E-mail: ${request.customer_email}` : null,
    request.customer_message ? `Mensagem: ${request.customer_message}` : null,
    '',
    'Acesse o painel para analisar a quantidade e negociar o prazo.',
  ].filter(Boolean).join('\n');
}

module.exports = { STOREFRONTS, STATUSES, normalizeDeadlineRequest, normalizeAdminUpdate, deadlineLabel, buildAdminNotification };
