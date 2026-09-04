const crypto = require('crypto');
const { PDFDocument, PDFName, PDFArray, PDFNumber, PDFNull } = require('pdf-lib');

const MAX_PDF_BYTES = 8 * 1024 * 1024;
const MAX_PAGES = 500;
function problem(message, statusCode = 400) { return Object.assign(new Error(message), { statusCode }); }
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function text(value, max = 120) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f]/.test(value)) throw problem('Texto inválido.');
  return value.trim();
}
function json(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object' && !Buffer.isBuffer(value)) return value;
  try { return JSON.parse(String(value)); } catch { return fallback; }
}
function matchPaper(printer, widthMm, heightMm) {
  const near = (a, b) => Math.abs(Number(a) - Number(b)) <= 0.3;
  return (printer?.papers || []).find(p => Number.isInteger(p.kind) && p.kind > 0 &&
    ((near(p.widthMm, widthMm) && near(p.heightMm, heightMm)) ||
      (near(p.heightMm, widthMm) && near(p.widthMm, heightMm)))) || (printer?.customSize === true ? { kind: null, custom: true } : null);
}
function normalizeInventory(input, allowed) {
  if (!Array.isArray(input) || input.length > 50) throw problem('Inventário inválido.');
  const seen = new Set();
  return input.filter(p => allowed.includes(p.name) && !seen.has(p.name) && seen.add(p.name)).map(p => ({
    name: text(p.name), status: ['ready', 'offline', 'unknown'].includes(p.status) ? p.status : 'unknown', customSize: p.customSize === true,
    papers: (Array.isArray(p.papers) ? p.papers : []).slice(0, 300).filter(v =>
      Number.isInteger(v.kind) && v.kind > 0 && Number.isFinite(v.widthMm) && v.widthMm > 0 &&
      Number.isFinite(v.heightMm) && v.heightMm > 0).map(v => ({
      name: String(v.name || '').slice(0, 100), kind: v.kind, widthMm: v.widthMm, heightMm: v.heightMm,
    })),
  }));
}
async function validatePdf(base64, expected = {}) {
  if (typeof base64 !== 'string' || base64.length > Math.ceil(MAX_PDF_BYTES / 3) * 4 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw problem('PDF inválido ou maior que 8 MB.');
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > MAX_PDF_BYTES || buffer.subarray(0, 5).toString() !== '%PDF-') throw problem('Arquivo não é um PDF.');
  let doc;
  try { doc = await PDFDocument.load(buffer); } catch { throw problem('PDF ilegível ou protegido.'); }
  const pages = doc.getPages();
  if (!pages.length || pages.length > MAX_PAGES) throw problem('O PDF deve ter de 1 a 500 páginas.');
  // jsPDF writes a harmless initial page view. Accept only an explicit local
  // page destination; action dictionaries (including Print/JavaScript) stay blocked.
  const openAction = doc.catalog.lookup(PDFName.of('OpenAction'));
  const destinationLengths = { '/XYZ': 5, '/Fit': 2, '/FitH': 3, '/FitV': 3, '/FitR': 6, '/FitB': 2, '/FitBH': 3, '/FitBV': 3 };
  const safeView = openAction instanceof PDFArray && pages.some(p => p.ref.toString() === openAction.get(0)?.toString()) &&
    destinationLengths[openAction.get(1)?.toString()] === openAction.size() &&
    openAction.asArray().slice(2).every(v => v instanceof PDFNumber || v === PDFNull);
  // Uploads are printable documents, never interactive PDFs or attachments.
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (typeof object?.keys !== 'function') continue;
    for (const key of object.keys()) {
      if (key.toString() === '/OpenAction' && object === doc.catalog && safeView) continue;
      if (['/JS', '/JavaScript', '/OpenAction', '/AA', '/EmbeddedFiles', '/Launch', '/RichMediaContent'].includes(key.toString())) {
        throw problem('Use um PDF sem scripts, ações automáticas ou anexos.');
      }
    }
  }
  if (openAction && !safeView) throw problem('Use um PDF sem impressão automática embutida.');
  const widthMm = pages[0].getWidth() * 25.4 / 72;
  const heightMm = pages[0].getHeight() * 25.4 / 72;
  if (widthMm < 10 || heightMm < 10 || widthMm > 1000 || heightMm > 2000) throw problem('Dimensões inválidas.');
  if (pages.some(p => Math.abs(p.getWidth() * 25.4 / 72 - widthMm) > 0.1 ||
      Math.abs(p.getHeight() * 25.4 / 72 - heightMm) > 0.1 || p.getRotation().angle % 360 !== 0)) {
    throw problem('Todas as páginas devem ter o mesmo tamanho e orientação, sem rotação embutida.');
  }
  if ((expected.widthMm != null && Math.abs(expected.widthMm - widthMm) > 0.1) ||
      (expected.heightMm != null && Math.abs(expected.heightMm - heightMm) > 0.1) ||
      (expected.pages != null && expected.pages !== pages.length)) throw problem('PDF diverge das configurações de impressão.');
  return { buffer, hash: hash(buffer), widthMm, heightMm, pages: pages.length };
}
function printOptions(job, inventory) {
  const printer = inventory.find(p => p.name === job.printer_name);
  if (!printer || printer.status === 'offline') throw problem('Impressora não disponível.');
  const paper = matchPaper(printer, Number(job.width_mm), Number(job.height_mm));
  if (!paper) throw problem('O driver não oferece o tamanho solicitado. Configure esse papel no Lenovo.');
  return { printer: printer.name, ...(paper.kind ? { paperKind: paper.kind } : {}), scale: 'noscale', copies: 1, side: 'simplex' };
}
module.exports = { MAX_PDF_BYTES, MAX_PAGES, problem, hash, text, json, matchPaper, normalizeInventory, validatePdf, printOptions };
