const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { hash, validatePdf, printOptions } = require('../services/centralPrintingCore.cjs');
const execFileAsync = promisify(execFile);

// No interpolation of server/browser values into PowerShell commands.
const INVENTORY_SCRIPT = `
$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class MdvCapabilities { [DllImport("winspool.drv",CharSet=CharSet.Unicode)] public static extern int DeviceCapabilities(string name,string port,short capability,IntPtr output,IntPtr mode); }'
$result=@(Get-CimInstance Win32_Printer | ForEach-Object {
  $printer=$_; $settings=New-Object System.Drawing.Printing.PrinterSettings
  $settings.PrinterName=$printer.Name
  $papers=@($settings.PaperSizes | ForEach-Object {
    [pscustomobject]@{name=$_.PaperName;kind=[int]$_.RawKind;widthMm=[double]($_.Width*0.254);heightMm=[double]($_.Height*0.254)}
  })
  $state='unknown'
  if($printer.WorkOffline -or $printer.PrinterStatus -eq 7){$state='offline'}
  elseif($printer.PrinterStatus -in 3,4,5){$state='ready'}
  $fields=[MdvCapabilities]::DeviceCapabilities($printer.Name,$printer.PortName,1,[IntPtr]::Zero,[IntPtr]::Zero)
  [pscustomobject]@{name=$printer.Name;status=$state;papers=$papers;customSize=($fields -ge 0 -and ($fields -band 12) -eq 12)}
})
ConvertTo-Json -InputObject $result -Depth 5 -Compress
`;
async function getWindowsPrintInventory() {
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand',
    Buffer.from(INVENTORY_SCRIPT, 'utf16le').toString('base64')], { windowsHide: true, timeout: 20000, maxBuffer: 2 * 1024 * 1024 });
  const inventory = JSON.parse(stdout.replace(/^\uFEFF/, '').trim()).filter(p => !p.name.startsWith('MDV Central '));
  const helper = path.join(__dirname, 'central-print-runtime', 'central-print-paper.exe');
  if (fs.existsSync(helper)) {
    // P50/LABEL legacy drivers omit DC_FIELDS flags despite accepting custom
    // DEVMODE dimensions. Probe in memory; the actual job is validated again.
    for (const printer of inventory.filter(p => !p.customSize)) {
      try {
        const result = await execFileAsync(helper, [printer.name, '30', '20', 'probe'], { windowsHide: true, timeout: 10000 });
        printer.customSize = JSON.parse(result.stdout.trim()).accepted === true;
      } catch { printer.customSize = false; }
    }
  }
  return inventory;
}
function writeJournal(file, record) {
  const temp = `${file}.tmp`;
  const fd = fs.openSync(temp, 'w', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(record)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temp, file);
}
async function prepareWindowsPaper(job) {
  const executable = path.join(__dirname, 'central-print-runtime', 'central-print-paper.exe');
  if (!fs.existsSync(executable)) throw new Error('Auxiliar de papel não instalado no Lenovo.');
  const { stdout } = await execFileAsync(executable, [job.printer_name, String(Number(job.width_mm)), String(Number(job.height_mm))],
    { windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 });
  return JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
}
async function executeJob({ job, inventory, directory, request, print, report, preparePaper = prepareWindowsPaper }) {
  if (!/^[a-f0-9-]{36}$/i.test(job.id)) throw new Error('ID de trabalho inválido.');
  const journalFile = path.join(directory, `${job.id}.json`);
  const pdfFile = path.join(directory, `${job.id}.pdf`);
  let record = fs.existsSync(journalFile) ? JSON.parse(fs.readFileSync(journalFile, 'utf8')) : null;
  if (record) {
    // A local physical attempt is never repeated, even after a new server lease.
    const status = record.status === 'submitted' ? 'submitted' : record.status === 'failed' ? 'failed' : 'uncertain';
    if (status === 'submitted') await request(`/jobs/${job.id}/start`, { claimToken: job.claimToken });
    await report(job, status, status === 'uncertain' ? 'Tentativa anterior encontrada no Lenovo; conferir antes de reimprimir.' : record.error);
    return;
  }
  let started = false;
  try {
    const options = printOptions(job, inventory);
    const buffer = await request(`/jobs/${job.id}/pdf`, null, { pdf: true, claim: job.claimToken });
    if (hash(buffer) !== job.pdf_hash) throw new Error('PDF recebido não confere com o documento solicitado.');
    await validatePdf(buffer.toString('base64'), { widthMm: Number(job.width_mm), heightMm: Number(job.height_mm), pages: job.pages });
    if (!options.paperKind) {
      const prepared = await preparePaper(job);
      if (!prepared?.printer?.startsWith('MDV Central ') || Math.abs(prepared.widthMm - job.width_mm) > 0.1 || Math.abs(prepared.heightMm - job.height_mm) > 0.1) throw new Error('Configuração do papel não confirmada.');
      options.printer = prepared.printer;
    }
    fs.writeFileSync(pdfFile, buffer, { mode: 0o600 });
    record = { id: job.id, claimToken: job.claimToken, status: 'sending', pdfHash: job.pdf_hash };
    writeJournal(journalFile, record);
    // Durable intent precedes both the server transition and the irreversible spooler call.
    started = true;
    await request(`/jobs/${job.id}/start`, { claimToken: job.claimToken });
    await print(pdfFile, options);
    record.status = 'submitted';
    writeJournal(journalFile, record);
  } catch (error) {
    record = { ...(record || { id: job.id, claimToken: job.claimToken }), status: started ? 'uncertain' : 'failed',
      error: started ? 'Envio sem confirmação. Confira a impressora antes de reimprimir.' : String(error.message).slice(0, 300) };
    writeJournal(journalFile, record);
  }
  await report(job, record.status, record.error);
  if (fs.existsSync(pdfFile)) fs.unlinkSync(pdfFile);
}
function startCentralPrintAgent({ env = process.env, directory = path.join(__dirname, 'central-print-journal'),
  inventoryReader = getWindowsPrintInventory, print = (...args) => require('pdf-to-printer').print(...args), requestFetch = global.fetch } = {}) {
  if (!env.MDV_PRINT_DEVICE_TOKEN || !env.MDV_PRINT_API_URL) return null;
  const base = new URL(env.MDV_PRINT_API_URL);
  if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
    throw new Error('MDV_PRINT_API_URL deve ser a origem HTTPS da API.');
  }
  fs.mkdirSync(directory, { recursive: true });
  const active = new Map(); let ticking = false;
  const request = async (route, body, { pdf = false, claim } = {}) => {
    const res = await requestFetch(`${base.origin}/printing/agent${route}`, {
      method: body === null ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${env.MDV_PRINT_DEVICE_TOKEN}`, 'Content-Type': 'application/json', ...(claim ? { 'x-print-claim': claim } : {}) },
      ...(body !== null ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000), redirect: 'error',
    });
    if (!res.ok) throw new Error(`Impressão central: HTTP ${res.status}`);
    return pdf ? Buffer.from(await res.arrayBuffer()) : res.json();
  };
  const report = (job, status, error) => request(`/jobs/${job.id}/result`, { claimToken: job.claimToken, status, error });
  const recover = async () => {
    for (const entry of fs.readdirSync(directory).filter(n => n.endsWith('.json'))) {
      const file = path.join(directory, entry);
      const record = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (record.reported || [...active.values()].some(v => v.id === record.id)) continue;
      const status = record.status === 'sending' ? 'uncertain' : record.status;
      await report({ id: record.id, claimToken: record.claimToken }, status, record.error).then(() => {
        writeJournal(file, { ...record, status, reported: true });
        const pdfFile = path.join(directory, `${record.id}.pdf`);
        if (fs.existsSync(pdfFile)) fs.unlinkSync(pdfFile);
      }).catch(() => {});
    }
  };
  const tick = async () => {
    if (ticking) return;
    ticking = true;
    try {
      const inventory = await inventoryReader();
      const heartbeat = await request('/heartbeat', { printers: inventory });
      await recover();
      for (const printer of inventory.filter(p => heartbeat.printers.includes(p.name) && p.status !== 'offline')) {
        if (active.has(printer.name)) continue;
        const { job } = await request('/claim', { printerName: printer.name });
        if (!job) continue;
        active.set(printer.name, job);
        void executeJob({ job, inventory, directory, request, print, report }).catch(() => {
          console.error(`[Impressão central] Resultado de ${job.id} pendente de sincronização.`);
        }).finally(() => active.delete(printer.name));
      }
    } catch (error) { console.error('[Impressão central]', error.message); }
    finally { ticking = false; }
  };
  void tick();
  const timer = setInterval(() => void tick(), 15000);
  return { stop: () => clearInterval(timer), tick };
}
module.exports = { startCentralPrintAgent, executeJob, getWindowsPrintInventory, writeJournal };
