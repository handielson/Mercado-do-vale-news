'use strict';
// printer-driver-v1: mesma interface do pdf-to-printer (print/getPrinters/getDefaultPrinter).
// Windows (Lenovo da loja): delega ao pdf-to-printer, sem mudar nada.
// Linux (servidor CCE, depois da mudança): manda para o CUPS com lp/lpstat.
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');

// Etiqueta de envio: o rolo da loja é 100 x 150 mm (o 4x6 de 101,6 x 152,4 cortava a borda de baixo na Zebra ZD220).
const PAPER = { '4x6': 'Custom.100x150mm', A4: 'A4', a4: 'A4' };

// printer-driver-v2: no Linux os nomes das impressoras do sistema (os mesmos do Windows, ex. "P50 Printer")
// viram filas do CUPS pelo MDV_CUPS_PRINTERS: "P50 Printer=P50:marklife;ZDesigner ZD220-203dpi ZPL=Zebra;Comprovante=Comprovante".
// ":marklife" = converte o PDF para o formato da Marklife P50 e manda raw.
function parsePrinterMap(value = process.env.MDV_CUPS_PRINTERS || '') {
    const map = {};
    for (const part of String(value).split(';').map((p) => p.trim()).filter(Boolean)) {
        const eq = part.lastIndexOf('=');
        if (eq <= 0) continue;
        const [queue, kind = ''] = part.slice(eq + 1).trim().split(':');
        if (queue) map[part.slice(0, eq).trim()] = { queue: queue.trim(), kind: kind.trim() };
    }
    return map;
}

function lpArgs(file, options = {}) {
    const args = [];
    if (options.printer) args.push('-d', String(options.printer));
    const media = options.media || (options.paperSize ? (PAPER[options.paperSize] || String(options.paperSize)) : '');
    if (media) args.push('-o', `media=${media}`);
    if (options.scale === 'fit' || options.scale === 'shrink') args.push('-o', 'fit-to-page');
    else if (options.scale === 'noscale') args.push('-o', 'print-scaling=none');
    // orientation do pdf-to-printer não vale aqui: o PDF já vem no tamanho/posição certos (o -o landscape do CUPS giraria de novo).
    if (options.pages) args.push('-P', String(options.pages));
    if (options.copies) args.push('-n', String(Math.max(1, Number(options.copies) || 1)));
    args.push('--', String(file));
    return args;
}

function parseLpstat(stdout) {
    return String(stdout || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
        .map((name) => ({ deviceId: name, name }));
}

function createPrinterDriver({ platform = process.platform, exec = promisify(execFile), windowsDriver = () => require('pdf-to-printer'), env = process.env, encodeMarklife = null } = {}) {
    if (platform === 'win32') {
        return {
            print: (...args) => windowsDriver().print(...args),
            getPrinters: (...args) => windowsDriver().getPrinters(...args),
            getDefaultPrinter: (...args) => windowsDriver().getDefaultPrinter(...args),
        };
    }
    const map = () => parsePrinterMap(env.MDV_CUPS_PRINTERS || '');
    return {
        async print(file, options = {}) {
            const alvo = map()[options.printer];
            const opts = alvo ? { ...options, printer: alvo.queue } : options;
            if (alvo?.kind === 'marklife') {
                const bytes = await (encodeMarklife || require('./marklife-p50.cjs').encodePdf)(file);
                const raw = `${file}.p50.bin`;
                fs.writeFileSync(raw, bytes);
                try { await exec('lp', ['-d', alvo.queue, '-o', 'raw', '--', raw], { timeout: 60000 }); }
                finally { fs.rmSync(raw, { force: true }); }
                return;
            }
            await exec('lp', lpArgs(file, opts), { timeout: 60000 });
        },
        // nomes iguais aos do Windows para as filas mapeadas; as outras filas do CUPS com o próprio nome
        async getPrinters() {
            const { stdout } = await exec('lpstat', ['-e'], { timeout: 15000 });
            const filas = parseLpstat(stdout).map((p) => p.name);
            const m = map();
            const nomes = Object.entries(m).filter(([, v]) => filas.includes(v.queue)).map(([nome]) => nome);
            const soltas = filas.filter((f) => !Object.values(m).some((v) => v.queue === f));
            return [...nomes, ...soltas].map((name) => ({ deviceId: name, name }));
        },
        async getDefaultPrinter() {
            const { stdout } = await exec('lpstat', ['-d'], { timeout: 15000 }).catch(() => ({ stdout: '' }));
            const name = String(stdout).match(/:\s*(\S+)/)?.[1];
            return name ? { deviceId: name, name } : null;
        },
    };
}

const driver = createPrinterDriver();
module.exports = { ...driver, createPrinterDriver, lpArgs, parseLpstat, parsePrinterMap };
