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
    assert.deepEqual(calls[0], ['lp', ['-d', 'Zebra', '-o', 'media=Custom.100x150mm', '-o', 'fit-to-page', '--', '/tmp/et.pdf']]);
    assert.deepEqual(await d.getPrinters(), [{ deviceId: 'Zebra', name: 'Zebra' }, { deviceId: 'Epson_P50', name: 'Epson_P50' }]);
});

test('opções do comprovante do ML (tamanho personalizado, sem escala)', () => {
    assert.deepEqual(lpArgs('r.pdf', { printer: 'Epson_P50', media: 'Custom.80x150mm', scale: 'noscale', orientation: 'portrait' }),
        ['-d', 'Epson_P50', '-o', 'media=Custom.80x150mm', '-o', 'print-scaling=none', '--', 'r.pdf']);
    assert.deepEqual(lpArgs('a.pdf', { printer: 'A4', scale: 'shrink' }), ['-d', 'A4', '-o', 'fit-to-page', '--', 'a.pdf']);
    assert.deepEqual(parseLpstat('\n'), []);
});

test('printer-driver-v2: nome do Windows vira fila do CUPS; Marklife vai raw convertida', async () => {
    const calls = [];
    const env = { MDV_CUPS_PRINTERS: 'P50 Printer=P50:marklife;ZDesigner ZD220-203dpi ZPL=Zebra' };
    const exec = async (cmd, args) => { calls.push([cmd, args]); return { stdout: 'Zebra\nP50\nOutra\n' }; };
    const d = createPrinterDriver({ platform: 'linux', exec, env, encodeMarklife: async () => Buffer.from('p50') });
    await d.print('/tmp/x.pdf', { printer: 'ZDesigner ZD220-203dpi ZPL', paperSize: '4x6', scale: 'fit' });
    assert.deepEqual(calls[0], ['lp', ['-d', 'Zebra', '-o', 'media=Custom.100x150mm', '-o', 'fit-to-page', '--', '/tmp/x.pdf']]);
    await d.print('/tmp/y.pdf', { printer: 'P50 Printer', orientation: 'landscape', scale: 'noscale' });
    assert.deepEqual(calls[1], ['lp', ['-d', 'P50', '-o', 'raw', '--', '/tmp/y.pdf.p50.bin']]);
    assert.deepEqual((await d.getPrinters()).map((p) => p.name), ['P50 Printer', 'ZDesigner ZD220-203dpi ZPL', 'Outra']);
});

test('marklife-p50-v1: girada 180° e encostada à direita, com início/fim do driver do Windows', () => {
    const { encodePage, parsePbm } = require('../scripts/marklife-p50.cjs');
    // 16 x 2 pontos: só o primeiro ponto (canto de cima à esquerda) preto
    const pbm = Buffer.concat([Buffer.from('P4\n16 2\n'), Buffer.from([0x80, 0, 0, 0])]);
    const out = encodePage(parsePbm(pbm));
    assert.equal(out.slice(0, 7).toString('hex'), '1f70010a1f1151');
    assert.equal(out.slice(7, 15).toString('hex'), '1d76300030000200');
    const img = out.slice(15, 15 + 96);
    assert.equal(img[48 + 47], 0x01); // vira o último ponto da última linha (canto oposto, lado direito)
    assert.equal(img.reduce((a, b) => a + b, 0), 1);
    assert.equal(out.slice(-5).toString('hex'), '1d0c1f1150');
});

test('printer-driver-v3: impressora adiada guarda o trabalho e imprime quando ganha fila', async () => {
  const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
  const { createPrinterDriver } = require('../scripts/printer-driver.cjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pend-'));
  const pdf = path.join(dir, 'resumo.pdf'); fs.writeFileSync(pdf, '%PDF-1.4 teste');
  const calls = [];
  const env = { MDV_CUPS_PRINTERS: 'ZDesigner ZD220-203dpi ZPL=Zebra', MDV_CUPS_DEFER: 'Comprovante', MDV_PRINT_PENDING_DIR: path.join(dir, 'pend') };
  const exec = async (cmd, args) => { calls.push([cmd, ...args]); return { stdout: cmd === 'lpstat' ? 'Zebra\nP50\n' : '' }; };
  const d = createPrinterDriver({ platform: 'linux', exec, env });
  assert.ok((await d.getPrinters()).some((p) => p.name === 'Comprovante'));
  await d.print(pdf, { printer: 'Comprovante', media: 'Custom.80x120mm' });
  assert.strictEqual(calls.filter((c) => c[0] === 'lp').length, 0);
  assert.strictEqual(fs.readdirSync(env.MDV_PRINT_PENDING_DIR).length, 2);
  env.MDV_CUPS_PRINTERS += ';Comprovante=Recibo';
  await d.getPrinters();
  const lp = calls.filter((c) => c[0] === 'lp');
  assert.strictEqual(lp.length, 1);
  assert.deepStrictEqual(lp[0].slice(1, 5), ['-d', 'Recibo', '-o', 'media=Custom.80x120mm']);
  assert.strictEqual(fs.readdirSync(env.MDV_PRINT_PENDING_DIR).length, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('printer-driver-v4: impressora remota manda PDF e depois o .json por scp; sem conexão guarda e reenvia', async () => {
  const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
  const { createPrinterDriver } = require('../scripts/printer-driver.cjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rem-'));
  const pdf = path.join(dir, 'resumo.pdf'); fs.writeFileSync(pdf, '%PDF-1.4 teste');
  const calls = []; let offline = true;
  const env = { MDV_CUPS_PRINTERS: 'ZDesigner ZD220-203dpi ZPL=Zebra', MDV_REMOTE_PRINTERS: 'Comprovante=Lenovo@192.168.1.30:C:/ProgramData/MercadoDoVale/comprovante-entrada',
    MDV_REMOTE_PRINT_KEY: '/k', MDV_PRINT_PENDING_DIR: path.join(dir, 'pend') };
  const exec = async (cmd, args) => { calls.push([cmd, ...args]); if (cmd === 'scp' && offline) throw new Error('ssh: connect timed out'); return { stdout: cmd === 'lpstat' ? 'Zebra\n' : '' }; };
  const d = createPrinterDriver({ platform: 'linux', exec, env });
  assert.ok((await d.getPrinters()).some((p) => p.name === 'Comprovante'));
  await d.print(pdf, { printer: 'Comprovante', media: 'Custom.90x100mm' });
  assert.strictEqual(fs.readdirSync(env.MDV_PRINT_PENDING_DIR).length, 2);
  offline = false; calls.length = 0;
  await d.getPrinters();
  const scp = calls.filter((c) => c[0] === 'scp');
  assert.strictEqual(scp.length, 2);
  assert.match(scp[0].at(-1), /^Lenovo@192\.168\.1\.30:C:\/ProgramData\/MercadoDoVale\/comprovante-entrada\/.+\.pdf$/);
  assert.match(scp[1].at(-1), /\.json$/);
  assert.ok(scp[0].includes('/k'));
  assert.strictEqual(fs.readdirSync(env.MDV_PRINT_PENDING_DIR).length, 0);
  assert.strictEqual(calls.filter((c) => c[0] === 'lp').length, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});
