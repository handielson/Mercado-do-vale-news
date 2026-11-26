'use strict';
// printer-driver-v1: mesma interface do pdf-to-printer (print/getPrinters/getDefaultPrinter).
// Windows (Lenovo da loja): delega ao pdf-to-printer, sem mudar nada.
// Linux (servidor CCE, depois da mudança): manda para o CUPS com lp/lpstat.
const { execFile } = require('child_process');
const { promisify } = require('util');

// Etiqueta de envio: o rolo da loja é 100 x 150 mm (o 4x6 de 101,6 x 152,4 cortava a borda de baixo na Zebra ZD220).
const PAPER = { '4x6': 'Custom.100x150mm', A4: 'A4', a4: 'A4' };

function lpArgs(file, options = {}) {
    const args = [];
    if (options.printer) args.push('-d', String(options.printer));
    const media = options.media || (options.paperSize ? (PAPER[options.paperSize] || String(options.paperSize)) : '');
    if (media) args.push('-o', `media=${media}`);
    if (options.scale === 'fit' || options.scale === 'shrink') args.push('-o', 'fit-to-page');
    else if (options.scale === 'noscale') args.push('-o', 'print-scaling=none');
    if (options.orientation === 'landscape') args.push('-o', 'landscape');
    if (options.pages) args.push('-P', String(options.pages));
    if (options.copies) args.push('-n', String(Math.max(1, Number(options.copies) || 1)));
    args.push('--', String(file));
    return args;
}

function parseLpstat(stdout) {
    return String(stdout || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
        .map((name) => ({ deviceId: name, name }));
}

function createPrinterDriver({ platform = process.platform, exec = promisify(execFile), windowsDriver = () => require('pdf-to-printer') } = {}) {
    if (platform === 'win32') {
        return {
            print: (...args) => windowsDriver().print(...args),
            getPrinters: (...args) => windowsDriver().getPrinters(...args),
            getDefaultPrinter: (...args) => windowsDriver().getDefaultPrinter(...args),
        };
    }
    return {
        async print(file, options = {}) {
            await exec('lp', lpArgs(file, options), { timeout: 60000 });
        },
        async getPrinters() {
            const { stdout } = await exec('lpstat', ['-e'], { timeout: 15000 });
            return parseLpstat(stdout);
        },
        async getDefaultPrinter() {
            const { stdout } = await exec('lpstat', ['-d'], { timeout: 15000 }).catch(() => ({ stdout: '' }));
            const name = String(stdout).match(/:\s*(\S+)/)?.[1];
            return name ? { deviceId: name, name } : null;
        },
    };
}

const driver = createPrinterDriver();
module.exports = { ...driver, createPrinterDriver, lpArgs, parseLpstat };
