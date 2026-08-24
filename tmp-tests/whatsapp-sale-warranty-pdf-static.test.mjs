import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pdv = readFileSync('pages/pdv/PDVPage.tsx', 'utf8');
const generator = readFileSync('utils/warrantyPdfGenerator.ts', 'utf8');
const service = readFileSync('services/warrantyWhatsAppService.ts', 'utf8');
const saleService = readFileSync('services/saleService.ts', 'utf8');

assert.match(pdv, /const buildWarrantyTermData = async/, 'PDV must centralize the existing printable warranty data');
assert.match(pdv, /generateWarrantyTerm[\s\S]*buildWarrantyTermData/, 'manual printing must reuse the centralized warranty data');
assert.match(pdv, /buildWarrantyTermData\(sale, selectedCustomer, cartItems\)[\s\S]*generateExistingWarrantyTermPdfBase64[\s\S]*sendSaleWarrantyPdfWhatsApp/, 'sale finalization must turn that same term into the WhatsApp PDF');
assert.match(generator, /renderWarrantyBothCopies/, 'automatic PDF must reuse the same two-copy renderer as the print modal');
assert.match(generator, /copies\.push\(rendered\.copy1, rendered\.copy2\)/, 'automatic PDF must preserve both printed copies');
assert.match(generator, /new jsPDF[\s\S]*toPng\(host/, 'automatic PDF must capture the existing HTML layout into a real PDF');
assert.match(service, /\/whatsapp\/automation\/sale-warranty-pdf/, 'frontend must send the rendered PDF through the dedicated API route');
assert.match(saleService, /saleWhatsAppNotification = vpsClient\.post\('\/whatsapp\/automation\/sale-completed'/, 'sale confirmation must be retained for sequencing');
assert.match(saleService, /await saleWhatsAppNotification/, 'sale finalization must await the confirmation text before returning to PDF generation');

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const source = readFileSync(file, 'utf8');
  assert.match(source, /\/message\/sendMedia\/\$\{encodeURIComponent\(instanceName\)\}/, `${file} must use Evolution sendMedia`);
  assert.match(source, /mediatype: 'document'[\s\S]*mimetype: 'application\/pdf'[\s\S]*fileName,/, `${file} must send the PDF as a named document`);
  assert.match(source, /fastify\.post\('\/whatsapp\/automation\/sale-warranty-pdf'/, `${file} must expose the protected warranty PDF send route`);
  assert.match(source, /pdfBuffer\.subarray\(0, 5\)\.toString\('ascii'\) !== '%PDF-'/, `${file} must reject non-PDF payloads`);
  assert.match(source, /serialized_unit_id IS NOT NULL/, `${file} must accept warranty PDFs only for serialized sales`);
  assert.match(source, /warranty_pdf_(sent|failed)/, `${file} must log the document send outcome`);
}

console.log('WhatsApp existing warranty term PDF contract checks passed');
