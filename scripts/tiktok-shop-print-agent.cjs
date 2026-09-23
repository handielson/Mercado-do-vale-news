'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { PDFDocument } = require('pdf-lib');
const { createMercadoLivreSummaryPdf } = require('./mercado-livre-print-core.cjs');
const { prepareMercadoLivreSummaryPrinter } = require('./mercado-livre-print-agent.cjs');

async function listWindowsPrinters(run = promisify(execFile)) {
  const { stdout } = await run('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-Command', 'Get-Printer | Select-Object -ExpandProperty Name',
  ], { timeout: 10000, windowsHide: true });
  return String(stdout).split(/\r?\n/).map(name => name.trim()).filter(Boolean).map(name => ({ name }));
}

function requestFactory(apiUrl, syncKey, requestFetch = global.fetch) {
  const base = new URL(apiUrl);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw new Error('API HTTPS inválida');
  return async (route, { body, pdf = false } = {}) => {
    const response = await requestFetch(`${base.origin}/api/tiktok-shop${route}`, {
      method: body ? 'POST' : 'GET', redirect: 'error', headers: {
        'x-sync-key': syncKey, ...(body ? { 'Content-Type': 'application/json' } : {}),
      }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000),
    });
    if (response.status === 204) return null;
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      let detail = errorBody;
      try { detail = JSON.parse(errorBody)?.detail || JSON.parse(errorBody)?.error || errorBody; } catch {}
      const error = new Error(`TikTok Shop ${route}: HTTP ${response.status}${detail ? ` - ${String(detail).slice(0, 500)}` : ''}`);
      error.status = response.status;
      error.retryable = [409, 429, 500, 502, 503, 504].includes(response.status);
      throw error;
    }
    return pdf ? Buffer.from(await response.arrayBuffer()) : response.json();
  };
}

function journalWrite(file, data) {
  const temporary = `${file}.tmp`;
  const fd = fs.openSync(temporary, 'w', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(data)); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(temporary, file);
}

function separationLocation(value) {
  const locations = String(value || '').split(' | ').map(item => item.trim()).filter(Boolean);
  return locations.find(item => /\b(?:caixa|prateleira|gaveta|corredor|armario|armário|estante)\b/i.test(item))
    || locations[0] || 'Nao cadastrada';
}

async function executeTikTokPrintJob({ job, settings, request, print, getStockLocations,
  directory, journalDirectory, prepareSummaryPrinter = prepareMercadoLivreSummaryPrinter, logger = console }) {
  const packageId = String(job.packageId || '');
  if (!/^\d{8,32}$/.test(packageId)) throw new Error('Pacote TikTok inválido');
  const labelPrinter = String(settings.shopee_printer_thermal || '').trim();
  const summaryPrinter = String(settings.shopee_printer_a4 || '').trim();
  if (!labelPrinter || !summaryPrinter) throw new Error('Impressoras Zebra e Comprovante não configuradas');
  fs.mkdirSync(directory, { recursive: true });
  fs.mkdirSync(journalDirectory, { recursive: true });
  const route = `/print-jobs/${encodeURIComponent(packageId)}`;
  try {
    for (const step of [
      { name: 'label', field: 'labelPrintedAt', printer: labelPrinter },
      { name: 'summary', field: 'summaryPrintedAt', printer: summaryPrinter },
    ]) {
      if (job[step.field]) continue;
      const journalFile = path.join(journalDirectory, `${packageId}.${step.name}.json`);
      let record = fs.existsSync(journalFile) ? JSON.parse(fs.readFileSync(journalFile, 'utf8')) : null;
      if (record?.status === 'sending') {
        const error = new Error(`Conferir ${step.name} do pacote ${packageId} no Lenovo antes de reimprimir`);
        error.retryable = false;
        throw error;
      }
      if (!record) {
        let pdf;
        if (step.name === 'label') pdf = await request(`${route}/label`, { pdf: true });
        else {
          const summary = { ...job.summary, marketplaceName: 'TIKTOK SHOP', items: (job.summary?.items || []).map(item => ({ ...item })) };
          if (getStockLocations) {
            const locations = await getStockLocations(summary.items.map(item => item.sku).filter(Boolean));
            summary.items = summary.items.map(item => ({ ...item,
              stockLocation: separationLocation(locations[String(item.sku).toUpperCase()]) }));
          }
          pdf = await createMercadoLivreSummaryPdf(summary);
        }
        if (!(await PDFDocument.load(pdf)).getPageCount()) throw new Error('PDF TikTok vazio');
        const filename = path.join(directory, `TIKTOK-${packageId}-${step.name}.pdf`);
        fs.writeFileSync(filename, pdf, { mode: 0o600 });
        record = { packageId, step: step.name, status: 'sending', startedAt: new Date().toISOString() };
        journalWrite(journalFile, record);
        try {
          await print(filename, step.name === 'label'
            ? { printer: step.printer, paperSize: '4x6', scale: 'fit' }
            : await prepareSummaryPrinter(step.printer));
        } catch {
          const error = new Error(`Conferir envio de ${step.name} do pacote ${packageId} ao Windows`);
          error.retryable = false;
          throw error;
        }
        journalWrite(journalFile, { ...record, status: 'submitted', submittedAt: new Date().toISOString() });
      }
      await request(`${route}/step`, { body: { step: step.name } });
      logger.log(`TikTok Shop: ${packageId} ${step.name} confirmado`);
    }
    await request(`${route}/complete`, { body: { ok: true } });
  } catch (error) {
    const retryable = error.retryable ?? (error instanceof TypeError || ['TimeoutError', 'AbortError'].includes(error.name));
    await request(`${route}/complete`, { body: { ok: false, retryable, error: String(error.message).slice(0, 1000) } }).catch(() => {});
    throw error;
  }
}

function startTikTokPrintAgent({ apiUrl, syncKey, getSettings, getStockLocations,
  request = requestFactory(apiUrl, syncKey), print = (...args) => require('pdf-to-printer').print(...args),
  listPrinters = listWindowsPrinters,
  directory = path.join(__dirname, 'Etiquetas de envio'),
  journalDirectory = path.join(__dirname, 'tiktok_shop_printed'), logger = console, intervalMs = 60000 } = {}) {
  if (!syncKey) throw new Error('Chave da API ausente');
  let running = false;
  let missingPrintersWarning = '';
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const settings = await getSettings();
      const requiredPrinters = [settings?.shopee_printer_thermal, settings?.shopee_printer_a4].map(value => String(value || '').trim());
      const availablePrinters = new Set((await listPrinters()).map(printer => String(printer.name || '').trim()));
      const missingPrinters = requiredPrinters.filter(name => !name || !availablePrinters.has(name));
      if (missingPrinters.length) {
        const warning = `Impressoras TikTok indisponíveis neste computador: ${missingPrinters.join(', ') || 'não configuradas'}`;
        if (warning !== missingPrintersWarning) logger.warn(warning);
        missingPrintersWarning = warning;
        return;
      }
      missingPrintersWarning = '';
      const job = await request('/print-jobs/next');
      if (job) await executeTikTokPrintJob({ job, settings, request, print,
        getStockLocations, directory, journalDirectory, logger });
    } catch (error) { logger.error('TikTok Shop Auto Print:', error.message); }
    finally { running = false; }
  };
  logger.log('TikTok Shop Auto Print: consulta a cada 60 segundos');
  void tick();
  const timer = setInterval(() => void tick(), intervalMs);
  return { tick, stop: () => clearInterval(timer) };
}

module.exports = { requestFactory, executeTikTokPrintJob, startTikTokPrintAgent, separationLocation, listWindowsPrinters };
