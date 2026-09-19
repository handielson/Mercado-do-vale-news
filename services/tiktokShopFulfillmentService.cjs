'use strict';

const DEFAULT_UPLOAD_PATH = '/fulfillment/202309/packages/invoice/upload';
const SHIP_PATH = '/fulfillment/202309/packages/ship';
const SHIPPING_DOCUMENT_PATH = packageId => `/fulfillment/202309/packages/${encodeURIComponent(String(packageId))}/shipping_documents`;

function validateNfeXml(buffer, maxBytes = 10 * 1024 * 1024) {
  const value = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || '');
  if (!value.length || value.length > maxBytes) throw new Error('XML da NF-e vazio ou acima de 10 MB.');
  const preview = value.subarray(0, 4096).toString('utf8');
  if (!/<(?:nfeProc|NFe)\b/i.test(preview)) throw new Error('Arquivo não é um XML NF-e válido.');
  return value;
}

function packageFromOrder(order, expectedOrderId = '') {
  const id = String(expectedOrderId || order?.id || '').trim();
  const packages = Array.isArray(order?.packages) ? order.packages : [];
  if (!id || !packages.length) throw new Error('Pedido TikTok não retornou pacote para expedição.');
  const pkg = packages[0];
  const packageId = String(pkg?.id || pkg?.package_id || '').trim();
  if (!packageId) throw new Error('Pacote TikTok sem package_id.');
  return { orderId: id, packageId, package: pkg };
}

function shipPackageBody(packageId, { handoverMethod = 'DROP_OFF', pickupSlot = null } = {}) {
  const item = { id: String(packageId), handover_method: handoverMethod };
  if (handoverMethod === 'PICKUP' && pickupSlot) item.pickup_slot = pickupSlot;
  return { packages: [item] };
}

async function uploadInvoice({ callMultipart, packageId, xml, filename, pathname = DEFAULT_UPLOAD_PATH }) {
  const buffer = validateNfeXml(xml);
  const result = await callMultipart({
    pathname,
    fields: { package_id: String(packageId) },
    file: { buffer, filename: filename || `NFE-${packageId}.xml`, contentType: 'application/xml' },
  });
  return { ...result, packageId: String(packageId) };
}

async function fulfillTikTokPackage({ order, orderId, xml, callMultipart, callJson, getDocument, handoverMethod = 'DROP_OFF' }) {
  const target = packageFromOrder(order, orderId);
  const invoice = await uploadInvoice({ callMultipart, packageId: target.packageId, xml });
  const shipped = await callJson({ method: 'POST', pathname: SHIP_PATH, body: shipPackageBody(target.packageId, { handoverMethod }) });
  const document = await getDocument({ packageId: target.packageId, documentType: 'SHIPPING_LABEL', invoiceLabel: true });
  return { orderId: target.orderId, packageId: target.packageId, invoice, shipped, document };
}

module.exports = { DEFAULT_UPLOAD_PATH, SHIP_PATH, SHIPPING_DOCUMENT_PATH, validateNfeXml, packageFromOrder, shipPackageBody, uploadInvoice, fulfillTikTokPackage };
