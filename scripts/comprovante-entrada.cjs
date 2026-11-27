'use strict';
// comprovante-entrada-v1 (roda no Lenovo da loja, PM2 "comprovante-entrada").
// O agente de etiquetas agora roda no servidor CCE; os resumos/comprovantes da impressora "Comprovante"
// chegam aqui por scp (printer-driver-v4): <id>.pdf e depois <id>.json com as opções. Este vigia imprime e arquiva.
const fs = require('fs');
const path = require('path');

const BASE = process.env.MDV_COMPROVANTE_ENTRADA || 'C:\\ProgramData\\MercadoDoVale\\comprovante-entrada';
const DONE = path.join(BASE, 'impressos');
const FAILED = path.join(BASE, 'erro');
const MAX_ATTEMPTS = 5;
const KEEP_DAYS = 7;

function optionsFor(meta, prepare) {
  const m = /^Custom\.(\d+)x(\d+)mm$/.exec(meta.media || '');
  if (!m) return Promise.resolve({ printer: meta.printer, scale: meta.scale || 'shrink', ...(meta.orientation ? { orientation: meta.orientation } : {}) });
  return prepare(meta.printer, Number(m[1]), Number(m[2]))
    .then((o) => ({ ...o, ...(meta.orientation ? { orientation: meta.orientation } : {}) }))
    .catch((e) => {
      console.warn(`[comprovante] papel ${m[1]}x${m[2]} não criado (${String(e.message).split('\n').pop()}); vai encolhido.`);
      return { printer: meta.printer, scale: 'shrink', ...(meta.orientation ? { orientation: meta.orientation } : {}) };
    });
}

async function processOnce({ dir = BASE, print, prepare, logger = console } = {}) {
  for (const d of [dir, path.join(dir, 'impressos'), path.join(dir, 'erro')]) fs.mkdirSync(d, { recursive: true });
  let done = 0;
  for (const json of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const jsonPath = path.join(dir, json);
    const pdfPath = jsonPath.replace(/\.json$/, '.pdf');
    let meta;
    try { meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); } catch { continue; }
    if (!fs.existsSync(pdfPath)) continue;
    const options = meta.options || {};
    if (!options.printer) options.printer = 'Comprovante';
    try {
      await print(pdfPath, await optionsFor(options, prepare));
      for (const f of [pdfPath, jsonPath]) fs.renameSync(f, path.join(dir, 'impressos', path.basename(f)));
      logger.log(`[comprovante] impresso ${meta.file || json} em ${options.printer}`);
      done += 1;
    } catch (error) {
      meta.attempts = (meta.attempts || 0) + 1;
      meta.lastError = String(error.message).slice(0, 300);
      fs.writeFileSync(jsonPath, JSON.stringify(meta));
      logger.error(`[comprovante] falhou ${meta.file || json} (${meta.attempts}/${MAX_ATTEMPTS}): ${meta.lastError}`);
      if (meta.attempts >= MAX_ATTEMPTS) for (const f of [pdfPath, jsonPath]) fs.renameSync(f, path.join(dir, 'erro', path.basename(f)));
    }
  }
  const limit = Date.now() - KEEP_DAYS * 86400000;
  for (const f of fs.readdirSync(path.join(dir, 'impressos'))) {
    const p = path.join(dir, 'impressos', f);
    try { if (fs.statSync(p).mtimeMs < limit) fs.rmSync(p, { force: true }); } catch {}
  }
  return done;
}

if (require.main === module) {
  const { print } = require('pdf-to-printer');
  const { prepareMercadoLivreSummaryPrinter } = require('./mercado-livre-print-agent.cjs');
  console.log(`[comprovante] vigiando ${BASE}`);
  let busy = false;
  setInterval(async () => {
    if (busy) return; busy = true;
    try { await processOnce({ print, prepare: prepareMercadoLivreSummaryPrinter }); }
    catch (e) { console.error('[comprovante]', e.message); } finally { busy = false; }
  }, 3000);
}

module.exports = { processOnce, optionsFor };
