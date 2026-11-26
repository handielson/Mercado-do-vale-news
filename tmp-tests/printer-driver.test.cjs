// printer-driver-v1
const test = require('node:test');
const assert = require('node:assert/strict');
const { createPrinterDriver, lpArgs, parseLpstat } = require('../scripts/printer-driver.cjs');

test('Windows continua usando o pdf-to-printer com as mesmas opções', async () => {
    const calls = [];
    const fake = { print: async (...a) => calls.push(a), getPrinters: async () => [{ name: 'ZDesigner' }], getDefaultPrinter: async () => null };
    const d = createPrinterDriver({ platform: 'win32', windowsDriver: () => fake });
    await d.print('x.pdf', { printer: 'ZDesigner', paperSize: '4x6', scale: 'fit' });
    assert.deepEqual(calls, [['x.pdf', { printer: 'ZDesigner', paperSize: '4x6', scale: 'fit' }]]);
    assert.deepEqual(await d.getPrinters(), [{ name: 'ZDesigner' }]);
});

test('Linux manda para o CUPS (lp) com papel 4x6 e ajuste', async () => {
    const calls = [];
    const d = createPrinterDriver({ platform: 'linux', exec: async (cmd, args) => { calls.push([cmd, args]); return { stdout: 'Zebra\nEpson_P50\n' }; } });
    await d.print('/tmp/et.pdf', { printer: 'Zebra', paperSize: '4x6', scale: 'fit' });
    assert.deepEqual(calls[0], ['lp', ['-d', 'Zebra', '-o', 'media=w288h432', '-o', 'fit-to-page', '--', '/tmp/et.pdf']]);
    assert.deepEqual(await d.getPrinters(), [{ deviceId: 'Zebra', name: 'Zebra' }, { deviceId: 'Epson_P50', name: 'Epson_P50' }]);
});

test('opções do comprovante do ML (tamanho personalizado, sem escala)', () => {
    assert.deepEqual(lpArgs('r.pdf', { printer: 'Epson_P50', media: 'Custom.80x150mm', scale: 'noscale', orientation: 'portrait' }),
        ['-d', 'Epson_P50', '-o', 'media=Custom.80x150mm', '-o', 'print-scaling=none', '--', 'r.pdf']);
    assert.deepEqual(lpArgs('a.pdf', { printer: 'A4', scale: 'shrink' }), ['-d', 'A4', '-o', 'fit-to-page', '--', 'a.pdf']);
    assert.deepEqual(parseLpstat('\n'), []);
});
