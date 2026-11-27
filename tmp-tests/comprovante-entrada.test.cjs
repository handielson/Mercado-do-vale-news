// comprovante-entrada-v1: o vigia do Lenovo imprime o que chega do CCE e arquiva.
const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const { processOnce } = require('../scripts/comprovante-entrada.cjs');
test('imprime com papel personalizado e move para impressos; sem .json não mexe', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-'));
  fs.writeFileSync(path.join(dir, 'a.pdf'), '%PDF'); fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify({ file: 'ML-1.pdf', options: { printer: 'Comprovante', media: 'Custom.90x100mm', orientation: 'portrait' } }));
  fs.writeFileSync(path.join(dir, 'b.pdf'), '%PDF');
  const printed = [];
  const n = await processOnce({ dir, print: async (f, o) => printed.push([path.basename(f), o]), prepare: async (p, w, h) => ({ printer: p, paperSize: `MDV ${w}x${h}` }), logger: { log() {}, error() {} } });
  assert.equal(n, 1);
  assert.deepEqual(printed[0], ['a.pdf', { printer: 'Comprovante', paperSize: 'MDV 90x100', orientation: 'portrait' }]);
  assert.ok(fs.existsSync(path.join(dir, 'impressos', 'a.json')) && fs.existsSync(path.join(dir, 'b.pdf')));
  fs.rmSync(dir, { recursive: true, force: true });
});
test('papel falhou: imprime encolhido; erro de impressão conta tentativa', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-'));
  fs.writeFileSync(path.join(dir, 'a.pdf'), '%PDF'); fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify({ options: { printer: 'Comprovante', media: 'Custom.90x80mm' } }));
  const got = [];
  await processOnce({ dir, print: async (f, o) => { got.push(o); throw new Error('spooler'); }, prepare: async () => { throw new Error('sem suporte'); }, logger: { log() {}, error() {}, warn() {} } });
  assert.deepEqual(got[0], { printer: 'Comprovante', scale: 'shrink' });
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'a.json'), 'utf8')).attempts, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});
