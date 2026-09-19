'use strict';

const DEFAULT_UPLOAD_PATH = '/fulfillment/202502/invoice/upload';
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

async function uploadInvoice({ callJson, packageId, orderIds, xml, pathname = DEFAULT_UPLOAD_PATH }) {
  const buffer = validateNfeXml(xml);
  if (buffer.length > 1024 * 1024) throw new Error('XML da NF-e excede 1 MB, limite do TikTok Shop.');
  const ids = (Array.isArray(orderIds) ? orderIds : [orderIds]).map(String).filter(Boolean);
  if (!ids.length) throw new Error('Pedido TikTok ausente no upload da NF-e.');
  const result = await callJson({ method: 'POST', pathname, body: {
    invoices: [{ package_id: String(packageId), order_ids: ids, file_type: 'XML', file: buffer.toString('base64') }],
  } });
  if (result?.payload?.data?.errors?.length) throw new Error('TikTok Shop recusou o XML da NF-e.');
  return { ...result, packageId: String(packageId) };
}

async function fulfillTikTokPackage({ order, orderId, xml, callJson }) {
  const target = packageFromOrder(order, orderId);
  const invoice = await uploadInvoice({ callJson, packageId: target.packageId, orderIds: [target.orderId], xml });
  return { orderId: target.orderId, packageId: target.packageId, invoice, invoiceStatus: 'PROCESSING' };
}

module.exports = { DEFAULT_UPLOAD_PATH, SHIP_PATH, SHIPPING_DOCUMENT_PATH, validateNfeXml, packageFromOrder, shipPackageBody, uploadInvoice, fulfillTikTokPackage };
